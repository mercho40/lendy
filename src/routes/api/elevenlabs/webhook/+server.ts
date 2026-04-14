import type { RequestHandler } from './$types';

/**
 * ElevenLabs post-call webhook.
 * Receives conversation transcript after the voice call ends.
 * Stores transcript in DB and triggers the next pipeline step.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		console.log('[ElevenLabs] Webhook received:', JSON.stringify(body).slice(0, 500));

		// Extract key data from the webhook payload
		const conversationId = body.conversation_id;
		const transcript = body.transcript; // array of {role, message, timestamp}
		const analysis = body.analysis; // conversation analysis/summary
		const metadata = body.metadata;

		// TODO: Match to user via metadata or conversation_id
		// TODO: Store transcript in DB (conversations table or users.voice_transcript)
		// TODO: Trigger next pipeline step (verification of references)

		console.log(`[ElevenLabs] Conversation ${conversationId} completed`);
		if (transcript) {
			console.log(`[ElevenLabs] Transcript entries: ${transcript.length}`);
		}

		return new Response('ok', { status: 200 });
	} catch (err) {
		console.error('[ElevenLabs] Webhook error:', err);
		return new Response('ok', { status: 200 }); // always 200 to prevent retries
	}
};
