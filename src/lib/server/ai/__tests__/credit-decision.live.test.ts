/**
 * LIVE TEST — hace 1 API call real a Claude. Corre con:
 *   LIVE=1 bun run test -- credit-decision.live
 *
 * Costo estimado: ~$0.01 por ejecución
 */
import { describe, it, expect } from 'vitest';

// Skip unless LIVE=1
const LIVE = process.env.LIVE === '1';

describe.skipIf(!LIVE)('Credit Decision — LIVE API test', () => {
	it('evaluates a good profile (score 75, income $400k)', async () => {
		const { evaluateCredit } = await import('../handlers/credit-decision');

		const decision = await evaluateCredit(1, {
			name: 'Carlos Pérez',
			monthlyIncome: 400000,
			occupation: 'Empleado en relación de dependencia',
			trustScore: 75,
			referencesSummary:
				'3 referencias positivas. Todas dicen que es responsable, tiene ingreso estable, y le prestarían plata. Lo conocen hace más de 3 años.'
		});

		console.log('\n=== CREDIT DECISION (score 75, income $400k) ===');
		console.log(JSON.stringify(decision, null, 2));

		expect(decision.approved).toBe(true);
		expect(decision.segment).toBe('plus');
		expect(decision.amount).toBeGreaterThanOrEqual(20000);
		expect(decision.amount).toBeLessThanOrEqual(715600);
		expect(decision.weeks).toBeGreaterThanOrEqual(8);
		expect(decision.weeks).toBeLessThanOrEqual(72);
		expect(decision.weeks % 4).toBe(0);
		expect(decision.tna).toBe(85);
		// Cuota no puede superar 25% del ingreso semanal
		const weeklyIncome = 400000 / 4.33;
		expect(decision.weeklyPayment).toBeLessThanOrEqual(weeklyIncome * 0.25 * 1.1); // 10% tolerance
	}, 30000);

	it('evaluates a low profile (score 20, income $200k)', async () => {
		const { evaluateCredit } = await import('../handlers/credit-decision');

		const decision = await evaluateCredit(2, {
			name: 'María López',
			monthlyIncome: 200000,
			occupation: 'Empleada informal',
			trustScore: 20,
			referencesSummary:
				'2 de 3 referencias respondieron. Una dice que es responsable pero tiene deudas. La otra no está segura de su estabilidad. Una referencia no respondió.'
		});

		console.log('\n=== CREDIT DECISION (score 20, income $200k) ===');
		console.log(JSON.stringify(decision, null, 2));

		expect(decision.segment).toBe('nuevo');
		if (decision.approved) {
			expect(decision.amount).toBeLessThanOrEqual(178900);
			expect(decision.weeks).toBeLessThanOrEqual(24);
			expect(decision.tna).toBe(120);
		}
	}, 30000);

	it('evaluates a premium profile (score 90, income $800k)', async () => {
		const { evaluateCredit } = await import('../handlers/credit-decision');

		const decision = await evaluateCredit(3, {
			name: 'Roberto Fernández',
			monthlyIncome: 800000,
			occupation: 'Contador independiente, monotributista',
			trustScore: 90,
			referencesSummary:
				'3 referencias excelentes. Todas lo conocen hace +5 años, confirman ingresos estables, muy responsable con pagos, todas le prestarían plata sin dudar.'
		});

		console.log('\n=== CREDIT DECISION (score 90, income $800k) ===');
		console.log(JSON.stringify(decision, null, 2));

		expect(decision.approved).toBe(true);
		expect(decision.segment).toBe('premium');
		expect(decision.amount).toBeGreaterThanOrEqual(20000);
		expect(decision.amount).toBeLessThanOrEqual(1073400);
		expect(decision.tna).toBe(70);
	}, 30000);
});
