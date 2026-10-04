import { ChevronRight, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { signOutAction } from '@/presentation/actions/auth';
import { PageHeader } from '@/presentation/components/shell/page-header';
import { version } from '../../../../package.json';

export const metadata = { title: 'เพิ่มเติม' };

const rowClass =
  'flex min-h-14 w-full items-center gap-3 px-4 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50 active:bg-accent';

export default function MorePage() {
  return (
    <>
      <PageHeader title="เพิ่มเติม" />
      <ul className="divide-y overflow-hidden rounded-xl border bg-background">
        <li>
          <Link href="/more/loan" className={rowClass}>
            <Settings className="size-5 text-muted-foreground" aria-hidden />
            <span className="flex-1">ตั้งค่าเงินกู้</span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </Link>
        </li>
        <li>
          <form action={signOutAction}>
            <button type="submit" className={`${rowClass} text-destructive`}>
              <LogOut className="size-5" aria-hidden />
              <span className="flex-1">ออกจากระบบ</span>
            </button>
          </form>
        </li>
      </ul>
      <p className="mt-8 text-center text-xs text-muted-foreground">หนี้ชัด v{version}</p>
    </>
  );
}
