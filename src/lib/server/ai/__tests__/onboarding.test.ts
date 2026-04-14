import { describe, test, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockDbUpdate = vi.fn((..._args: unknown[]) => ({
	set: vi.fn(() => ({
		where: vi.fn(() => Promise.resolve())
	}))
}));

const mockDbInsert = vi.fn((..._args: unknown[]) => ({
	values: vi.fn(() => Promise.resolve())
}));

const mockDbSelect = vi.fn((..._args: unknown[]) => ({
	from: vi.fn(() => ({
		where: vi.fn(() => ({
			limit: vi.fn(() => []) // no collision on reference codes
		}))
	}))
}));

vi.mock('../../db', () => ({
	db: {
		update: (...args: unknown[]) => mockDbUpdate(...args),
		insert: (...args: unknown[]) => mockDbInsert(...args),
		select: (...args: unknown[]) => mockDbSelect(...args)
	}
}));

vi.mock('../../db/schema', () => ({
	users: { id: 'users.id' },
	references: { id: 'references.id' }
}));

vi.mock('drizzle-orm', () => ({
	eq: (col: unknown, val: unknown) => ({ col, val })
}));

vi.mock('../pipeline', () => ({
	generateReferenceCode: () => 'REF-TEST'
}));

import { saveUserProfile, submitReferences } from '../handlers/onboarding';

describe('onboarding handler', () => {
	beforeEach(() => {
		mockDbUpdate.mockClear();
		mockDbInsert.mockClear();

		mockDbUpdate.mockImplementation(() => ({
			set: vi.fn(() => ({
				where: vi.fn(() => Promise.resolve())
			}))
		}));
		mockDbInsert.mockImplementation(() => ({
			values: vi.fn(() => Promise.resolve())
		}));
	});

	describe('save_user_profile', () => {
		test('updates user with provided data and sets onboardingComplete', async () => {
			const result = await saveUserProfile(42, {
				name: 'Juan Pérez',
				dni: '12345678',
				monthly_income: 150000,
				occupation: 'Carpintero'
			});

			expect(result.ok).toBe(true);
			expect(result.message).toContain('Perfil guardado');
			expect(mockDbUpdate).toHaveBeenCalledTimes(1);
		});
	});

	describe('submit_references', () => {
		test('generates 3 reference codes and inserts into DB', async () => {
			// Mock select for uniqueness check (no existing codes)
			const mockDbSelect = vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() => []) // no collision
					}))
				}))
			}));

			// Re-mock db with select
			vi.mocked(mockDbInsert).mockImplementation(() => ({
				values: vi.fn(() => Promise.resolve())
			}));

			const result = await submitReferences(42);

			expect(result.ok).toBe(true);
			expect(result.newState).toBe('verification');
			expect(result.codes).toHaveLength(3);
			for (const code of result.codes as string[]) {
				expect(code).toMatch(/^REF-[A-Z0-9]{4}$/);
			}
		});

		test('returns codes in message', async () => {
			const result = await submitReferences(42);

			expect(result.message).toContain('REF-');
		});
	});
});
