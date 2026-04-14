import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users, references } from '../../db/schema';
import { generateReferenceCode } from '../pipeline';
import { BASE_URL } from '$env/static/private';
import type { ToolResult, SaveUserProfileInput } from '../types';

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

	const voiceUrl = `${BASE_URL}/voice?user=${userId}&name=${encodeURIComponent(input.name)}`;

	return {
		ok: true,
		message: `Perfil guardado. IMPORTANTE: Mandále al usuario este link de verificación por voz: ${voiceUrl} — Decile que hable con Lucía y cuando termine que vuelva y escriba "listo".`
	};
}

export async function submitReferences(
	userId: number
): Promise<ToolResult> {
	const count = 3;
	const codes: string[] = [];

	for (let i = 0; i < count; i++) {
		// Generate unique code — retry on collision
		let code: string;
		let attempts = 0;
		do {
			code = generateReferenceCode();
			const [existing] = await db
				.select()
				.from(references)
				.where(eq(references.referenceCode, code))
				.limit(1);
			if (!existing) break;
			attempts++;
		} while (attempts < 10);

		await db.insert(references).values({
			userId,
			phone: null,
			name: null,
			relationship: null,
			referenceCode: code
		});

		codes.push(code);
	}

	return {
		ok: true,
		message: `Códigos generados: ${codes.join(', ')}`,
		codes,
		newState: 'verification'
	};
}
