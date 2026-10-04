import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { AllowedMimeType, Evidence } from '@/domain/evidence/evidence';
import type { Loan } from '@/domain/loan/loan';
import type { PaymentCorrection } from '@/domain/payment/correction';
import type { Payment } from '@/domain/payment/payment';
import { DateOnly } from '@/domain/shared/date-only';
import { Money } from '@/domain/shared/money';
import { loans, paymentCorrections, paymentEvidence, payments } from '@/infrastructure/db/schema';

type LoanRow = InferSelectModel<typeof loans>;
type PaymentRow = InferSelectModel<typeof payments>;
type EvidenceRow = InferSelectModel<typeof paymentEvidence>;
type CorrectionRow = InferSelectModel<typeof paymentCorrections>;

export function rowToLoan(row: LoanRow): Loan {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    loanNumber: row.loanNumber,
    openingBalance: Money.of(row.openingBalance),
    openingBalanceDate: DateOnly.of(row.openingBalanceDate),
    defaultAmount: row.defaultAmount === null ? null : Money.of(row.defaultAmount),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function loanToRow(loan: Loan): InferInsertModel<typeof loans> {
  return {
    id: loan.id,
    userId: loan.userId,
    name: loan.name,
    loanNumber: loan.loanNumber,
    openingBalance: loan.openingBalance.toString(),
    openingBalanceDate: loan.openingBalanceDate.iso,
    defaultAmount: loan.defaultAmount?.toString() ?? null,
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt,
  };
}

export function rowToPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    loanId: row.loanId,
    userId: row.userId,
    paidAt: DateOnly.of(row.paidAt),
    amount: Money.of(row.amount),
    paymentMethod: row.paymentMethod,
    referenceNo: row.referenceNo,
    notes: row.notes,
    status: row.status,
    voidedAt: row.voidedAt,
    voidReason: row.voidReason,
    replacedByPaymentId: row.replacedByPaymentId,
    createdAt: row.createdAt,
  };
}

export function paymentToRow(p: Payment): InferInsertModel<typeof payments> {
  return {
    id: p.id,
    loanId: p.loanId,
    userId: p.userId,
    paidAt: p.paidAt.iso,
    amount: p.amount.toString(),
    paymentMethod: p.paymentMethod,
    referenceNo: p.referenceNo,
    notes: p.notes,
    status: p.status,
    voidedAt: p.voidedAt,
    voidReason: p.voidReason,
    replacedByPaymentId: p.replacedByPaymentId,
    createdAt: p.createdAt,
  };
}

export function rowToEvidence(row: EvidenceRow): Evidence {
  return {
    id: row.id,
    paymentId: row.paymentId,
    userId: row.userId,
    storagePath: row.storagePath,
    type: row.type,
    mimeType: row.mimeType as AllowedMimeType,
    sizeBytes: row.sizeBytes,
    originalFilename: row.originalFilename,
    createdAt: row.createdAt,
  };
}

export function evidenceToRow(e: Evidence): InferInsertModel<typeof paymentEvidence> {
  return {
    id: e.id,
    paymentId: e.paymentId,
    userId: e.userId,
    storagePath: e.storagePath,
    type: e.type,
    mimeType: e.mimeType,
    sizeBytes: e.sizeBytes,
    originalFilename: e.originalFilename,
    createdAt: e.createdAt,
  };
}

export function rowToCorrection(row: CorrectionRow): PaymentCorrection {
  return {
    id: row.id,
    userId: row.userId,
    originalPaymentId: row.originalPaymentId,
    replacementPaymentId: row.replacementPaymentId,
    reason: row.reason,
    createdAt: row.createdAt,
  };
}

export function correctionToRow(c: PaymentCorrection): InferInsertModel<typeof paymentCorrections> {
  return {
    id: c.id,
    userId: c.userId,
    originalPaymentId: c.originalPaymentId,
    replacementPaymentId: c.replacementPaymentId,
    reason: c.reason,
    createdAt: c.createdAt,
  };
}
