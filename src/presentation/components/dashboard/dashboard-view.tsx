import Link from 'next/link';
import type { DashboardView as DashboardData } from '@/application/use-cases/query/get-dashboard';
import { Badge } from '@/presentation/components/ui/badge';
import { EmptyState } from '@/presentation/components/shared/empty-state';
import { MoneyText } from '@/presentation/components/shared/money-text';
import { PageHeader } from '@/presentation/components/shell/page-header';
import { PrimaryActionButton } from '@/presentation/components/shell/primary-action-button';
import { formatBaht, formatThaiDate, PAYMENT_METHOD_LABELS } from '@/presentation/view-models/format';
import { StatCard } from './stat-card';

export function DashboardView({ view }: { view: DashboardData }) {
  const { loan, summary } = view;
  const latest = summary.latestPayment;

  return (
    <>
      <PageHeader title={loan.name} />
      <div className="flex flex-col gap-4">
        {/* The one bold element: the ledger balance sits bare on the white page, no card around it. */}
        <section aria-labelledby="ledger-balance-label" className="flex flex-col gap-1.5 px-1 pb-2 pt-3">
          <p id="ledger-balance-label" className="text-sm text-muted-foreground">
            ยอดคงเหลือตามบัญชีของฉัน
          </p>
          <MoneyText amount={summary.ledgerBalance} size="xl" />
          <p className="text-xs text-muted-foreground">
            {`ตั้งต้น ${formatBaht(loan.openingBalance)} ณ ${formatThaiDate(loan.openingBalanceDate)}`}
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="ชำระแล้วทั้งหมด">
            <MoneyText amount={summary.totalPaid} size="lg" />
          </StatCard>
          <StatCard label="จำนวนครั้ง">
            <span className="text-2xl font-semibold tabular-nums">{summary.paymentCount}</span>{' '}
            <span className="text-muted-foreground">ครั้ง</span>
          </StatCard>
        </div>

        <StatCard label="งวดล่าสุด">
          {latest ? (
            <Link
              href={`/payments/${latest.id}`}
              className="-mx-2 flex min-h-12 items-center justify-between gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <div className="flex flex-col">
                <span className="font-medium">{formatThaiDate(latest.paidAt)}</span>
                <span className="text-sm text-muted-foreground">{PAYMENT_METHOD_LABELS[latest.paymentMethod]}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <MoneyText amount={latest.amount} size="lg" />
                <Badge variant="secondary">บันทึกแล้ว</Badge>
              </div>
            </Link>
          ) : (
            <EmptyState title="ยังไม่มีรายการชำระ" description="กดปุ่มด้านล่างเพื่อบันทึกการชำระครั้งแรก" />
          )}
        </StatCard>
      </div>
      <PrimaryActionButton href="/payments/new" label="บันทึกการชำระ" />
    </>
  );
}
