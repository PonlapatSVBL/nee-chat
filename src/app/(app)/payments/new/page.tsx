import { redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { PaymentForm } from '@/presentation/components/payments/payment-form';
import { PageHeader } from '@/presentation/components/shell/page-header';
import { requireUserId } from '@/presentation/lib/supabase/server';
import { buildDefaultNote } from '@/presentation/view-models/default-note';

export const metadata = { title: 'บันทึกการชำระ' };

export default async function NewPaymentPage() {
  const userId = await requireUserId();
  const container = getContainer();
  const dashboard = await container.getDashboard.execute({ userId });
  if (!dashboard.ok) redirect('/setup');

  const { loan, summary } = dashboard.value;
  const latest = summary.latestPayment;
  const today = container.clock.today();

  return (
    <>
      <PageHeader title="บันทึกการชำระ" back="/" />
      <PaymentForm
        mode="create"
        defaults={{
          paidAt: today.iso,
          amount: loan.defaultAmount?.toString() ?? latest?.amount.toString() ?? '',
          paymentMethod: latest?.paymentMethod ?? 'MOBILE_BANKING',
          referenceNo: '',
          notes: buildDefaultNote(today),
          reason: '',
        }}
      />
    </>
  );
}
