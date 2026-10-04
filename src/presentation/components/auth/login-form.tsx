'use client';

import { MailCheck } from 'lucide-react';
import { useActionState } from 'react';
import { sendMagicLinkAction, type AuthActionState } from '@/presentation/actions/auth';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Label } from '@/presentation/components/ui/label';

const SCREEN =
  'mx-auto flex min-h-dvh w-full max-w-sm flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]';

export function LoginForm({ next, initialError }: { next: string; initialError: string | null }) {
  const [state, action, pending] = useActionState<AuthActionState, FormData>(sendMagicLinkAction, { status: 'idle' });

  if (state.status === 'sent') {
    return (
      <section className={`${SCREEN} justify-center gap-4`}>
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold">ตรวจอีเมลของคุณ</h1>
        <p className="text-base">
          เราส่งลิงก์เข้าสู่ระบบไปที่ <strong className="font-semibold break-all">{state.email}</strong> แล้ว กดลิงก์ในอีเมลเพื่อเข้าใช้งาน
        </p>
        <p className="text-sm text-muted-foreground">ลิงก์ใช้ได้ครั้งเดียวและหมดอายุใน 1 ชั่วโมง</p>
      </section>
    );
  }

  const error = state.status === 'error' ? state.message : initialError;

  return (
    <form action={action} className={`${SCREEN} justify-between gap-10`}>
      <div className="flex flex-1 flex-col justify-center gap-1">
        <h1 className="text-3xl font-bold text-primary">หนี้ชัด</h1>
        <p className="text-base text-muted-foreground">บันทึกทุกการจ่าย ตรวจสอบทุกยอด</p>
      </div>

      <div className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-sm leading-normal">
            อีเมล
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'email-error' : undefined}
            className="h-12 rounded-lg bg-background px-3.5 text-base md:text-base"
            placeholder="you@example.com"
          />
        </div>
        {error && (
          <p id="email-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="h-12 w-full rounded-lg text-base font-semibold">
          {pending ? 'กำลังส่ง…' : 'ส่งลิงก์เข้าสู่ระบบ'}
        </Button>
      </div>
    </form>
  );
}
