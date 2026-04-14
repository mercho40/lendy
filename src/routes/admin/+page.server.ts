import type { PageServerLoad } from './$types';
import { and, count, eq, gte, sum } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users, references, loans, payments, conversations } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	const [usersTotal] = await db.select({ c: count() }).from(users);
	const [usersOnboarded] = await db
		.select({ c: count() })
		.from(users)
		.where(eq(users.onboardingComplete, true));

	// Pipeline breakdown: count applicants (not reference conversations) per state.
	// La conversación del aplicante es la única con conversations.phone = users.phone.
	const pipelineRows = await db
		.select({ state: conversations.state, c: count() })
		.from(conversations)
		.innerJoin(
			users,
			and(eq(users.id, conversations.userId), eq(users.phone, conversations.phone))
		)
		.groupBy(conversations.state);
	const pipeline = {
		onboarding: 0,
		verification: 0,
		credit_decision: 0,
		active_loan: 0
	};
	for (const r of pipelineRows) pipeline[r.state] = r.c;
	// Users without a conversation are implicitly in onboarding (default state)
	const usersWithoutConvo = usersTotal.c - pipelineRows.reduce((s, r) => s + r.c, 0);
	pipeline.onboarding += usersWithoutConvo;

	const [refsTotal] = await db.select({ c: count() }).from(references);
	const [refsContacted] = await db
		.select({ c: count() })
		.from(references)
		.where(eq(references.status, 'contacted'));
	const [refsResponded] = await db
		.select({ c: count() })
		.from(references)
		.where(eq(references.status, 'responded'));
	const [refsPositive] = await db
		.select({ c: count() })
		.from(references)
		.where(gte(references.score, 70));

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
			pipeline,
			references: {
				total: refsTotal.c,
				contacted: refsContacted.c,
				responded: refsResponded.c,
				positive: refsPositive.c
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
