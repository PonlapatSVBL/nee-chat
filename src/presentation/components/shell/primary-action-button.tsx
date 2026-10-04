import { Plus } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/presentation/components/ui/button';
import { cn } from '@/presentation/lib/utils';

export function PrimaryActionButton({ href, label }: { href: string; label: string }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-30 px-4"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 0.75rem)' }}
    >
      <Link
        href={href}
        className={cn(
          buttonVariants({ size: 'lg' }),
          'pointer-events-auto mx-auto flex h-14 w-full max-w-[calc(28rem-2rem)] rounded-xl text-base font-semibold shadow-float',
          'transition-[transform,background-color] duration-150 ease-out-quart active:scale-[0.98]',
        )}
      >
        <Plus className="size-5" strokeWidth={2.25} aria-hidden />
        {label}
      </Link>
    </div>
  );
}
