import { computeDashboard, type DashboardSummary } from '@/domain/ledger/ledger';
import type { Loan } from '@/domain/loan/loan';
import { DomainError } from '@/domain/shared/errors';
import { err, ok, type Result } from '@/domain/shared/result';
import type { LoanRepository, PaymentRepository } from '@/application/ports/repositories';

export interface DashboardView {
  readonly loan: Loan;
  readonly summary: DashboardSummary;
}

export class GetDashboard {
  constructor(
    private readonly loans: LoanRepository,
    private readonly payments: PaymentRepository,
  ) {}

  async execute(input: { userId: string }): Promise<Result<DashboardView>> {
    const loan = await this.loans.findByUserId(input.userId);
    if (!loan) return err(new DomainError('LOAN_NOT_FOUND', 'ไม่พบข้อมูลเงินกู้'));
    const payments = await this.payments.listByLoan(loan.id, input.userId);
    return ok({ loan, summary: computeDashboard(loan, payments) });
  }
}
