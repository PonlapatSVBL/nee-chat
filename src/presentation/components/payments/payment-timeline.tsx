import type { TimelineGroup } from '@/domain/ledger/ledger';
import { formatThaiMonthYear } from '@/presentation/view-models/format';
import { PaymentRow } from './payment-row';

export function PaymentTimeline({
  groups,
  evidenceCount,
}: {
  groups: TimelineGroup[];
  evidenceCount: Record<string, number>;
}) {
  return (
    <div className="flex flex-col gap-4 pb-40">
      {groups.map((group) => (
        <section key={`${group.year}-${group.month}`}>
          <h2 className="sticky top-0 z-10 -mx-4 border-b bg-background/95 px-4 py-2 text-sm font-medium text-muted-foreground backdrop-blur">
            {formatThaiMonthYear(group.year, group.month)}
          </h2>
          <ul className="divide-y">
            {group.rows.map((row) => (
              <PaymentRow key={row.payment.id} row={row} evidenceCount={evidenceCount[row.payment.id] ?? 0} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
