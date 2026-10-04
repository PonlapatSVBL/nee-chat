import { describe, expect, it } from 'vitest';
import { DateOnly } from '@/domain/shared/date-only';
import { Money } from '@/domain/shared/money';
import { createPayment, parsePaymentMethod, validatePaymentDraft, voidPayment, type PaymentDraft } from './payment';

const today = DateOnly.of('2026-10-04');
const draft: PaymentDraft = {
  paidAt: DateOnly.of('2026-10-04'),
  amount: Money.of('3000'),
  paymentMethod: 'MOBILE_BANKING',
  referenceNo: ' REF123 ',
  notes: '  ',
};
const now = new Date('2026-10-04T09:00:00Z');

describe('parsePaymentMethod', () => {
  it('accepts known methods and rejects others', () => {
    expect(parsePaymentMethod('ATM')).toEqual({ ok: true, value: 'ATM' });
    const bad = parsePaymentMethod('CASH');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('INVALID_PAYMENT_METHOD');
  });
});

describe('validatePaymentDraft', () => {
  it('trims reference and nulls blank notes', () => {
    const r = validatePaymentDraft(draft, today);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.referenceNo).toBe('REF123');
      expect(r.value.notes).toBeNull();
    }
  });

  it('rejects non-positive amount', () => {
    const r = validatePaymentDraft({ ...draft, amount: Money.of('0') }, today);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_AMOUNT');
  });

  it('rejects a future paid_at', () => {
    const r = validatePaymentDraft({ ...draft, paidAt: DateOnly.of('2026-10-05') }, today);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('FUTURE_DATE');
  });
});

describe('createPayment', () => {
  it('creates an ACTIVE payment with null void fields', () => {
    const p = createPayment(draft, { id: 'p1', loanId: 'l1', userId: 'u1', now });
    expect(p.status).toBe('ACTIVE');
    expect(p.voidedAt).toBeNull();
    expect(p.voidReason).toBeNull();
    expect(p.replacedByPaymentId).toBeNull();
    expect(p.createdAt).toBe(now);
  });
});

describe('voidPayment', () => {
  const active = createPayment(draft, { id: 'p1', loanId: 'l1', userId: 'u1', now });
  const later = new Date('2026-10-05T09:00:00Z');

  it('marks VOIDED with reason, time and replacement', () => {
    const r = voidPayment(active, ' พิมพ์ยอดผิด ', later, 'p2');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.status).toBe('VOIDED');
      expect(r.value.voidedAt).toBe(later);
      expect(r.value.voidReason).toBe('พิมพ์ยอดผิด');
      expect(r.value.replacedByPaymentId).toBe('p2');
      expect(r.value.amount.equals(active.amount)).toBe(true);
    }
  });

  it('requires a reason', () => {
    const r = voidPayment(active, '  ', later, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('REASON_REQUIRED');
  });

  it('refuses to void twice', () => {
    const once = voidPayment(active, 'x', later, null);
    if (!once.ok) throw once.error;
    const twice = voidPayment(once.value, 'y', later, null);
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.error.code).toBe('PAYMENT_ALREADY_VOIDED');
  });
});
