import type { Loan } from '@/domain/loan/loan';
import type { LoanRepository } from '@/application/ports/repositories';

export class GetLoan {
  constructor(private readonly loans: LoanRepository) {}

  execute(userId: string): Promise<Loan | null> {
    return this.loans.findByUserId(userId);
  }
}
