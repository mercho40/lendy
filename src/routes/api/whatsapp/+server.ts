import type { RequestHandler } from './$types';

// GET: Webhook verification (Kapso/Meta challenge)
export const GET: RequestHandler = async ({ url }) => {
	// TODO: Verify token and return challenge
	const challenge = url.searchParams.get('hub.challenge');
	return new Response(challenge ?? 'ok');
};

// POST: Incoming WhatsApp messages
export const POST: RequestHandler = async ({ request }) => {
	// TODO: Parse Kapso webhook → find/create user → run agent → respond
	return new Response('ok');
};
