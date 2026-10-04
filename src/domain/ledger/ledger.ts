import type { Loan } from '@/domain/loan/loan';
import type { Payment } from '@/domain/payment/payment';
import { Money } from '@/domain/shared/money';

export interface TimelineRow {
  readonly payment: Payment;
  /** Ledger balance right after this payment; null when it does not count toward the balance. */
  readonly balanceAfter: Money | null;
}

export interface TimelineGroup {
  readonly year: number;
  readonly month: number;
  readonly rows: TimelineRow[];
}

export interface DashboardSummary {
  readonly ledgerBalance: Money;
  readonly totalPaid: Money;
  readonly paymentCount: number;
  readonly latestPayment: Payment | null;
}

export function countsTowardBalance(loan: Loan, payment: Payment): boolean {
  return payment.status === 'ACTIVE' && payment.paidAt.isAfter(loan.openingBalanceDate);
}

export function sortChronologically(payments: readonly Payment[]): Payment[] {
  return [...payments].sort((a, b) => {
    const byDate = a.paidAt.compare(b.paidAt);
    if (byDate !== 0) return byDate;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export function computeLedgerBalance(loan: Loan, payments: readonly Payment[]): Money {
  return payments
    .filter((p) => countsTowardBalance(loan, p))
    .reduce((balance, p) => balance.subtract(p.amount), loan.openingBalance);
}

export function buildTimeline(
  loan: Loan,
  payments: readonly Payment[],
  opts: { includeVoided?: boolean } = {},
): TimelineGroup[] {
  const includeVoided = opts.includeVoided ?? false;
  let running = loan.openingBalance;
  const rows: TimelineRow[] = [];

  for (const payment of sortChronologically(payments)) {
    let balanceAfter: Money | null = null;
    if (countsTowardBalance(loan, payment)) {
      running = running.subtract(payment.amount);
      balanceAfter = running;
    }
    if (payment.status === 'VOIDED' && !includeVoided) continue;
    rows.push({ payment, balanceAfter });
  }

  rows.reverse();

  const groups: TimelineGroup[] = [];
  for (const row of rows) {
    const { year, month } = row.payment.paidAt;
    const last = groups[groups.length - 1];
    if (last && last.year === year && last.month === month) {
      last.rows.push(row);
    } else {
      groups.push({ year, month, rows: [row] });
    }
  }
  return groups;
}

export function computeDashboard(loan: Loan, payments: readonly Payment[]): DashboardSummary {
  const active = sortChronologically(payments.filter((p) => p.status === 'ACTIVE'));
  return {
    ledgerBalance: computeLedgerBalance(loan, payments),
    totalPaid: active.reduce((sum, p) => sum.add(p.amount), Money.zero()),
    paymentCount: active.length,
    latestPayment: active.length > 0 ? active[active.length - 1]! : null,
  };
}
