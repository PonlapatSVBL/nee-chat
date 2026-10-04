import { describe, expect, it } from 'vitest';
import { correctionFormSchema, paymentFormSchema } from './payment-schema';

const valid = { paidAt: '2026-10-04', amount: '3,000', paymentMethod: 'MOBILE_BANKING', referenceNo: '', notes: '', reason: '' };

describe('payment schemas', () => {
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
