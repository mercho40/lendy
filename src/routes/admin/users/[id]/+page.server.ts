import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users, conversations, references, loans, payments } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'id inválido');

	const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
	if (!user) throw error(404, 'Usuario no encontrado');

	// Applicant conversation (phone match — las referencias tienen otras conversations
	// con el mismo user_id pero phone distinto).
	const [applicantConvo] = await db
		.select()
		.from(conversations)
		.where(and(eq(conversations.userId, id), eq(conversations.phone, user.phone)))
		.limit(1);

	const refs = await db
		.select()
		.from(references)
		.where(eq(references.userId, id))
		.orderBy(references.createdAt);

	const userLoans = await db
		.select()
		.from(loans)
		.where(eq(loans.userId, id))
		.orderBy(desc(loans.createdAt));

	const loanIds = userLoans.map((l) => l.id);
	const userPayments = loanIds.length
		? await db
				.select()
				.from(payments)
				.where(inArray(payments.loanId, loanIds))
				.orderBy(desc(payments.createdAt))
		: [];

	const messages = Array.isArray(applicantConvo?.messages)
		? (applicantConvo!.messages as unknown[])
		: [];

	return {
		user,
		conversation: applicantConvo
			? {
					id: applicantConvo.id,
					state: applicantConvo.state,
					updatedAt: applicantConvo.updatedAt,
					messages
				}
			: null,
		references: refs,
		loans: userLoans,
		payments: userPayments
	};
};
