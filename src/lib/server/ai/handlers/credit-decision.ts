import Anthropic from '@anthropic-ai/sdk';
import type { AgentContext } from '../types';

const client = new Anthropic();

export interface CreditDecision {
	approved: boolean;
	amount: number; // ARS (not cents)
	installments: number;
	interestRate: number; // basis points (500 = 5%)
	weeklyPayment: number; // ARS
	reason: string;
}

/**
 * Single API call — no tool loop. Takes all collected data and returns a structured decision.
 * This is the hook between verification and active_loan states.
 */
export async function evaluateCredit(
	userId: number,
	userData: {
		name: string;
		monthlyIncome: number;
		occupation: string;
		trustScore: number;
		referencesSummary: string;
	}
): Promise<CreditDecision> {
	const response = await client.messages.create({
		model: 'claude-sonnet-4-6',
		max_tokens: 1024,
		messages: [
			{
				role: 'user',
				content: `Evaluá este perfil para un microcrédito en Argentina.

DATOS DEL SOLICITANTE:
- Nombre: ${userData.name}
- Ingreso mensual: $${userData.monthlyIncome} ARS
- Ocupación: ${userData.occupation}
- Trust score de referencias: ${userData.trustScore}/100

RESPUESTAS DE REFERENCIAS:
${userData.referencesSummary}

REGLAS:
- Monto entre $5.000 y $50.000 ARS
- 4 cuotas semanales
- Tasa entre 5% y 15% flat según riesgo
- Trust score > 70 → monto alto, tasa baja
- Trust score 40-70 → monto medio, tasa media
- Trust score < 40 → rechazar o monto mínimo
- La cuota no puede superar el 30% del ingreso mensual

Respondé SOLO con JSON válido, sin markdown:`
			}
		],
		output_config: {
			format: {
				type: 'json_schema',
				json_schema: {
					name: 'credit_decision',
					schema: {
						type: 'object',
						properties: {
							approved: { type: 'boolean' },
							amount: { type: 'number', description: 'Monto en ARS' },
							installments: { type: 'number' },
							interest_rate: { type: 'number', description: 'Basis points (500 = 5%)' },
							weekly_payment: { type: 'number', description: 'Cuota semanal en ARS' },
							reason: { type: 'string' }
						},
						required: [
							'approved',
							'amount',
							'installments',
							'interest_rate',
							'weekly_payment',
							'reason'
						],
						additionalProperties: false
					}
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
		amount: parsed.amount,
		installments: parsed.installments,
		interestRate: parsed.interest_rate,
		weeklyPayment: parsed.weekly_payment,
		reason: parsed.reason
	};
}
