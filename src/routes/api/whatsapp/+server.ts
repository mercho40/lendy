import type { RequestHandler } from './$types';
import { KAPSO_VERIFY_TOKEN } from '$env/static/private';
import { sendText } from '$lib/server/whatsapp';
import { db } from '$lib/server/db';
import { users, conversations, references } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
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

		// Check if this phone belongs to a reference (not a regular user)
		const [existingRef] = await db
			.select()
			.from(references)
			.where(eq(references.phone, from))
			.limit(1);

		if (existingRef) {
			// Route to the applicant's conversation in verification context
			await handleReferenceMessage(existingRef, text, from);
			return new Response('ok');
		}

		// Find or create user by phone number
		let [user] = await db.select().from(users).where(eq(users.phone, from)).limit(1);

		if (!user) {
			[user] = await db.insert(users).values({ phone: from }).returning();
		}

		// Find or create conversation for this user
		let [convo] = await db
			.select()
			.from(conversations)
			.where(eq(conversations.userId, user.id))
			.limit(1);

		if (!convo) {
			[convo] = await db
				.insert(conversations)
				.values({ userId: user.id, messages: [], state: 'onboarding' })
				.returning();
		}

		// Append user message to history
		const msgs: AgentMessage[] = [...(convo.messages as AgentMessage[])];
		msgs.push({ role: 'user', content: text });

		// Run the agent (will fail without API key — catch gracefully)
		let replyText: string;
		let updatedMsgs: AgentMessage[];

		try {
			const result = await runAgent(user.id, msgs);
			replyText = result.reply;
			updatedMsgs = result.messages;
		} catch (err) {
			console.error('[WhatsApp] Agent error:', err);
			replyText = FALLBACK_MSG;
			updatedMsgs = msgs; // keep user message in history
		}

		// Save updated conversation
		await db
			.update(conversations)
			.set({
				messages: updatedMsgs,
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
	from: string
) {
	// Find the applicant's conversation
	let [convo] = await db
		.select()
		.from(conversations)
		.where(eq(conversations.userId, ref.userId))
		.limit(1);

	if (!convo) {
		[convo] = await db
			.insert(conversations)
			.values({ userId: ref.userId, messages: [], state: 'onboarding' })
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

	try {
		const result = await runAgent(ref.userId, msgs);
		replyText = result.reply;
		updatedMsgs = result.messages;
	} catch (err) {
		console.error('[WhatsApp] Agent error (reference):', err);
		replyText = FALLBACK_MSG;
		updatedMsgs = msgs;
	}

	await db
		.update(conversations)
		.set({
			messages: updatedMsgs,
			updatedAt: new Date()
		})
		.where(eq(conversations.id, convo.id));

	// Send reply to the reference's phone, not the applicant
	await sendText(from, replyText);
}
