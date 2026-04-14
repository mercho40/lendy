import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';

/**
 * ElevenLabs post-call webhook.
 *
 * Payload shape (per ElevenLabs post-call webhook docs):
 *   {
 *     type: 'post_call_transcription' | ...,
 *     data: {
 *       conversation_id,
 *       agent_id,
 *       transcript,                           // array of turns
 *       analysis,                             // summary / eval
 *       metadata,                             // costs, phone, timings
 *       conversation_initiation_client_data: {
 *         dynamic_variables: { user_id, ... }
 *       }
 *     }
 *   }
 *
 * We use `dynamic_variables.user_id` (set by the /voice page) to attach the
 * call back to the applicant.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const data = body?.data ?? body; // tolerate both shapes

		const conversationId: string | undefined = data?.conversation_id;
		const transcript = data?.transcript ?? null;
		const analysis = data?.analysis ?? null;
		const dynamicVars = data?.conversation_initiation_client_data?.dynamic_variables ?? {};
		const rawUserId = dynamicVars?.user_id;
		const userId = rawUserId != null ? Number(rawUserId) : NaN;

		console.log(
			`[ElevenLabs] Post-call received — conversation=${conversationId} user_id=${rawUserId} turns=${Array.isArray(transcript) ? transcript.length : 0}`
		);

		if (!Number.isInteger(userId) || userId <= 0) {
			// Can't attach the call — log and drop. Returning 200 prevents retry storms.
			console.warn('[ElevenLabs] Missing or invalid user_id in dynamic_variables; skipping persist.');
			return new Response('ok', { status: 200 });
		}

		await db
			.update(users)
			.set({
				voiceTranscript: transcript,
				voiceAnalysis: analysis,
				voiceCompletedAt: new Date()
			})
			.where(eq(users.id, userId));

		return new Response('ok', { status: 200 });
	} catch (err) {
		console.error('[ElevenLabs] Webhook error:', err);
		return new Response('ok', { status: 200 }); // always 200 to prevent retries
	}
};
