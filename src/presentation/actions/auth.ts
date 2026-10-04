'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { safePath } from '@/presentation/lib/auth/resolve-next';
import { createSupabaseServerClient } from '@/presentation/lib/supabase/server';

export type AuthActionState =
  | { status: 'idle' }
  | { status: 'sent'; email: string }
  | { status: 'error'; message: string };

const schema = z.object({
  email: z.string().trim().email('กรุณากรอกอีเมลให้ถูกต้อง'),
  next: z.string().default('/'),
});

export async function sendMagicLinkAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = schema.safeParse({ email: formData.get('email'), next: formData.get('next') ?? '/' });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' };
  }
  const next = safePath(parsed.data.next) ?? '/';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  });
  if (error) {
    return { status: 'error', message: 'ส่งลิงก์ไม่สำเร็จ ลองใหม่อีกครั้งในอีกสักครู่' };
  }
  return { status: 'sent', email: parsed.data.email };
}

export async function signOutAction(): Promise<never> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
