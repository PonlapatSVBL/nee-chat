'use client';

import type { UploadedEvidenceInput } from '@/application/use-cases/payment/evidence-input';
import { prepareUploadAction } from '@/presentation/actions/payment';
import { createSupabaseBrowserClient } from './supabase/browser';

export interface PendingFile {
  id: string;
  blob: Blob;
  name: string;
  mimeType: string;
  previewUrl: string | null;
}

export class UploadError extends Error {}

export async function uploadEvidence(
  files: readonly PendingFile[],
  paymentId: string | null,
): Promise<{ paymentId: string | null; uploaded: UploadedEvidenceInput[] }> {
  if (files.length === 0) return { paymentId, uploaded: [] };
  const supabase = createSupabaseBrowserClient();
  let currentPaymentId = paymentId;
  const uploaded: UploadedEvidenceInput[] = [];

  for (const file of files) {
    try {
      const prepared = await prepareUploadAction({
        paymentId: currentPaymentId,
        mimeType: file.mimeType,
        sizeBytes: file.blob.size,
      });
      if (!prepared.ok) throw new UploadError(prepared.message);
      currentPaymentId = prepared.data.paymentId;

      const { error } = await supabase.storage
        .from('evidence')
        .uploadToSignedUrl(prepared.data.storagePath, prepared.data.token, file.blob, { contentType: file.mimeType });
      if (error) throw new UploadError(error.message);

      uploaded.push({
        fileId: prepared.data.fileId,
        storagePath: prepared.data.storagePath,
        mimeType: file.mimeType,
        sizeBytes: file.blob.size,
        originalFilename: file.name,
      });
    } catch (e) {
      // Network failures and thrown server actions must still surface the upload toast.
      throw e instanceof UploadError ? e : new UploadError(String(e));
    }
  }
  return { paymentId: currentPaymentId, uploaded };
}
