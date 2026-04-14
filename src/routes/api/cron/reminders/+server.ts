import type { RequestHandler } from './$types';
import { and, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import { dev } from '$app/environment';
import { CRON_SECRET } from '$env/static/private';
import { db } from '$lib/server/db';
import { loans, users } from '$lib/server/db/schema';
import { triggerPaymentReminder } from '$lib/server/ai/pipeline';

// Días antes o después del vencimiento en los que sí mandamos recordatorio.
// Negativo = después del vencimiento (mora).
const REMINDER_DAYS = new Set([2, 0, -1, -3, -7]);
const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(date: Date | null, now: Date): number {
	if (!date) return Infinity;
	return Math.round((date.getTime() - now.getTime()) / DAY_MS);
}

function startOfTodayUTC(now: Date): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export const GET: RequestHandler = async ({ request, url }) => {
	// Auth: Vercel Cron manda Authorization: Bearer CRON_SECRET.
	// En dev o con ?force=1 lo salteamos para testeo manual.
	const force = url.searchParams.get('force') === '1';
	const auth = request.headers.get('authorization');
	const validAuth = CRON_SECRET && auth === `Bearer ${CRON_SECRET}`;
	if (!dev && !force && !validAuth) {
		return new Response('Unauthorized', { status: 401 });
	}

	const now = new Date();
	const today = startOfTodayUTC(now);

	// Pull all loans that could still receive reminders
	const candidates = await db
		.select({
			loan: loans,
			user: users
		})
		.from(loans)
		.leftJoin(users, eq(users.id, loans.userId))
		.where(
			and(
				inArray(loans.status, ['active', 'overdue']),
				or(isNull(loans.lastReminderAt), lt(loans.lastReminderAt, today))
			)
		);

	const results: Array<{ loanId: number; sent: boolean; daysUntilDue: number; reason?: string }> = [];

	for (const { loan, user } of candidates) {
		const days = daysUntil(loan.nextDueDate, now);
		const shouldRemind = REMINDER_DAYS.has(days);

		if (!shouldRemind) {
			results.push({ loanId: loan.id, sent: false, daysUntilDue: days, reason: 'out-of-window' });
			continue;
		}
		if (!user) {
			results.push({ loanId: loan.id, sent: false, daysUntilDue: days, reason: 'no-user' });
			continue;
		}

		// Auto-promover a 'overdue' independiente del envío (si la cuota ya venció).
		if (days < 0 && loan.status === 'active') {
			await db.update(loans).set({ status: 'overdue' }).where(eq(loans.id, loan.id));
		}

		try {
			await triggerPaymentReminder(user.phone, user.name ?? 'amigo', {
				installmentNumber: loan.installmentsPaid + 1,
				totalInstallments: loan.totalInstallments,
				amount: Math.round(loan.installmentAmount / 100),
				dueDate: loan.nextDueDate?.toISOString().slice(0, 10) ?? 'hoy',
				daysUntilDue: days
			});
			await db.update(loans).set({ lastReminderAt: now }).where(eq(loans.id, loan.id));
			results.push({ loanId: loan.id, sent: true, daysUntilDue: days });
		} catch (err) {
			console.error('reminder failed for loan', loan.id, err);
			results.push({
				loanId: loan.id,
				sent: false,
				daysUntilDue: days,
				reason: (err as Error).message
			});
		}
	}

	return new Response(
		JSON.stringify({ ok: true, processed: results.length, results }, null, 2),
		{ headers: { 'content-type': 'application/json' } }
	);
};
