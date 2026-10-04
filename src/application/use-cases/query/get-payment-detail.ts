import type { Evidence } from '@/domain/evidence/evidence';
import { buildTimeline } from '@/domain/ledger/ledger';
import type { Loan } from '@/domain/loan/loan';
import type { Payment } from '@/domain/payment/payment';
import { DomainError } from '@/domain/shared/errors';
import type { Money } from '@/domain/shared/money';
import { err, ok, type Result } from '@/domain/shared/result';
import type { FileStorage } from '@/application/ports/file-storage';
import type {
  CorrectionRepository,
  EvidenceRepository,
  LoanRepository,
  PaymentRepository,
} from '@/application/ports/repositories';

export const SIGNED_URL_TTL_SECONDS = 3600;

export interface EvidenceWithUrl {
  readonly evidence: Evidence;
  readonly url: string;
}

export interface PaymentDetailView {
  readonly loan: Loan;
  readonly payment: Payment;
  readonly balanceAfter: Money | null;
  readonly evidence: EvidenceWithUrl[];
  /** The payment that replaced this one (when this one is VOIDED by a correction). */
  readonly replacedBy: Payment | null;
  /** The original payment this one replaced (when this one is a replacement). */
  readonly correctedFrom: Payment | null;
  readonly correctionReason: string | null;
}

export class GetPaymentDetail {
  constructor(
    private readonly loans: LoanRepository,
    private readonly payments: PaymentRepository,
    private readonly evidence: EvidenceRepository,
    private readonly corrections: CorrectionRepository,
    private readonly storage: FileStorage,
  ) {}

  async execute(input: { userId: string; paymentId: string }): Promise<Result<PaymentDetailView>> {
    const payment = await this.payments.findById(input.paymentId, input.userId);
    if (!payment) return err(new DomainError('PAYMENT_NOT_FOUND', 'ไม่พบรายการชำระ'));
    const loan = await this.loans.findById(payment.loanId, input.userId);
    if (!loan) return err(new DomainError('LOAN_NOT_FOUND', 'ไม่พบข้อมูลเงินกู้'));

    const all = await this.payments.listByLoan(loan.id, input.userId);
    const row = buildTimeline(loan, all, { includeVoided: true })
      .flatMap((g) => g.rows)
      .find((r) => r.payment.id === payment.id);

    const evidenceItems = await this.evidence.listByPayment(payment.id, input.userId);
    const evidence = await Promise.all(
      evidenceItems.map(async (e) => ({
        evidence: e,
        url: await this.storage.createSignedReadUrl(e.storagePath, SIGNED_URL_TTL_SECONDS),
      })),
    );

    const replacedBy = payment.replacedByPaymentId
      ? await this.payments.findById(payment.replacedByPaymentId, input.userId)
      : null;
    const correction = await this.corrections.findByReplacement(payment.id, input.userId);
    const correctedFrom = correction ? await this.payments.findById(correction.originalPaymentId, input.userId) : null;
    const correctionReason = payment.status === 'VOIDED' ? payment.voidReason : (correction?.reason ?? null);

    return ok({
      loan,
      payment,
      balanceAfter: row?.balanceAfter ?? null,
      evidence,
      replacedBy,
      correctedFrom,
      correctionReason,
    });
  }
}
