'use client';

import { Home, MoreHorizontal, ReceiptText } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/presentation/lib/utils';

const ITEMS = [
  { href: '/', label: 'หน้าแรก', icon: Home, match: (p: string) => p === '/' },
  { href: '/payments', label: 'รายการ', icon: ReceiptText, match: (p: string) => p.startsWith('/payments') },
  { href: '/more', label: 'เพิ่มเติม', icon: MoreHorizontal, match: (p: string) => p.startsWith('/more') },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-3">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group flex h-full flex-col items-center justify-center gap-0.5 text-xs outline-none transition-colors',
                  'focus-visible:bg-accent/60',
                  active ? 'font-semibold text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-14 items-center justify-center rounded-full transition-colors duration-200 ease-out-quart',
                    active ? 'bg-accent' : 'group-active:bg-muted',
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
