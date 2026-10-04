'use client';

import { Camera, FileText, Images, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { MAX_EVIDENCE_BYTES } from '@/domain/evidence/evidence';
import { Button } from '@/presentation/components/ui/button';
import { prepareForUpload } from '@/presentation/lib/resize-image';
import type { PendingFile } from '@/presentation/lib/upload-evidence';
import { cn } from '@/presentation/lib/utils';

interface Props {
  files: PendingFile[];
  onChange: (files: PendingFile[]) => void;
  disabled?: boolean;
}

const pickerButton =
  'h-14 rounded-xl text-base font-medium transition-[transform,background-color,color] duration-150 ease-out-quart active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100';

export function EvidencePicker({ files, onChange, disabled }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    };
    // revoke only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const added: PendingFile[] = [];
    for (const file of Array.from(list)) {
      try {
        const { blob, mimeType } = await prepareForUpload(file);
        if (blob.size > MAX_EVIDENCE_BYTES) {
          toast.error(`ไฟล์ ${file.name} ใหญ่เกิน 5 MB`);
          continue;
        }
        added.push({
          id: crypto.randomUUID(),
          blob,
          name: file.name,
          mimeType,
          previewUrl: mimeType.startsWith('image/') ? URL.createObjectURL(blob) : null,
        });
      } catch {
        toast.error(`อ่านไฟล์ ${file.name} ไม่ได้`);
      }
    }
    onChange([...files, ...added]);
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
  }

  function remove(id: string) {
    const target = files.find((f) => f.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onChange(files.filter((f) => f.id !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={cameraRef}
        data-testid="camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void addFiles(e.target.files)}
        disabled={disabled}
      />
      <input
        ref={galleryRef}
        data-testid="gallery-input"
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void addFiles(e.target.files)}
        disabled={disabled}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          size="lg"
          variant="secondary"
          className={pickerButton}
          onClick={() => cameraRef.current?.click()}
          disabled={disabled}
        >
          <Camera className="size-5" aria-hidden /> ถ่ายรูปสลิป
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className={cn(pickerButton, 'border-input shadow-none')}
          onClick={() => galleryRef.current?.click()}
          disabled={disabled}
        >
          <Images className="size-5" aria-hidden /> เลือกจากเครื่อง
        </Button>
      </div>
      {files.length > 0 && (
        <ul className="grid grid-cols-3 gap-2" aria-label="สลิปที่แนบ">
          {files.map((f, i) => (
            <li key={f.id} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              {f.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.previewUrl} alt={`สลิป ${i + 1}`} className="size-full object-cover" />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-1.5 p-2 text-center text-xs text-muted-foreground">
                  <FileText className="size-7 text-primary" aria-hidden />
                  <span className="line-clamp-2 break-all text-foreground">{f.name}</span>
                </div>
              )}
              {/* 44px hit area, 28px visible chip, pinned to the corner */}
              <button
                type="button"
                aria-label={`ลบไฟล์ ${i + 1}`}
                onClick={() => remove(f.id)}
                className="group absolute -right-1 -top-1 inline-flex size-11 items-center justify-center rounded-full outline-none disabled:opacity-50"
                disabled={disabled}
              >
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-background text-foreground shadow-raised transition-colors duration-150 group-hover:bg-muted group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50 group-active:bg-accent">
                  <X className="size-4" aria-hidden />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
