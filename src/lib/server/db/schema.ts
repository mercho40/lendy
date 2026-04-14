import {
	pgTable,
	serial,
	text,
	integer,
	boolean,
	timestamp,
	jsonb,
	pgEnum
} from 'drizzle-orm/pg-core';

// Enums
export const conversationStateEnum = pgEnum('conversation_state', [
	'onboarding',
	'verification',
	'credit_decision',
	'active_loan'
]);
export const loanStatusEnum = pgEnum('loan_status', ['active', 'paid', 'overdue']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'approved', 'rejected']);
export const referenceStatusEnum = pgEnum('reference_status', [
	'pending',
	'contacted',
	'responded',
	'failed'
]);
export const managerRunTriggerEnum = pgEnum('manager_run_trigger', ['cron', 'manual', 'chat']);
export const managerActionKindEnum = pgEnum('manager_action_kind', [
	'snapshot',
	'nudge',
	'reminder',
	'observation'
]);

// Tables
export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	phone: text('phone').unique().notNull(),
	name: text('name'),
	dni: text('dni'),
	monthlyIncome: integer('monthly_income'),
	occupation: text('occupation'),
	onboardingComplete: boolean('onboarding_complete').default(false).notNull(),
	trustScore: integer('trust_score'), // 0-100, calculated from references
	lastNudgedAt: timestamp('last_nudged_at'), // dedupe manager nudges
	voiceTranscript: jsonb('voice_transcript'), // ElevenLabs transcript array
	voiceAnalysis: jsonb('voice_analysis'), // ElevenLabs analysis/summary object
	voiceCompletedAt: timestamp('voice_completed_at'),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const references = pgTable('user_references', {
	id: serial('id').primaryKey(),
	userId: integer('user_id')
		.references(() => users.id)
		.notNull(),
	phone: text('phone'), // null until the reference writes to the bot
	name: text('name'),
	relationship: text('relationship'),
	referenceCode: text('reference_code').unique(), // REF-XXXX format
	status: referenceStatusEnum('status').default('pending').notNull(),
	responses: jsonb('responses'), // { answers to verification questions }
	score: integer('score'), // individual reference score 0-100
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const loans = pgTable('loans', {
	id: serial('id').primaryKey(),
	userId: integer('user_id')
		.references(() => users.id)
		.notNull(),
	amount: integer('amount').notNull(), // ARS cents
	totalInstallments: integer('total_installments').notNull(),
	installmentsPaid: integer('installments_paid').default(0).notNull(),
	installmentAmount: integer('installment_amount').notNull(), // ARS cents
	interestRate: integer('interest_rate').notNull(), // basis points (100 bps = 1%; e.g. 500 = 5%, 12000 = 120% TNA)
	status: loanStatusEnum('status').default('active').notNull(),
	nextDueDate: timestamp('next_due_date'),
	terms: jsonb('terms'), // full credit decision output
	lastReminderAt: timestamp('last_reminder_at'), // dedupe cron reminders
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const payments = pgTable('payments', {
	id: serial('id').primaryKey(),
	loanId: integer('loan_id')
		.references(() => loans.id)
		.notNull(),
	amount: integer('amount').notNull(), // ARS cents
	mpPreferenceId: text('mp_preference_id'),
	mpPaymentId: text('mp_payment_id'),
	status: paymentStatusEnum('status').default('pending').notNull(),
	paymentLink: text('payment_link'),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const conversations = pgTable('conversations', {
	id: serial('id').primaryKey(),
	userId: integer('user_id')
		.references(() => users.id)
		.notNull(),
	phone: text('phone').notNull(), // denormalized for quick lookup
	messages: jsonb('messages').default([]).notNull(),
	state: conversationStateEnum('state').default('onboarding').notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// ---------------------------------------------------------------------------
// Manager (autopilot) audit log
// ---------------------------------------------------------------------------

// Una ejecución del autopilot: snapshot + transcript + resumen final.
export const managerRuns = pgTable('manager_runs', {
	id: serial('id').primaryKey(),
	trigger: managerRunTriggerEnum('trigger').default('cron').notNull(),
	summary: text('summary'), // resumen textual que devolvió el LLM al terminar
	transcript: jsonb('transcript').default([]).notNull(), // messages array completo
	actionsCount: integer('actions_count').default(0).notNull(),
	startedAt: timestamp('started_at').defaultNow().notNull(),
	endedAt: timestamp('ended_at')
});

// Cada acción concreta que tomó un run (nudge, reminder, snapshot read, etc.).
export const managerActions = pgTable('manager_actions', {
	id: serial('id').primaryKey(),
	runId: integer('run_id')
		.references(() => managerRuns.id, { onDelete: 'cascade' })
		.notNull(),
	kind: managerActionKindEnum('kind').notNull(),
	targetUserId: integer('target_user_id').references(() => users.id),
	targetLoanId: integer('target_loan_id').references(() => loans.id),
	summary: text('summary').notNull(),
	payload: jsonb('payload'),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

// Chat operativo con el manager. Es una fila singleton (id=1) cuyo jsonb
// `messages` acumula toda la conversación con el operador.
export const managerChats = pgTable('manager_chats', {
	id: serial('id').primaryKey(),
	messages: jsonb('messages').default([]).notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});
