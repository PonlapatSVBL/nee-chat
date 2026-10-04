import { redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { signOutAction } from '@/presentation/actions/auth';
import { requireUserId } from '@/presentation/lib/supabase/server';

export default async function SetupPage() {
  const userId = await requireUserId();
  const loan = await getContainer().getLoan.execute(userId);
  if (loan) redirect('/');
  return (
    <main className="p-4">
      <h1 className="text-xl font-semibold">ตั้งค่าเงินกู้</h1>
      <p>ฟอร์มจะมาใน Task 17</p>
      <form action={signOutAction}>
        <button type="submit" className="underline">ออกจากระบบ</button>
      </form>
    </main>
  );
}
