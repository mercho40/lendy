import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { loans, payments, users } from '$lib/server/db/schema';
import { triggerPaymentReminder } from '$lib/server/ai/pipeline';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'invalid id');

	const [loan] = await db.select().from(loans).where(eq(loans.id, id)).limit(1);
	if (!loan) throw error(404, 'Loan not found');

	const [borrower] = await db.select().from(users).where(eq(users.id, loan.userId)).limit(1);

	const loanPayments = await db
		.select()
		.from(payments)
		.where(eq(payments.loanId, id))
		.orderBy(desc(payments.createdAt));

	return { loan, borrower, payments: loanPayments };
};

export const actions: Actions = {
	simulateCollection: async ({ params }) => {
		const loanId = Number(params.id);
		if (!loanId) return fail(400, { message: 'invalid loanId' });

		const [loan] = await db.select().from(loans).where(eq(loans.id, loanId)).limit(1);
		if (!loan) return fail(404, { message: 'Loan not found' });

		const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
		await db
			.update(loans)
			.set({ status: 'overdue', nextDueDate: yesterday })
			.where(eq(loans.id, loanId));

		const [borrower] = await db.select().from(users).where(eq(users.id, loan.userId)).limit(1);
		if (!borrower) return { success: true, sentTo: null };

		try {
			await triggerPaymentReminder(borrower.phone, borrower.name ?? 'amigo', {
				installmentNumber: loan.installmentsPaid + 1,
				totalInstallments: loan.totalInstallments,
				amount: Math.round(loan.installmentAmount / 100),
				dueDate: yesterday.toISOString().slice(0, 10),
				daysUntilDue: -1
			});
			return { success: true, sentTo: borrower.phone };
		} catch (err) {
			console.error('triggerPaymentReminder failed', err);
			return { success: true, sentTo: null, warning: 'WA send failed (check Kapso)' };
		}
	}
};
