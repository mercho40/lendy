import type { Actions, PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { payments, loans, users } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ params }) => {
	const paymentId = Number(params.paymentId);
	if (!paymentId) throw error(400, 'paymentId inválido');

	const [pay] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
	if (!pay) throw error(404, 'Pago no encontrado');

	const [loan] = await db.select().from(loans).where(eq(loans.id, pay.loanId)).limit(1);
	const [user] = await db.select().from(users).where(eq(users.id, loan.userId)).limit(1);

	return {
		payment: {
			id: pay.id,
			amountCents: pay.amount,
			status: pay.status
		},
		loan: {
			id: loan.id,
			installmentsPaid: loan.installmentsPaid,
			totalInstallments: loan.totalInstallments
		},
		user: {
			name: user?.name ?? 'Usuario',
			phone: user?.phone ?? ''
		}
	};
};

export const actions: Actions = {
	approve: async ({ params, fetch }) => {
		const mpId = `MOCK-${params.paymentId}-APPROVED`;
		await fetch(`/api/payments/webhook?id=${mpId}&type=payment`, { method: 'POST' });
		throw redirect(303, `/mock-pay/${params.paymentId}/done?status=approved`);
	},
	reject: async ({ params, fetch }) => {
		const mpId = `MOCK-${params.paymentId}-REJECTED`;
		await fetch(`/api/payments/webhook?id=${mpId}&type=payment`, { method: 'POST' });
		throw redirect(303, `/mock-pay/${params.paymentId}/done?status=rejected`);
	}
};
