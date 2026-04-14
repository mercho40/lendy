import type { PageServerLoad } from './$types';
import { desc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { groups, users, loans } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	const rows = await db.select().from(groups).orderBy(desc(groups.createdAt));

	const allMembers = await db
		.select({ id: users.id, name: users.name, phone: users.phone, groupId: users.groupId })
		.from(users);

	const allLoans = await db
		.select({
			id: loans.id,
			userId: loans.userId,
			groupId: loans.groupId,
			amount: loans.amount,
			status: loans.status
		})
		.from(loans);

	return {
		groups: rows.map((g) => {
			const members = allMembers.filter((m) => m.groupId === g.id);
			const groupLoans = allLoans.filter((l) => l.groupId === g.id);
			const totalLent = groupLoans.reduce((sum, l) => sum + l.amount, 0);
			const hasOverdue = groupLoans.some((l) => l.status === 'overdue');
			const activeLoans = groupLoans.filter((l) => l.status !== 'paid').length;
			return { ...g, members, totalLent, hasOverdue, activeLoans };
		})
	};
};
