import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { and, avg, count, eq, sum } from 'drizzle-orm';
import { db } from '../db';
import {
	users,
	references,
	loans,
	payments,
	conversations,
	managerRuns,
	managerActions
} from '../db/schema';
import { triggerPaymentReminder } from './pipeline';
import { sendText } from '../whatsapp';

const MODEL = 'claude-sonnet-4-6';
const MAX_ITERATIONS = 8;
const MAX_ACTIONS_PER_RUN = 5;
const NUDGE_COOLDOWN_HOURS = 24;
const STUCK_ONBOARDING_HOURS = 24;
const STUCK_VERIFICATION_HOURS = 48;
const STUCK_DECISION_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Sos el manager de GrameenBot, una financiera argentina de microcréditos por WhatsApp.

Cada 30 minutos te despertás, revisás el estado del negocio con get_system_snapshot, y tomás acciones para destrabarlo.

REGLAS DURAS:
- Máximo ${MAX_ACTIONS_PER_RUN} acciones por run (nudges + reminders combinados).
- Nunca mandes más de un nudge al mismo usuario por run.
- Si un user ya fue nudgeado en las últimas ${NUDGE_COOLDOWN_HOURS}h, el snapshot lo marca como "cooldown" — no lo toques.
- Mensajes de nudge: breves (máx 2 oraciones), cálidos, en español rioplatense informal. Nunca menciones que sos un agente automático. Nunca pidas datos sensibles (DNI, CBU, etc.).
- Si no hay nada urgente, mandá una o dos observaciones con note_observation y terminá.

PRIORIDADES (en orden):
1. Préstamos en mora — trigger_collection_reminder para cada uno con last_reminder_at viejo (el snapshot te dice cuáles).
2. Verificación trabada — usuarios en state=verification con refs todas pending/contacted y ≥48h de antigüedad → nudge breve para recordarles que compartan el código REF-XXXX con sus contactos.
3. Onboarding trabado — usuarios en onboarding con ≥24h y onboarding_complete=false → nudge para retomar.
4. Credit decision trabado — usuarios con state=credit_decision y sin loan creado ≥24h → nudge para que acepten o rechacen la oferta.

FORMATO DE SALIDA:
Al terminar, respondé con texto plano (sin markdown pesado): un resumen de 3-5 líneas con qué hiciste y qué no tocaste y por qué. Ese texto se guarda como el summary del run.`;

// ---------------------------------------------------------------------------
// Tool schemas (para Claude)
// ---------------------------------------------------------------------------

const TOOLS: Anthropic.Tool[] = [
	{
		name: 'get_system_snapshot',
		description:
			'Devuelve el pulso actual del negocio: métricas globales y una lista priorizada de alertas accionables (mora, verificación trabada, onboarding trabado, decisión trabada). Llamá esto SIEMPRE primero.',
		input_schema: { type: 'object' as const, properties: {} }
	},
	{
		name: 'send_nudge',
		description:
			'Manda un mensaje de WhatsApp al usuario indicado y marca el timestamp para no spamear. Usá mensajes cortos y amables.',
		input_schema: {
			type: 'object' as const,
			properties: {
				user_id: { type: 'integer' },
				message: { type: 'string', description: 'Texto corto, máx 2 oraciones' },
				reason: {
					type: 'string',
					description: 'Etiqueta de por qué lo nudgeás (ej "stuck_onboarding", "stuck_verification")'
				}
			},
			required: ['user_id', 'message', 'reason']
		}
	},
	{
		name: 'trigger_collection_reminder',
		description:
			'Dispara el recordatorio de cobranza al deudor de un préstamo vencido. Usa el mismo motor que el cron diario.',
		input_schema: {
			type: 'object' as const,
			properties: {
				loan_id: { type: 'integer' }
			},
			required: ['loan_id']
		}
	},
	{
		name: 'note_observation',
		description:
			'Registra una observación para el log del run sin tomar ninguna acción externa. Usá esto cuando veas algo interesante pero no querés actuar.',
		input_schema: {
			type: 'object' as const,
			properties: {
				text: { type: 'string' }
			},
			required: ['text']
		}
	}
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

interface HandlerCtx {
	runId: number;
	actionsTaken: number;
	nudgedInThisRun: Set<number>;
}

async function getSnapshot(ctx: HandlerCtx) {
	const now = new Date();

	// Métricas
	const [usersTotal] = await db.select({ c: count() }).from(users);
	const [usersOnboarded] = await db
		.select({ c: count() })
		.from(users)
		.where(eq(users.onboardingComplete, true));
	const [loansActive] = await db
		.select({ c: count() })
		.from(loans)
		.where(eq(loans.status, 'active'));
	const [loansOverdue] = await db
		.select({ c: count() })
		.from(loans)
		.where(eq(loans.status, 'overdue'));
	const [loansPaid] = await db.select({ c: count() }).from(loans).where(eq(loans.status, 'paid'));
	const [totalLent] = await db.select({ v: sum(loans.amount) }).from(loans);
	const [totalCollected] = await db
		.select({ v: sum(payments.amount) })
		.from(payments)
		.where(eq(payments.status, 'approved'));
	const [avgTrust] = await db.select({ v: avg(users.trustScore) }).from(users);

	const activePlusOverdue = loansActive.c + loansOverdue.c;
	const defaultRate = activePlusOverdue > 0 ? loansOverdue.c / activePlusOverdue : 0;

	// Alertas
	const alerts: Array<{
		kind: string;
		priority: number;
		user_id?: number;
		loan_id?: number;
		borrower?: string;
		phone?: string;
		detail: string;
		cooldown?: boolean;
	}> = [];

	// 1. Préstamos en mora
	const overdueLoans = await db
		.select({
			loan: loans,
			user: users
		})
		.from(loans)
		.leftJoin(users, eq(users.id, loans.userId))
		.where(eq(loans.status, 'overdue'));

	for (const { loan, user } of overdueLoans) {
		const daysOverdue = loan.nextDueDate
			? Math.round((now.getTime() - loan.nextDueDate.getTime()) / (24 * HOUR_MS))
			: 0;
		const lastReminderHours = loan.lastReminderAt
			? Math.round((now.getTime() - loan.lastReminderAt.getTime()) / HOUR_MS)
			: Infinity;
		alerts.push({
			kind: 'overdue_loan',
			priority: 1,
			loan_id: loan.id,
			user_id: loan.userId,
			borrower: user?.name ?? user?.phone ?? `user#${loan.userId}`,
			phone: user?.phone,
			detail: `Cuota de $${Math.round(loan.installmentAmount / 100)}, ${daysOverdue}d de mora, último recordatorio hace ${lastReminderHours === Infinity ? '∞' : lastReminderHours}h`
		});
	}

	// 2. Trabados por estado de conversación
	const convos = await db
		.select({
			conv: conversations,
			user: users
		})
		.from(conversations)
		.innerJoin(
			users,
			and(eq(users.id, conversations.userId), eq(users.phone, conversations.phone))
		);

	const cooldownThreshold = new Date(now.getTime() - NUDGE_COOLDOWN_HOURS * HOUR_MS);

	for (const { conv, user } of convos) {
		const hoursSinceUpdate = Math.round((now.getTime() - conv.updatedAt.getTime()) / HOUR_MS);
		const cooldown = !!(user.lastNudgedAt && user.lastNudgedAt > cooldownThreshold);

		if (conv.state === 'onboarding' && hoursSinceUpdate >= STUCK_ONBOARDING_HOURS && !user.onboardingComplete) {
			alerts.push({
				kind: 'stuck_onboarding',
				priority: 3,
				user_id: user.id,
				borrower: user.name ?? user.phone,
				phone: user.phone,
				detail: `Empezó onboarding hace ${hoursSinceUpdate}h y no completó datos`,
				cooldown
			});
		} else if (
			conv.state === 'verification' &&
			hoursSinceUpdate >= STUCK_VERIFICATION_HOURS
		) {
			const refs = await db.select().from(references).where(eq(references.userId, user.id));
			const responded = refs.filter((r) => r.status === 'responded').length;
			if (responded < 3) {
				alerts.push({
					kind: 'stuck_verification',
					priority: 2,
					user_id: user.id,
					borrower: user.name ?? user.phone,
					phone: user.phone,
					detail: `En verificación hace ${hoursSinceUpdate}h, sólo ${responded}/${refs.length} refs respondieron`,
					cooldown
				});
			}
		} else if (conv.state === 'credit_decision' && hoursSinceUpdate >= STUCK_DECISION_HOURS) {
			const [activeLoan] = await db
				.select()
				.from(loans)
				.where(eq(loans.userId, user.id))
				.limit(1);
			if (!activeLoan) {
				alerts.push({
					kind: 'stuck_decision',
					priority: 4,
					user_id: user.id,
					borrower: user.name ?? user.phone,
					phone: user.phone,
					detail: `Oferta pendiente de aceptación hace ${hoursSinceUpdate}h`,
					cooldown
				});
			}
		}
	}

	// Ordenar alertas por prioridad
	alerts.sort((a, b) => a.priority - b.priority);

	// Log la snapshot como acción
	await db.insert(managerActions).values({
		runId: ctx.runId,
		kind: 'snapshot',
		summary: `Snapshot: ${usersTotal.c} users, ${loansActive.c + loansOverdue.c} préstamos vivos, ${alerts.length} alertas`,
		payload: {
			metrics: {
				users_total: usersTotal.c,
				users_onboarded: usersOnboarded.c,
				loans_active: loansActive.c,
				loans_overdue: loansOverdue.c,
				loans_paid: loansPaid.c,
				lent_pesos: Math.round(Number(totalLent?.v ?? 0) / 100),
				collected_pesos: Math.round(Number(totalCollected?.v ?? 0) / 100),
				default_rate: defaultRate,
				trust_score_avg: avgTrust?.v ? Math.round(Number(avgTrust.v)) : null
			},
			alerts_count: alerts.length
		}
	});

	return {
		now: now.toISOString(),
		metrics: {
			users_total: usersTotal.c,
			users_onboarded: usersOnboarded.c,
			loans_active: loansActive.c,
			loans_overdue: loansOverdue.c,
			loans_paid: loansPaid.c,
			lent_pesos: Math.round(Number(totalLent?.v ?? 0) / 100),
			collected_pesos: Math.round(Number(totalCollected?.v ?? 0) / 100),
			default_rate: defaultRate,
			trust_score_avg: avgTrust?.v ? Math.round(Number(avgTrust.v)) : null
		},
		alerts,
		limits: {
			actions_remaining: MAX_ACTIONS_PER_RUN - ctx.actionsTaken,
			nudge_cooldown_hours: NUDGE_COOLDOWN_HOURS
		}
	};
}

async function sendNudge(
	ctx: HandlerCtx,
	input: { user_id: number; message: string; reason: string }
) {
	if (ctx.actionsTaken >= MAX_ACTIONS_PER_RUN) {
		return { error: 'Se alcanzó el máximo de acciones por run' };
	}
	if (ctx.nudgedInThisRun.has(input.user_id)) {
		return { error: 'Ya nudgeaste a este usuario en este run' };
	}

	const [user] = await db.select().from(users).where(eq(users.id, input.user_id)).limit(1);
	if (!user) return { error: 'Usuario no encontrado' };

	const cooldownThreshold = new Date(Date.now() - NUDGE_COOLDOWN_HOURS * HOUR_MS);
	if (user.lastNudgedAt && user.lastNudgedAt > cooldownThreshold) {
		return { error: 'Usuario todavía está en cooldown de nudge' };
	}

	let sent = false;
	try {
		await sendText(user.phone, input.message);
		sent = true;
	} catch (err) {
		console.error('[manager] sendText failed', err);
	}

	await db.update(users).set({ lastNudgedAt: new Date() }).where(eq(users.id, user.id));
	await db.insert(managerActions).values({
		runId: ctx.runId,
		kind: 'nudge',
		targetUserId: user.id,
		summary: `Nudge (${input.reason}) a ${user.name ?? user.phone}${sent ? '' : ' — WA falló'}`,
		payload: { message: input.message, reason: input.reason, sent }
	});

	ctx.actionsTaken++;
	ctx.nudgedInThisRun.add(user.id);
	return { ok: true, sent, phone: user.phone };
}

async function triggerCollectionReminder(ctx: HandlerCtx, input: { loan_id: number }) {
	if (ctx.actionsTaken >= MAX_ACTIONS_PER_RUN) {
		return { error: 'Se alcanzó el máximo de acciones por run' };
	}

	const [loan] = await db.select().from(loans).where(eq(loans.id, input.loan_id)).limit(1);
	if (!loan) return { error: 'Préstamo no encontrado' };
	const [user] = await db.select().from(users).where(eq(users.id, loan.userId)).limit(1);
	if (!user) return { error: 'Deudor no encontrado' };

	const now = new Date();
	const daysUntilDue = loan.nextDueDate
		? Math.round((loan.nextDueDate.getTime() - now.getTime()) / (24 * HOUR_MS))
		: -1;

	let sent = false;
	try {
		await triggerPaymentReminder(user.phone, user.name ?? 'amigo', {
			installmentNumber: loan.installmentsPaid + 1,
			totalInstallments: loan.totalInstallments,
			amount: Math.round(loan.installmentAmount / 100),
			dueDate: loan.nextDueDate?.toISOString().slice(0, 10) ?? 'hoy',
			daysUntilDue
		});
		sent = true;
		await db.update(loans).set({ lastReminderAt: now }).where(eq(loans.id, loan.id));
	} catch (err) {
		console.error('[manager] triggerPaymentReminder failed', err);
	}

	await db.insert(managerActions).values({
		runId: ctx.runId,
		kind: 'reminder',
		targetLoanId: loan.id,
		targetUserId: user.id,
		summary: `Recordatorio de cobranza a ${user.name ?? user.phone} (loan #${loan.id})${sent ? '' : ' — WA falló'}`,
		payload: { daysUntilDue, sent }
	});

	ctx.actionsTaken++;
	return { ok: true, sent };
}

async function noteObservation(ctx: HandlerCtx, input: { text: string }) {
	await db.insert(managerActions).values({
		runId: ctx.runId,
		kind: 'observation',
		summary: input.text.slice(0, 200)
	});
	return { ok: true };
}

async function handleTool(
	name: string,
	input: Record<string, unknown>,
	ctx: HandlerCtx
): Promise<unknown> {
	switch (name) {
		case 'get_system_snapshot':
			return getSnapshot(ctx);
		case 'send_nudge':
			return sendNudge(ctx, input as { user_id: number; message: string; reason: string });
		case 'trigger_collection_reminder':
			return triggerCollectionReminder(ctx, input as { loan_id: number });
		case 'note_observation':
			return noteObservation(ctx, input as { text: string });
		default:
			return { error: `Tool desconocida: ${name}` };
	}
}

// ---------------------------------------------------------------------------
// Entry point: runManager
// ---------------------------------------------------------------------------

export interface ManagerRunResult {
	runId: number;
	summary: string;
	actionsTaken: number;
	iterations: number;
}

export async function runManager(trigger: 'cron' | 'manual' = 'cron'): Promise<ManagerRunResult> {
	const [run] = await db.insert(managerRuns).values({ trigger }).returning();

	const ctx: HandlerCtx = {
		runId: run.id,
		actionsTaken: 0,
		nudgedInThisRun: new Set()
	};

	const messages: Anthropic.MessageParam[] = [
		{
			role: 'user',
			content: `Son las ${new Date().toISOString()}. Revisá el estado de la financiera y tomá las acciones que correspondan.`
		}
	];

	let iterations = 0;
	let summary = '(sin resumen — el agente no terminó con texto)';

	for (let i = 0; i < MAX_ITERATIONS; i++) {
		iterations++;
		const res = await client.messages.create({
			model: MODEL,
			max_tokens: 2048,
			system: [
				{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }
			],
			tools: TOOLS,
			messages
		});
		messages.push({ role: 'assistant', content: res.content });

		if (res.stop_reason !== 'tool_use') {
			const text = res.content
				.filter((b): b is Anthropic.TextBlock => b.type === 'text')
				.map((b) => b.text)
				.join('\n')
				.trim();
			if (text) summary = text;
			break;
		}

		const toolResults: Anthropic.ToolResultBlockParam[] = [];
		for (const block of res.content) {
			if (block.type !== 'tool_use') continue;
			const out = await handleTool(block.name, block.input as Record<string, unknown>, ctx);
			toolResults.push({
				type: 'tool_result',
				tool_use_id: block.id,
				content: JSON.stringify(out)
			});
		}
		messages.push({ role: 'user', content: toolResults });
	}

	await db
		.update(managerRuns)
		.set({
			summary,
			transcript: messages,
			actionsCount: ctx.actionsTaken,
			endedAt: new Date()
		})
		.where(eq(managerRuns.id, run.id));

	return { runId: run.id, summary, actionsTaken: ctx.actionsTaken, iterations };
}
