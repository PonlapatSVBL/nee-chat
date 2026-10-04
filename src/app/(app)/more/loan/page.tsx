import { redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { LoanForm } from '@/presentation/components/loan/loan-form';
import { PageHeader } from '@/presentation/components/shell/page-header';
import { requireUserId } from '@/presentation/lib/supabase/server';

export const metadata = { title: 'ตั้งค่าเงินกู้' };

export default async function EditLoanPage() {
  const userId = await requireUserId();
  const loan = await getContainer().getLoan.execute(userId);
  if (!loan) redirect('/setup');

  return (
    <>
      <PageHeader title="ตั้งค่าเงินกู้" back="/more" />
      <LoanForm
        loanId={loan.id}
        defaults={{
          name: loan.name,
          loanNumber: loan.loanNumber ?? '',
          openingBalance: loan.openingBalance.toString(),
          openingBalanceDate: loan.openingBalanceDate.iso,
          defaultAmount: loan.defaultAmount?.toString() ?? '',
        }}
        submitLabel="บันทึกการแก้ไข"
      />
    </>
  );
}
