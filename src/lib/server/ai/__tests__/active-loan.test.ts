// Set env vars before any imports to prevent neon/mercadopago crashes
process.env.DATABASE_URL = 'postgresql://fake:fake@localhost/fake';
process.env.MP_ACCESS_TOKEN = 'TEST-fake-token';
process.env.BASE_URL = 'http://localhost:3000';

import { describe, it, expect } from 'vitest';
import {
	getLoanStatus,
	generatePaymentLink,
	renegotiateTerms,
	type Deps
} from '../handlers/active-loan';

// Build a fake DB that chains like Drizzle
function createMockDb(state: { selectResult: unknown[][]; insertResult: unknown[][] }) {
	return {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: () => state.selectResult.shift() ?? []
				})
			})
		}),
		insert: () => ({
			values: () => ({
				returning: () => state.insertResult.shift() ?? []
			})
		}),
		update: () => ({
			set: () => ({
				where: () => Promise.resolve()
			})
		})
	} as unknown as Deps['db'];
}

describe('Active Loan Handler', () => {
	const ctx = { userId: 1 };

	const baseLoan = {
		id: 10,
		userId: 1,
		groupId: 1,
		amount: 1000000, // 10000 pesos
		totalInstallments: 4,
		installmentsPaid: 1,
		installmentAmount: 262500, // 2625 pesos
		status: 'active' as const,
		nextDueDate: new Date('2026-04-21'),
		createdAt: new Date()
	};

	describe('get_loan_status', () => {
		it('returns formatted loan data', async () => {
			const deps: Deps = {
				db: createMockDb({ selectResult: [[baseLoan]], insertResult: [] }),
				createPaymentPreference: () => Promise.resolve({ id: '', initPoint: '' })
			};

			const result = (await getLoanStatus(ctx, deps)) as Record<string, unknown>;

			expect(result.loan_id).toBe(10);
			expect(result.amount_pesos).toBe(10000);
			expect(result.installments_paid).toBe(1);
			expect(result.total_installments).toBe(4);
			expect(result.installment_amount_pesos).toBe(2625);
			expect(result.status).toBe('active');
			expect(result.next_due_date).toBe('2026-04-21');
		});

		it('returns error if no active loan', async () => {
			const deps: Deps = {
				db: createMockDb({ selectResult: [[]], insertResult: [] }),
				createPaymentPreference: () => Promise.resolve({ id: '', initPoint: '' })
			};

			const result = (await getLoanStatus(ctx, deps)) as Record<string, unknown>;

			expect(result.error).toBe('No tenés un préstamo activo');
		});
	});

	describe('generate_payment_link', () => {
		it('creates payment record and returns link', async () => {
			const fakePayment = { id: 55, loanId: 10, amount: 262500, status: 'pending' };
			const deps: Deps = {
				db: createMockDb({
					selectResult: [[baseLoan]],
					insertResult: [[fakePayment]]
				}),
				createPaymentPreference: () =>
					Promise.resolve({ id: 'pref_123', initPoint: 'https://mp.com/pay/123' })
			};

			const result = (await generatePaymentLink(
				{ loan_id: 10 },
				ctx,
				deps
			)) as Record<string, unknown>;

			expect(result.ok).toBe(true);
			expect(result.payment_id).toBe(55);
			expect(result.amount_pesos).toBe(2625);
			expect(result.payment_link).toBe('https://mp.com/pay/123');
		});

		it('falls back to mock link when MercadoPago fails', async () => {
			const fakePayment = { id: 55, loanId: 10, amount: 262500, status: 'pending' };
			const deps: Deps = {
				db: createMockDb({
					selectResult: [[baseLoan]],
					insertResult: [[fakePayment]]
				}),
				createPaymentPreference: () => Promise.reject(new Error('MP not configured'))
			};

			const result = (await generatePaymentLink(
				{ loan_id: 10 },
				ctx,
				deps
			)) as Record<string, unknown>;

			expect(result.ok).toBe(true);
			expect(result.payment_id).toBe(55);
			expect((result.payment_link as string).includes('mock')).toBe(true);
		});
	});

	describe('renegotiate_terms', () => {
		it('extend_term doubles remaining installments and halves amount', async () => {
			const deps: Deps = {
				db: createMockDb({ selectResult: [[baseLoan]], insertResult: [] }),
				createPaymentPreference: () => Promise.resolve({ id: '', initPoint: '' })
			};

			const result = (await renegotiateTerms(
				{ loan_id: 10, strategy: 'extend_term' },
				ctx,
				deps
			)) as Record<string, unknown>;

			expect(result.ok).toBe(true);
			expect(result.strategy).toBe('extend_term');
			expect(result.new_total_installments).toBe(7);
			expect(result.remaining_installments).toBe(6);
			expect(result.new_installment_amount_pesos).toBe(1313);
		});

		it('reduce_installment reduces amount by 30% and extends proportionally', async () => {
			const deps: Deps = {
				db: createMockDb({ selectResult: [[baseLoan]], insertResult: [] }),
				createPaymentPreference: () => Promise.resolve({ id: '', initPoint: '' })
			};

			const result = (await renegotiateTerms(
				{ loan_id: 10, strategy: 'reduce_installment' },
				ctx,
				deps
			)) as Record<string, unknown>;

			expect(result.ok).toBe(true);
			expect(result.strategy).toBe('reduce_installment');
			expect(result.new_total_installments).toBe(6);
			expect(result.remaining_installments).toBe(5);
			expect(result.new_installment_amount_pesos).toBe(1838);
		});
	});
});
