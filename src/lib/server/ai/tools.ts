import type Anthropic from '@anthropic-ai/sdk';
import type { ConversationState, AgentContext, ToolResult } from './types';

// ============================================================
// Tool schemas per agent state
// ============================================================

const ONBOARDING_TOOLS: Anthropic.Tool[] = [
	{
		name: 'save_user_profile',
		description:
			'Guarda el perfil completo del usuario. Llamar cuando tengas TODOS los datos: básicos + scoring. Los campos de scoring van en el objeto scoring_data.',
		input_schema: {
			type: 'object' as const,
			properties: {
				name: { type: 'string', description: 'Nombre completo' },
				dni: { type: 'string', description: 'DNI (solo números)' },
				monthly_income: { type: 'integer', description: 'Ingreso mensual neto en pesos ARS' },
				occupation: { type: 'string', description: 'Ocupación / trabajo' },
				scoring_data: {
					type: 'object',
					description: 'Datos del cuestionario de scoring',
					properties: {
						date_of_birth: { type: 'string', description: 'Fecha de nacimiento YYYY-MM-DD' },
						marital_status: { type: 'string', enum: ['soltero', 'casado', 'union_libre', 'divorciado', 'viudo'] },
						dependents: { type: 'integer', description: '0-4+' },
						education: { type: 'string', enum: ['primario', 'secundario', 'terciario', 'universitario', 'posgrado'] },
						postal_code: { type: 'string' },
						locality: { type: 'string' },
						residence_time: { type: 'string', enum: ['menos_6_meses', '6m_2_anios', '2_5_anios', 'mas_5_anios'] },
						housing: { type: 'string', enum: ['propia', 'alquilada', 'familiar', 'otra'] },
						employment_type: { type: 'string', enum: ['empleado_dependencia', 'monotributista', 'informal', 'jubilado', 'desempleado', 'estudiante'] },
						job_tenure: { type: 'string', enum: ['menos_3_meses', '3_12_meses', '1_3_anios', 'mas_3_anios'] },
						payment_method: { type: 'string', enum: ['cuenta_bancaria', 'transferencia', 'efectivo', 'billetera_virtual', 'otro'] },
						other_income: { type: 'string', enum: ['estables', 'ocasionales', 'no'] },
						has_bank_account: { type: 'boolean' },
						bank_account_years: { type: 'integer' },
						credit_cards: { type: 'string', enum: ['ninguna', 'una', 'mas_de_una'] },
						existing_debts: { type: 'string', enum: ['ninguno', 'uno', 'dos_o_mas'] },
						payment_delays: { type: 'string', enum: ['nunca', 'una_vez', 'dos_o_mas'] },
						loan_purpose: { type: 'string', enum: ['gastos_hogar', 'emergencia_medica', 'consolidar_deudas', 'inversion_negocio', 'consumo', 'educacion', 'otro'] },
						weekly_payment_capacity: { type: 'integer', description: 'Cuánto puede pagar por semana en ARS' },
						preferred_payment: { type: 'string', enum: ['debito_automatico', 'transferencia', 'efectivo', 'billetera_virtual'] }
					}
				}
			},
			required: ['name', 'dni', 'monthly_income', 'occupation']
		}
	},
	{
		name: 'submit_references',
		description:
			'Genera 3 códigos de referencia REF-XXXX para que el usuario los comparta con sus contactos. Llamar inmediatamente después de save_user_profile. No requiere ningún dato de las referencias.',
		input_schema: {
			type: 'object' as const,
			properties: {
				count: { type: 'integer', description: 'Cantidad de códigos a generar (default 3)' }
			}
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

import { saveUserProfile, submitReferences } from './handlers/onboarding';
import { handleSaveReferenceResponse } from './handlers/verification';
import { handleActiveLoanTool } from './handlers/active-loan';
import type { SaveUserProfileInput, ReferenceResponse } from './types';

export async function handleTool(
	name: string,
	input: Record<string, unknown>,
	ctx: AgentContext
): Promise<ToolResult> {
	switch (ctx.state) {
		case 'onboarding': {
			if (name === 'save_user_profile') {
				const result = await saveUserProfile(ctx.userId, input as unknown as SaveUserProfileInput);
				// After saving profile, send voice link directly via WhatsApp
				// (don't rely on the agent to forward it — it sometimes refuses URLs)
				try {
					const { sendText } = await import('./../../whatsapp');
					const { BASE_URL } = await import('$env/static/private');
					const name = (input as any).name ?? 'Usuario';
					const voiceUrl = `${BASE_URL}/voice?user=${ctx.userId}&name=${encodeURIComponent(name)}`;
					await sendText(
						ctx.phone,
						`¡Perfil guardado! Ahora necesitamos una verificación rápida por voz 🎙️\n\n` +
							`Tocá este link y hablá con nuestra asistente Lucía (menos de 5 min):\n${voiceUrl}\n\n` +
							`Cuando termines, volvé acá y escribime "listo" para seguir.`
					);
				} catch { /* swallow */ }
				return result;
			}
			if (name === 'submit_references') {
				return submitReferences(ctx.userId);
			}
			return { error: `Tool desconocida: ${name}` };
		}
		case 'verification': {
			if (name === 'save_reference_response') {
				const result = await handleSaveReferenceResponse(
					input as unknown as ReferenceResponse,
					{ userId: ctx.userId, phone: ctx.phone }
				);
				return { ok: result.ok, message: result.message };
			}
			return { error: `Tool desconocida: ${name}` };
		}
		case 'active_loan': {
			const result = await handleActiveLoanTool(name, input, { userId: ctx.userId });
			return { data: result };
		}
		default:
			return { error: `No tools for state: ${ctx.state}` };
	}
}
