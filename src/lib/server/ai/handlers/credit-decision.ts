import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

export interface CreditDecision {
	approved: boolean;
	segment: string; // nuevo, estandar, plus, premium
	amount: number; // ARS
	weeks: number;
	tna: number; // TNA as percentage (e.g. 120)
	weeklyPayment: number; // ARS
	reason: string;
}

export interface CreditEvalInput {
	name: string;
	monthlyIncome: number;
	occupation: string;
	trustScore: number;
	referencesSummary: string;
}

const CREDIT_MATRIX_PROMPT = `Sos el motor de decisión crediticia de GrameenBot, un sistema de microcréditos en Argentina.

MATRIZ DE OTORGAMIENTO (vigente abril 2026):

SMVM de referencia: $357.800/mes

SEGMENTOS:
| Segmento  | Score    | Monto máx.    | En SMVM  | Plazo máx. | TNA ref. |
|-----------|----------|---------------|----------|------------|----------|
| Nuevo     | 0 – 40   | $178.900      | 0.5 SMVM | 24 sem.    | 120%     |
| Estándar  | 41 – 65  | $357.800      | 1 SMVM   | 48 sem.    | 100%     |
| Plus      | 66 – 80  | $715.600      | 2 SMVM   | 72 sem.    | 85%      |
| Premium   | 81 – 100 | $1.073.400    | 3 SMVM   | 96 sem.    | 70%      |

REGLAS DE PLAZO:
| Segmento  | Plazo mín. | Plazo máx. | Incremento |
|-----------|------------|------------|------------|
| Nuevo     | 4 sem.     | 24 sem.    | 4 sem.     |
| Estándar  | 4 sem.     | 48 sem.    | 4 sem.     |
| Plus      | 8 sem.     | 72 sem.    | 4 sem.     |
| Premium   | 12 sem.    | 96 sem.    | 4 sem.     |

REGLAS DE DECISIÓN:
1. El segmento se determina EXCLUSIVAMENTE por el score crediticio interno.
2. La cuota semanal NO puede superar el 25% del ingreso semanal declarado (ingreso mensual / 4.33).
3. Si la cuota del monto máximo excede el 25%, reducir el monto hasta que la cuota cumpla.
4. El plazo debe ser múltiplo de 4 semanas dentro del rango del segmento.
5. Monto mínimo de crédito: $20.000 ARS.
6. Si el score es 0-40 y el ingreso no alcanza ni para el monto mínimo, RECHAZAR.

CÁLCULO DE CUOTA SEMANAL:
cuota_semanal = (monto * (1 + TNA/100 * semanas/52)) / semanas

Evaluá el perfil y decidí: segmento, monto aprobado, plazo en semanas, TNA, cuota semanal.`;

/**
 * Single API call — structured output. Takes collected data, returns credit decision.
 */
export async function evaluateCredit(
	userId: number,
	userData: CreditEvalInput
): Promise<CreditDecision> {
	const weeklyIncome = Math.round(userData.monthlyIncome / 4.33);

	const response = await client.messages.create({
		model: 'claude-sonnet-4-6',
		max_tokens: 512,
		system: CREDIT_MATRIX_PROMPT,
		messages: [
			{
				role: 'user',
				content: `PERFIL DEL SOLICITANTE:
- Nombre: ${userData.name}
- Ingreso mensual declarado: $${userData.monthlyIncome} ARS (semanal: $${weeklyIncome})
- Ocupación: ${userData.occupation}
- Score crediticio interno: ${userData.trustScore}/100
- 25% del ingreso semanal (tope cuota): $${Math.round(weeklyIncome * 0.25)}

RESUMEN DE REFERENCIAS:
${userData.referencesSummary}

Determiná el segmento, monto, plazo y cuota según la matriz.`
			}
		],
		output_config: {
			format: {
				type: 'json_schema',
				schema: {
					type: 'object',
					properties: {
						approved: { type: 'boolean', description: 'true si se aprueba el crédito' },
						segment: {
							type: 'string',
							enum: ['nuevo', 'estandar', 'plus', 'premium', 'rechazado'],
							description: 'Segmento crediticio según score'
						},
						amount: { type: 'number', description: 'Monto aprobado en ARS' },
						weeks: {
							type: 'number',
							description: 'Plazo en semanas (múltiplo de 4)'
						},
						tna: { type: 'number', description: 'TNA de referencia como porcentaje' },
						weekly_payment: { type: 'number', description: 'Cuota semanal en ARS' },
						reason: {
							type: 'string',
							description: 'Explicación breve de la decisión'
						}
					},
					required: [
						'approved',
						'segment',
						'amount',
						'weeks',
						'tna',
						'weekly_payment',
						'reason'
					],
					additionalProperties: false
				}
			}
		}
	});

	const textBlock = response.content.find(
		(b): b is Anthropic.TextBlock => b.type === 'text'
	);
	const parsed = JSON.parse(textBlock?.text ?? '{}');

	return {
		approved: parsed.approved,
		segment: parsed.segment,
		amount: parsed.amount,
		weeks: parsed.weeks,
		tna: parsed.tna,
		weeklyPayment: parsed.weekly_payment,
		reason: parsed.reason
	};
}
