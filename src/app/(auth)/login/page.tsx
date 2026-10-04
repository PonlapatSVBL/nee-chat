import { safePath } from '@/presentation/lib/auth/resolve-next';
import { LoginForm } from '@/presentation/components/auth/login-form';

export const metadata = { title: 'เข้าสู่ระบบ' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <LoginForm
      next={safePath(next ?? null) ?? '/'}
      initialError={error === 'link' ? 'ลิงก์หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่' : null}
    />
  );
}
