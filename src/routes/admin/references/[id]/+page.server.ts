import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { references, users, conversations } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(400, 'invalid id');

	const [ref] = await db.select().from(references).where(eq(references.id, id)).limit(1);
	if (!ref) throw error(404, 'Reference not found');

	const [applicant] = await db.select().from(users).where(eq(users.id, ref.userId)).limit(1);

	// La conversación de esta referencia: misma user_id del aplicante,
	// pero phone = el de la referencia. Si la ref aún no escribió al bot,
	// su phone es NULL y no hay conversación asociada.
	const [refConvo] = ref.phone
		? await db
				.select()
				.from(conversations)
				.where(and(eq(conversations.userId, ref.userId), eq(conversations.phone, ref.phone)))
				.limit(1)
		: [undefined];

	return {
		reference: ref,
		applicant,
		messages: (refConvo?.messages as unknown[]) ?? [],
		convoState: refConvo?.state ?? null
	};
};
