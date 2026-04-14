import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users, references } from '../../db/schema';
import { triggerVerification } from '../pipeline';
import type { ToolResult, SaveUserProfileInput, SubmitReferencesInput } from '../types';

export async function saveUserProfile(
	userId: number,
	input: SaveUserProfileInput
): Promise<ToolResult> {
	await db
		.update(users)
		.set({
			name: input.name,
			dni: input.dni,
			monthlyIncome: input.monthly_income,
			occupation: input.occupation,
			onboardingComplete: true
		})
		.where(eq(users.id, userId));

	return { ok: true, message: 'Perfil guardado' };
}

export async function submitReferences(
	userId: number,
	userName: string,
	input: SubmitReferencesInput
): Promise<ToolResult> {
	for (const ref of input.references) {
		await db.insert(references).values({
			userId,
			phone: ref.phone,
			name: ref.name ?? null,
			relationship: ref.relationship ?? null
		});
	}

	await triggerVerification(userId, userName, input.references);

	return {
		ok: true,
		message: 'Referencias registradas. Iniciando verificación.',
		newState: 'verification'
	};
}
