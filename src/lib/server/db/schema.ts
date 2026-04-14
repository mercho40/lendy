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
export const groupStatusEnum = pgEnum('group_status', ['forming', 'active', 'defaulted']);
export const loanStatusEnum = pgEnum('loan_status', ['active', 'paid', 'overdue']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'approved', 'rejected']);
export const conversationStateEnum = pgEnum('conversation_state', [
	'onboarding',
	'group_formation',
	'active',
	'payment_pending'
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
	groupId: integer('group_id').references(() => groups.id),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const groups = pgTable('groups', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	inviteCode: text('invite_code').unique().notNull(),
	maxMembers: integer('max_members').default(5).notNull(),
	status: groupStatusEnum('status').default('forming').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const loans = pgTable('loans', {
	id: serial('id').primaryKey(),
	userId: integer('user_id')
		.references(() => users.id)
		.notNull(),
	groupId: integer('group_id')
		.references(() => groups.id)
		.notNull(),
	amount: integer('amount').notNull(), // ARS cents
	totalInstallments: integer('total_installments').notNull(),
	installmentsPaid: integer('installments_paid').default(0).notNull(),
	installmentAmount: integer('installment_amount').notNull(), // ARS cents
	status: loanStatusEnum('status').default('active').notNull(),
	nextDueDate: timestamp('next_due_date'),
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
	messages: jsonb('messages').default([]).notNull(),
	state: conversationStateEnum('state').default('onboarding').notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});
