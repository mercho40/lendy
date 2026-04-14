import type { PageServerLoad } from './$types';
import { desc, eq, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users, groups, loans } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	const rows = await db
		.select({
			id: users.id,
			phone: users.phone,
			name: users.name,
			dni: users.dni,
			onboardingComplete: users.onboardingComplete,
			createdAt: users.createdAt,
			groupId: groups.id,
			groupName: groups.name,
			groupStatus: groups.status
		})
		.from(users)
		.leftJoin(groups, eq(users.groupId, groups.id))
		.orderBy(desc(users.createdAt));

	const activeLoans = await db
		.select({
			userId: loans.userId,
			loanId: loans.id,
			amount: loans.amount,
			status: loans.status,
			installmentsPaid: loans.installmentsPaid,
			totalInstallments: loans.totalInstallments
		})
		.from(loans)
		.where(ne(loans.status, 'paid'));

	const loanByUser = new Map<number, (typeof activeLoans)[number]>();
	for (const l of activeLoans) loanByUser.set(l.userId, l);

	return {
		users: rows.map((r) => ({ ...r, activeLoan: loanByUser.get(r.id) ?? null }))
	};
};
