import type { AgentContext, ToolResult } from '../types';

// TODO: import db, schema

export async function handleOnboardingTool(
	name: string,
	input: Record<string, unknown>,
	ctx: AgentContext
): Promise<ToolResult> {
	switch (name) {
		case 'save_user_profile':
			// TODO: update user in DB
			return {
				data: { ok: true, message: 'Perfil guardado' }
			};

		case 'submit_references':
			// TODO: insert references in DB, trigger verification pipeline
			return {
				data: { ok: true, message: 'Referencias registradas. Iniciando verificación.' },
				newState: 'verification'
			};

		default:
			return { data: { error: `Tool desconocida: ${name}` } };
	}
}
