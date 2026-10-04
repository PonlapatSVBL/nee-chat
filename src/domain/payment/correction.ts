export interface PaymentCorrection {
  readonly id: string;
  readonly userId: string;
  readonly originalPaymentId: string;
  /** null when the payment was voided without a replacement */
  readonly replacementPaymentId: string | null;
  readonly reason: string;
  readonly createdAt: Date;
}
