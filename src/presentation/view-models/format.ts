import type { PaymentMethod } from '@/domain/payment/payment';
import { DateOnly } from '@/domain/shared/date-only';
import type { Money } from '@/domain/shared/money';

export const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'] as const;
export const THAI_MONTHS_LONG = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'] as const;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  MOBILE_BANKING: 'Mobile Banking',
  COUNTER: 'เคาน์เตอร์ธนาคาร',
  ATM: 'ตู้ ATM',
  OTHER: 'อื่น ๆ',
};

export function toBuddhistYear(year: number): number {
  return year + 543;
}

const amountFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function asString(amount: Money | string): string {
  return typeof amount === 'string' ? amount : amount.toString();
}

export function formatAmount(amount: Money | string): string {
  return amountFormatter.format(Number(asString(amount)));
}

export function formatBaht(amount: Money | string): string {
  return `${formatAmount(amount)} บาท`;
}

function asDateOnly(date: DateOnly | string): DateOnly {
  return typeof date === 'string' ? DateOnly.of(date) : date;
}

export function formatThaiDate(date: DateOnly | string): string {
  const d = asDateOnly(date);
  return `${d.day} ${THAI_MONTHS_SHORT[d.month - 1]} ${toBuddhistYear(d.year)}`;
}

export function formatThaiDateLong(date: DateOnly | string): string {
  const d = asDateOnly(date);
  return `${d.day} ${THAI_MONTHS_LONG[d.month - 1]} ${toBuddhistYear(d.year)}`;
}

export function formatThaiMonthYear(year: number, month: number): string {
  return `${THAI_MONTHS_LONG[month - 1]} ${toBuddhistYear(year)}`;
}

const bangkokParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatThaiDateTime(date: Date): string {
  const parts = Object.fromEntries(bangkokParts.formatToParts(date).map((p) => [p.type, p.value]));
  const day = Number(parts.day);
  const month = Number(parts.month);
  const year = Number(parts.year);
  return `${day} ${THAI_MONTHS_SHORT[month - 1]} ${toBuddhistYear(year)} ${parts.hour}:${parts.minute}`;
}
