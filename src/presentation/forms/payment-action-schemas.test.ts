import { describe, expect, it } from 'vitest';
import { evidenceListInput, prepareUploadInput, voidPaymentInput } from './payment-action-schemas';

const evidence = {
  fileId: 'f1',
  storagePath: 'u/p/f1.png',
  mimeType: 'image/png',
  sizeBytes: 10,
  originalFilename: 'a.png',
};

describe('payment action input schemas', () => {
  it('strips unknown keys such as userId', () => {
    const parsed = prepareUploadInput.parse({ paymentId: null, mimeType: 'image/png', sizeBytes: 1, userId: 'x' });
    expect(parsed).not.toHaveProperty('userId');
    expect(parsed).toEqual({ paymentId: null, mimeType: 'image/png', sizeBytes: 1 });
  });

  it('rejects a non-uuid paymentId', () => {
    expect(prepareUploadInput.safeParse({ paymentId: 'abc', mimeType: 'image/png', sizeBytes: 1 }).success).toBe(false);
    expect(voidPaymentInput.safeParse({ paymentId: 'abc', reason: 'x' }).success).toBe(false);
  });

  it('rejects negative sizeBytes', () => {
    expect(prepareUploadInput.safeParse({ paymentId: null, mimeType: 'image/png', sizeBytes: -1 }).success).toBe(false);
    expect(evidenceListInput.safeParse([{ ...evidence, sizeBytes: -1 }]).success).toBe(false);
  });

  it('rejects more than 10 evidence items', () => {
    expect(evidenceListInput.safeParse(Array.from({ length: 10 }, () => evidence)).success).toBe(true);
    expect(evidenceListInput.safeParse(Array.from({ length: 11 }, () => evidence)).success).toBe(false);
  });
});
