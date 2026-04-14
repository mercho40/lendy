import { and, eq, ne } from 'drizzle-orm';
import { db as defaultDb } from '../../db';
import { loans, payments } from '../../db/schema';
import { createPaymentPreference as defaultCreatePref } from '../../mercadopago';

interface ToolContext {
	userId: number;
}

// Dependencies injectable for testing
export interface Deps {
	db: typeof defaultDb;
	createPaymentPreference: typeof defaultCreatePref;
}

const defaultDeps: Deps = {
	db: defaultDb,
	createPaymentPreference: defaultCreatePref
};

export async function getLoanStatus(ctx: ToolContext, deps: Deps = defaultDeps) {
	const [loan] = await deps.db
		.select()
		.from(loans)
		.where(and(eq(loans.userId, ctx.userId), ne(loans.status, 'paid')))
		.limit(1);

	if (!loan) return { error: 'No tenés un préstamo activo' };

	return {
		loan_id: loan.id,
		amount_pesos: Math.round(loan.amount / 100),
		installments_paid: loan.installmentsPaid,
		total_installments: loan.totalInstallments,
		installment_amount_pesos: Math.round(loan.installmentAmount / 100),
		status: loan.status,
		next_due_date: loan.nextDueDate?.toISOString().slice(0, 10) ?? null
	};
}

export async function generatePaymentLink(
	input: { loan_id: number },
	ctx: ToolContext,
	deps: Deps = defaultDeps
) {
	const loanId = input.loan_id;
	const [loan] = await deps.db.select().from(loans).where(eq(loans.id, loanId)).limit(1);

	if (!loan) return { error: 'Préstamo no encontrado' };
	if (loan.userId !== ctx.userId) return { error: 'Ese préstamo no es tuyo' };
	if (loan.status === 'paid') return { error: 'El préstamo ya está pagado' };

	const [pay] = await deps.db
		.insert(payments)
		.values({ loanId: loan.id, amount: loan.installmentAmount, status: 'pending' })
		.returning();

	try {
		const pref = await deps.createPaymentPreference({
			loanId: loan.id,
			paymentId: pay.id,
			amountPesos: Math.round(loan.installmentAmount / 100),
			description: `Cuota ${loan.installmentsPaid + 1}/${loan.totalInstallments} - préstamo #${loan.id}`
		});
		await deps.db
			.update(payments)
			.set({ mpPreferenceId: pref.id, paymentLink: pref.initPoint })
			.where(eq(payments.id, pay.id));
		return {
			ok: true,
			payment_id: pay.id,
			payment_link: pref.initPoint,
			amount_pesos: Math.round(loan.installmentAmount / 100),
			message: `Link de pago generado: ${pref.initPoint}`
		};
	} catch {
		// MercadoPago not configured — return mock link for demo
		const mockLink = `https://www.mercadopago.com.ar/checkout/mock/${pay.id}`;
		await deps.db
			.update(payments)
			.set({ paymentLink: mockLink })
			.where(eq(payments.id, pay.id));
		return {
			ok: true,
			payment_id: pay.id,
			payment_link: mockLink,
			amount_pesos: Math.round(loan.installmentAmount / 100),
			message: `Link de pago (demo): ${mockLink}`
		};
	}
}

export async function renegotiateTerms(
	input: { loan_id: number; strategy: 'extend_term' | 'reduce_installment' },
	ctx: ToolContext,
	deps: Deps = defaultDeps
) {
	const loanId = input.loan_id;
	const [loan] = await deps.db.select().from(loans).where(eq(loans.id, loanId)).limit(1);

	if (!loan) return { error: 'Préstamo no encontrado' };
	if (loan.userId !== ctx.userId) return { error: 'Ese préstamo no es tuyo' };
	if (loan.status === 'paid') return { error: 'El préstamo ya está pagado' };

	const remaining = loan.totalInstallments - loan.installmentsPaid;

	if (input.strategy === 'extend_term') {
		// Double remaining installments, halve installment amount
		const newTotal = loan.installmentsPaid + remaining * 2;
		const newInstallmentAmount = Math.round(loan.installmentAmount / 2);

		await deps.db
			.update(loans)
			.set({
				totalInstallments: newTotal,
				installmentAmount: newInstallmentAmount
			})
			.where(eq(loans.id, loanId));

		return {
			ok: true,
			loan_id: loanId,
			strategy: 'extend_term',
			new_total_installments: newTotal,
			new_installment_amount_pesos: Math.round(newInstallmentAmount / 100),
			remaining_installments: remaining * 2,
			message: `Cuotas extendidas: ahora tenés ${remaining * 2} cuotas restantes de $${Math.round(newInstallmentAmount / 100)}`
		};
	} else {
		// reduce_installment: reduce installment by 30%, extend proportionally
		const newInstallmentAmount = Math.round(loan.installmentAmount * 0.7);
		const remainingDebt = loan.installmentAmount * remaining;
		const newRemaining = Math.ceil(remainingDebt / newInstallmentAmount);
		const newTotal = loan.installmentsPaid + newRemaining;

		await deps.db
			.update(loans)
			.set({
				totalInstallments: newTotal,
				installmentAmount: newInstallmentAmount
			})
			.where(eq(loans.id, loanId));

		return {
			ok: true,
			loan_id: loanId,
			strategy: 'reduce_installment',
			new_total_installments: newTotal,
			new_installment_amount_pesos: Math.round(newInstallmentAmount / 100),
			remaining_installments: newRemaining,
			message: `Cuota reducida a $${Math.round(newInstallmentAmount / 100)}, ahora tenés ${newRemaining} cuotas restantes`
		};
	}
}

export async function handleActiveLoanTool(
	name: string,
	input: Record<string, unknown>,
	ctx: ToolContext
): Promise<unknown> {
	switch (name) {
		case 'get_loan_status':
			return getLoanStatus(ctx);
		case 'generate_payment_link':
			return generatePaymentLink(input as { loan_id: number }, ctx);
		case 'renegotiate_terms':
			return renegotiateTerms(
				input as { loan_id: number; strategy: 'extend_term' | 'reduce_installment' },
				ctx
			);
		default:
			return { error: `Tool desconocida: ${name}` };
	}
}
