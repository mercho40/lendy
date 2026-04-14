import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { loans, users } from '$lib/server/db/schema';
import { triggerPaymentReminder } from '$lib/server/ai/pipeline';

const VALID_STATUSES = ['active', 'overdue', 'paid'] as const;
type LoanStatus = (typeof VALID_STATUSES)[number];

export const load: PageServerLoad = async ({ url }) => {
	const statusParam = url.searchParams.get('status');
	const filterStatus = (VALID_STATUSES as readonly string[]).includes(statusParam ?? '')
		? (statusParam as LoanStatus)
		: null;

	const base = db
		.select({
			id: loans.id,
			amount: loans.amount,
			installmentAmount: loans.installmentAmount,
			installmentsPaid: loans.installmentsPaid,
			totalInstallments: loans.totalInstallments,
			status: loans.status,
			nextDueDate: loans.nextDueDate,
			createdAt: loans.createdAt,
			userName: users.name,
			userPhone: users.phone,
			userTrustScore: users.trustScore
		})
		.from(loans)
		.leftJoin(users, eq(loans.userId, users.id));

	const rows = filterStatus
		? await base.where(eq(loans.status, filterStatus)).orderBy(desc(loans.createdAt))
		: await base.orderBy(desc(loans.createdAt));

	return {
		loans: rows,
		filterStatus
	};
};

export const actions: Actions = {
	// Demo helper — fuerza una cuota a estado vencido y dispara el recordatorio
	// de cobranza por WhatsApp para poder mostrarlo en la demo sin esperar 7 días.
	simulateCollection: async ({ request }) => {
		const data = await request.formData();
		const loanId = Number(data.get('loanId'));
		if (!loanId) return fail(400, { message: 'loanId required' });

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
