import { describe, expect, it } from 'vitest';
import { formDataToLoanValues, loanFormSchema } from './loan-schema';
import { zodFieldErrors } from './field-errors';

describe('loanFormSchema', () => {
  const valid = { name: 'กยศ.', loanNumber: '', openingBalance: '195,420.50', openingBalanceDate: '2026-06-30', defaultAmount: '' };

  it('accepts valid values including comma-grouped money and empty optionals', () => {
    expect(loanFormSchema.safeParse(valid).success).toBe(true);
    expect(loanFormSchema.safeParse({ ...valid, defaultAmount: '3000' }).success).toBe(true);
  });

  it('reports per-field Thai errors', () => {
    const r = loanFormSchema.safeParse({ ...valid, name: ' ', openingBalance: '1.234', openingBalanceDate: '30/06/2026', defaultAmount: 'x' });
    expect(r.success).toBe(false);
    if (r.success) return;
    const errors = zodFieldErrors(r.error);
    expect(errors.name).toBe('กรุณาระบุชื่อเงินกู้');
    expect(errors.openingBalance).toBe('กรอกตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง');
    expect(errors.openingBalanceDate).toBe('กรุณาเลือกวันที่');
    expect(errors.defaultAmount).toBe('กรอกตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง');
  });

  it('caps money at 10 integer digits (numeric(12,2))', () => {
    expect(loanFormSchema.safeParse({ ...valid, openingBalance: '1234567890.99' }).success).toBe(true);
    expect(loanFormSchema.safeParse({ ...valid, openingBalance: '1,234,567,890' }).success).toBe(true);
    expect(loanFormSchema.safeParse({ ...valid, openingBalance: '12345678901' }).success).toBe(false);
    expect(loanFormSchema.safeParse({ ...valid, openingBalance: '12,345,678,901' }).success).toBe(false);
  });

  it('reads FormData into string values', () => {
    const fd = new FormData();
    fd.set('name', 'x');
    fd.set('openingBalance', '1');
    fd.set('openingBalanceDate', '2026-01-01');
    expect(formDataToLoanValues(fd)).toEqual({ name: 'x', loanNumber: '', openingBalance: '1', openingBalanceDate: '2026-01-01', defaultAmount: '' });
  });
});
