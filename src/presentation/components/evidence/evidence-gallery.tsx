'use client';

import { FileText } from 'lucide-react';
import { useState } from 'react';
import { refreshEvidenceUrlAction } from '@/presentation/actions/evidence';
import { Dialog, DialogContent, DialogTitle } from '@/presentation/components/ui/dialog';

export interface EvidenceItemVm {
  id: string;
  url: string;
  mimeType: string;
  filename: string | null;
}

/** Signed URLs expire after an hour; on a load error, ask for a fresh one once. */
function EvidenceImage({ item, alt, className }: { item: EvidenceItemVm; alt: string; className?: string }) {
  const [src, setSrc] = useState(item.url);
  const [refreshed, setRefreshed] = useState(false);

  async function handleError() {
    if (refreshed) return;
    setRefreshed(true);
    const result = await refreshEvidenceUrlAction(item.id);
    if (result.ok) setSrc(result.data.url);
  }

  // Signed URLs live on the storage origin, so next/image's optimiser is not used here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} onError={() => void handleError()} />;
}

const tile =
  'block size-full outline-none transition-[opacity,box-shadow] hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:opacity-80';

export function EvidenceGallery({ items }: { items: EvidenceItemVm[] }) {
  const [open, setOpen] = useState<EvidenceItemVm | null>(null);

  return (
    <>
      <ul className="grid grid-cols-3 gap-2">
        {items.map((item, i) => {
          const alt = `สลิป ${i + 1}`;
          const isImage = item.mimeType.startsWith('image/');
          return (
            <li key={item.id} className="aspect-square overflow-hidden rounded-lg border bg-muted">
              {isImage ? (
                <button type="button" className={tile} onClick={() => setOpen(item)} aria-label={`เปิด${alt}`}>
                  <EvidenceImage item={item} alt={alt} className="size-full object-cover" />
                </button>
              ) : (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`${tile} flex flex-col items-center justify-center gap-1.5 p-2 text-center text-xs text-muted-foreground`}
                >
                  <FileText className="size-7 text-primary" aria-hidden />
                  <span className="line-clamp-2 break-all">{item.filename ?? 'PDF'}</span>
                </a>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-[100vw] overflow-hidden border-0 bg-black p-0 sm:max-w-3xl">
          <DialogTitle className="sr-only">หลักฐานการชำระ</DialogTitle>
          {open && <EvidenceImage item={open} alt="หลักฐานการชำระ" className="max-h-[90dvh] w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
