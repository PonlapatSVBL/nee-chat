'use client';

import { useActionState } from 'react';
import { sendMagicLinkAction, type AuthActionState } from '@/presentation/actions/auth';

export function LoginForm({ next, initialError }: { next: string; initialError: string | null }) {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(sendMagicLinkAction, { status: 'idle' });

  if (state.status === 'sent') {
    return (
      <section className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-3 px-4">
        <h1 className="text-2xl font-semibold">ตรวจอีเมลของคุณ</h1>
        <p>
          เราส่งลิงก์เข้าสู่ระบบไปที่ <strong>{state.email}</strong> แล้ว กดลิงก์ในอีเมลเพื่อเข้าใช้งาน
        </p>
        <p className="text-sm opacity-70">ลิงก์ใช้ได้ครั้งเดียวและหมดอายุใน 1 ชั่วโมง</p>
      </section>
    );
  }

  const error = state.status === 'error' ? state.message : initialError;

  return (
    <form action={action} className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4">
      <div>
        <h1 className="text-3xl font-bold">หนี้ชัด</h1>
        <p className="opacity-70">บันทึกทุกการจ่าย ตรวจสอบทุกยอด</p>
      </div>
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1">
        <span>อีเมล</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          className="h-12 rounded-md border px-3"
          placeholder="you@example.com"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className="h-12 rounded-md bg-black text-white disabled:opacity-50">
        {pending ? 'กำลังส่ง…' : 'ส่งลิงก์เข้าสู่ระบบ'}
      </button>
    </form>
  );
}
