import { describe, it, expect, vi } from 'vitest';

// Mock whatsapp before importing pipeline
vi.mock('../../whatsapp', () => ({
	sendText: vi.fn().mockResolvedValue(undefined)
}));

// Mock credit decision
vi.mock('../handlers/credit-decision', () => ({
	evaluateCredit: vi.fn().mockResolvedValue({
		approved: true,
		amount: 20000,
		installments: 4,
		interestRate: 500,
		weeklyPayment: 5250,
		reason: 'Buen perfil crediticio'
	})
}));

import { triggerVerification, triggerCreditDecision, triggerPaymentReminder } from '../pipeline';
import { sendText } from '../../whatsapp';
import { evaluateCredit } from '../handlers/credit-decision';

describe('Pipeline: triggerVerification', () => {
	it('sends a message to each reference', async () => {
		const refs = [
			{ phone: '+5491100001111', name: 'Juan' },
			{ phone: '+5491100002222', name: 'María' },
			{ phone: '+5491100003333' }
		];

		await triggerVerification(1, 'Carlos', refs);

		expect(sendText).toHaveBeenCalledTimes(3);
		expect(sendText).toHaveBeenCalledWith('+5491100001111', expect.stringContaining('Juan'));
		expect(sendText).toHaveBeenCalledWith('+5491100002222', expect.stringContaining('María'));
		expect(sendText).toHaveBeenCalledWith('+5491100003333', expect.stringContaining('Carlos'));
	});

	it('includes the applicant name in the message', async () => {
		await triggerVerification(1, 'Pedro', [{ phone: '+5491100001111' }]);

		expect(sendText).toHaveBeenCalledWith(
			'+5491100001111',
			expect.stringContaining('Pedro')
		);
	});
});

describe('Pipeline: triggerCreditDecision', () => {
	it('calls evaluateCredit and sends approval message', async () => {
		await triggerCreditDecision(1, '+5491155551234', {
			name: 'Carlos',
			monthlyIncome: 200000,
			occupation: 'Programador',
			trustScore: 85,
			referencesSummary: 'Todas las referencias son positivas'
		});

		expect(evaluateCredit).toHaveBeenCalledWith(1, expect.objectContaining({
			name: 'Carlos',
			trustScore: 85
		}));

		expect(sendText).toHaveBeenCalledWith(
			'+5491155551234',
			expect.stringContaining('aprobado')
		);
		expect(sendText).toHaveBeenCalledWith(
			'+5491155551234',
			expect.stringContaining('$20000')
		);
	});
});

describe('Pipeline: triggerPaymentReminder', () => {
	it('sends pre-due reminder when days > 0', async () => {
		await triggerPaymentReminder('+5491155551234', 'Carlos', {
			installmentNumber: 2,
			totalInstallments: 4,
			amount: 5250,
			dueDate: '2026-04-20',
			daysUntilDue: 2
		});

		expect(sendText).toHaveBeenCalledWith(
			'+5491155551234',
			expect.stringContaining('recuerdo')
		);
	});

	it('sends due-today message when days === 0', async () => {
		await triggerPaymentReminder('+5491155551234', 'Carlos', {
			installmentNumber: 2,
			totalInstallments: 4,
			amount: 5250,
			dueDate: '2026-04-18',
			daysUntilDue: 0
		});

		expect(sendText).toHaveBeenCalledWith(
			'+5491155551234',
			expect.stringContaining('hoy vence')
		);
	});

	it('sends overdue message with renegotiation offer when days < 0', async () => {
		await triggerPaymentReminder('+5491155551234', 'Carlos', {
			installmentNumber: 2,
			totalInstallments: 4,
			amount: 5250,
			dueDate: '2026-04-15',
			daysUntilDue: -3
		});

		expect(sendText).toHaveBeenCalledWith(
			'+5491155551234',
			expect.stringContaining('atraso')
		);
		expect(sendText).toHaveBeenCalledWith(
			'+5491155551234',
			expect.stringContaining('renegociación')
		);
	});
});
