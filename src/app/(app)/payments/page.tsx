import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { PaymentTimeline } from '@/presentation/components/payments/payment-timeline';
import { EmptyState } from '@/presentation/components/shared/empty-state';
import { PageHeader } from '@/presentation/components/shell/page-header';
import { PrimaryActionButton } from '@/presentation/components/shell/primary-action-button';
import { requireUserId } from '@/presentation/lib/supabase/server';

export const metadata = { title: 'รายการชำระ' };
export const dynamic = 'force-dynamic';

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ voided?: string }> }) {
  const userId = await requireUserId();
  const { voided } = await searchParams;
  const includeVoided = voided === '1';
  const result = await getContainer().listPayments.execute({ userId, includeVoided });
  if (!result.ok) redirect('/setup');
  const { groups, evidenceCount } = result.value;

  return (
    <>
      <PageHeader
        title="รายการชำระ"
        action={
          <Link
            href={includeVoided ? '/payments' : '/payments?voided=1'}
            className="-mr-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {includeVoided ? 'ซ่อนรายการที่ยกเลิก' : 'แสดงรายการที่ยกเลิก'}
          </Link>
        }
      />
      {groups.length === 0 ? (
        <EmptyState title="ยังไม่มีรายการชำระ" description="กดปุ่มด้านล่างเพื่อบันทึกการชำระครั้งแรก" />
      ) : (
        <PaymentTimeline groups={groups} evidenceCount={evidenceCount} />
      )}
      <PrimaryActionButton href="/payments/new" label="บันทึกการชำระ" />
    </>
  );
}
