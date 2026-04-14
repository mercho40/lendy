import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { CRON_SECRET } from '$env/static/private';
import { db } from '$lib/server/db';
import { users, references } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { triggerCreditDecision } from '$lib/server/ai/pipeline';

// Manual credit-decision trigger. Gated behind CRON_SECRET (same shared secret
// used by the reminders cron) or dev mode so it isn't an open door on Vercel.
export const POST: RequestHandler = async ({ request, url }) => {
	const auth = request.headers.get('authorization') ?? '';
	const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : null;
	const forced = dev && url.searchParams.get('force') === '1';

	if (!forced && (!CRON_SECRET || bearer !== CRON_SECRET)) {
		return new Response('forbidden', { status: 403 });
	}

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
