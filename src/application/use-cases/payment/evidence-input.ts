import { createEvidence, isPathOwnedBy, validateFile, type Evidence } from '@/domain/evidence/evidence';
import { DomainError } from '@/domain/shared/errors';
import { err, ok, type Result } from '@/domain/shared/result';
import type { IdGenerator } from '@/application/ports/system';

export interface UploadedEvidenceInput {
  readonly fileId: string;
  readonly storagePath: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly originalFilename: string | null;
}

export function buildEvidenceList(
  items: readonly UploadedEvidenceInput[],
  ctx: { userId: string; paymentId: string; now: Date; ids: IdGenerator },
): Result<Evidence[]> {
  const result: Evidence[] = [];
  for (const item of items) {
    const mime = validateFile(item);
    if (!mime.ok) return err(mime.error);
    if (!isPathOwnedBy(item.storagePath, ctx.userId, ctx.paymentId)) {
      return err(new DomainError('INVALID_EVIDENCE_PATH', 'ตำแหน่งไฟล์ไม่ถูกต้อง'));
    }
    result.push(
      createEvidence({
        id: ctx.ids.next(),
        paymentId: ctx.paymentId,
        userId: ctx.userId,
        storagePath: item.storagePath,
        type: 'PAYMENT_SLIP',
        mimeType: mime.value,
        sizeBytes: item.sizeBytes,
        originalFilename: item.originalFilename,
        now: ctx.now,
      }),
    );
  }
  return ok(result);
}
