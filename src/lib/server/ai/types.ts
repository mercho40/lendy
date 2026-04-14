export type ConversationState = 'onboarding' | 'verification' | 'credit_decision' | 'active_loan';

export interface ToolResult {
	data: unknown;
	newState?: ConversationState;
}

export interface AgentContext {
	userId: number;
	phone: string;
	state: ConversationState;
}
