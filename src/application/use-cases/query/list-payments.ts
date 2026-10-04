import { buildTimeline, type TimelineGroup } from '@/domain/ledger/ledger';
import type { Loan } from '@/domain/loan/loan';
import { DomainError } from '@/domain/shared/errors';
import { err, ok, type Result } from '@/domain/shared/result';
import type { EvidenceRepository, LoanRepository, PaymentRepository } from '@/application/ports/repositories';

export interface PaymentListView {
  readonly loan: Loan;
  readonly groups: TimelineGroup[];
  readonly evidenceCount: Record<string, number>;
}

export class ListPayments {
  constructor(
    private readonly loans: LoanRepository,
    private readonly payments: PaymentRepository,
    private readonly evidence: EvidenceRepository,
  ) {}

  async execute(input: { userId: string; includeVoided: boolean }): Promise<Result<PaymentListView>> {
    const loan = await this.loans.findByUserId(input.userId);
    if (!loan) return err(new DomainError('LOAN_NOT_FOUND', 'ไม่พบข้อมูลเงินกู้'));
    const payments = await this.payments.listByLoan(loan.id, input.userId);
    const groups = buildTimeline(loan, payments, { includeVoided: input.includeVoided });
    const ids = groups.flatMap((g) => g.rows.map((r) => r.payment.id));
    const evidenceCount = ids.length > 0 ? await this.evidence.countByPaymentIds(ids, input.userId) : {};
    return ok({ loan, groups, evidenceCount });
  }
}
