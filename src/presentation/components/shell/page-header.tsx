import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export function PageHeader({ title, back, action }: { title: string; back?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-5 flex min-h-11 items-center gap-1">
      {back && (
        <Link
          href={back}
          aria-label="ย้อนกลับ"
          className="-ml-2.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 active:bg-accent"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
      )}
      <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{title}</h1>
      {action}
    </header>
  );
}
