import { redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { requireUserId } from '@/presentation/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireUserId();
  const loan = await getContainer().getLoan.execute(userId);
  if (!loan) redirect('/setup');
  return <>{children}</>;
}
