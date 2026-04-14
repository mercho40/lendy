import { describe, it, expect } from 'vitest';
import { handleOnboardingTool } from '../handlers/onboarding';
import { handleVerificationTool } from '../handlers/verification';
import { handleActiveLoanTool } from '../handlers/active-loan';
import type { AgentContext } from '../types';

const ctx: AgentContext = { userId: 1, phone: '+5491155551234', state: 'onboarding' };

describe('Onboarding handlers', () => {
	it('save_user_profile returns ok', async () => {
		const result = await handleOnboardingTool(
			'save_user_profile',
			{ name: 'Carlos', dni: '30123456', monthly_income: 200000, occupation: 'Dev' },
			ctx
		);
		expect(result.data).toHaveProperty('ok', true);
	});

	it('submit_references transitions to verification state', async () => {
		const result = await handleOnboardingTool(
			'submit_references',
			{
				references: [
					{ phone: '+5491100001111', name: 'Juan', relationship: 'amigo' },
					{ phone: '+5491100002222', name: 'María', relationship: 'familiar' },
					{ phone: '+5491100003333', name: 'Pedro', relationship: 'compañero' }
				]
			},
			ctx
		);
		expect(result.data).toHaveProperty('ok', true);
		expect(result.newState).toBe('verification');
	});

	it('unknown tool returns error', async () => {
		const result = await handleOnboardingTool('nonexistent', {}, ctx);
		expect(result.data).toHaveProperty('error');
	});
});

describe('Verification handlers', () => {
	it('save_reference_response returns ok', async () => {
		const result = await handleVerificationTool(
			'save_reference_response',
			{
				knows_since: '5 años',
				stable_income: true,
				financial_responsibility: 'Muy responsable',
				would_lend_money: true
			},
			{ ...ctx, state: 'verification' }
		);
		expect(result.data).toHaveProperty('ok', true);
	});
});

describe('Active loan handlers', () => {
	it('get_loan_status returns not implemented (stub)', async () => {
		const result = await handleActiveLoanTool('get_loan_status', {}, {
			...ctx,
			state: 'active_loan'
		});
		expect(result.data).toHaveProperty('error');
	});

	it('generate_payment_link returns not implemented (stub)', async () => {
		const result = await handleActiveLoanTool(
			'generate_payment_link',
			{ loan_id: 1 },
			{ ...ctx, state: 'active_loan' }
		);
		expect(result.data).toHaveProperty('error');
	});

	it('renegotiate_terms returns not implemented (stub)', async () => {
		const result = await handleActiveLoanTool(
			'renegotiate_terms',
			{ loan_id: 1, strategy: 'extend_term' },
			{ ...ctx, state: 'active_loan' }
		);
		expect(result.data).toHaveProperty('error');
	});
});
