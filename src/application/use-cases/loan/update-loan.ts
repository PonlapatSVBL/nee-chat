import { applyLoanUpdate } from '@/domain/loan/loan';
import { DomainError } from '@/domain/shared/errors';
import { err, ok, type Result } from '@/domain/shared/result';
import type { LoanRepository } from '@/application/ports/repositories';
import type { Clock } from '@/application/ports/system';
import { parseLoanInput, type LoanInput } from './parse-loan-input';

export class UpdateLoan {
  constructor(
    private readonly loans: LoanRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: LoanInput & { userId: string; loanId: string }): Promise<Result<void>> {
    const loan = await this.loans.findById(input.loanId, input.userId);
    if (!loan) return err(new DomainError('LOAN_NOT_FOUND', 'ไม่พบข้อมูลเงินกู้'));

    const draft = parseLoanInput(input);
    if (!draft.ok) return err(draft.error);

    await this.loans.save(applyLoanUpdate(loan, draft.value, this.clock.now()));
    return ok(undefined);
  }
}
