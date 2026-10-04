import type { DateOnly } from '@/domain/shared/date-only';
import { THAI_MONTHS_SHORT, toBuddhistYear } from './format';

export function buildDefaultNote(today: DateOnly): string {
  return `ชำระงวดเดือน ${THAI_MONTHS_SHORT[today.month - 1]} ${toBuddhistYear(today.year)}`;
}
