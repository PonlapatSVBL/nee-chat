import { describe, expect, it } from 'vitest';
import { DateOnly } from '@/domain/shared/date-only';
import { Money } from '@/domain/shared/money';
import { formatAmount, formatBaht, formatThaiDate, formatThaiDateLong, formatThaiDateTime, formatThaiMonthYear } from './format';

describe('format', () => {
  it('formats baht with grouping and two decimals', () => {
    expect(formatBaht(Money.of('3000'))).toBe('3,000.00 บาท');
    expect(formatBaht('182420.5')).toBe('182,420.50 บาท');
    expect(formatAmount(Money.of('0'))).toBe('0.00');
  });

  it('formats dates in Buddhist era', () => {
    expect(formatThaiDate(DateOnly.of('2026-10-04'))).toBe('4 ต.ค. 2569');
    expect(formatThaiDate('2026-01-31')).toBe('31 ม.ค. 2569');
    expect(formatThaiDateLong('2026-10-04')).toBe('4 ตุลาคม 2569');
    expect(formatThaiMonthYear(2026, 10)).toBe('ตุลาคม 2569');
  });

  it('formats timestamps in Bangkok time', () => {
    expect(formatThaiDateTime(new Date('2026-10-04T09:05:00Z'))).toBe('4 ต.ค. 2569 16:05');
  });

  it('formats midnight in Bangkok as 00:xx, not 24:xx', () => {
    expect(formatThaiDateTime(new Date('2026-10-03T17:30:00Z'))).toBe('4 ต.ค. 2569 00:30');
  });
});
