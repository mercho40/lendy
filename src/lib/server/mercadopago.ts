import { BASE_URL } from '$env/static/private';

// Mock mínimo de MercadoPago para la demo — no llama al SDK real.
// createPaymentPreference devuelve un link a /mock-pay/[paymentId] que es nuestro
// checkout falso. getPayment sintetiza la respuesta a partir del id que manda el
// mock checkout al webhook.

const MOCK_PREFIX = 'MOCK';

export interface MockPayment {
	id: string;
	external_reference: string;
	status: 'approved' | 'rejected' | 'pending';
}

export async function createPaymentPreference(opts: {
	loanId: number;
	paymentId: number;
	amountPesos: number;
	description: string;
}): Promise<{ id: string; initPoint: string }> {
	const id = `${MOCK_PREFIX}-PREF-${opts.paymentId}-${Date.now()}`;
	const initPoint = `${BASE_URL}/mock-pay/${opts.paymentId}`;
	return { id, initPoint };
}

// El mock checkout manda al webhook un id con shape MOCK-<paymentRowId>-<APPROVED|REJECTED>
export async function getPayment(mpPaymentId: string): Promise<MockPayment> {
	if (!mpPaymentId.startsWith(`${MOCK_PREFIX}-`)) {
		throw new Error(`getPayment mock no reconoce el id: ${mpPaymentId}`);
	}
	const parts = mpPaymentId.split('-');
	const paymentRowId = parts[1];
	const outcome = (parts[2] ?? 'APPROVED').toUpperCase();
	return {
		id: mpPaymentId,
		external_reference: paymentRowId,
		status: outcome === 'REJECTED' ? 'rejected' : 'approved'
	};
}
