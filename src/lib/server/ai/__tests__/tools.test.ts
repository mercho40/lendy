import { describe, it, expect } from 'vitest';
import { getTools } from '../tools';
import type { ConversationState } from '../types';

describe('getTools', () => {
	it('returns onboarding tools for onboarding state', () => {
		const tools = getTools('onboarding');
		const names = tools.map((t) => t.name);
		expect(names).toContain('save_user_profile');
		expect(names).toContain('submit_references');
		expect(names).toHaveLength(2);
	});

	it('returns verification tools for verification state', () => {
		const tools = getTools('verification');
		const names = tools.map((t) => t.name);
		expect(names).toContain('save_reference_response');
		expect(names).toHaveLength(1);
	});

	it('returns no tools for credit_decision state', () => {
		const tools = getTools('credit_decision');
		expect(tools).toHaveLength(0);
	});

	it('returns active_loan tools for active_loan state', () => {
		const tools = getTools('active_loan');
		const names = tools.map((t) => t.name);
		expect(names).toContain('get_loan_status');
		expect(names).toContain('generate_payment_link');
		expect(names).toContain('renegotiate_terms');
		expect(names).toHaveLength(3);
	});

	it('all tools have valid input_schema', () => {
		const states: ConversationState[] = [
			'onboarding',
			'verification',
			'credit_decision',
			'active_loan'
		];
		for (const state of states) {
			for (const tool of getTools(state)) {
				expect(tool.input_schema).toBeDefined();
				expect(tool.input_schema.type).toBe('object');
				expect(tool.name).toMatch(/^[a-z_]+$/);
				expect(tool.description).toBeTruthy();
			}
		}
	});
});
