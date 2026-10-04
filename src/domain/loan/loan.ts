import { DateOnly } from '@/domain/shared/date-only';
import { DomainError } from '@/domain/shared/errors';
import { Money } from '@/domain/shared/money';
import { err, ok, type Result } from '@/domain/shared/result';

export interface Loan {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly loanNumber: string | null;
  readonly openingBalance: Money;
  readonly openingBalanceDate: DateOnly;
  readonly defaultAmount: Money | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface LoanDraft {
  readonly name: string;
  readonly loanNumber: string | null;
  readonly openingBalance: Money;
  readonly openingBalanceDate: DateOnly;
  readonly defaultAmount: Money | null;
}

export function validateLoanDraft(draft: LoanDraft): Result<LoanDraft> {
  const name = draft.name.trim();
  if (name.length === 0) {
    return err(new DomainError('INVALID_NAME', 'กรุณาระบุชื่อเงินกู้'));
  }
  if (draft.openingBalance.isNegative()) {
    return err(new DomainError('INVALID_AMOUNT', 'ยอดตั้งต้นต้องไม่ติดลบ'));
  }
  if (draft.defaultAmount && !draft.defaultAmount.isPositive()) {
    return err(new DomainError('INVALID_AMOUNT', 'ยอดจ่ายประจำต้องมากกว่า 0'));
  }
  const loanNumber = draft.loanNumber?.trim() || null;
  return ok({ ...draft, name, loanNumber });
}

export function createLoan(draft: LoanDraft, ctx: { id: string; userId: string; now: Date }): Loan {
  return {
    id: ctx.id,
    userId: ctx.userId,
    name: draft.name,
    loanNumber: draft.loanNumber,
    openingBalance: draft.openingBalance,
    openingBalanceDate: draft.openingBalanceDate,
    defaultAmount: draft.defaultAmount,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
}

export function applyLoanUpdate(loan: Loan, draft: LoanDraft, now: Date): Loan {
  return {
    ...loan,
    name: draft.name,
    loanNumber: draft.loanNumber,
    openingBalance: draft.openingBalance,
    openingBalanceDate: draft.openingBalanceDate,
    defaultAmount: draft.defaultAmount,
    updatedAt: now,
  };
}
