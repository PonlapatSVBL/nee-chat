import { date, index, integer, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const paymentMethodEnum = pgEnum('payment_method', ['MOBILE_BANKING', 'COUNTER', 'ATM', 'OTHER']);
export const paymentStatusEnum = pgEnum('payment_status', ['ACTIVE', 'VOIDED']);
export const evidenceTypeEnum = pgEnum('evidence_type', ['PAYMENT_SLIP', 'RECEIPT', 'OTHER']);

const money = (name: string) => numeric(name, { precision: 12, scale: 2 });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const loans = pgTable(
  'loans',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    name: text('name').notNull(),
    loanNumber: text('loan_number'),
    openingBalance: money('opening_balance').notNull(),
    openingBalanceDate: date('opening_balance_date', { mode: 'string' }).notNull(),
    defaultAmount: money('default_amount'),
    createdAt: ts('created_at').notNull(),
    updatedAt: ts('updated_at').notNull(),
  },
  (t) => [uniqueIndex('loans_user_uq').on(t.userId)],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => loans.id),
    userId: uuid('user_id').notNull(),
    paidAt: date('paid_at', { mode: 'string' }).notNull(),
    amount: money('amount').notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    referenceNo: text('reference_no'),
    notes: text('notes'),
    status: paymentStatusEnum('status').notNull(),
    voidedAt: ts('voided_at'),
    voidReason: text('void_reason'),
    replacedByPaymentId: uuid('replaced_by_payment_id'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('payments_loan_user_idx').on(t.loanId, t.userId), index('payments_user_idx').on(t.userId)],
);

export const paymentEvidence = pgTable(
  'payment_evidence',
  {
    id: uuid('id').primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id),
    userId: uuid('user_id').notNull(),
    storagePath: text('storage_path').notNull(),
    type: evidenceTypeEnum('type').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    originalFilename: text('original_filename'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('payment_evidence_payment_idx').on(t.paymentId)],
);

export const paymentCorrections = pgTable(
  'payment_corrections',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    originalPaymentId: uuid('original_payment_id')
      .notNull()
      .references(() => payments.id),
    replacementPaymentId: uuid('replacement_payment_id').references(() => payments.id),
    reason: text('reason').notNull(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('payment_corrections_replacement_idx').on(t.replacementPaymentId)],
);
