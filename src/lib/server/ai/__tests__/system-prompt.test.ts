import { describe, it, expect } from 'vitest';
import { getSystemPrompt } from '../system-prompt';
import type { AgentContext } from '../types';

const baseCtx: AgentContext = {
	userId: 1,
	phone: '+5491155551234',
	state: 'onboarding'
};

describe('getSystemPrompt', () => {
	it('returns onboarding prompt with KYC instructions', () => {
		const prompt = getSystemPrompt('onboarding', baseCtx);
		expect(prompt).toContain('ONBOARDING');
		expect(prompt).toContain('save_user_profile');
		expect(prompt).toContain('3 personas');
		expect(prompt).toContain('submit_references');
	});

	it('returns verification prompt for reference conversations', () => {
		const prompt = getSystemPrompt('verification', { ...baseCtx, state: 'verification' });
		expect(prompt).toContain('REFERENCIA');
		expect(prompt).toContain('save_reference_response');
		expect(prompt).not.toContain('save_user_profile');
	});

	it('returns empty prompt for credit_decision (single API call)', () => {
		const prompt = getSystemPrompt('credit_decision', { ...baseCtx, state: 'credit_decision' });
		expect(prompt).toBe('');
	});

	it('returns active_loan prompt with payment instructions', () => {
		const prompt = getSystemPrompt('active_loan', { ...baseCtx, state: 'active_loan' });
		expect(prompt).toContain('PRÉSTAMO ACTIVO');
		expect(prompt).toContain('generate_payment_link');
		expect(prompt).toContain('renegociar');
	});

	it('includes user context in all conversational prompts', () => {
		for (const state of ['onboarding', 'verification', 'active_loan'] as const) {
			const prompt = getSystemPrompt(state, { ...baseCtx, state });
			expect(prompt).toContain(baseCtx.phone);
			expect(prompt).toContain(String(baseCtx.userId));
		}
	});

	it('speaks rioplatense spanish', () => {
		const prompt = getSystemPrompt('onboarding', baseCtx);
		expect(prompt).toContain('rioplatense');
	});
});
