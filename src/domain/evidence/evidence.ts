import { DomainError } from '@/domain/shared/errors';
import { err, ok, type Result } from '@/domain/shared/result';

export type EvidenceType = 'PAYMENT_SLIP' | 'RECEIPT' | 'OTHER';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_EVIDENCE_BYTES = 5_242_880;

export interface Evidence {
  readonly id: string;
  readonly paymentId: string;
  readonly userId: string;
  readonly storagePath: string;
  readonly type: EvidenceType;
  readonly mimeType: AllowedMimeType;
  readonly sizeBytes: number;
  readonly originalFilename: string | null;
  readonly createdAt: Date;
}

export function validateFile(file: { mimeType: string; sizeBytes: number }): Result<AllowedMimeType> {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimeType)) {
    return err(new DomainError('UNSUPPORTED_FILE_TYPE', 'รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ PDF'));
  }
  if (file.sizeBytes > MAX_EVIDENCE_BYTES) {
    return err(new DomainError('FILE_TOO_LARGE', 'ไฟล์ต้องมีขนาดไม่เกิน 5 MB'));
  }
  return ok(file.mimeType as AllowedMimeType);
}

export function extensionFor(mime: AllowedMimeType): 'jpg' | 'png' | 'webp' | 'pdf' {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'application/pdf':
      return 'pdf';
  }
}

export function evidenceDirectory(userId: string, paymentId: string): string {
  return `${userId}/payments/${paymentId}`;
}

export function buildStoragePath(userId: string, paymentId: string, fileId: string, mime: AllowedMimeType): string {
  return `${evidenceDirectory(userId, paymentId)}/${fileId}.${extensionFor(mime)}`;
}

const SAFE_SEGMENT = /^[A-Za-z0-9_-]+\.(jpg|png|webp|pdf)$/;

export function isPathOwnedBy(path: string, userId: string, paymentId: string): boolean {
  const prefix = `${evidenceDirectory(userId, paymentId)}/`;
  if (!path.startsWith(prefix)) return false;
  const rest = path.slice(prefix.length);
  return SAFE_SEGMENT.test(rest);
}

export function createEvidence(input: {
  id: string;
  paymentId: string;
  userId: string;
  storagePath: string;
  type: EvidenceType;
  mimeType: AllowedMimeType;
  sizeBytes: number;
  originalFilename: string | null;
  now: Date;
}): Evidence {
  return {
    id: input.id,
    paymentId: input.paymentId,
    userId: input.userId,
    storagePath: input.storagePath,
    type: input.type,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    originalFilename: input.originalFilename,
    createdAt: input.now,
  };
}

export function copyEvidenceTo(evidence: Evidence, newPaymentId: string, newId: string, now: Date): Evidence {
  return { ...evidence, id: newId, paymentId: newPaymentId, createdAt: now };
}
