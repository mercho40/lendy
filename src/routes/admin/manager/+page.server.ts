import type { Actions, PageServerLoad } from './$types';
import { desc, eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { managerActions, managerRuns } from '$lib/server/db/schema';
import { loadManagerChat, resetManagerChat, runManager, runManagerChat } from '$lib/server/ai/manager';

export const load: PageServerLoad = async () => {
	const messages = await loadManagerChat();
	const recentRuns = await db
		.select()
		.from(managerRuns)
		.orderBy(desc(managerRuns.startedAt))
		.limit(10);
	const recentActions = await db
		.select()
		.from(managerActions)
		.orderBy(desc(managerActions.createdAt))
		.limit(15);

	return {
		messages,
		recentRuns,
		recentActions
	};
};

export const actions: Actions = {
	send: async ({ request }) => {
		const form = await request.formData();
		const text = String(form.get('message') ?? '').trim();
		if (!text) return fail(400, { message: 'Empty message' });
		try {
			const result = await runManagerChat(text);
			return { success: true, reply: result.reply };
		} catch (err) {
			console.error('[manager chat] failed', err);
			return fail(500, { message: (err as Error).message });
		}
	},
	reset: async () => {
		await resetManagerChat();
		return { success: true, reset: true };
	},
	runAutopilot: async () => {
		try {
			const result = await runManager('manual');
			return { success: true, autopilot: true, actions: result.actionsTaken, summary: result.summary };
		} catch (err) {
			console.error('[manager autopilot] failed', err);
			return fail(500, { message: (err as Error).message });
		}
	}
};
