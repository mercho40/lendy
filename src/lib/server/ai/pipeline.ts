/**
 * Pipeline orchestrator — chains the agent flow:
 *
 * 1. Onboarding (conversational, reactive)
 *    ↓ submit_references triggers:
 * 2. [Hook] ElevenLabs voice call (optional, for demo wow factor)
 *    ↓ then:
 * 3. Verification × 3 references (parallel, proactive)
 *    ↓ all responded triggers:
 * 4. [Hook] Credit decision (single API call, structured output)
 *    ↓ approved triggers:
 * 5. [Hook] Loan creation + payment loop (reactive + cron reminders)
 */

import { eq } from 'drizzle-orm';
import { sendText } from '../whatsapp';
import { evaluateCredit } from './handlers/credit-decision';
import { db } from '../db';
import { conversations, loans } from '../db/schema';

const ELEVENLABS_AGENT_ID = 'agent_7601kp6cks47ehat26gjm20y2p86';

/**
 * Called after onboarding profile is saved, before references.
 * Sends a voice verification link via WhatsApp.
 */
export async function triggerVoiceVerification(
	userId: number,
	userName: string,
	userPhone: string,
	baseUrl: string
): Promise<void> {
	const voiceUrl = `${baseUrl}/voice?user=${userId}&name=${encodeURIComponent(userName)}`;

	await sendText(
		userPhone,
		`Genial ${userName}! Para avanzar con tu solicitud, necesitamos una verificación rápida por voz.\n\n` +
			`🎙️ Tocá este link y hablá con nuestro asistente (menos de 2 min):\n${voiceUrl}\n\n` +
			`Cuando termines, seguimos acá por WhatsApp.`
	);
}

/**
 * Generates a unique reference code in REF-XXXX format.
 */
export function generateReferenceCode(): string {
	const chars = crypto.randomUUID().replace(/-/g, '').toUpperCase();
	return `REF-${chars.slice(0, 4)}`;
}

// triggerVerification removed — references now write to the bot first using their REF-XXXX code.

/**
 * Called when all references have responded.
 * Runs credit decision and notifies the user.
 */
export async function triggerCreditDecision(
	userId: number,
	userPhone: string,
	userData: {
		name: string;
		monthlyIncome: number;
		occupation: string;
		trustScore: number;
		referencesSummary: string;
	}
): Promise<void> {
	const decision = await evaluateCredit(userId, userData);

	if (decision.approved) {
		const montoFmt = decision.amount.toLocaleString('es-AR');
		const cuotaFmt = Math.round(decision.weeklyPayment).toLocaleString('es-AR');

		// Create the loan in DB
		const amountCents = Math.round(decision.amount * 100);
		const installmentCents = Math.round(decision.weeklyPayment * 100);
		const nextDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

		await db.insert(loans).values({
			userId,
			amount: amountCents,
			totalInstallments: decision.weeks,
			installmentsPaid: 0,
			installmentAmount: installmentCents,
			interestRate: decision.tna * 100, // basis points
			status: 'active',
			nextDueDate: nextDue,
			terms: decision
		});

		// Update conversation state to active_loan
		await db
			.update(conversations)
			.set({ state: 'active_loan' })
			.where(eq(conversations.userId, userId));

		await sendText(
			userPhone,
			`¡Buenas noticias, ${userData.name}! Tu crédito fue aprobado.\n\n` +
				`💰 Monto: $${montoFmt}\n` +
				`📅 ${decision.weeks} cuotas semanales de $${cuotaFmt}\n\n` +
				`El dinero se va a acreditar en tu cuenta en las próximas horas. Te aviso cuando esté listo.`
		);

		// Simulate disbursement after a short delay
		setTimeout(async () => {
			try {
				await sendText(
					userPhone,
					`✅ ¡Listo! Se acreditaron $${montoFmt} en tu cuenta.\n\n` +
						`Tu primera cuota de $${cuotaFmt} vence el ${nextDue.toLocaleDateString('es-AR')}.\n` +
						`Cuando quieras pagar escribime "pagar" y te mando el link.`
				);
			} catch { /* ignore */ }
		}, 5000); // 5 seconds for demo effect
	} else {
		await sendText(
			userPhone,
			`Hola ${userData.name}. Lamentablemente no podemos ofrecerte un crédito en este momento.\n\n` +
				`Motivo: ${decision.reason}\n\n` +
				`Podés volver a intentar en 30 días.`
		);
	}
}

/**
 * Called by cron or when a payment is due.
 * Sends reminder to the user.
 */
export async function triggerPaymentReminder(
	userPhone: string,
	userName: string,
	loanData: {
		installmentNumber: number;
		totalInstallments: number;
		amount: number;
		dueDate: string;
		daysUntilDue: number;
	}
): Promise<void> {
	let message: string;

	if (loanData.daysUntilDue > 0) {
		// Pre-due reminder
		message =
			`Hola ${userName}! Te recuerdo que tu cuota ${loanData.installmentNumber}/${loanData.totalInstallments} ` +
			`de $${loanData.amount} vence el ${loanData.dueDate}. ` +
			`Escribime "pagar" y te mando el link.`;
	} else if (loanData.daysUntilDue === 0) {
		// Due today
		message =
			`${userName}, hoy vence tu cuota ${loanData.installmentNumber}/${loanData.totalInstallments} ` +
			`de $${loanData.amount}. Escribime "pagar" para generar el link.`;
	} else {
		// Overdue
		const daysLate = Math.abs(loanData.daysUntilDue);
		message =
			`${userName}, tu cuota de $${loanData.amount} tiene ${daysLate} día${daysLate > 1 ? 's' : ''} de atraso. ` +
			`Si necesitás, podemos ver opciones de renegociación. Escribime.`;
	}

	await sendText(userPhone, message);
}
