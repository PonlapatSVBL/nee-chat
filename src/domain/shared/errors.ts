export type DomainErrorCode =
  | 'INVALID_AMOUNT'
  | 'INVALID_DATE'
  | 'FUTURE_DATE'
  | 'INVALID_NAME'
  | 'INVALID_PAYMENT_METHOD'
  | 'REASON_REQUIRED'
  | 'LOAN_NOT_FOUND'
  | 'LOAN_ALREADY_EXISTS'
  | 'PAYMENT_NOT_FOUND'
  | 'PAYMENT_ALREADY_VOIDED'
  | 'EVIDENCE_NOT_FOUND'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'INVALID_EVIDENCE_PATH'
  | 'PERSISTENCE_FAILED'
  | 'STORAGE_FAILED';

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'DomainError';
  }
}
