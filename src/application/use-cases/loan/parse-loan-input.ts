import { validateLoanDraft, type LoanDraft } from '@/domain/loan/loan';
import { DateOnly } from '@/domain/shared/date-only';
import { Money } from '@/domain/shared/money';
import { err, type Result } from '@/domain/shared/result';

export interface LoanInput {
  readonly name: string;
  readonly loanNumber: string | null;
  readonly openingBalance: string;
  readonly openingBalanceDate: string;
  readonly defaultAmount: string | null;
}

export function parseLoanInput(input: LoanInput): Result<LoanDraft> {
  const openingBalance = Money.parse(input.openingBalance);
  if (!openingBalance.ok) return err(openingBalance.error);

  const openingBalanceDate = DateOnly.parse(input.openingBalanceDate);
  if (!openingBalanceDate.ok) return err(openingBalanceDate.error);

  let defaultAmount: Money | null = null;
  if (input.defaultAmount && input.defaultAmount.trim() !== '') {
    const parsed = Money.parse(input.defaultAmount);
    if (!parsed.ok) return err(parsed.error);
    defaultAmount = parsed.value;
  }

  return validateLoanDraft({
    name: input.name,
    loanNumber: input.loanNumber,
    openingBalance: openingBalance.value,
    openingBalanceDate: openingBalanceDate.value,
    defaultAmount,
  });
}
