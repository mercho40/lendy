import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { CRON_SECRET } from '$env/static/private';
import { runManager } from '$lib/server/ai/manager';

export const GET: RequestHandler = async ({ request, url }) => {
	const force = url.searchParams.get('force') === '1';
	const auth = request.headers.get('authorization');
	const validAuth = CRON_SECRET && auth === `Bearer ${CRON_SECRET}`;
	if (!dev && !force && !validAuth) {
		return new Response('Unauthorized', { status: 401 });
	}

	const trigger = force ? 'manual' : 'cron';
	try {
		const result = await runManager(trigger);
		return new Response(JSON.stringify({ ok: true, ...result }, null, 2), {
			headers: { 'content-type': 'application/json' }
		});
	} catch (err) {
		console.error('[cron/manager] failed', err);
		return new Response(
			JSON.stringify({ ok: false, error: (err as Error).message }, null, 2),
			{ status: 500, headers: { 'content-type': 'application/json' } }
		);
	}
};
