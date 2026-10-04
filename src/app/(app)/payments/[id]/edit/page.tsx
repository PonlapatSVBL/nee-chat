import { notFound, redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { PaymentForm } from '@/presentation/components/payments/payment-form';
import { PageHeader } from '@/presentation/components/shell/page-header';
import { requireUserId } from '@/presentation/lib/supabase/server';

export const metadata = { title: 'แก้ไขรายการ' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const result = await getContainer().getPaymentDetail.execute({ userId, paymentId: id });
  if (!result.ok) notFound();
  const { payment, evidence } = result.value;
  if (payment.status === 'VOIDED') redirect(`/payments/${id}`);

  return (
    <>
      <PageHeader title="แก้ไขรายการ" back={`/payments/${id}`} />
      <p className="mb-4 text-sm text-muted-foreground">
        รายการเดิมจะถูกทำเครื่องหมายว่ายกเลิก และสร้างรายการใหม่แทน ประวัติทั้งสองยังอยู่ครบ
      </p>
      <PaymentForm
        mode="correct"
        originalPaymentId={payment.id}
        existingEvidenceCount={evidence.length}
        defaults={{
          paidAt: payment.paidAt.iso,
          amount: payment.amount.toString(),
          paymentMethod: payment.paymentMethod,
          referenceNo: payment.referenceNo ?? '',
          notes: payment.notes ?? '',
          reason: '',
        }}
      />
    </>
  );
}
