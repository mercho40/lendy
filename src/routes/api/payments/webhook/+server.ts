import type { RequestHandler } from './$types';

// POST: MercadoPago IPN webhook
export const POST: RequestHandler = async ({ request }) => {
	// TODO: Receive payment notification → update payment/loan → notify user/group
	return new Response('ok');
};
