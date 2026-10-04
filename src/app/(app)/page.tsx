import { redirect } from 'next/navigation';
import { getContainer } from '@/infrastructure/container';
import { DashboardView } from '@/presentation/components/dashboard/dashboard-view';
import { requireUserId } from '@/presentation/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const userId = await requireUserId();
  const result = await getContainer().getDashboard.execute({ userId });
  if (!result.ok) redirect('/setup');
  return <DashboardView view={result.value} />;
}
