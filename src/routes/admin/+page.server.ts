import type { PageServerLoad } from './$types';
import { count, eq, sum } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users, groups, loans, payments } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	const [usersTotal] = await db.select({ c: count() }).from(users);
	const [usersOnboarded] = await db
		.select({ c: count() })
		.from(users)
		.where(eq(users.onboardingComplete, true));

	const groupsForming = await db.select({ c: count() }).from(groups).where(eq(groups.status, 'forming'));
	const groupsActive = await db.select({ c: count() }).from(groups).where(eq(groups.status, 'active'));
	const groupsDefaulted = await db
		.select({ c: count() })
		.from(groups)
		.where(eq(groups.status, 'defaulted'));

	const loansActive = await db.select({ c: count() }).from(loans).where(eq(loans.status, 'active'));
	const loansOverdue = await db
		.select({ c: count() })
		.from(loans)
		.where(eq(loans.status, 'overdue'));
	const loansPaid = await db.select({ c: count() }).from(loans).where(eq(loans.status, 'paid'));

	const [totalLent] = await db.select({ total: sum(loans.amount) }).from(loans);
	const [totalCollected] = await db
		.select({ total: sum(payments.amount) })
		.from(payments)
		.where(eq(payments.status, 'approved'));

	return {
		stats: {
			users: { total: usersTotal.c, onboarded: usersOnboarded.c },
			groups: {
				forming: groupsForming[0].c,
				active: groupsActive[0].c,
				defaulted: groupsDefaulted[0].c
			},
			loans: {
				active: loansActive[0].c,
				overdue: loansOverdue[0].c,
				paid: loansPaid[0].c
			},
			lentCents: Number(totalLent?.total ?? 0),
			collectedCents: Number(totalCollected?.total ?? 0)
		}
	};
};
