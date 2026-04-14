export type ConversationState = 'onboarding' | 'verification' | 'credit_decision' | 'active_loan';

export interface ToolResult {
	ok?: boolean;
	data?: unknown;
	message?: string;
	error?: string;
	newState?: ConversationState;
	codes?: string[]; // submitReferences devuelve los REF-XXXX generados
}

export interface AgentContext {
	userId: number;
	phone: string;
	state: ConversationState;
}

// Onboarding types
export interface SaveUserProfileInput {
	name: string;
	dni: string;
	monthly_income: number;
	occupation: string;
}

export interface SubmitReferencesInput {
	references: Array<{
		phone: string;
		name?: string;
		relationship?: string;
	}>;
}

// Verification types
export interface HandlerContext {
	userId: number;
	phone: string;
}

export interface HandlerResult {
	ok: boolean;
	message: string;
}

export interface ReferenceResponse {
	knows_since: string;
	stable_income: boolean;
	financial_responsibility: string;
	would_lend_money: boolean;
	additional_notes?: string;
}
