import { requireUserId } from '@/presentation/lib/supabase/server';

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireUserId();
  return <>{children}</>;
}
