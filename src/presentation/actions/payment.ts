'use server';

import { revalidatePath } from 'next/cache';
import { getContainer } from '@/infrastructure/container';
import type { UploadedEvidenceInput } from '@/application/use-cases/payment/evidence-input';
import type { PreparedUpload } from '@/application/use-cases/payment/prepare-evidence-upload';
import { DomainError } from '@/domain/shared/errors';
import { zodFieldErrors } from '@/presentation/forms/field-errors';
import {
  evidenceListInput,
  nullablePaymentIdInput,
  paymentIdInput,
  prepareUploadInput,
  voidPaymentInput,
} from '@/presentation/forms/payment-action-schemas';
import { correctionFormSchema, paymentFormSchema, type PaymentFormValues } from '@/presentation/forms/payment-schema';
import { requireUserId } from '@/presentation/lib/supabase/server';
import { failure, success, type ActionResult } from './types';

const INVALID_INPUT = 'ข้อมูลไม่ถูกต้อง';

function revalidateLedger() {
  revalidatePath('/', 'layout');
}

export async function prepareUploadAction(input: {
  paymentId: string | null;
  mimeType: string;
  sizeBytes: number;
}): Promise<ActionResult<PreparedUpload>> {
  const userId = await requireUserId();
  const parsed = prepareUploadInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: INVALID_INPUT };
  const result = await getContainer().prepareEvidenceUpload.execute({
    userId,
    paymentId: parsed.data.paymentId,
    mimeType: parsed.data.mimeType,
    sizeBytes: parsed.data.sizeBytes,
  });
  return result.ok ? success(result.value) : failure(result.error);
}

export async function recordPaymentAction(input: {
  values: PaymentFormValues;
  paymentId: string | null;
  evidence: UploadedEvidenceInput[];
}): Promise<ActionResult<{ paymentId: string }>> {
  const userId = await requireUserId();
  const parsed = paymentFormSchema.safeParse(input.values);
  if (!parsed.success) return { ok: false, message: INVALID_INPUT, fieldErrors: zodFieldErrors(parsed.error) };
  const paymentId = nullablePaymentIdInput.safeParse(input.paymentId);
  const evidence = evidenceListInput.safeParse(input.evidence);
  if (!paymentId.success || !evidence.success) return { ok: false, message: INVALID_INPUT };

  const container = getContainer();
  const loan = await container.getLoan.execute(userId);
  if (!loan) return failure(new DomainError('LOAN_NOT_FOUND'));

  const v = parsed.data;
  const result = await container.recordPayment.execute({
    userId,
    loanId: loan.id,
    paymentId: paymentId.data,
    paidAt: v.paidAt,
    amount: v.amount,
    paymentMethod: v.paymentMethod,
    referenceNo: v.referenceNo || null,
    notes: v.notes || null,
    evidence: evidence.data,
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
  if (!parsed.success) return { ok: false, message: INVALID_INPUT, fieldErrors: zodFieldErrors(parsed.error) };
  const originalPaymentId = paymentIdInput.safeParse(input.originalPaymentId);
  const newPaymentId = nullablePaymentIdInput.safeParse(input.newPaymentId);
  const evidence = evidenceListInput.safeParse(input.evidence);
  if (!originalPaymentId.success || !newPaymentId.success || !evidence.success) {
    return { ok: false, message: INVALID_INPUT };
  }

  const v = parsed.data;
  const result = await getContainer().correctPayment.execute({
    userId,
    originalPaymentId: originalPaymentId.data,
    newPaymentId: newPaymentId.data,
    reason: v.reason,
    paidAt: v.paidAt,
    amount: v.amount,
    paymentMethod: v.paymentMethod,
    referenceNo: v.referenceNo || null,
    notes: v.notes || null,
    newEvidence: evidence.data,
  });
  if (!result.ok) return failure(result.error);
  revalidateLedger();
  return success(result.value);
}

export async function voidPaymentAction(input: { paymentId: string; reason: string }): Promise<ActionResult<void>> {
  const userId = await requireUserId();
  const parsed = voidPaymentInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: INVALID_INPUT };
  const result = await getContainer().voidPayment.execute({
    userId,
    paymentId: parsed.data.paymentId,
    reason: parsed.data.reason,
  });
  if (!result.ok) return failure(result.error);
  revalidateLedger();
  return success(undefined);
}
