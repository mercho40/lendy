import type { PageServerLoad } from './$types';
import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { loans, users, groups } from '$lib/server/db/schema';

const VALID_STATUSES = ['active', 'overdue', 'paid'] as const;
type LoanStatus = (typeof VALID_STATUSES)[number];

export const load: PageServerLoad = async ({ url }) => {
	const statusParam = url.searchParams.get('status');
	const filterStatus = (VALID_STATUSES as readonly string[]).includes(statusParam ?? '')
		? (statusParam as LoanStatus)
		: null;

	const base = db
		.select({
			id: loans.id,
			amount: loans.amount,
			installmentAmount: loans.installmentAmount,
			installmentsPaid: loans.installmentsPaid,
			totalInstallments: loans.totalInstallments,
			status: loans.status,
			nextDueDate: loans.nextDueDate,
			createdAt: loans.createdAt,
			userName: users.name,
			userPhone: users.phone,
			groupName: groups.name
		})
		.from(loans)
		.leftJoin(users, eq(loans.userId, users.id))
		.leftJoin(groups, eq(loans.groupId, groups.id));

	const rows = filterStatus
		? await base.where(eq(loans.status, filterStatus)).orderBy(desc(loans.createdAt))
		: await base.orderBy(desc(loans.createdAt));

	return {
		loans: rows,
		filterStatus
	};
};
