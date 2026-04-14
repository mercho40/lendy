import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { references, users } from '../../db/schema';
import { triggerCreditDecision } from '../pipeline';
import type { HandlerContext, HandlerResult, ReferenceResponse } from '../types';

const POSITIVE_WORDS = ['responsable', 'puntual', 'confiable', 'cumplidor', 'seria', 'serio', 'ordenado', 'ordenada'];

function calculateScore(input: ReferenceResponse): number {
	let score = 0;

	if (input.would_lend_money) score += 40;
	if (input.stable_income) score += 30;

	// knows_since: +20 if contains "año" or a number > 1
	const sinceLower = input.knows_since.toLowerCase();
	if (sinceLower.includes('año')) {
		score += 20;
	} else {
		const nums = sinceLower.match(/\d+/);
		if (nums && parseInt(nums[0], 10) > 1) {
			score += 20;
		}
	}

	// financial_responsibility: +10 if contains positive words
	const respLower = input.financial_responsibility.toLowerCase();
	if (POSITIVE_WORDS.some((w) => respLower.includes(w))) {
		score += 10;
	}

	return score;
}

export async function handleSaveReferenceResponse(
	input: ReferenceResponse,
	ctx: HandlerContext
): Promise<HandlerResult> {
	// 1. Find the reference by the responding person's phone
	const [ref] = await db
		.select()
		.from(references)
		.where(eq(references.phone, ctx.phone))
		.limit(1);

	if (!ref) {
		return { ok: false, message: 'No se encontró una referencia asociada a este número.' };
	}

	// 2. Calculate score
	const score = calculateScore(input);

	// 3. Update the reference with responses, score, and status
	await db
		.update(references)
		.set({
			responses: input,
			score,
			status: 'responded'
		})
		.where(eq(references.id, ref.id));

	// 4. Check if ALL references for this user have responded
	const allRefs = await db
		.select()
		.from(references)
		.where(eq(references.userId, ref.userId));

	const allResponded = allRefs.every(
		(r) => r.id === ref.id ? true : r.status === 'responded'
	);

	if (allResponded) {
		// Calculate average trust score
		const scores = allRefs.map((r) => (r.id === ref.id ? score : r.score ?? 0));
		const trustScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

		// Update user's trust score
		await db
			.update(users)
			.set({ trustScore })
			.where(eq(users.id, ref.userId));

		// Build the summary + load applicant data
		const [applicant] = await db
			.select()
			.from(users)
			.where(eq(users.id, ref.userId))
			.limit(1);

		const referencesSummary = allRefs
			.map((r) => {
				const resp = r.id === ref.id ? input : (r.responses as ReferenceResponse | null);
				const s = r.id === ref.id ? score : r.score ?? 0;
				if (!resp) return `- ${r.name ?? r.phone} (sin responder)`;
				return `- ${r.name ?? r.phone} (score ${s}/100): conoce hace ${resp.knows_since}; ingresos estables: ${resp.stable_income}; prestaría: ${resp.would_lend_money}; responsabilidad: ${resp.financial_responsibility}`;
			})
			.join('\n');

		await triggerCreditDecision(ref.userId, applicant.phone, {
			name: applicant.name ?? 'desconocido',
			monthlyIncome: applicant.monthlyIncome ?? 0,
			occupation: applicant.occupation ?? 'desconocida',
			trustScore,
			referencesSummary
		});
	}

	return { ok: true, message: 'Respuesta guardada. Gracias por tu tiempo.' };
}

export { calculateScore };
