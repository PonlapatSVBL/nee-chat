import { describe, expect, it } from 'vitest';
import { DomainError } from '@/domain/shared/errors';
import { messageFor } from './error-messages';

describe('messageFor', () => {
  it('maps known codes to Thai copy', () => {
    expect(messageFor(new DomainError('PAYMENT_ALREADY_VOIDED'))).toBe('รายการนี้ถูกยกเลิกไปแล้ว');
    expect(messageFor(new DomainError('FILE_TOO_LARGE'))).toBe('ไฟล์ต้องมีขนาดไม่เกิน 5 MB');
  });

  it('falls back to a generic message for persistence failures', () => {
    expect(messageFor(new DomainError('PERSISTENCE_FAILED', 'raw db text'))).toBe('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  });
});
