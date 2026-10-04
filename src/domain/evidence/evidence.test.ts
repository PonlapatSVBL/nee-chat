import { describe, expect, it } from 'vitest';
import {
  MAX_EVIDENCE_BYTES,
  buildStoragePath,
  copyEvidenceTo,
  createEvidence,
  extensionFor,
  isPathOwnedBy,
  validateFile,
} from './evidence';

describe('validateFile', () => {
  it('accepts allowed types within size', () => {
    const r = validateFile({ mimeType: 'image/jpeg', sizeBytes: 1024 });
    expect(r).toEqual({ ok: true, value: 'image/jpeg' });
  });

  it('rejects unsupported type', () => {
    const r = validateFile({ mimeType: 'image/gif', sizeBytes: 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('rejects oversize file', () => {
    const r = validateFile({ mimeType: 'application/pdf', sizeBytes: MAX_EVIDENCE_BYTES + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('FILE_TOO_LARGE');
  });
});

describe('validateFile size boundary', () => {
  it('accepts exactly MAX_EVIDENCE_BYTES and rejects one byte more', () => {
    expect(validateFile({ mimeType: 'image/png', sizeBytes: MAX_EVIDENCE_BYTES }).ok).toBe(true);
    const over = validateFile({ mimeType: 'image/png', sizeBytes: MAX_EVIDENCE_BYTES + 1 });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error.code).toBe('FILE_TOO_LARGE');
  });
});

describe('isPathOwnedBy rejections', () => {
  it.each([
    'u1/payments/p1/sub/f.png',
    'u1/payments/p1/../f.png',
    'u1/payments/p1/f.exe',
    'u1/payments/p2/f.png',
    'u10/payments/p1/f.png',
    'u1/payments/p1/',
  ])('rejects %s for user u1 / payment p1', (path) => {
    expect(isPathOwnedBy(path, 'u1', 'p1')).toBe(false);
  });
});

describe('storage paths', () => {
  it('builds the canonical path and recognises ownership', () => {
    const path = buildStoragePath('u1', 'p1', 'f1', 'image/png');
    expect(path).toBe('u1/payments/p1/f1.png');
    expect(isPathOwnedBy(path, 'u1', 'p1')).toBe(true);
    expect(isPathOwnedBy(path, 'u2', 'p1')).toBe(false);
    expect(isPathOwnedBy('u1/payments/p1/../p9/f.png', 'u1', 'p1')).toBe(false);
    expect(extensionFor('application/pdf')).toBe('pdf');
  });
});

describe('copyEvidenceTo', () => {
  it('reuses the file but points at the new payment', () => {
    const now = new Date('2026-10-04T00:00:00Z');
    const e = createEvidence({
      id: 'e1', paymentId: 'p1', userId: 'u1', storagePath: 'u1/payments/p1/f1.jpg',
      type: 'PAYMENT_SLIP', mimeType: 'image/jpeg', sizeBytes: 100, originalFilename: 'slip.jpg', now,
    });
    const later = new Date('2026-10-05T00:00:00Z');
    const copy = copyEvidenceTo(e, 'p2', 'e2', later);
    expect(copy.id).toBe('e2');
    expect(copy.paymentId).toBe('p2');
    expect(copy.storagePath).toBe(e.storagePath);
    expect(copy.createdAt).toBe(later);
  });
});
