import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { correctionFormSchema, paymentFormSchema } from './payment-schema';

const valid = { paidAt: '2026-10-04', amount: '3,000', paymentMethod: 'MOBILE_BANKING', referenceNo: '', notes: '', reason: '' };

describe('payment schemas', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T05:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects a paidAt after today in Bangkok', () => {
    const r = paymentFormSchema.safeParse({ ...valid, paidAt: '2026-10-05' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('วันที่ชำระต้องไม่เป็นวันในอนาคต');
    expect(paymentFormSchema.safeParse({ ...valid, paidAt: '2026-10-04' }).success).toBe(true);
  });

  it('accepts a valid payment form', () => {
    expect(paymentFormSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects unknown method and bad amount', () => {
    expect(paymentFormSchema.safeParse({ ...valid, paymentMethod: 'CASH' }).success).toBe(false);
    expect(paymentFormSchema.safeParse({ ...valid, amount: '-5' }).success).toBe(false);
  });

  it('requires a reason only for corrections', () => {
    expect(paymentFormSchema.safeParse(valid).success).toBe(true);
    const r = correctionFormSchema.safeParse(valid);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('กรุณาระบุเหตุผลที่แก้ไข');
  });
});
