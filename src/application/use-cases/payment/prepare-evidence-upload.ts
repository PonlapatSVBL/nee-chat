import { buildStoragePath, validateFile } from '@/domain/evidence/evidence';
import { DomainError } from '@/domain/shared/errors';
import { err, ok, type Result } from '@/domain/shared/result';
import type { FileStorage } from '@/application/ports/file-storage';
import type { IdGenerator } from '@/application/ports/system';

export interface PreparedUpload {
  readonly paymentId: string;
  readonly fileId: string;
  readonly storagePath: string;
  readonly uploadUrl: string;
  readonly token: string;
}

export class PrepareEvidenceUpload {
  constructor(
    private readonly storage: FileStorage,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: {
    userId: string;
    paymentId: string | null;
    mimeType: string;
    sizeBytes: number;
  }): Promise<Result<PreparedUpload>> {
    const mime = validateFile(input);
    if (!mime.ok) return err(mime.error);

    const paymentId = input.paymentId ?? this.ids.next();
    const fileId = this.ids.next();
    const storagePath = buildStoragePath(input.userId, paymentId, fileId, mime.value);
    try {
      const signed = await this.storage.createSignedUploadUrl(storagePath);
      return ok({ paymentId, fileId, storagePath, uploadUrl: signed.url, token: signed.token });
    } catch (cause) {
      return err(new DomainError('STORAGE_FAILED', `เตรียมอัปโหลดไม่สำเร็จ: ${String(cause)}`));
    }
  }
}
