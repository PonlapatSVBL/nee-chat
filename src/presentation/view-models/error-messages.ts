import type { DomainError, DomainErrorCode } from '@/domain/shared/errors';

const MESSAGES: Record<DomainErrorCode, string> = {
  INVALID_AMOUNT: 'จำนวนเงินไม่ถูกต้อง',
  INVALID_DATE: 'วันที่ไม่ถูกต้อง',
  FUTURE_DATE: 'วันที่ชำระต้องไม่เป็นวันในอนาคต',
  INVALID_NAME: 'กรุณาระบุชื่อเงินกู้',
  INVALID_PAYMENT_METHOD: 'กรุณาเลือกช่องทางการชำระ',
  REASON_REQUIRED: 'กรุณาระบุเหตุผล',
  LOAN_NOT_FOUND: 'ไม่พบข้อมูลเงินกู้',
  LOAN_ALREADY_EXISTS: 'มีข้อมูลเงินกู้อยู่แล้ว',
  PAYMENT_NOT_FOUND: 'ไม่พบรายการชำระ',
  PAYMENT_ALREADY_VOIDED: 'รายการนี้ถูกยกเลิกไปแล้ว',
  EVIDENCE_NOT_FOUND: 'ไม่พบไฟล์หลักฐาน',
  UNSUPPORTED_FILE_TYPE: 'รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ PDF',
  FILE_TOO_LARGE: 'ไฟล์ต้องมีขนาดไม่เกิน 5 MB',
  INVALID_EVIDENCE_PATH: 'ไฟล์หลักฐานไม่ถูกต้อง กรุณาแนบใหม่',
  PERSISTENCE_FAILED: 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
  STORAGE_FAILED: 'อัปโหลดสลิปไม่สำเร็จ ลองใหม่อีกครั้ง',
};

export function messageFor(error: DomainError): string {
  return MESSAGES[error.code] ?? error.message;
}
