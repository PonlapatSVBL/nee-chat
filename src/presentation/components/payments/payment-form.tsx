'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { PAYMENT_METHODS } from '@/domain/payment/payment';
import { correctPaymentAction, recordPaymentAction } from '@/presentation/actions/payment';
import { EvidencePicker } from '@/presentation/components/evidence/evidence-picker';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';
import { Textarea } from '@/presentation/components/ui/textarea';
import { correctionFormSchema, paymentFormSchema, type PaymentFormValues } from '@/presentation/forms/payment-schema';
import { uploadEvidence, UploadError, type PendingFile } from '@/presentation/lib/upload-evidence';
import { cn } from '@/presentation/lib/utils';
import { PAYMENT_METHOD_LABELS } from '@/presentation/view-models/format';

interface Props {
  mode: 'create' | 'correct';
  defaults: PaymentFormValues;
  originalPaymentId?: string;
  existingEvidenceCount?: number;
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-base font-medium">
        {label}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

const control = 'h-12 rounded-lg text-base';

export function PaymentForm({ mode, defaults, originalPaymentId, existingEvidenceCount = 0 }: Props) {
  const router = useRouter();
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(mode === 'correct' ? correctionFormSchema : paymentFormSchema),
    defaultValues: defaults,
  });
  const errors = form.formState.errors;
  const a11y = (field: keyof PaymentFormValues) => ({
    'aria-invalid': !!errors[field],
    'aria-describedby': errors[field] ? `${field}-error` : undefined,
  });

  async function onSubmit(values: PaymentFormValues) {
    setBusy(true);
    try {
      const { paymentId, uploaded } = await uploadEvidence(files, null);
      const result =
        mode === 'create'
          ? await recordPaymentAction({ values, paymentId, evidence: uploaded })
          : await correctPaymentAction({ originalPaymentId: originalPaymentId!, newPaymentId: paymentId, values, evidence: uploaded });

      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, message] of Object.entries(result.fieldErrors)) {
            form.setError(field as keyof PaymentFormValues, { message });
          }
        }
        toast.error(result.message);
        return;
      }
      toast.success(mode === 'create' ? 'บันทึกการชำระแล้ว' : 'แก้ไขรายการแล้ว');
      router.push(mode === 'create' ? '/payments' : `/payments/${result.data.paymentId}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof UploadError ? 'อัปโหลดสลิปไม่สำเร็จ ลองใหม่อีกครั้ง' : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
    } finally {
      setBusy(false);
    }
  }

  const noEvidence = files.length === 0 && existingEvidenceCount === 0;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate aria-busy={busy}>
      {/* The one bold element: the figure being recorded, sized like the dashboard balance. */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount" className="text-base font-medium">
          จำนวนเงิน
        </Label>
        <div
          className={cn(
            'flex items-baseline gap-2 rounded-xl border border-input px-4 py-2 transition-[border-color,box-shadow] duration-200 ease-out-quart',
            'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
            errors.amount && 'border-destructive focus-within:border-destructive focus-within:ring-destructive/20',
          )}
        >
          <input
            id="amount"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="next"
            placeholder="0.00"
            className="h-14 min-w-0 flex-1 bg-transparent text-4xl font-semibold tracking-[-0.02em] tabular-nums outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
            {...a11y('amount')}
            {...form.register('amount')}
          />
          <span className="shrink-0 text-xl text-muted-foreground" aria-hidden>
            บาท
          </span>
        </div>
        {errors.amount && (
          <p id="amount-error" role="alert" className="text-sm text-destructive">
            {errors.amount.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <Field id="paidAt" label="วันที่ชำระ" error={errors.paidAt?.message}>
          <Input id="paidAt" type="date" className={control} {...a11y('paidAt')} {...form.register('paidAt')} />
        </Field>

        <Field id="paymentMethod" label="ช่องทางการชำระ" error={errors.paymentMethod?.message}>
          <div className="relative">
            <select
              id="paymentMethod"
              className={cn(
                control,
                'w-full appearance-none border border-input bg-background pl-3 pr-11 text-foreground outline-none transition-[border-color,box-shadow] duration-200',
                'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                'aria-invalid:border-destructive disabled:opacity-50',
              )}
              {...a11y('paymentMethod')}
              {...form.register('paymentMethod')}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          </div>
        </Field>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="evidence-heading">
        <div className="flex flex-col gap-0.5">
          <h2 id="evidence-heading" className="text-base font-medium">
            หลักฐาน
          </h2>
          {mode === 'correct' && existingEvidenceCount > 0 && (
            <p className="text-sm text-muted-foreground">สลิปเดิม {existingEvidenceCount} ไฟล์จะติดไปกับรายการใหม่อัตโนมัติ</p>
          )}
        </div>
        <EvidencePicker files={files} onChange={setFiles} disabled={busy} />
        {noEvidence && (
          <p className="flex gap-2.5 rounded-lg bg-warning/10 p-3 text-sm text-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <span>ยังไม่ได้แนบสลิป คุณยังบันทึกได้ แต่แนะนำให้แนบไว้เป็นหลักฐาน</span>
          </p>
        )}
      </section>

      <div className="flex flex-col gap-5">
        <Field id="referenceNo" label="เลขอ้างอิง" error={errors.referenceNo?.message}>
          <Input
            id="referenceNo"
            autoComplete="off"
            className={control}
            {...a11y('referenceNo')}
            {...form.register('referenceNo')}
          />
        </Field>

        <Field id="notes" label="หมายเหตุ" error={errors.notes?.message}>
          <Textarea id="notes" rows={2} className="rounded-lg text-base" {...a11y('notes')} {...form.register('notes')} />
        </Field>

        {mode === 'correct' && (
          <Field id="reason" label="เหตุผลที่แก้ไข" error={errors.reason?.message}>
            <Textarea
              id="reason"
              rows={2}
              placeholder="เช่น พิมพ์ยอดผิด"
              className="rounded-lg text-base"
              {...a11y('reason')}
              {...form.register('reason')}
            />
          </Field>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        className="h-14 rounded-xl text-base font-semibold transition-[transform,background-color] duration-150 ease-out-quart active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
        disabled={busy}
      >
        {busy ? 'กำลังบันทึก…' : 'บันทึก'}
      </Button>
    </form>
  );
}
