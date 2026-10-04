import { z } from 'zod';

export const prepareUploadInput = z.object({
  paymentId: z.string().uuid().nullable(),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().nonnegative(),
});

export const voidPaymentInput = z.object({
  paymentId: z.string().uuid(),
  reason: z.string().max(500),
});

export const uploadedEvidenceInput = z.object({
  fileId: z.string().min(1),
  storagePath: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().nonnegative(),
  originalFilename: z.string().max(255).nullable(),
});

export const evidenceListInput = z.array(uploadedEvidenceInput).max(10);

export const nullablePaymentIdInput = z.string().uuid().nullable();
export const paymentIdInput = z.string().uuid();
