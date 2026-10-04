import { createLoan } from '@/domain/loan/loan';
import { DomainError } from '@/domain/shared/errors';
import { err, ok, type Result } from '@/domain/shared/result';
import type { LoanRepository } from '@/application/ports/repositories';
import type { Clock, IdGenerator } from '@/application/ports/system';
import { parseLoanInput, type LoanInput } from './parse-loan-input';

export class SetupLoan {
  constructor(
    private readonly loans: LoanRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: LoanInput & { userId: string }): Promise<Result<{ loanId: string }>> {
    const existing = await this.loans.findByUserId(input.userId);
    if (existing) {
      return err(new DomainError('LOAN_ALREADY_EXISTS', 'มีข้อมูลเงินกู้อยู่แล้ว'));
    }
    const draft = parseLoanInput(input);
    if (!draft.ok) return err(draft.error);

    const loan = createLoan(draft.value, { id: this.ids.next(), userId: input.userId, now: this.clock.now() });
    await this.loans.save(loan);
    return ok({ loanId: loan.id });
  }
}
