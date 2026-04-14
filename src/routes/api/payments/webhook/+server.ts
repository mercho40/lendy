import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users, loans, payments } from '$lib/server/db/schema';
import { getPayment } from '$lib/server/mercadopago';
import { sendText } from '$lib/server/whatsapp';

export const POST: RequestHandler = async ({ request, url }) => {
	const qsId = url.searchParams.get('id') ?? url.searchParams.get('data.id');
	let mpPaymentId = qsId;
	if (!mpPaymentId) {
		try {
			const body = await request.json();
			mpPaymentId = body?.data?.id ? String(body.data.id) : null;
		} catch {
			/* no-op */
		}
	}
	if (!mpPaymentId) return new Response('ok');

	try {
		const mp = await getPayment(mpPaymentId);
		const externalRef = mp.external_reference;
		const status = mp.status;
		if (!externalRef) return new Response('ok');

		const paymentRowId = Number(externalRef);
		const [pay] = await db.select().from(payments).where(eq(payments.id, paymentRowId)).limit(1);
		if (!pay) return new Response('ok');
		if (pay.status === 'approved') return new Response('ok'); // idempotent

		if (status === 'approved') {
			await db
				.update(payments)
				.set({ status: 'approved', mpPaymentId: String(mp.id) })
				.where(eq(payments.id, pay.id));

			const [loan] = await db.select().from(loans).where(eq(loans.id, pay.loanId)).limit(1);
			const newPaid = loan.installmentsPaid + 1;
			const fullyPaid = newPaid >= loan.totalInstallments;
			await db
				.update(loans)
				.set({
					installmentsPaid: newPaid,
					status: fullyPaid ? 'paid' : 'active',
					nextDueDate: fullyPaid
						? null
						: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
				})
				.where(eq(loans.id, loan.id));

			const [borrower] = await db.select().from(users).where(eq(users.id, loan.userId)).limit(1);
			const msg = fullyPaid
				? `¡Listo! Pagaste la última cuota de tu préstamo. Gracias 🙌`
				: `Recibimos tu pago de la cuota ${newPaid}/${loan.totalInstallments}. Próxima en 7 días.`;
			try {
				await sendText(borrower.phone, msg);
			} catch {
				/* swallow */
			}
		} else if (status === 'rejected') {
			await db
				.update(payments)
				.set({ status: 'rejected', mpPaymentId: String(mp.id) })
				.where(eq(payments.id, pay.id));
		}
	} catch (e) {
		console.error('MP webhook error', e);
	}

	return new Response('ok');
};
