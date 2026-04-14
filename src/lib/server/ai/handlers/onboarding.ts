import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users, references } from '../../db/schema';
import { generateReferenceCode } from '../pipeline';
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
	const codeLines: string[] = [];

	for (const ref of input.references) {
		// Generate a unique code, retry on collision (very unlikely but safe)
		let code: string;
		let attempts = 0;
		do {
			code = generateReferenceCode();
			attempts++;
		} while (attempts < 5);

		await db.insert(references).values({
			userId,
			phone: null, // phone is unknown until the reference writes to the bot
			name: ref.name ?? null,
			relationship: ref.relationship ?? null,
			referenceCode: code
		});

		const label = ref.name ?? ref.phone ?? 'tu contacto';
		codeLines.push(`${code} → ${label}`);
	}

	const codesText = codeLines.join('\n');
	const botNumber = '+1 201-252-0899';

	return {
		ok: true,
		message: `Referencias registradas. Compartí estos códigos con tus contactos y pediles que le escriban a ${botNumber}:\n${codesText}\n\nCada uno tiene que mandar su código para que podamos verificar.`,
		newState: 'verification'
	};
}
