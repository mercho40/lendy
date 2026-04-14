import type { RequestHandler } from './$types';
import { KAPSO_VERIFY_TOKEN } from '$env/static/private';
import { sendText } from '$lib/server/whatsapp';
import { db } from '$lib/server/db';
import { users, conversations, references } from '$lib/server/db/schema';
import { eq, isNotNull } from 'drizzle-orm';
import { runAgent, type AgentMessage } from '$lib/server/ai/agent';

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

const FALLBACK_MSG = 'Estamos configurando el sistema. Volvé a intentar en unos minutos.';

// POST: Incoming WhatsApp messages (Kapso webhook payload v2)
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		// Kapso v2 payload: { message, conversation, phone_number_id }
		const message = body.message;
		if (!message || message.kapso?.direction !== 'inbound') {
			return new Response('ok');
		}

		const from: string | undefined = body.conversation?.phone_number;
		const text: string = message.text?.body ?? message.kapso?.content ?? '';

		if (!from || !text) {
			return new Response('ok');
		}

		console.log(`[WhatsApp] Received from ${from}: ${text}`);

		// Check if this phone already belongs to a matched reference
		const [existingRef] = await db
			.select()
			.from(references)
			.where(eq(references.phone, from))
			.limit(1);

		if (existingRef) {
			// Only route as a reference if the reference is still pending a response
			// AND the applicant's conversation is still in verification. Otherwise this
			// phone is a past reference who happens to be messaging us again — don't
			// leak the applicant's active-loan data (see review I1).
			const [applicantConvo] = await db
				.select()
				.from(conversations)
				.where(eq(conversations.userId, existingRef.userId))
				.limit(1);

			const refDone = existingRef.status === 'responded' || existingRef.status === 'failed';
			const applicantPastVerification = applicantConvo && applicantConvo.state !== 'verification';

			if (refDone || applicantPastVerification) {
				await sendText(
					from,
					'¡Gracias! Ya tenemos registradas tus respuestas. Si querés pedir un crédito propio, escribinos desde este mismo número en un rato.'
				);
				return new Response('ok');
			}

			await handleReferenceMessage(existingRef, text, from, applicantConvo);
			return new Response('ok');
		}

		// Check if this phone belongs to an existing user
		let [user] = await db.select().from(users).where(eq(users.phone, from)).limit(1);

		if (!user) {
			// New number — check if they're sending a REF-XXXX code
			const refCodeMatch = text.match(/REF-[A-Z0-9]{4}/i);
			const refCode = refCodeMatch ? refCodeMatch[0].toUpperCase() : null;

			if (refCode) {
				// Look up the code in the references table
				const [pendingRef] = await db
					.select()
					.from(references)
					.where(eq(references.referenceCode, refCode))
					.limit(1);

				if (!pendingRef) {
					await sendText(from, 'Ese código no es válido. ¿Podés verificarlo con quien te lo pasó?');
					return new Response('ok');
				}

				// Match: assign this phone to the reference record and start verification
				await db
					.update(references)
					.set({ phone: from, status: 'contacted' })
					.where(eq(references.id, pendingRef.id));

				// Get the applicant's name for the greeting
				const [applicant] = await db
					.select()
					.from(users)
					.where(eq(users.id, pendingRef.userId))
					.limit(1);
				const applicantName = applicant?.name ?? 'alguien';

				// Create a user record for this reference so the conversation is tracked
				[user] = await db.insert(users).values({ phone: from }).returning();

				// Create a conversation in verification state, seeded with context
				const [convo] = await db
					.insert(conversations)
					.values({
						userId: pendingRef.userId, // conversation belongs to the applicant
						phone: from,
						messages: [],
						state: 'verification'
					})
					.returning();

				// Kick off verification with context pre-loaded
				const seedMsg: AgentMessage = {
					role: 'user',
					content: `[REFERENCIA entró con código ${refCode}. Es referencia de ${applicantName} (user ID ${pendingRef.userId}). Nombre de la referencia: ${pendingRef.name ?? 'desconocido'}. Su primer mensaje: ${text}]`
				};
				const msgs: AgentMessage[] = [seedMsg];

				let replyText: string;
				let updatedMsgs: AgentMessage[];

				try {
					const result = await runAgent(msgs, {
						userId: pendingRef.userId,
						phone: from,
						state: 'verification'
					});
					replyText = result.reply;
					updatedMsgs = result.messages;
				} catch (err) {
					console.error('[WhatsApp] Agent error (new reference):', err);
					replyText = FALLBACK_MSG;
					updatedMsgs = msgs;
				}

				await db
					.update(conversations)
					.set({ messages: updatedMsgs, updatedAt: new Date() })
					.where(eq(conversations.id, convo.id));

				await sendText(from, replyText);
				return new Response('ok');
			}

			// No code — new user starting onboarding
			[user] = await db.insert(users).values({ phone: from }).returning();

			const [convo] = await db
				.insert(conversations)
				.values({ userId: user.id, phone: from, messages: [], state: 'onboarding' })
				.returning();

			// Greet them and ask if they have a reference code or want a loan
			const welcomeMsg =
				'¡Hola! Bienvenido/a a Lendy 👋\n\n¿Venís por un crédito propio o te pasaron un código de referencia?';
			await sendText(from, welcomeMsg);

			// Save the welcome as an assistant message so the agent has context
			await db
				.update(conversations)
				.set({
					messages: [{ role: 'assistant', content: welcomeMsg }],
					updatedAt: new Date()
				})
				.where(eq(conversations.id, convo.id));

			return new Response('ok');
		}

		// Existing user — find or create their conversation
		let [convo] = await db
			.select()
			.from(conversations)
			.where(eq(conversations.userId, user.id))
			.limit(1);

		if (!convo) {
			[convo] = await db
				.insert(conversations)
				.values({ userId: user.id, phone: from, messages: [], state: 'onboarding' })
				.returning();
		}

		// Append user message to history
		const msgs: AgentMessage[] = [...(convo.messages as AgentMessage[])];
		msgs.push({ role: 'user', content: text });

		// Run the agent (will fail without API key — catch gracefully)
		let replyText: string;
		let updatedMsgs: AgentMessage[];
		let newState: typeof convo.state | undefined;

		try {
			const result = await runAgent(msgs, {
				userId: user.id,
				phone: from,
				state: convo.state
			});
			replyText = result.reply;
			updatedMsgs = result.messages;
			newState = result.newState;
		} catch (err) {
			console.error('[WhatsApp] Agent error:', err);
			replyText = FALLBACK_MSG;
			updatedMsgs = msgs; // keep user message in history
		}

		// Save updated conversation (+ possibly new state from tool result)
		await db
			.update(conversations)
			.set({
				messages: updatedMsgs,
				...(newState ? { state: newState } : {}),
				updatedAt: new Date()
			})
			.where(eq(conversations.id, convo.id));

		// Send reply via WhatsApp
		await sendText(from, replyText);

		return new Response('ok');
	} catch (err) {
		console.error('[WhatsApp] Webhook error:', err);
		return new Response('ok');
	}
};

async function handleReferenceMessage(
	ref: typeof references.$inferSelect,
	text: string,
	from: string,
	existingConvo?: typeof conversations.$inferSelect | undefined
) {
	// Reuse the convo already fetched in the gate, otherwise create one.
	let convo = existingConvo;
	if (!convo) {
		// Need the applicant's phone for the new conversation row (required by schema)
		const [applicant] = await db
			.select()
			.from(users)
			.where(eq(users.id, ref.userId))
			.limit(1);
		[convo] = await db
			.insert(conversations)
			.values({
				userId: ref.userId,
				phone: applicant?.phone ?? from,
				messages: [],
				state: 'verification'
			})
			.returning();
	}

	const msgs: AgentMessage[] = [...(convo.messages as AgentMessage[])];
	// Tag the message so the agent knows it's from a reference
	msgs.push({
		role: 'user',
		content: `[REFERENCIA ${ref.name ?? ref.phone}]: ${text}`
	});

	let replyText: string;
	let updatedMsgs: AgentMessage[];
	let newState: typeof convo.state | undefined;

	try {
		const result = await runAgent(msgs, {
			userId: ref.userId,
			phone: from, // the reference's phone — handlers look up references by this
			state: convo.state
		});
		replyText = result.reply;
		updatedMsgs = result.messages;
		newState = result.newState;
	} catch (err) {
		console.error('[WhatsApp] Agent error (reference):', err);
		replyText = FALLBACK_MSG;
		updatedMsgs = msgs;
	}

	await db
		.update(conversations)
		.set({
			messages: updatedMsgs,
			...(newState ? { state: newState } : {}),
			updatedAt: new Date()
		})
		.where(eq(conversations.id, convo.id));

	// Send reply to the reference's phone, not the applicant
	await sendText(from, replyText);
}
