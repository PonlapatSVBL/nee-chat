import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { resolveNext } from '@/presentation/lib/auth/resolve-next';
import { createSupabaseServerClient } from '@/presentation/lib/supabase/server';

const OTP_TYPES: EmailOtpType[] = ['email', 'magiclink', 'signup', 'recovery', 'invite', 'email_change'];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = resolveNext(searchParams, origin);
  const tokenHash = searchParams.get('token_hash');
  const rawType = searchParams.get('type');
  const code = searchParams.get('code');

  const supabase = await createSupabaseServerClient();

  if (tokenHash && rawType && (OTP_TYPES as string[]).includes(rawType)) {
    const { error } = await supabase.auth.verifyOtp({ type: rawType as EmailOtpType, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL('/login?error=link', origin));
}
