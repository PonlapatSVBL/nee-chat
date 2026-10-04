'use client';

import { Button } from '@/presentation/components/ui/button';

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 px-4 py-16 text-center">
      <p className="text-lg font-medium text-foreground">เกิดข้อผิดพลาด</p>
      <Button type="button" className="h-12 min-w-32" onClick={() => reset()}>
        ลองใหม่
      </Button>
    </div>
  );
}
