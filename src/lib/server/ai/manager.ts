import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { and, avg, count, desc, eq, ilike, or, sum } from 'drizzle-orm';
import { db } from '../db';
import {
	users,
	references,
	loans,
	payments,
	conversations,
	managerRuns,
	managerActions,
	managerChats
} from '../db/schema';
import { triggerPaymentReminder } from './pipeline';
import { sendText } from '../whatsapp';

const MODEL = 'claude-sonnet-4-6';
const MAX_ITERATIONS = 8;
const MAX_AUTOPILOT_ACTIONS = 5;
const NUDGE_COOLDOWN_HOURS = 24;
const STUCK_ONBOARDING_HOURS = 24;
const STUCK_VERIFICATION_HOURS = 48;
const STUCK_DECISION_HOURS = 24;
const CHAT_HISTORY_LIMIT = 40;

const HOUR_MS = 60 * 60 * 1000;

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const AUTOPILOT_PROMPT = `Sos el manager de GrameenBot, una financiera argentina de microcréditos por WhatsApp.

Cada 30 minutos te despertás, revisás el estado del negocio con get_system_snapshot, y tomás acciones para destrabarlo.

REGLAS DURAS:
- Máximo ${MAX_AUTOPILOT_ACTIONS} acciones por run (nudges + reminders combinados).
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

const CHAT_PROMPT = `Sos el manager de GrameenBot, una financiera argentina de microcréditos por WhatsApp. Estás hablando con el operador (el dueño) por la consola interna de administración.

TU ROL:
- Asistente operativo: respondés preguntas sobre el estado del negocio, buscás detalles de usuarios / préstamos / referencias, y tomás acciones cuando te las piden (nudgeos, recordatorios, mensajes custom).
- Sos conciso, directo, en español rioplatense informal. Nunca uses emojis ni formato recargado — es un panel de trabajo, no un chat con cliente.

REGLAS:
- NUNCA inventes datos. Siempre usá los tools para leer — get_system_snapshot para overview, lookup_user / lookup_loan / search_users para detalles.
- Antes de mandar un mensaje a un usuario (send_custom_message), reconfirma muy brevemente qué vas a mandar y a quién, en la misma respuesta. No pedís permiso dos veces.
- Si el operador es ambiguo, pregunta 1 cosa específica y esperás. No hagas suposiciones.
- Si no hace falta ningún tool, respondé directo.

Al terminar cada turno, devolvé texto plano: eso es lo que ve el operador en la consola.`;

// ---------------------------------------------------------------------------
// Tool schemas
// ---------------------------------------------------------------------------

const AUTOPILOT_TOOLS: Anthropic.Tool[] = [
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
			properties: { text: { type: 'string' } },
			required: ['text']
		}
	}
];

const CHAT_TOOLS: Anthropic.Tool[] = [
	{
		name: 'get_system_snapshot',
		description: 'Métricas globales + lista de alertas accionables. Usá para dar el pulso del negocio.',
		input_schema: { type: 'object' as const, properties: {} }
	},
	{
		name: 'lookup_user',
		description:
			'Trae info detallada de un usuario: perfil, conversación, referencias, préstamos y pagos.',
		input_schema: {
			type: 'object' as const,
			properties: { user_id: { type: 'integer' } },
			required: ['user_id']
		}
	},
	{
		name: 'lookup_loan',
		description: 'Trae info completa de un préstamo: deudor, estado, pagos.',
		input_schema: {
			type: 'object' as const,
			properties: { loan_id: { type: 'integer' } },
			required: ['loan_id']
		}
	},
	{
		name: 'search_users',
		description:
			'Busca usuarios por nombre (substring case-insensitive) o teléfono. Devuelve hasta 10 matches.',
		input_schema: {
			type: 'object' as const,
			properties: { query: { type: 'string' } },
			required: ['query']
		}
	},
	{
		name: 'send_custom_message',
		description:
			'Manda un mensaje de WhatsApp al usuario indicado (sin cooldown). Usar sólo cuando el operador lo pide explícitamente.',
		input_schema: {
			type: 'object' as const,
			properties: {
				user_id: { type: 'integer' },
				message: { type: 'string' }
			},
			required: ['user_id', 'message']
		}
	},
	{
		name: 'trigger_collection_reminder',
		description: 'Dispara el recordatorio de cobranza al deudor del préstamo.',
		input_schema: {
			type: 'object' as const,
			properties: { loan_id: { type: 'integer' } },
			required: ['loan_id']
		}
	}
];

// ---------------------------------------------------------------------------
// Handler context + helpers
// ---------------------------------------------------------------------------

interface HandlerCtx {
	runId: number;
	actionsTaken: number;
	nudgedInThisRun: Set<number>;
	enforceLimits: boolean; // true en autopilot, false en chat
}

async function getSnapshot(ctx: HandlerCtx) {
	const now = new Date();

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

	const overdueLoans = await db
		.select({ loan: loans, user: users })
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

	const convos = await db
		.select({ conv: conversations, user: users })
		.from(conversations)
		.innerJoin(
			users,
			and(eq(users.id, conversations.userId), eq(users.phone, conversations.phone))
		);

	const cooldownThreshold = new Date(now.getTime() - NUDGE_COOLDOWN_HOURS * HOUR_MS);

	for (const { conv, user } of convos) {
		const hoursSinceUpdate = Math.round((now.getTime() - conv.updatedAt.getTime()) / HOUR_MS);
		const cooldown = !!(user.lastNudgedAt && user.lastNudgedAt > cooldownThreshold);

		if (
			conv.state === 'onboarding' &&
			hoursSinceUpdate >= STUCK_ONBOARDING_HOURS &&
			!user.onboardingComplete
		) {
			alerts.push({
				kind: 'stuck_onboarding',
				priority: 3,
				user_id: user.id,
				borrower: user.name ?? user.phone,
				phone: user.phone,
				detail: `Empezó onboarding hace ${hoursSinceUpdate}h y no completó datos`,
				cooldown
			});
		} else if (conv.state === 'verification' && hoursSinceUpdate >= STUCK_VERIFICATION_HOURS) {
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

	alerts.sort((a, b) => a.priority - b.priority);

	const metrics = {
		users_total: usersTotal.c,
		users_onboarded: usersOnboarded.c,
		loans_active: loansActive.c,
		loans_overdue: loansOverdue.c,
		loans_paid: loansPaid.c,
		lent_pesos: Math.round(Number(totalLent?.v ?? 0) / 100),
		collected_pesos: Math.round(Number(totalCollected?.v ?? 0) / 100),
		default_rate: defaultRate,
		trust_score_avg: avgTrust?.v ? Math.round(Number(avgTrust.v)) : null
	};

	await db.insert(managerActions).values({
		runId: ctx.runId,
		kind: 'snapshot',
		summary: `Snapshot: ${usersTotal.c} users, ${loansActive.c + loansOverdue.c} préstamos vivos, ${alerts.length} alertas`,
		payload: { metrics, alerts_count: alerts.length }
	});

	return {
		now: now.toISOString(),
		metrics,
		alerts,
		limits: {
			actions_remaining: ctx.enforceLimits ? MAX_AUTOPILOT_ACTIONS - ctx.actionsTaken : null,
			nudge_cooldown_hours: NUDGE_COOLDOWN_HOURS
		}
	};
}

async function sendNudge(
	ctx: HandlerCtx,
	input: { user_id: number; message: string; reason: string }
) {
	if (ctx.enforceLimits && ctx.actionsTaken >= MAX_AUTOPILOT_ACTIONS) {
		return { error: 'Se alcanzó el máximo de acciones por run' };
	}
	if (ctx.nudgedInThisRun.has(input.user_id)) {
		return { error: 'Ya nudgeaste a este usuario en este run' };
	}

	const [user] = await db.select().from(users).where(eq(users.id, input.user_id)).limit(1);
	if (!user) return { error: 'Usuario no encontrado' };

	if (ctx.enforceLimits) {
		const cooldownThreshold = new Date(Date.now() - NUDGE_COOLDOWN_HOURS * HOUR_MS);
		if (user.lastNudgedAt && user.lastNudgedAt > cooldownThreshold) {
			return { error: 'Usuario todavía está en cooldown de nudge' };
		}
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

async function sendCustomMessage(ctx: HandlerCtx, input: { user_id: number; message: string }) {
	const [user] = await db.select().from(users).where(eq(users.id, input.user_id)).limit(1);
	if (!user) return { error: 'Usuario no encontrado' };

	let sent = false;
	try {
		await sendText(user.phone, input.message);
		sent = true;
	} catch (err) {
		console.error('[manager] sendText failed', err);
	}

	await db.insert(managerActions).values({
		runId: ctx.runId,
		kind: 'nudge',
		targetUserId: user.id,
		summary: `Mensaje custom a ${user.name ?? user.phone}${sent ? '' : ' — WA falló'}`,
		payload: { message: input.message, sent, source: 'chat' }
	});

	ctx.actionsTaken++;
	return { ok: true, sent, phone: user.phone };
}

async function triggerCollectionReminder(ctx: HandlerCtx, input: { loan_id: number }) {
	if (ctx.enforceLimits && ctx.actionsTaken >= MAX_AUTOPILOT_ACTIONS) {
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

async function lookupUser(input: { user_id: number }) {
	const [user] = await db.select().from(users).where(eq(users.id, input.user_id)).limit(1);
	if (!user) return { error: 'Usuario no encontrado' };

	const [convo] = await db
		.select()
		.from(conversations)
		.where(and(eq(conversations.userId, user.id), eq(conversations.phone, user.phone)))
		.limit(1);

	const refs = await db.select().from(references).where(eq(references.userId, user.id));

	const userLoans = await db
		.select()
		.from(loans)
		.where(eq(loans.userId, user.id))
		.orderBy(desc(loans.createdAt));

	const userPayments = userLoans.length
		? await db
				.select()
				.from(payments)
				.orderBy(desc(payments.createdAt))
				.then((ps) => ps.filter((p) => userLoans.some((l) => l.id === p.loanId)))
		: [];

	return {
		user: {
			id: user.id,
			phone: user.phone,
			name: user.name,
			dni: user.dni,
			monthly_income: user.monthlyIncome,
			occupation: user.occupation,
			onboarding_complete: user.onboardingComplete,
			trust_score: user.trustScore,
			last_nudged_at: user.lastNudgedAt,
			created_at: user.createdAt
		},
		conversation: convo
			? {
					state: convo.state,
					updated_at: convo.updatedAt,
					message_count: Array.isArray(convo.messages)
						? (convo.messages as unknown[]).length
						: 0
				}
			: null,
		references: refs.map((r) => ({
			id: r.id,
			name: r.name,
			phone: r.phone,
			relationship: r.relationship,
			reference_code: r.referenceCode,
			status: r.status,
			score: r.score,
			responses: r.responses
		})),
		loans: userLoans.map((l) => ({
			id: l.id,
			amount_pesos: Math.round(l.amount / 100),
			installment_pesos: Math.round(l.installmentAmount / 100),
			installments_paid: l.installmentsPaid,
			total_installments: l.totalInstallments,
			status: l.status,
			next_due_date: l.nextDueDate,
			last_reminder_at: l.lastReminderAt
		})),
		payments: userPayments.map((p) => ({
			id: p.id,
			loan_id: p.loanId,
			amount_pesos: Math.round(p.amount / 100),
			status: p.status,
			created_at: p.createdAt
		}))
	};
}

async function lookupLoan(input: { loan_id: number }) {
	const [loan] = await db.select().from(loans).where(eq(loans.id, input.loan_id)).limit(1);
	if (!loan) return { error: 'Préstamo no encontrado' };
	const [borrower] = await db.select().from(users).where(eq(users.id, loan.userId)).limit(1);
	const loanPayments = await db
		.select()
		.from(payments)
		.where(eq(payments.loanId, loan.id))
		.orderBy(desc(payments.createdAt));

	return {
		loan: {
			id: loan.id,
			amount_pesos: Math.round(loan.amount / 100),
			installment_pesos: Math.round(loan.installmentAmount / 100),
			installments_paid: loan.installmentsPaid,
			total_installments: loan.totalInstallments,
			interest_rate_bps: loan.interestRate,
			status: loan.status,
			next_due_date: loan.nextDueDate,
			last_reminder_at: loan.lastReminderAt,
			terms: loan.terms
		},
		borrower: borrower
			? {
					id: borrower.id,
					name: borrower.name,
					phone: borrower.phone,
					trust_score: borrower.trustScore
				}
			: null,
		payments: loanPayments.map((p) => ({
			id: p.id,
			amount_pesos: Math.round(p.amount / 100),
			status: p.status,
			mp_preference_id: p.mpPreferenceId,
			mp_payment_id: p.mpPaymentId,
			created_at: p.createdAt
		}))
	};
}

async function searchUsers(input: { query: string }) {
	const q = input.query.trim();
	if (!q) return { error: 'Query vacía' };
	const pattern = `%${q}%`;
	const rows = await db
		.select({
			id: users.id,
			name: users.name,
			phone: users.phone,
			trust_score: users.trustScore,
			onboarding_complete: users.onboardingComplete,
			created_at: users.createdAt
		})
		.from(users)
		.where(or(ilike(users.name, pattern), ilike(users.phone, pattern)))
		.orderBy(desc(users.createdAt))
		.limit(10);
	return { matches: rows };
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
		case 'lookup_user':
			return lookupUser(input as { user_id: number });
		case 'lookup_loan':
			return lookupLoan(input as { loan_id: number });
		case 'search_users':
			return searchUsers(input as { query: string });
		case 'send_custom_message':
			return sendCustomMessage(ctx, input as { user_id: number; message: string });
		default:
			return { error: `Tool desconocida: ${name}` };
	}
}

// ---------------------------------------------------------------------------
// Core loop
// ---------------------------------------------------------------------------

async function runLoop(
	ctx: HandlerCtx,
	systemPrompt: string,
	messages: Anthropic.MessageParam[],
	tools: Anthropic.Tool[]
): Promise<{ reply: string; messages: Anthropic.MessageParam[] }> {
	let reply = '';
	for (let i = 0; i < MAX_ITERATIONS; i++) {
		const res = await client.messages.create({
			model: MODEL,
			max_tokens: 2048,
			system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
			tools,
			messages
		});
		messages.push({ role: 'assistant', content: res.content });

		if (res.stop_reason !== 'tool_use') {
			reply = res.content
				.filter((b): b is Anthropic.TextBlock => b.type === 'text')
				.map((b) => b.text)
				.join('\n')
				.trim();
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
	return { reply, messages };
}

// ---------------------------------------------------------------------------
// Public entry points
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
		nudgedInThisRun: new Set(),
		enforceLimits: true
	};
	const messages: Anthropic.MessageParam[] = [
		{
			role: 'user',
			content: `Son las ${new Date().toISOString()}. Revisá el estado de la financiera y tomá las acciones que correspondan.`
		}
	];

	const { reply, messages: updated } = await runLoop(
		ctx,
		AUTOPILOT_PROMPT,
		messages,
		AUTOPILOT_TOOLS
	);

	await db
		.update(managerRuns)
		.set({
			summary: reply || '(sin resumen)',
			transcript: updated,
			actionsCount: ctx.actionsTaken,
			endedAt: new Date()
		})
		.where(eq(managerRuns.id, run.id));

	return {
		runId: run.id,
		summary: reply || '(sin resumen)',
		actionsTaken: ctx.actionsTaken,
		iterations: updated.length - 1
	};
}

export interface ManagerChatResult {
	runId: number;
	reply: string;
	messages: Anthropic.MessageParam[];
}

async function loadOrCreateChat() {
	const [chat] = await db.select().from(managerChats).limit(1);
	if (chat) return chat;
	const [fresh] = await db
		.insert(managerChats)
		.values({ messages: [], updatedAt: new Date() })
		.returning();
	return fresh;
}

export async function runManagerChat(userMessage: string): Promise<ManagerChatResult> {
	const chat = await loadOrCreateChat();
	const [run] = await db.insert(managerRuns).values({ trigger: 'chat' }).returning();

	const ctx: HandlerCtx = {
		runId: run.id,
		actionsTaken: 0,
		nudgedInThisRun: new Set(),
		enforceLimits: false
	};

	// Trim history to the last N messages to keep context bounded
	const prior = (chat.messages as Anthropic.MessageParam[]) ?? [];
	const trimmed = prior.slice(-CHAT_HISTORY_LIMIT);
	const messages: Anthropic.MessageParam[] = [
		...trimmed,
		{ role: 'user', content: userMessage }
	];

	const { reply, messages: updated } = await runLoop(ctx, CHAT_PROMPT, messages, CHAT_TOOLS);

	// Persist the chat (full transcript)
	await db
		.update(managerChats)
		.set({ messages: updated, updatedAt: new Date() })
		.where(eq(managerChats.id, chat.id));

	// Log the run
	await db
		.update(managerRuns)
		.set({
			summary: reply || '(sin respuesta)',
			transcript: updated,
			actionsCount: ctx.actionsTaken,
			endedAt: new Date()
		})
		.where(eq(managerRuns.id, run.id));

	return { runId: run.id, reply, messages: updated };
}

export async function resetManagerChat(): Promise<void> {
	const chat = await loadOrCreateChat();
	await db
		.update(managerChats)
		.set({ messages: [], updatedAt: new Date() })
		.where(eq(managerChats.id, chat.id));
}

export async function loadManagerChat(): Promise<Anthropic.MessageParam[]> {
	const chat = await loadOrCreateChat();
	return (chat.messages as Anthropic.MessageParam[]) ?? [];
}
