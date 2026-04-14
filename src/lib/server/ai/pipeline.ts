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

import { sendText } from '../whatsapp';
import { evaluateCredit } from './handlers/credit-decision';

/**
 * Called when onboarding completes (submit_references tool).
 * Initiates verification by messaging each reference.
 */
export async function triggerVerification(
	userId: number,
	userName: string,
	references: Array<{ phone: string; name?: string }>
): Promise<void> {
	for (const ref of references) {
		const greeting = ref.name
			? `Hola ${ref.name}! Soy GrameenBot.`
			: `Hola! Soy GrameenBot.`;

		await sendText(
			ref.phone,
			`${greeting} ${userName} te puso como referencia para un microcrédito. ¿Tenés unos minutos para responder unas preguntas sobre su situación financiera? Es rápido y confidencial.`
		);
	}
}

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
		await sendText(
			userPhone,
			`¡Buenas noticias, ${userData.name}! Tu crédito fue aprobado.\n\n` +
				`💰 Monto: $${decision.amount}\n` +
				`📅 ${decision.installments} cuotas semanales de $${decision.weeklyPayment}\n` +
				`📊 Tasa: ${decision.interestRate / 100}%\n\n` +
				`¿Querés aceptar? Respondé "acepto" y te mando el link de pago de la primera cuota.`
		);
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
