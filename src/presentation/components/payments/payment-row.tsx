import { Paperclip } from 'lucide-react';
import Link from 'next/link';
import type { TimelineRow } from '@/domain/ledger/ledger';
import { MoneyText } from '@/presentation/components/shared/money-text';
import { Badge } from '@/presentation/components/ui/badge';
import { cn } from '@/presentation/lib/utils';
import { formatAmount, formatThaiDate, PAYMENT_METHOD_LABELS } from '@/presentation/view-models/format';

export function PaymentRow({ row, evidenceCount }: { row: TimelineRow; evidenceCount: number }) {
  const { payment, balanceAfter } = row;
  const voided = payment.status === 'VOIDED';
  return (
    <li>
      {/* One link per row: date + method on the left, amount + running balance on the right. */}
      <Link
        href={`/payments/${payment.id}`}
        className={cn(
          'flex min-h-16 items-center justify-between gap-3 rounded-lg px-2 py-3 outline-none transition-colors',
          'hover:bg-muted/60 active:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50',
          voided && 'text-muted-foreground',
        )}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={cn('font-medium', !voided && 'text-foreground')}>{formatThaiDate(payment.paidAt)}</span>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="truncate">{PAYMENT_METHOD_LABELS[payment.paymentMethod]}</span>
            {evidenceCount > 0 && (
              <Paperclip className="size-3.5 shrink-0" role="img" aria-label={`มีหลักฐาน ${evidenceCount} ไฟล์`} />
            )}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <MoneyText amount={payment.amount} size="lg" className={cn(voided && 'font-normal line-through decoration-1')} />
          {voided ? (
            <Badge variant="outline">ยกเลิกแล้ว</Badge>
          ) : (
            <span className="text-sm tabular-nums text-muted-foreground">
              {`ยอดหลังชำระ ${balanceAfter ? formatAmount(balanceAfter) : '—'}`}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
