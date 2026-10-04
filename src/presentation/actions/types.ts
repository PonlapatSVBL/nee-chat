import type { DomainError, DomainErrorCode } from '@/domain/shared/errors';
import { messageFor } from '@/presentation/view-models/error-messages';

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: DomainErrorCode; fieldErrors?: Record<string, string> };

export function success<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function failure(error: DomainError): ActionResult<never> {
  return { ok: false, message: messageFor(error), code: error.code };
}
