import type { AgentContext, ToolResult } from '../types';

// TODO: import db, schema

export async function handleVerificationTool(
	name: string,
	input: Record<string, unknown>,
	ctx: AgentContext
): Promise<ToolResult> {
	switch (name) {
		case 'save_reference_response':
			// TODO: update reference record with responses, calculate individual score
			// TODO: check if all references responded → trigger credit decision
			return {
				data: { ok: true, message: 'Respuesta guardada. Gracias por tu tiempo.' }
			};

		default:
			return { data: { error: `Tool desconocida: ${name}` } };
	}
}
