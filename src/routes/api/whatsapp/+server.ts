import type { RequestHandler } from './$types';
import { KAPSO_VERIFY_TOKEN } from '$env/static/private';
import { sendText } from '$lib/server/whatsapp';

// GET: Webhook verification (Meta hub.challenge handshake)
export const GET: RequestHandler = async ({ url }) => {
	const mode = url.searchParams.get('hub.mode');
	const token = url.searchParams.get('hub.verify_token');
	const challenge = url.searchParams.get('hub.challenge');

	if (mode === 'subscribe' && token === KAPSO_VERIFY_TOKEN) {
		return new Response(challenge ?? '', { status: 200 });
	}
	return new Response('Forbidden', { status: 403 });
};

// POST: Incoming WhatsApp messages (Kapso webhook payload v2)
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		// Kapso v2 payload: { message, conversation, phone_number_id }
		const message = body.message;
		if (!message || message.kapso?.direction !== 'inbound') {
			return new Response('ok');
		}

		const from = body.conversation?.phone_number;
		const text = message.text?.body ?? message.kapso?.content ?? '';

		if (!from || !text) {
			return new Response('ok');
		}

		console.log(`[WhatsApp] Received from ${from}: ${text}`);

		// Phase 1: Echo bot — respond with the same message
		// TODO: Replace with agent.process() in Phase 2
		await sendText(from, `Echo: ${text}`);

		return new Response('ok');
	} catch (err) {
		console.error('[WhatsApp] Webhook error:', err);
		return new Response('ok');
	}
};
