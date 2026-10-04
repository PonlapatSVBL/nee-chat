import { parsePaymentMethod, validatePaymentDraft, type PaymentDraft } from '@/domain/payment/payment';
import { DateOnly } from '@/domain/shared/date-only';
import { Money } from '@/domain/shared/money';
import { err, type Result } from '@/domain/shared/result';

export interface PaymentInput {
  readonly paidAt: string;
  readonly amount: string;
  readonly paymentMethod: string;
  readonly referenceNo: string | null;
  readonly notes: string | null;
}

export function parsePaymentInput(input: PaymentInput, today: DateOnly): Result<PaymentDraft> {
  const paidAt = DateOnly.parse(input.paidAt);
  if (!paidAt.ok) return err(paidAt.error);
  const amount = Money.parse(input.amount);
  if (!amount.ok) return err(amount.error);
  const method = parsePaymentMethod(input.paymentMethod);
  if (!method.ok) return err(method.error);

  return validatePaymentDraft(
    {
      paidAt: paidAt.value,
      amount: amount.value,
      paymentMethod: method.value,
      referenceNo: input.referenceNo,
      notes: input.notes,
    },
    today,
  );
}
