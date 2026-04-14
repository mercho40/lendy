import type { PageServerLoad } from './$types';
import { and, avg, count, desc, eq, gte, sum } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users, references, loans, payments, conversations } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	// ---- Counts ---------------------------------------------------------
	const [usersTotal] = await db.select({ c: count() }).from(users);
	const [usersOnboarded] = await db
		.select({ c: count() })
		.from(users)
		.where(eq(users.onboardingComplete, true));

	// Pipeline breakdown: count applicants (not reference conversations) per state.
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
	const usersWithoutConvo = usersTotal.c - pipelineRows.reduce((s, r) => s + r.c, 0);
	pipeline.onboarding += usersWithoutConvo;

	const [refsTotal] = await db.select({ c: count() }).from(references);
	const [refsPending] = await db
		.select({ c: count() })
		.from(references)
		.where(eq(references.status, 'pending'));
	const [refsContacted] = await db
		.select({ c: count() })
		.from(references)
		.where(eq(references.status, 'contacted'));
	const [refsResponded] = await db
		.select({ c: count() })
		.from(references)
		.where(eq(references.status, 'responded'));
	const [refsFailed] = await db
		.select({ c: count() })
		.from(references)
		.where(eq(references.status, 'failed'));
	const [refsPositive] = await db
		.select({ c: count() })
		.from(references)
		.where(gte(references.score, 70));

	const [loansTotal] = await db.select({ c: count() }).from(loans);
	const [loansActive] = await db
		.select({ c: count() })
		.from(loans)
		.where(eq(loans.status, 'active'));
	const [loansOverdue] = await db
		.select({ c: count() })
		.from(loans)
		.where(eq(loans.status, 'overdue'));
	const [loansPaid] = await db
		.select({ c: count() })
		.from(loans)
		.where(eq(loans.status, 'paid'));

	// ---- Money ----------------------------------------------------------
	const [totalLent] = await db.select({ total: sum(loans.amount) }).from(loans);
	const [totalCollected] = await db
		.select({ total: sum(payments.amount) })
		.from(payments)
		.where(eq(payments.status, 'approved'));

	const [paymentsTotal] = await db.select({ c: count() }).from(payments);
	const [paymentsApproved] = await db
		.select({ c: count() })
		.from(payments)
		.where(eq(payments.status, 'approved'));

	// ---- Averages -------------------------------------------------------
	const [avgTrust] = await db.select({ v: avg(users.trustScore) }).from(users);
	const [avgLoan] = await db.select({ v: avg(loans.amount) }).from(loans);
	const [avgRefScore] = await db.select({ v: avg(references.score) }).from(references);

	// ---- Recent activity -------------------------------------------------
	const recentUsers = await db
		.select({
			id: users.id,
			name: users.name,
			phone: users.phone,
			onboardingComplete: users.onboardingComplete,
			trustScore: users.trustScore,
			createdAt: users.createdAt
		})
		.from(users)
		.orderBy(desc(users.createdAt))
		.limit(5);

	const recentLoans = await db
		.select({
			id: loans.id,
			userId: loans.userId,
			amount: loans.amount,
			status: loans.status,
			installmentsPaid: loans.installmentsPaid,
			totalInstallments: loans.totalInstallments,
			createdAt: loans.createdAt,
			userName: users.name,
			userPhone: users.phone
		})
		.from(loans)
		.leftJoin(users, eq(users.id, loans.userId))
		.orderBy(desc(loans.createdAt))
		.limit(5);

	const recentPayments = await db
		.select({
			id: payments.id,
			loanId: payments.loanId,
			amount: payments.amount,
			status: payments.status,
			createdAt: payments.createdAt
		})
		.from(payments)
		.orderBy(desc(payments.createdAt))
		.limit(5);

	// ---- Derived ratios --------------------------------------------------
	const activePlusOverdue = loansActive.c + loansOverdue.c;
	const defaultRate = activePlusOverdue > 0 ? loansOverdue.c / activePlusOverdue : 0;
	const lentCents = Number(totalLent?.total ?? 0);
	const collectedCents = Number(totalCollected?.total ?? 0);
	const collectionRate = lentCents > 0 ? collectedCents / lentCents : 0;
	const responseRate = refsTotal.c > 0 ? refsResponded.c / refsTotal.c : 0;
	const conversionRate = usersTotal.c > 0 ? loansTotal.c / usersTotal.c : 0;

	return {
		stats: {
			users: { total: usersTotal.c, onboarded: usersOnboarded.c },
			pipeline,
			references: {
				total: refsTotal.c,
				pending: refsPending.c,
				contacted: refsContacted.c,
				responded: refsResponded.c,
				failed: refsFailed.c,
				positive: refsPositive.c
			},
			loans: {
				total: loansTotal.c,
				active: loansActive.c,
				overdue: loansOverdue.c,
				paid: loansPaid.c
			},
			payments: { total: paymentsTotal.c, approved: paymentsApproved.c },
			lentCents,
			collectedCents,
			avgTrustScore: avgTrust?.v ? Math.round(Number(avgTrust.v)) : null,
			avgLoanCents: avgLoan?.v ? Math.round(Number(avgLoan.v)) : null,
			avgRefScore: avgRefScore?.v ? Math.round(Number(avgRefScore.v)) : null,
			defaultRate,
			collectionRate,
			responseRate,
			conversionRate
		},
		recent: {
			users: recentUsers,
			loans: recentLoans,
			payments: recentPayments
		}
	};
};
