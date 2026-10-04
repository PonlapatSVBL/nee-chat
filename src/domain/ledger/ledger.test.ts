import { describe, expect, it } from 'vitest';
import { createLoan, type Loan } from '@/domain/loan/loan';
import { createPayment, voidPayment, type Payment } from '@/domain/payment/payment';
import { DateOnly } from '@/domain/shared/date-only';
import { Money } from '@/domain/shared/money';
import { buildTimeline, computeDashboard, computeLedgerBalance } from './ledger';

const loan: Loan = createLoan(
  {
    name: 'กยศ.', loanNumber: null, openingBalance: Money.of('195420.50'),
    openingBalanceDate: DateOnly.of('2026-06-30'), defaultAmount: Money.of('3000'),
  },
  { id: 'l1', userId: 'u1', now: new Date('2026-06-30T00:00:00Z') },
);

function pay(id: string, paidAt: string, amount: string, createdAt = `${paidAt}T08:00:00Z`): Payment {
  return createPayment(
    { paidAt: DateOnly.of(paidAt), amount: Money.of(amount), paymentMethod: 'MOBILE_BANKING', referenceNo: null, notes: null },
    { id, loanId: 'l1', userId: 'u1', now: new Date(createdAt) },
  );
}

describe('computeLedgerBalance', () => {
  it('subtracts only ACTIVE payments after the opening date', () => {
    const before = pay('p0', '2026-06-04', '3000');      // on/before opening date: ignored
    const onDate = pay('p1', '2026-06-30', '3000');      // same day as opening: ignored
    const jul = pay('p2', '2026-07-04', '3000');
    const aug = pay('p3', '2026-08-04', '3000');
    const voidedRes = voidPayment(pay('p4', '2026-09-04', '3000'), 'ผิด', new Date(), null);
    if (!voidedRes.ok) throw voidedRes.error;
    const balance = computeLedgerBalance(loan, [before, onDate, jul, aug, voidedRes.value]);
    expect(balance.toString()).toBe('189420.50');
  });

  it('returns the opening balance when there are no payments', () => {
    expect(computeLedgerBalance(loan, []).toString()).toBe('195420.50');
  });
});

describe('buildTimeline', () => {
  const jul = pay('p2', '2026-07-04', '3000');
  const aug = pay('p3', '2026-08-04', '3000');
  const augLater = pay('p5', '2026-08-04', '500', '2026-08-04T20:00:00Z');
  const old = pay('p0', '2026-06-04', '3000');
  const voidedRes = voidPayment(pay('p4', '2026-09-04', '3000'), 'ผิด', new Date(), null);
  if (!voidedRes.ok) throw voidedRes.error;
  const all = [aug, old, voidedRes.value, jul, augLater];

  it('groups by month newest first and carries a running balance', () => {
    const groups = buildTimeline(loan, all);
    expect(groups.map((g) => `${g.year}-${g.month}`)).toEqual(['2026-8', '2026-7', '2026-6']);
    const augRows = groups[0]!.rows;
    expect(augRows.map((r) => r.payment.id)).toEqual(['p5', 'p3']);
    expect(augRows[0]!.balanceAfter?.toString()).toBe('188920.50');
    expect(augRows[1]!.balanceAfter?.toString()).toBe('189420.50');
    expect(groups[1]!.rows[0]!.balanceAfter?.toString()).toBe('192420.50');
  });

  it('shows null balance for payments on/before the opening date', () => {
    const groups = buildTimeline(loan, all);
    expect(groups[2]!.rows[0]!.payment.id).toBe('p0');
    expect(groups[2]!.rows[0]!.balanceAfter).toBeNull();
  });

  it('hides voided rows by default and includes them on request with null balance', () => {
    expect(buildTimeline(loan, all).flatMap((g) => g.rows).some((r) => r.payment.id === 'p4')).toBe(false);
    const withVoided = buildTimeline(loan, all, { includeVoided: true });
    const row = withVoided.flatMap((g) => g.rows).find((r) => r.payment.id === 'p4');
    expect(row?.balanceAfter).toBeNull();
    expect(withVoided[0]!.month).toBe(9);
  });
});

describe('computeDashboard', () => {
  it('totals ACTIVE payments regardless of date and picks the latest', () => {
    const old = pay('p0', '2026-06-04', '3000');
    const jul = pay('p2', '2026-07-04', '3000');
    const voidedRes = voidPayment(pay('p4', '2026-09-04', '3000'), 'ผิด', new Date(), null);
    if (!voidedRes.ok) throw voidedRes.error;
    const s = computeDashboard(loan, [voidedRes.value, old, jul]);
    expect(s.ledgerBalance.toString()).toBe('192420.50');
    expect(s.totalPaid.toString()).toBe('6000.00');
    expect(s.paymentCount).toBe(2);
    expect(s.latestPayment?.id).toBe('p2');
  });

  it('handles no payments', () => {
    const s = computeDashboard(loan, []);
    expect(s.totalPaid.isZero()).toBe(true);
    expect(s.paymentCount).toBe(0);
    expect(s.latestPayment).toBeNull();
  });
});
