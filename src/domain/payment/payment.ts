import { DateOnly } from '@/domain/shared/date-only';
import { DomainError } from '@/domain/shared/errors';
import { Money } from '@/domain/shared/money';
import { err, ok, type Result } from '@/domain/shared/result';

export const PAYMENT_METHODS = ['MOBILE_BANKING', 'COUNTER', 'ATM', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PaymentStatus = 'ACTIVE' | 'VOIDED';

export interface Payment {
  readonly id: string;
  readonly loanId: string;
  readonly userId: string;
  readonly paidAt: DateOnly;
  readonly amount: Money;
  readonly paymentMethod: PaymentMethod;
  readonly referenceNo: string | null;
  readonly notes: string | null;
  readonly status: PaymentStatus;
  readonly voidedAt: Date | null;
  readonly voidReason: string | null;
  readonly replacedByPaymentId: string | null;
  readonly createdAt: Date;
}

export interface PaymentDraft {
  readonly paidAt: DateOnly;
  readonly amount: Money;
  readonly paymentMethod: PaymentMethod;
  readonly referenceNo: string | null;
  readonly notes: string | null;
}

export function parsePaymentMethod(input: string): Result<PaymentMethod> {
  if ((PAYMENT_METHODS as readonly string[]).includes(input)) {
    return ok(input as PaymentMethod);
  }
  return err(new DomainError('INVALID_PAYMENT_METHOD', `ช่องทางการชำระไม่ถูกต้อง: "${input}"`));
}

export function validatePaymentDraft(draft: PaymentDraft, today: DateOnly): Result<PaymentDraft> {
  if (!draft.amount.isPositive()) {
    return err(new DomainError('INVALID_AMOUNT', 'จำนวนเงินต้องมากกว่า 0'));
  }
  if (draft.paidAt.isAfter(today)) {
    return err(new DomainError('FUTURE_DATE', 'วันที่ชำระต้องไม่เป็นวันในอนาคต'));
  }
  return ok({
    ...draft,
    referenceNo: draft.referenceNo?.trim() || null,
    notes: draft.notes?.trim() || null,
  });
}

export function createPayment(
  draft: PaymentDraft,
  ctx: { id: string; loanId: string; userId: string; now: Date },
): Payment {
  return {
    id: ctx.id,
    loanId: ctx.loanId,
    userId: ctx.userId,
    paidAt: draft.paidAt,
    amount: draft.amount,
    paymentMethod: draft.paymentMethod,
    referenceNo: draft.referenceNo,
    notes: draft.notes,
    status: 'ACTIVE',
    voidedAt: null,
    voidReason: null,
    replacedByPaymentId: null,
    createdAt: ctx.now,
  };
}

export function voidPayment(
  payment: Payment,
  reason: string,
  now: Date,
  replacedByPaymentId: string | null,
): Result<Payment> {
  if (payment.status === 'VOIDED') {
    return err(new DomainError('PAYMENT_ALREADY_VOIDED', 'รายการนี้ถูกยกเลิกไปแล้ว'));
  }
  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    return err(new DomainError('REASON_REQUIRED', 'กรุณาระบุเหตุผล'));
  }
  return ok({
    ...payment,
    status: 'VOIDED',
    voidedAt: now,
    voidReason: trimmed,
    replacedByPaymentId,
  });
}
