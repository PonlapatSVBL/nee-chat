import { redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { LoanForm } from '@/presentation/components/loan/loan-form';
import { requireUserId } from '@/presentation/lib/supabase/server';

export const metadata = { title: 'ตั้งค่าเงินกู้' };

export default async function SetupPage() {
  const userId = await requireUserId();
  const container = getContainer();
  const loan = await container.getLoan.execute(userId);
  if (loan) redirect('/');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">ตั้งค่าเงินกู้</h1>
        <p className="text-muted-foreground">กรอกครั้งเดียว แก้ไขภายหลังได้ที่เมนู “เพิ่มเติม”</p>
      </div>
      <LoanForm
        defaults={{ name: 'กยศ. ของฉัน', loanNumber: '', openingBalance: '', openingBalanceDate: container.clock.today().iso, defaultAmount: '' }}
        submitLabel="บันทึก"
      />
    </main>
  );
}
