import { describe, expect, it } from 'vitest';
import { DateOnly } from '@/domain/shared/date-only';
import { Money } from '@/domain/shared/money';
import { applyLoanUpdate, createLoan, validateLoanDraft, type LoanDraft } from './loan';

const draft: LoanDraft = {
  name: '  กยศ. ของฉัน ',
  loanNumber: ' 12345 ',
  openingBalance: Money.of('195420.50'),
  openingBalanceDate: DateOnly.of('2026-06-30'),
  defaultAmount: Money.of('3000'),
};

describe('validateLoanDraft', () => {
  it('trims name and loan number', () => {
    const r = validateLoanDraft(draft);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe('กยศ. ของฉัน');
      expect(r.value.loanNumber).toBe('12345');
    }
  });

  it('turns blank loan number into null', () => {
    const r = validateLoanDraft({ ...draft, loanNumber: '   ' });
    if (r.ok) expect(r.value.loanNumber).toBeNull();
    expect(r.ok).toBe(true);
  });

  it('rejects empty name', () => {
    const r = validateLoanDraft({ ...draft, name: ' ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_NAME');
  });

  it('rejects negative opening balance and non-positive default amount', () => {
    const neg = validateLoanDraft({ ...draft, openingBalance: Money.of('-1') });
    expect(neg.ok).toBe(false);
    const zeroDefault = validateLoanDraft({ ...draft, defaultAmount: Money.of('0') });
    expect(zeroDefault.ok).toBe(false);
    if (!zeroDefault.ok) expect(zeroDefault.error.code).toBe('INVALID_AMOUNT');
  });
});

describe('createLoan / applyLoanUpdate', () => {
  it('stamps ids and timestamps', () => {
    const now = new Date('2026-10-04T10:00:00Z');
    const loan = createLoan(draft, { id: 'loan-1', userId: 'user-1', now });
    expect(loan.id).toBe('loan-1');
    expect(loan.userId).toBe('user-1');
    expect(loan.createdAt).toBe(now);
    expect(loan.updatedAt).toBe(now);
  });

  it('keeps id/userId/createdAt on update and bumps updatedAt', () => {
    const now = new Date('2026-10-04T10:00:00Z');
    const later = new Date('2026-10-05T10:00:00Z');
    const loan = createLoan(draft, { id: 'loan-1', userId: 'user-1', now });
    const updated = applyLoanUpdate(loan, { ...draft, name: 'ใหม่' }, later);
    expect(updated.id).toBe('loan-1');
    expect(updated.createdAt).toBe(now);
    expect(updated.updatedAt).toBe(later);
    expect(updated.name).toBe('ใหม่');
  });
});
