import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

// Mock DB results
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();

const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectLimit = vi.fn();

const mockInsertValues = vi.fn();
const mockInsertReturning = vi.fn();

const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

// Chain builders
mockDbSelect.mockReturnValue({ from: mockSelectFrom });
mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });

mockDbInsert.mockReturnValue({ values: mockInsertValues });
mockInsertValues.mockReturnValue({ returning: mockInsertReturning });

mockDbUpdate.mockReturnValue({ set: mockUpdateSet });
mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });

vi.mock('$lib/server/db', () => ({
	db: {
		select: mockDbSelect,
		insert: mockDbInsert,
		update: mockDbUpdate
	}
}));

vi.mock('$lib/server/db/schema', () => ({
	users: { id: 'users.id', phone: 'users.phone' },
	conversations: { id: 'conversations.id', userId: 'conversations.userId', messages: 'conversations.messages' },
	references: { id: 'references.id', phone: 'references.phone', userId: 'references.userId' }
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((col, val) => ({ col, val }))
}));

const mockSendText = vi.fn().mockResolvedValue(undefined);
vi.mock('$lib/server/whatsapp', () => ({
	sendText: mockSendText
}));

const mockRunAgent = vi.fn();
vi.mock('$lib/server/ai/agent', () => ({
	runAgent: mockRunAgent
}));

vi.mock('$env/static/private', () => ({
	KAPSO_VERIFY_TOKEN: 'test-token'
}));

// Import the handlers AFTER mocks are set up
const { GET, POST } = await import('../../../../routes/api/whatsapp/+server');

// --- Helpers ---

function makeRequest(body: unknown): Request {
	return new Request('http://localhost/api/whatsapp', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

function inboundPayload(phone: string, text: string) {
	return {
		message: {
			text: { body: text },
			kapso: { direction: 'inbound', content: text }
		},
		conversation: { phone_number: phone }
	};
}

// --- Tests ---

describe('WhatsApp Webhook', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Reset chain mocks
		mockDbSelect.mockReturnValue({ from: mockSelectFrom });
		mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
		mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });

		mockDbInsert.mockReturnValue({ values: mockInsertValues });
		mockInsertValues.mockReturnValue({ returning: mockInsertReturning });

		mockDbUpdate.mockReturnValue({ set: mockUpdateSet });
		mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
		mockUpdateWhere.mockResolvedValue(undefined);
	});

	describe('POST - inbound text creates user and conversation', () => {
		it('creates a new user and conversation for unknown phone number', async () => {
			const phone = '+5491155551234';
			const text = 'Hola, quiero un préstamo';

			// references lookup: no match
			mockSelectLimit.mockResolvedValueOnce([]);
			// users lookup: no match
			mockSelectLimit.mockResolvedValueOnce([]);

			const newUser = { id: 1, phone, name: null, onboardingComplete: false };
			// insert user
			mockInsertReturning.mockResolvedValueOnce([newUser]);

			// conversations lookup: no match
			mockSelectLimit.mockResolvedValueOnce([]);

			const newConvo = { id: 10, userId: 1, messages: [], state: 'onboarding' };
			// insert conversation
			mockInsertReturning.mockResolvedValueOnce([newConvo]);

			// Agent fails (no API key)
			mockRunAgent.mockRejectedValueOnce(new Error('No API key'));

			const req = makeRequest(inboundPayload(phone, text));
			const res = await POST({ request: req } as any);

			expect(res.status).toBe(200);

			// Should have tried to insert a user
			expect(mockDbInsert).toHaveBeenCalled();

			// Should send fallback message
			expect(mockSendText).toHaveBeenCalledWith(
				phone,
				'Estamos configurando el sistema. Volvé a intentar en unos minutos.'
			);
		});

		it('reuses existing user and conversation', async () => {
			const phone = '+5491155551234';
			const existingUser = { id: 5, phone, name: 'Juan', onboardingComplete: true };
			const existingConvo = {
				id: 20,
				userId: 5,
				messages: [{ role: 'user', content: 'hola' }],
				state: 'onboarding'
			};

			// references lookup: no match
			mockSelectLimit.mockResolvedValueOnce([]);
			// users lookup: found
			mockSelectLimit.mockResolvedValueOnce([existingUser]);
			// conversations lookup: found
			mockSelectLimit.mockResolvedValueOnce([existingConvo]);

			mockRunAgent.mockResolvedValueOnce({
				reply: 'Hola Juan!',
				messages: [
					{ role: 'user', content: 'hola' },
					{ role: 'user', content: 'Quiero pagar' },
					{ role: 'assistant', content: 'Hola Juan!' }
				]
			});

			const req = makeRequest(inboundPayload(phone, 'Quiero pagar'));
			const res = await POST({ request: req } as any);

			expect(res.status).toBe(200);
			expect(mockRunAgent).toHaveBeenCalledWith(
				expect.arrayContaining([
					{ role: 'user', content: 'hola' },
					{ role: 'user', content: 'Quiero pagar' }
				]),
				expect.objectContaining({ userId: 5, phone })
			);
			expect(mockSendText).toHaveBeenCalledWith(phone, 'Hola Juan!');
		});
	});

	describe('POST - non-inbound messages are ignored', () => {
		it('ignores outbound messages', async () => {
			const req = makeRequest({
				message: {
					text: { body: 'hello' },
					kapso: { direction: 'outbound' }
				},
				conversation: { phone_number: '+5491155551234' }
			});

			const res = await POST({ request: req } as any);

			expect(res.status).toBe(200);
			expect(mockSendText).not.toHaveBeenCalled();
			expect(mockRunAgent).not.toHaveBeenCalled();
		});

		it('ignores messages without text', async () => {
			const req = makeRequest({
				message: {
					kapso: { direction: 'inbound', content: '' }
				},
				conversation: { phone_number: '+5491155551234' }
			});

			const res = await POST({ request: req } as any);

			expect(res.status).toBe(200);
			expect(mockSendText).not.toHaveBeenCalled();
		});

		it('ignores messages without phone number', async () => {
			const req = makeRequest({
				message: {
					text: { body: 'hello' },
					kapso: { direction: 'inbound' }
				},
				conversation: {}
			});

			const res = await POST({ request: req } as any);

			expect(res.status).toBe(200);
			expect(mockSendText).not.toHaveBeenCalled();
		});
	});

	describe('POST - reference phone routes to verification', () => {
		it('routes reference messages to the applicant conversation', async () => {
			const refPhone = '+5491166665555';
			const ref = { id: 1, userId: 42, phone: refPhone, name: 'María', verified: false };
			const convo = {
				id: 30,
				userId: 42,
				messages: [{ role: 'user', content: 'previous msg' }],
				state: 'onboarding'
			};

			// references lookup: found
			mockSelectLimit.mockResolvedValueOnce([ref]);
			// conversations lookup for applicant (userId 42): found
			mockSelectLimit.mockResolvedValueOnce([convo]);

			mockRunAgent.mockResolvedValueOnce({
				reply: 'Gracias María por tu referencia.',
				messages: [
					{ role: 'user', content: 'previous msg' },
					{ role: 'user', content: '[REFERENCIA María]: Sí, lo conozco' },
					{ role: 'assistant', content: 'Gracias María por tu referencia.' }
				]
			});

			const req = makeRequest(inboundPayload(refPhone, 'Sí, lo conozco'));
			const res = await POST({ request: req } as any);

			expect(res.status).toBe(200);

			// Agent should be called with the applicant's userId and the reference's phone
			expect(mockRunAgent).toHaveBeenCalledWith(
				expect.arrayContaining([
					{ role: 'user', content: '[REFERENCIA María]: Sí, lo conozco' }
				]),
				expect.objectContaining({ userId: 42, phone: refPhone })
			);

			// Reply goes to the reference's phone
			expect(mockSendText).toHaveBeenCalledWith(refPhone, 'Gracias María por tu referencia.');
		});
	});

	describe('POST - conversation state persisted after agent response', () => {
		it('saves updated messages to the conversation after agent responds', async () => {
			const phone = '+5491155559999';
			const user = { id: 7, phone, name: 'Pedro' };
			const convo = { id: 50, userId: 7, messages: [], state: 'onboarding' };

			// references: no match
			mockSelectLimit.mockResolvedValueOnce([]);
			// user: found
			mockSelectLimit.mockResolvedValueOnce([user]);
			// conversation: found
			mockSelectLimit.mockResolvedValueOnce([convo]);

			const agentMessages = [
				{ role: 'user', content: 'Hola' },
				{ role: 'assistant', content: 'Bienvenido Pedro!' }
			];

			mockRunAgent.mockResolvedValueOnce({
				reply: 'Bienvenido Pedro!',
				messages: agentMessages
			});

			const req = makeRequest(inboundPayload(phone, 'Hola'));
			const res = await POST({ request: req } as any);

			expect(res.status).toBe(200);

			// Verify conversation update was called with new messages
			expect(mockDbUpdate).toHaveBeenCalled();
			expect(mockUpdateSet).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: agentMessages
				})
			);
		});

		it('saves messages even when agent fails', async () => {
			const phone = '+5491155558888';
			const user = { id: 8, phone };
			const convo = { id: 60, userId: 8, messages: [], state: 'onboarding' };

			// references: no match
			mockSelectLimit.mockResolvedValueOnce([]);
			// user: found
			mockSelectLimit.mockResolvedValueOnce([user]);
			// conversation: found
			mockSelectLimit.mockResolvedValueOnce([convo]);

			mockRunAgent.mockRejectedValueOnce(new Error('API key missing'));

			const req = makeRequest(inboundPayload(phone, 'Hola'));
			const res = await POST({ request: req } as any);

			expect(res.status).toBe(200);

			// Should still save the user message
			expect(mockUpdateSet).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: [{ role: 'user', content: 'Hola' }]
				})
			);

			// Should send fallback
			expect(mockSendText).toHaveBeenCalledWith(
				phone,
				'Estamos configurando el sistema. Volvé a intentar en unos minutos.'
			);
		});
	});
});
