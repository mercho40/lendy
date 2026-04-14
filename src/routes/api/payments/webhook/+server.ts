import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { waitUntil } from '@vercel/functions';
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
			const remaining = loan.totalInstallments - newPaid;
			const cuotaPesos = Math.round(loan.installmentAmount / 100).toLocaleString('es-AR');

			const msg = fullyPaid
				? `¡Listo! Pagaste la última cuota de tu préstamo. ¡Gracias por confiar en Lendy! 🙌`
				: `✅ Recibimos tu pago de la cuota ${newPaid}/${loan.totalInstallments}.\n\n` +
					`Te quedan ${remaining} cuotas de $${cuotaPesos}.`;
			try {
				await sendText(borrower.phone, msg);
			} catch {
				/* swallow */
			}

			// DEMO: After first payment, offer early payment discount after 8 seconds.
			// waitUntil keeps the Vercel function alive long enough for the delay.
			if (newPaid === 1 && !fullyPaid) {
				const descuento = Math.round(loan.installmentAmount * 0.9 / 100).toLocaleString('es-AR');
				waitUntil(
					(async () => {
						await new Promise((r) => setTimeout(r, 8000));
						try {
							await sendText(
								borrower.phone,
								`💡 ¡Oferta especial!\n\n` +
									`Si pagás la cuota 2 ahora, te hacemos un 10% de descuento: $${descuento} en vez de $${cuotaPesos}.\n\n` +
									`¿Querés aprovechar? Escribime "pagar" y te mando el link con el descuento.`
							);
						} catch {
							/* swallow */
						}
					})()
				);
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
