'use client';

import { useActionState } from 'react';
import { saveLoanAction, type LoanActionState } from '@/presentation/actions/loan';
import type { LoanFormValues } from '@/presentation/forms/loan-schema';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';

interface Props {
  loanId?: string;
  defaults: LoanFormValues;
  submitLabel: string;
}

function Field({
  id, label, hint, error, children,
}: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-base font-medium">{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function LoanForm({ loanId, defaults, submitLabel }: Props) {
  const [state, action, pending] = useActionState<LoanActionState, FormData>(saveLoanAction, { ok: false });
  const values = (!state.ok && state.values) || defaults;
  const errors = (!state.ok && state.fieldErrors) || {};
  const describe = (id: string, hasHint: boolean) =>
    errors[id] ? `${id}-error` : hasHint ? `${id}-hint` : undefined;

  return (
    <form action={action} className="flex flex-col gap-5">
      {loanId && <input type="hidden" name="loanId" value={loanId} />}

      <Field id="name" label="ชื่อเงินกู้" error={errors.name}>
        <Input id="name" name="name" defaultValue={values.name} required maxLength={100} className="h-12"
          aria-invalid={!!errors.name} aria-describedby={describe('name', false)} />
      </Field>

      <Field id="loanNumber" label="เลขสัญญา (ถ้ามี)" error={errors.loanNumber}>
        <Input id="loanNumber" name="loanNumber" defaultValue={values.loanNumber} maxLength={50} className="h-12"
          aria-invalid={!!errors.loanNumber} aria-describedby={describe('loanNumber', false)} />
      </Field>

      <Field
        id="openingBalance"
        label="ยอดหนี้ตั้งต้น"
        hint="ดูจากยอดหนี้คงเหลือล่าสุดในระบบ กยศ."
        error={errors.openingBalance}
      >
        <Input id="openingBalance" name="openingBalance" inputMode="decimal" defaultValue={values.openingBalance} required
          className="h-12 text-lg tabular-nums" placeholder="0.00"
          aria-invalid={!!errors.openingBalance} aria-describedby={describe('openingBalance', true)} />
      </Field>

      <Field id="openingBalanceDate" label="ยอดนี้เป็นของวันที่" hint="รายการชำระหลังวันนี้จะถูกนำมาหักจากยอดตั้งต้น" error={errors.openingBalanceDate}>
        <Input id="openingBalanceDate" name="openingBalanceDate" type="date" defaultValue={values.openingBalanceDate} required className="h-12"
          aria-invalid={!!errors.openingBalanceDate} aria-describedby={describe('openingBalanceDate', true)} />
      </Field>

      <Field id="defaultAmount" label="ยอดจ่ายประจำ (ถ้ามี)" hint="ใช้เติมให้อัตโนมัติตอนบันทึกการชำระ" error={errors.defaultAmount}>
        <Input id="defaultAmount" name="defaultAmount" inputMode="decimal" defaultValue={values.defaultAmount} className="h-12 tabular-nums" placeholder="เช่น 3000"
          aria-invalid={!!errors.defaultAmount} aria-describedby={describe('defaultAmount', true)} />
      </Field>

      {!state.ok && state.message && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.message}</p>
      )}

      <Button type="submit" size="lg" className="h-14 text-base" disabled={pending}>
        {pending ? 'กำลังบันทึก…' : submitLabel}
      </Button>
    </form>
  );
}
