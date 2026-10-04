'use server';

import { revalidatePath } from 'next/cache';
import { getContainer } from '@/infrastructure/container';
import type { UploadedEvidenceInput } from '@/application/use-cases/payment/evidence-input';
import type { PreparedUpload } from '@/application/use-cases/payment/prepare-evidence-upload';
import { DomainError } from '@/domain/shared/errors';
import { zodFieldErrors } from '@/presentation/forms/field-errors';
import { correctionFormSchema, paymentFormSchema, type PaymentFormValues } from '@/presentation/forms/payment-schema';
import { requireUserId } from '@/presentation/lib/supabase/server';
import { failure, success, type ActionResult } from './types';

function revalidateLedger() {
  revalidatePath('/', 'layout');
}

export async function prepareUploadAction(input: {
  paymentId: string | null;
  mimeType: string;
  sizeBytes: number;
}): Promise<ActionResult<PreparedUpload>> {
  const userId = await requireUserId();
  const result = await getContainer().prepareEvidenceUpload.execute({ userId, ...input });
  return result.ok ? success(result.value) : failure(result.error);
}

export async function recordPaymentAction(input: {
  values: PaymentFormValues;
  paymentId: string | null;
  evidence: UploadedEvidenceInput[];
}): Promise<ActionResult<{ paymentId: string }>> {
  const userId = await requireUserId();
  const parsed = paymentFormSchema.safeParse(input.values);
  if (!parsed.success) return { ok: false, message: 'ข้อมูลไม่ถูกต้อง', fieldErrors: zodFieldErrors(parsed.error) };

  const container = getContainer();
  const loan = await container.getLoan.execute(userId);
  if (!loan) return failure(new DomainError('LOAN_NOT_FOUND'));

  const v = parsed.data;
  const result = await container.recordPayment.execute({
    userId,
    loanId: loan.id,
    paymentId: input.paymentId,
    paidAt: v.paidAt,
    amount: v.amount,
    paymentMethod: v.paymentMethod,
    referenceNo: v.referenceNo || null,
    notes: v.notes || null,
    evidence: input.evidence,
  });
  if (!result.ok) return failure(result.error);
  revalidateLedger();
  return success(result.value);
}

export async function correctPaymentAction(input: {
  originalPaymentId: string;
  newPaymentId: string | null;
  values: PaymentFormValues;
  evidence: UploadedEvidenceInput[];
}): Promise<ActionResult<{ paymentId: string }>> {
  const userId = await requireUserId();
  const parsed = correctionFormSchema.safeParse(input.values);
  if (!parsed.success) return { ok: false, message: 'ข้อมูลไม่ถูกต้อง', fieldErrors: zodFieldErrors(parsed.error) };

  const v = parsed.data;
  const result = await getContainer().correctPayment.execute({
    userId,
    originalPaymentId: input.originalPaymentId,
    newPaymentId: input.newPaymentId,
    reason: v.reason,
    paidAt: v.paidAt,
    amount: v.amount,
    paymentMethod: v.paymentMethod,
    referenceNo: v.referenceNo || null,
    notes: v.notes || null,
    newEvidence: input.evidence,
  });
  if (!result.ok) return failure(result.error);
  revalidateLedger();
  return success(result.value);
}

export async function voidPaymentAction(input: { paymentId: string; reason: string }): Promise<ActionResult<void>> {
  const userId = await requireUserId();
  const result = await getContainer().voidPayment.execute({ userId, ...input });
  if (!result.ok) return failure(result.error);
  revalidateLedger();
  return success(undefined);
}
