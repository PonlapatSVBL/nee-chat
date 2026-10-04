import { notFound, redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { PaymentDetailView } from '@/presentation/components/payments/payment-detail-view';
import { requireUserId } from '@/presentation/lib/supabase/server';

export const metadata = { title: 'รายละเอียดการชำระ' };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const result = await getContainer().getPaymentDetail.execute({ userId, paymentId: id });
  if (!result.ok) {
    if (result.error.code === 'PAYMENT_NOT_FOUND') notFound();
    redirect('/');
  }
  return <PaymentDetailView view={result.value} />;
}
