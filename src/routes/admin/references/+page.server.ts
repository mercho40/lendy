import type { PageServerLoad } from './$types';
import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { references, users } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	const rows = await db
		.select({
			id: references.id,
			name: references.name,
			phone: references.phone,
			relationship: references.relationship,
			status: references.status,
			score: references.score,
			responses: references.responses,
			createdAt: references.createdAt,
			applicantId: users.id,
			applicantName: users.name,
			applicantPhone: users.phone
		})
		.from(references)
		.leftJoin(users, eq(references.userId, users.id))
		.orderBy(desc(references.createdAt));

	return { references: rows };
};
