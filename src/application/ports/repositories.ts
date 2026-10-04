import type { Evidence } from '@/domain/evidence/evidence';
import type { Loan } from '@/domain/loan/loan';
import type { PaymentCorrection } from '@/domain/payment/correction';
import type { Payment } from '@/domain/payment/payment';

export interface LoanRepository {
  findByUserId(userId: string): Promise<Loan | null>;
  findById(id: string, userId: string): Promise<Loan | null>;
  /** Insert or update by id. */
  save(loan: Loan): Promise<void>;
}

export interface PaymentRepository {
  findById(id: string, userId: string): Promise<Payment | null>;
  listByLoan(loanId: string, userId: string): Promise<Payment[]>;
  /** Latest ACTIVE payment by paidAt then createdAt. */
  findLatestActive(loanId: string, userId: string): Promise<Payment | null>;
  insert(payment: Payment): Promise<void>;
  /** Persist status/voidedAt/voidReason/replacedByPaymentId of an already-stored payment. */
  markVoided(payment: Payment): Promise<void>;
}

export interface EvidenceRepository {
  findById(id: string, userId: string): Promise<Evidence | null>;
  listByPayment(paymentId: string, userId: string): Promise<Evidence[]>;
  insertMany(items: readonly Evidence[]): Promise<void>;
  countByPaymentIds(paymentIds: readonly string[], userId: string): Promise<Record<string, number>>;
}

export interface CorrectionRepository {
  insert(correction: PaymentCorrection): Promise<void>;
  findByReplacement(replacementPaymentId: string, userId: string): Promise<PaymentCorrection | null>;
}

export interface Repositories {
  readonly loans: LoanRepository;
  readonly payments: PaymentRepository;
  readonly evidence: EvidenceRepository;
  readonly corrections: CorrectionRepository;
}
