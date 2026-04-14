import type { AgentContext, ToolResult } from '../types';

// TODO: import db, schema, mercadopago

export async function handleActiveLoanTool(
	name: string,
	input: Record<string, unknown>,
	ctx: AgentContext
): Promise<ToolResult> {
	switch (name) {
		case 'get_loan_status':
			// TODO: query loan from DB
			return { data: { error: 'Not implemented' } };

		case 'generate_payment_link':
			// TODO: create MP preference, insert payment record
			return { data: { error: 'Not implemented' } };

		case 'renegotiate_terms':
			// TODO: calculate new terms, update loan
			return { data: { error: 'Not implemented' } };

		default:
			return { data: { error: `Tool desconocida: ${name}` } };
	}
}
