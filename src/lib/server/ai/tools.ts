import type Anthropic from '@anthropic-ai/sdk';
import type { ConversationState, AgentContext, ToolResult } from './types';

// ============================================================
// Tool schemas per agent state
// ============================================================

const ONBOARDING_TOOLS: Anthropic.Tool[] = [
	{
		name: 'save_user_profile',
		description:
			'Guarda el perfil del usuario. Llamar cuando tengas nombre, DNI, ingreso mensual y ocupación.',
		input_schema: {
			type: 'object' as const,
			properties: {
				name: { type: 'string', description: 'Nombre completo' },
				dni: { type: 'string', description: 'DNI (solo números)' },
				monthly_income: { type: 'integer', description: 'Ingreso mensual en pesos ARS' },
				occupation: { type: 'string', description: 'Ocupación / trabajo' }
			},
			required: ['name', 'dni', 'monthly_income', 'occupation']
		}
	},
	{
		name: 'submit_references',
		description:
			'Registra los 3 contactos de referencia del usuario. Cada contacto es un número de WhatsApp. Esto completa el onboarding y triggerea la verificación.',
		input_schema: {
			type: 'object' as const,
			properties: {
				references: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							phone: { type: 'string', description: 'Número de WhatsApp con código de país' },
							name: { type: 'string', description: 'Nombre de la referencia (si lo dio)' },
							relationship: {
								type: 'string',
								description: 'Relación con el usuario (amigo, familiar, etc.)'
							}
						},
						required: ['phone']
					},
					minItems: 1,
					maxItems: 3,
					description: 'Lista de referencias (ideal 3)'
				}
			},
			required: ['references']
		}
	}
];

const VERIFICATION_TOOLS: Anthropic.Tool[] = [
	{
		name: 'save_reference_response',
		description:
			'Guarda las respuestas de una referencia sobre el solicitante. Llamar cuando la referencia haya respondido las preguntas.',
		input_schema: {
			type: 'object' as const,
			properties: {
				knows_since: { type: 'string', description: 'Hace cuánto conoce al solicitante' },
				stable_income: {
					type: 'boolean',
					description: '¿La referencia cree que tiene ingresos estables?'
				},
				financial_responsibility: {
					type: 'string',
					description: 'Descripción de responsabilidad financiera'
				},
				would_lend_money: {
					type: 'boolean',
					description: '¿Le prestaría plata?'
				},
				additional_notes: { type: 'string', description: 'Notas adicionales' }
			},
			required: ['knows_since', 'stable_income', 'financial_responsibility', 'would_lend_money']
		}
	}
];

const ACTIVE_LOAN_TOOLS: Anthropic.Tool[] = [
	{
		name: 'get_loan_status',
		description: 'Devuelve el estado del préstamo activo del usuario.',
		input_schema: { type: 'object' as const, properties: {} }
	},
	{
		name: 'generate_payment_link',
		description: 'Genera un link de MercadoPago para la próxima cuota.',
		input_schema: {
			type: 'object' as const,
			properties: {
				loan_id: { type: 'integer', description: 'ID del préstamo' }
			},
			required: ['loan_id']
		}
	},
	{
		name: 'renegotiate_terms',
		description:
			'Ofrece nuevos términos de pago al usuario en mora. Extiende plazo o reduce cuota.',
		input_schema: {
			type: 'object' as const,
			properties: {
				loan_id: { type: 'integer', description: 'ID del préstamo' },
				strategy: {
					type: 'string',
					enum: ['extend_term', 'reduce_installment'],
					description: 'Estrategia de renegociación'
				}
			},
			required: ['loan_id', 'strategy']
		}
	}
];

export function getTools(state: ConversationState): Anthropic.Tool[] {
	switch (state) {
		case 'onboarding':
			return ONBOARDING_TOOLS;
		case 'verification':
			return VERIFICATION_TOOLS;
		case 'credit_decision':
			return []; // single API call, no tools
		case 'active_loan':
			return ACTIVE_LOAN_TOOLS;
	}
}

// ============================================================
// Tool handlers — delegate to specific implementations
// ============================================================

// These will be implemented by each agent's handler module
// For now, stubs that the tests can mock

import { handleOnboardingTool } from './handlers/onboarding';
import { handleVerificationTool } from './handlers/verification';
import { handleActiveLoanTool } from './handlers/active-loan';

export async function handleTool(
	name: string,
	input: Record<string, unknown>,
	ctx: AgentContext
): Promise<ToolResult> {
	switch (ctx.state) {
		case 'onboarding':
			return handleOnboardingTool(name, input, ctx);
		case 'verification':
			return handleVerificationTool(name, input, ctx);
		case 'active_loan':
			return handleActiveLoanTool(name, input, ctx);
		default:
			return { data: { error: `No tools for state: ${ctx.state}` } };
	}
}
