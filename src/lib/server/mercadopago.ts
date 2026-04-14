import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

export const mpClient = new MercadoPagoConfig({
	accessToken: process.env.MP_ACCESS_TOKEN!
});

export async function createPaymentPreference(opts: {
	loanId: number;
	paymentId: number;
	amountPesos: number;
	description: string;
}) {
	const baseUrl = process.env.BASE_URL!;
	const pref = new Preference(mpClient);
	const result = await pref.create({
		body: {
			items: [
				{
					id: `loan-${opts.loanId}-pay-${opts.paymentId}`,
					title: opts.description,
					quantity: 1,
					unit_price: opts.amountPesos,
					currency_id: 'ARS'
				}
			],
			external_reference: String(opts.paymentId),
			back_urls: {
				success: `${baseUrl}/admin/loans`,
				failure: `${baseUrl}/admin/loans`,
				pending: `${baseUrl}/admin/loans`
			},
			notification_url: `${baseUrl}/api/payments/webhook`
		}
	});
	return { id: result.id!, initPoint: result.init_point! };
}

export async function getPayment(paymentId: string) {
	const payment = new Payment(mpClient);
	return payment.get({ id: paymentId });
}
