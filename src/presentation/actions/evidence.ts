'use server';

import { z } from 'zod';
import { getContainer } from '@/infrastructure/container';
import { SIGNED_URL_TTL_SECONDS } from '@/application/use-cases/query/get-payment-detail';
import { DomainError } from '@/domain/shared/errors';
import { requireUserId } from '@/presentation/lib/supabase/server';
import { failure, success, type ActionResult } from './types';

const evidenceIdInput = z.string().uuid();

export async function refreshEvidenceUrlAction(evidenceId: string): Promise<ActionResult<{ url: string }>> {
  const userId = await requireUserId();
  const parsed = evidenceIdInput.safeParse(evidenceId);
  if (!parsed.success) return { ok: false, message: 'ข้อมูลไม่ถูกต้อง' };
  const container = getContainer();
  const evidence = await container.evidence.findById(parsed.data, userId);
  if (!evidence) return failure(new DomainError('EVIDENCE_NOT_FOUND'));
  try {
    const url = await container.storage.createSignedReadUrl(evidence.storagePath, SIGNED_URL_TTL_SECONDS);
    return success({ url });
  } catch {
    return failure(new DomainError('STORAGE_FAILED'));
  }
}
