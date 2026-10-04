'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { zodFieldErrors } from '@/presentation/forms/field-errors';
import { paymentIdInput as uuidInput } from '@/presentation/forms/payment-action-schemas';
import { formDataToLoanValues, loanFormSchema, type LoanFormValues } from '@/presentation/forms/loan-schema';
import { requireUserId } from '@/presentation/lib/supabase/server';
import { messageFor } from '@/presentation/view-models/error-messages';

export type LoanActionState =
  | { ok: false; message?: string; fieldErrors?: Record<string, string>; values?: LoanFormValues }
  | { ok: true };

export async function saveLoanAction(_prev: LoanActionState, formData: FormData): Promise<LoanActionState> {
  const userId = await requireUserId();
  const values = formDataToLoanValues(formData);
  const parsed = loanFormSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodFieldErrors(parsed.error), values };
  }

  const v = parsed.data;
  const input = {
    userId,
    name: v.name,
    loanNumber: v.loanNumber || null,
    openingBalance: v.openingBalance,
    openingBalanceDate: v.openingBalanceDate,
    defaultAmount: v.defaultAmount || null,
  };

  const loanIdRaw = formData.get('loanId');
  let loanId: string | null = null;
  if (typeof loanIdRaw === 'string' && loanIdRaw) {
    const id = uuidInput.safeParse(loanIdRaw);
    if (!id.success) return { ok: false, message: 'ข้อมูลไม่ถูกต้อง', values };
    loanId = id.data;
  }
  const container = getContainer();
  const result = loanId
    ? await container.updateLoan.execute({ ...input, loanId })
    : await container.setupLoan.execute(input);

  if (!result.ok) {
    return { ok: false, message: messageFor(result.error), values };
  }

  revalidatePath('/', 'layout');
  redirect(loanId ? '/more' : '/');
}
