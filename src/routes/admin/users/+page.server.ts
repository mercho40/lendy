import type { PageServerLoad } from './$types';
import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users, conversations, loans } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	// Join sólo a la conversación del aplicante (phone = users.phone).
	// Las conversaciones de referencias comparten user_id pero tienen el phone
	// de la referencia, y generarían duplicados en la tabla.
	const rows = await db
		.select({
			id: users.id,
			phone: users.phone,
			name: users.name,
			dni: users.dni,
			onboardingComplete: users.onboardingComplete,
			trustScore: users.trustScore,
			createdAt: users.createdAt,
			state: conversations.state
		})
		.from(users)
		.leftJoin(
			conversations,
			and(eq(conversations.userId, users.id), eq(conversations.phone, users.phone))
		)
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
		users: rows.map((r) => ({
			...r,
			state: r.state ?? 'onboarding',
			activeLoan: loanByUser.get(r.id) ?? null
		}))
	};
};
