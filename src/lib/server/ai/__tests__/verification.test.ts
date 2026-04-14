import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReferenceResponse } from '../types';

// --- Mock DB and pipeline ---

const mockSelect = vi.fn((..._args: unknown[]) => ({}));
const mockUpdate = vi.fn((..._args: unknown[]) => ({}));
const mockFrom = vi.fn((..._args: unknown[]) => ({}));
const mockWhere = vi.fn((..._args: unknown[]) => ({}));
const mockLimit = vi.fn((..._args: unknown[]) => ({}));
const mockSet = vi.fn((..._args: unknown[]) => ({}));

let selectResults: unknown[][] = [];
let selectCallIndex = 0;

function resetMocks() {
	selectCallIndex = 0;
	selectResults = [];

	mockLimit.mockImplementation(() => selectResults[selectCallIndex++] ?? []);
	mockWhere.mockImplementation(() => {
		if ((mockWhere as any).__fromUpdate) {
			(mockWhere as any).__fromUpdate = false;
			return Promise.resolve();
		}
		return { limit: mockLimit };
	});
	mockFrom.mockImplementation(() => ({ where: mockWhere }));
	mockSelect.mockImplementation(() => ({ from: mockFrom }));
	mockSet.mockImplementation(() => {
		(mockWhere as any).__fromUpdate = true;
		return { where: mockWhere };
	});
	mockUpdate.mockImplementation(() => ({ set: mockSet }));
}

const mockTriggerCreditDecision = vi.fn((..._args: unknown[]) => Promise.resolve());

vi.mock('../../db', () => ({
	db: {
		select: (...args: unknown[]) => mockSelect(...args),
		update: (...args: unknown[]) => mockUpdate(...args)
	}
}));

vi.mock('../../db/schema', () => ({
	references: { id: 'id', phone: 'phone', userId: 'user_id', status: 'status', score: 'score' },
	users: { id: 'id', trustScore: 'trust_score' }
}));

vi.mock('drizzle-orm', () => ({
	eq: (col: unknown, val: unknown) => ({ col, val })
}));

vi.mock('../pipeline', () => ({
	triggerCreditDecision: (...args: unknown[]) => mockTriggerCreditDecision(...args)
}));

import { handleSaveReferenceResponse, calculateScore } from '../handlers/verification';

describe('Verification Handler', () => {
	beforeEach(() => {
		resetMocks();
		mockTriggerCreditDecision.mockClear();
	});

	describe('calculateScore', () => {
		it('gives max score (100) for best possible input', () => {
			const input: ReferenceResponse = {
				knows_since: '5 años',
				stable_income: true,
				financial_responsibility: 'Muy responsable y puntual',
				would_lend_money: true
			};
			expect(calculateScore(input)).toBe(100);
		});

		it('gives 0 for worst possible input', () => {
			const input: ReferenceResponse = {
				knows_since: 'poco',
				stable_income: false,
				financial_responsibility: 'no sé',
				would_lend_money: false
			};
			expect(calculateScore(input)).toBe(0);
		});

		it('gives +40 for would_lend_money', () => {
			const input: ReferenceResponse = {
				knows_since: 'poco',
				stable_income: false,
				financial_responsibility: 'no sé',
				would_lend_money: true
			};
			expect(calculateScore(input)).toBe(40);
		});

		it('gives +30 for stable_income', () => {
			const input: ReferenceResponse = {
				knows_since: 'poco',
				stable_income: true,
				financial_responsibility: 'no sé',
				would_lend_money: false
			};
			expect(calculateScore(input)).toBe(30);
		});

		it('gives +20 when knows_since contains "año"', () => {
			const input: ReferenceResponse = {
				knows_since: '1 año',
				stable_income: false,
				financial_responsibility: 'no sé',
				would_lend_money: false
			};
			expect(calculateScore(input)).toBe(20);
		});

		it('gives +20 when knows_since contains a number > 1', () => {
			const input: ReferenceResponse = {
				knows_since: '3 meses',
				stable_income: false,
				financial_responsibility: 'no sé',
				would_lend_money: false
			};
			expect(calculateScore(input)).toBe(20);
		});

		it('gives 0 for knows_since with number <= 1', () => {
			const input: ReferenceResponse = {
				knows_since: '1 mes',
				stable_income: false,
				financial_responsibility: 'no sé',
				would_lend_money: false
			};
			expect(calculateScore(input)).toBe(0);
		});

		it('gives +10 for positive financial_responsibility words', () => {
			const input: ReferenceResponse = {
				knows_since: 'poco',
				stable_income: false,
				financial_responsibility: 'Es muy confiable',
				would_lend_money: false
			};
			expect(calculateScore(input)).toBe(10);
		});

		it('handles combination: stable_income + would_lend = 70', () => {
			const input: ReferenceResponse = {
				knows_since: 'poco',
				stable_income: true,
				financial_responsibility: 'no sé',
				would_lend_money: true
			};
			expect(calculateScore(input)).toBe(70);
		});
	});

	describe('handleSaveReferenceResponse', () => {
		const baseInput: ReferenceResponse = {
			knows_since: '3 años',
			stable_income: true,
			financial_responsibility: 'Muy responsable',
			would_lend_money: true
		};

		it('returns error when reference not found', async () => {
			selectResults = [[]];
			const result = await handleSaveReferenceResponse(baseInput, {
				userId: 0,
				phone: '+5491100000000'
			});
			expect(result.ok).toBe(false);
			expect(result.message).toContain('No se encontró');
		});

		it('updates the reference record with responses and score', async () => {
			selectResults = [
				[{ id: 1, userId: 10, phone: '+5491112345678', status: 'contacted', score: null }],
				[{ id: 1, userId: 10, phone: '+5491112345678', status: 'contacted', score: null }],
				[
					{
						id: 10,
						name: 'Aplicante',
						phone: '+5491100000000',
						monthlyIncome: 100000,
						occupation: 'dev'
					}
				]
			];

			let selectCount = 0;
			mockFrom.mockImplementation(() => ({
				where: () => {
					selectCount++;
					if (selectCount === 1) {
						return { limit: () => selectResults[0] };
					}
					if (selectCount === 2) {
						return selectResults[1];
					}
					return { limit: () => selectResults[2] };
				}
			}));

			const result = await handleSaveReferenceResponse(baseInput, {
				userId: 10,
				phone: '+5491112345678'
			});

			expect(result.ok).toBe(true);
			expect(result.message).toBe('Respuesta guardada. Gracias por tu tiempo.');
			expect(mockUpdate).toHaveBeenCalled();
		});

		it('triggers credit decision when all references responded', async () => {
			let selectCount = 0;
			mockFrom.mockImplementation(() => ({
				where: () => {
					selectCount++;
					if (selectCount === 1) {
						return {
							limit: () => [
								{ id: 1, userId: 10, phone: '+5491100000001', status: 'contacted', score: null }
							]
						};
					}
					if (selectCount === 2) {
						return [
							{ id: 1, userId: 10, phone: '+5491100000001', status: 'contacted', score: null },
							{ id: 2, userId: 10, phone: '+5491100000002', status: 'responded', score: 80 },
							{ id: 3, userId: 10, phone: '+5491100000003', status: 'responded', score: 60 }
						];
					}
					return {
						limit: () => [
							{
								id: 10,
								name: 'Aplicante',
								phone: '+5491100000000',
								monthlyIncome: 100000,
								occupation: 'dev'
							}
						]
					};
				}
			}));

			const result = await handleSaveReferenceResponse(baseInput, {
				userId: 10,
				phone: '+5491100000001'
			});

			expect(result.ok).toBe(true);
			expect(mockTriggerCreditDecision).toHaveBeenCalledTimes(1);
			expect(mockTriggerCreditDecision).toHaveBeenCalledWith(
				10,
				'+5491100000000',
				expect.objectContaining({ trustScore: 80 })
			);
		});

		it('does NOT trigger credit decision when not all refs responded', async () => {
			let selectCount = 0;
			mockFrom.mockImplementation(() => ({
				where: () => {
					selectCount++;
					if (selectCount === 1) {
						return {
							limit: () => [
								{ id: 1, userId: 10, phone: '+5491100000001', status: 'contacted', score: null }
							]
						};
					}
					return [
						{ id: 1, userId: 10, phone: '+5491100000001', status: 'contacted', score: null },
						{ id: 2, userId: 10, phone: '+5491100000002', status: 'responded', score: 80 },
						{ id: 3, userId: 10, phone: '+5491100000003', status: 'pending', score: null }
					];
				}
			}));

			const result = await handleSaveReferenceResponse(baseInput, {
				userId: 10,
				phone: '+5491100000001'
			});

			expect(result.ok).toBe(true);
			expect(mockTriggerCreditDecision).not.toHaveBeenCalled();
		});
	});
});
