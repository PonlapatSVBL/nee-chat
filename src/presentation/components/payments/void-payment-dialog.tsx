'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { voidPaymentAction } from '@/presentation/actions/payment';
import { Button } from '@/presentation/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/presentation/components/ui/dialog';
import { Label } from '@/presentation/components/ui/label';
import { Textarea } from '@/presentation/components/ui/textarea';

export function VoidPaymentDialog({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (busy) return;
    setOpen(next);
    if (!next) setError(null);
  }

  async function confirm() {
    if (reason.trim() === '') {
      setError('กรุณาระบุเหตุผล');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await voidPaymentAction({ paymentId, reason });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    toast.success('ยกเลิกรายการแล้ว');
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" className="h-12 text-destructive hover:bg-destructive/5 hover:text-destructive">
          ยกเลิกรายการ
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ยกเลิกรายการนี้?</DialogTitle>
          <DialogDescription>รายการจะถูกทำเครื่องหมายว่ายกเลิก ประวัติและหลักฐานยังเก็บไว้ ย้อนดูได้ภายหลัง</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="void-reason">เหตุผล</Label>
          <Textarea
            id="void-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เช่น บันทึกซ้ำ"
            aria-invalid={error !== null}
            aria-describedby={error ? 'void-reason-error' : undefined}
          />
          {error && (
            <p id="void-reason-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="h-12" onClick={() => handleOpenChange(false)} disabled={busy}>
            กลับ
          </Button>
          <Button type="button" variant="destructive" className="h-12" onClick={() => void confirm()} disabled={busy}>
            {busy ? 'กำลังยกเลิก…' : 'ยืนยันการยกเลิก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
