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
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const references = pgTable('references', {
	id: serial('id').primaryKey(),
	userId: integer('user_id')
		.references(() => users.id)
		.notNull(),
	phone: text('phone').notNull(),
	name: text('name'),
	relationship: text('relationship'),
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
	interestRate: integer('interest_rate').notNull(), // basis points (500 = 5%)
	status: loanStatusEnum('status').default('active').notNull(),
	nextDueDate: timestamp('next_due_date'),
	terms: jsonb('terms'), // full credit decision output
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
