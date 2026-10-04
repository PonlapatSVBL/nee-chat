import type { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function createTestUser(email: string): Promise<string> {
  const { data, error } = await adminClient().auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('no user');
  return data.user.id;
}

/** Logs in without email by generating a magic link server-side and hitting the callback with its token hash. */
export async function loginAs(page: Page, email: string): Promise<void> {
  const { data, error } = await adminClient().auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw error;
  const tokenHash = data.properties.hashed_token;
  // `type=email` verifies the magic-link token hash reliably against local Supabase; `type=magiclink` intermittently failed.
  await page.goto(`/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=email&next=%2F`);
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = adminClient();
  for (const table of ['payment_corrections', 'payment_evidence', 'payments', 'loans']) {
    await admin.from(table).delete().eq('user_id', userId);
  }
  const { data } = await admin.storage.from('evidence').list(`${userId}/payments`);
  for (const dir of data ?? []) {
    const files = await admin.storage.from('evidence').list(`${userId}/payments/${dir.name}`);
    const paths = (files.data ?? []).map((f) => `${userId}/payments/${dir.name}/${f.name}`);
    if (paths.length) await admin.storage.from('evidence').remove(paths);
  }
  await admin.auth.admin.deleteUser(userId);
}
