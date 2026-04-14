import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users, references } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { triggerCreditDecision } from '$lib/server/ai/pipeline';

// Temporary endpoint to manually trigger credit decision for testing
export const POST: RequestHandler = async ({ request }) => {
	const { userId } = await request.json();

	const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
	if (!user) return new Response('User not found', { status: 404 });

	const refs = await db.select().from(references).where(eq(references.userId, userId));
	const summary = refs
		.map((r) => r.responses ? JSON.stringify(r.responses) : 'Sin respuesta')
		.join('\n');

	await triggerCreditDecision(userId, user.phone, {
		name: user.name ?? 'Usuario',
		monthlyIncome: user.monthlyIncome ?? 0,
		occupation: user.occupation ?? 'No especificada',
		trustScore: user.trustScore ?? 0,
		referencesSummary: summary
	});

	return new Response('triggered');
};
