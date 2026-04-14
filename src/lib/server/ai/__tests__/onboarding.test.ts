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

const mockTriggerVerification = vi.fn((..._args: unknown[]) => Promise.resolve());

vi.mock('../../db', () => ({
	db: {
		update: (...args: unknown[]) => mockDbUpdate(...args),
		insert: (...args: unknown[]) => mockDbInsert(...args)
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
	triggerVerification: (...args: unknown[]) => mockTriggerVerification(...args)
}));

import { saveUserProfile, submitReferences } from '../handlers/onboarding';

describe('onboarding handler', () => {
	beforeEach(() => {
		mockDbUpdate.mockClear();
		mockDbInsert.mockClear();
		mockTriggerVerification.mockClear();

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

			expect(result).toEqual({ ok: true, message: 'Perfil guardado' });
			expect(mockDbUpdate).toHaveBeenCalledTimes(1);
		});
	});

	describe('submit_references', () => {
		test('inserts references into the database', async () => {
			const refs = [
				{ phone: '+5491155551111', name: 'María', relationship: 'amiga' },
				{ phone: '+5491155552222' }
			];

			const result = await submitReferences(42, 'Juan Pérez', { references: refs });

			expect(result.ok).toBe(true);
			expect(result.message).toBe('Referencias registradas. Iniciando verificación.');
			expect(mockDbInsert).toHaveBeenCalledTimes(2);
		});

		test('calls triggerVerification with correct args', async () => {
			const refs = [{ phone: '+5491155551111', name: 'María', relationship: 'amiga' }];

			await submitReferences(42, 'Juan Pérez', { references: refs });

			expect(mockTriggerVerification).toHaveBeenCalledTimes(1);
			expect(mockTriggerVerification).toHaveBeenCalledWith(42, 'Juan Pérez', refs);
		});

		test('returns newState verification for state transition', async () => {
			const refs = [{ phone: '+5491155551111' }];

			const result = await submitReferences(42, 'Juan Pérez', { references: refs });

			expect(result.newState).toBe('verification');
		});
	});
});
