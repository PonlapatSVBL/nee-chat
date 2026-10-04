import { Ban, CircleCheck, History } from 'lucide-react';
import Link from 'next/link';
import type { PaymentDetailView as DetailData } from '@/application/use-cases/query/get-payment-detail';
import { EvidenceGallery } from '@/presentation/components/evidence/evidence-gallery';
import { Badge } from '@/presentation/components/ui/badge';
import { buttonVariants } from '@/presentation/components/ui/button';
import { EmptyState } from '@/presentation/components/shared/empty-state';
import { MoneyText } from '@/presentation/components/shared/money-text';
import { PageHeader } from '@/presentation/components/shell/page-header';
import { cn } from '@/presentation/lib/utils';
import { formatAmount, formatThaiDateLong, formatThaiDateTime, PAYMENT_METHOD_LABELS } from '@/presentation/view-models/format';
import { VoidPaymentDialog } from './void-payment-dialog';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right break-words">{children}</dd>
    </div>
  );
}

const bannerLink =
  'mt-1 inline-flex min-h-11 w-fit items-center text-sm font-medium underline underline-offset-4 outline-none focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function PaymentDetailView({ view }: { view: DetailData }) {
  const { payment, balanceAfter, evidence, replacedBy, correctedFrom, correctionReason } = view;
  const voided = payment.status === 'VOIDED';

  return (
    <>
      <PageHeader title="รายละเอียดการชำระ" back="/payments" />

      {voided && (
        <section aria-label="สถานะรายการ" className="mb-4 flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <Ban className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="font-semibold text-destructive">รายการนี้ถูกยกเลิกแล้ว</p>
            {correctionReason && <p className="text-sm">{`เหตุผล: ${correctionReason}`}</p>}
            {payment.voidedAt && (
              <p className="text-xs text-muted-foreground">{`เมื่อ ${formatThaiDateTime(payment.voidedAt)}`}</p>
            )}
            {replacedBy && (
              <Link href={`/payments/${replacedBy.id}`} className={cn(bannerLink, 'text-destructive')}>
                ดูรายการที่แก้ไขแล้ว
              </Link>
            )}
          </div>
        </section>
      )}

      {!voided && correctedFrom && (
        <section aria-label="ที่มาของรายการ" className="mb-4 flex gap-3 rounded-xl border border-primary/20 bg-accent p-4">
          <History className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="flex min-w-0 flex-col gap-0.5 text-accent-foreground">
            <p className="font-semibold">แก้ไขจากรายการเดิม</p>
            {correctionReason && <p className="text-sm">{`เหตุผล: ${correctionReason}`}</p>}
            <Link href={`/payments/${correctedFrom.id}`} className={bannerLink}>
              {`ดูรายการเดิม (${formatAmount(correctedFrom.amount)} บาท)`}
            </Link>
          </div>
        </section>
      )}

      {/* The amount and its teller's stamp: the one thing this screen is about. */}
      <div className="flex flex-col items-center gap-2 pt-3 pb-6 text-center">
        <MoneyText
          amount={payment.amount}
          size="xl"
          className={cn(voided && 'text-muted-foreground line-through decoration-destructive/70 decoration-2')}
        />
        <p className="text-muted-foreground">{formatThaiDateLong(payment.paidAt)}</p>
        <Badge
          variant="outline"
          className={cn(
            'mt-1 -rotate-2 gap-1.5 rounded-md border-2 px-2.5 py-1 text-sm font-semibold [&>svg]:size-4',
            voided ? 'border-destructive/70 text-destructive' : 'border-primary/70 text-primary',
          )}
        >
          {voided ? <Ban aria-hidden /> : <CircleCheck aria-hidden />}
          {voided ? 'ยกเลิกแล้ว' : 'บันทึกแล้ว'}
        </Badge>
      </div>

      <dl className={cn('divide-y rounded-xl border px-4', voided && 'text-muted-foreground')}>
        <Row label="ช่องทาง">{PAYMENT_METHOD_LABELS[payment.paymentMethod]}</Row>
        <Row label="เลขอ้างอิง">{payment.referenceNo ?? '—'}</Row>
        <Row label="ยอดหลังชำระ">
          {balanceAfter ? (
            <span className="tabular-nums">{`${formatAmount(balanceAfter)} บาท`}</span>
          ) : (
            <span className="text-muted-foreground">{voided ? '—' : '— (ก่อนวันที่ยอดตั้งต้น)'}</span>
          )}
        </Row>
        <Row label="หมายเหตุ">{payment.notes ?? '—'}</Row>
        <Row label="บันทึกเมื่อ">{formatThaiDateTime(payment.createdAt)}</Row>
      </dl>

      <section aria-labelledby="evidence-heading" className="mt-6 flex flex-col gap-3">
        <h2 id="evidence-heading" className="text-base font-semibold">
          หลักฐาน
        </h2>
        {evidence.length === 0 ? (
          <EmptyState title="ยังไม่มีหลักฐาน" description={voided ? undefined : 'แก้ไขรายการเพื่อแนบสลิปเพิ่ม'} />
        ) : (
          <EvidenceGallery
            items={evidence.map((e) => ({
              id: e.evidence.id,
              url: e.url,
              mimeType: e.evidence.mimeType,
              filename: e.evidence.originalFilename,
            }))}
          />
        )}
      </section>

      {!voided && (
        <div className="mt-8 flex flex-col gap-2">
          <Link href={`/payments/${payment.id}/edit`} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-12')}>
            แก้ไขรายการ
          </Link>
          <VoidPaymentDialog paymentId={payment.id} />
        </div>
      )}
    </>
  );
}
