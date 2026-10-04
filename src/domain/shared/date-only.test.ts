import { describe, expect, it } from 'vitest';
import { DateOnly } from './date-only';

describe('DateOnly', () => {
  it('parses valid ISO dates', () => {
    const d = DateOnly.of('2026-10-04');
    expect(d.iso).toBe('2026-10-04');
    expect(d.year).toBe(2026);
    expect(d.month).toBe(10);
    expect(d.day).toBe(4);
  });

  it('rejects bad formats and impossible dates', () => {
    for (const bad of ['2026-13-01', '2026-02-30', '04/10/2026', '2026-1-4', '']) {
      const r = DateOnly.parse(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('INVALID_DATE');
    }
  });

  it('compares chronologically', () => {
    const a = DateOnly.of('2026-09-04');
    const b = DateOnly.of('2026-10-04');
    expect(a.isBefore(b)).toBe(true);
    expect(b.isAfter(a)).toBe(true);
    expect(a.equals(DateOnly.of('2026-09-04'))).toBe(true);
    expect(a.compare(b)).toBe(-1);
  });

  it('converts from a JS Date using local calendar fields', () => {
    const local = new Date(2026, 9, 4, 23, 59);
    expect(DateOnly.fromDate(local).iso).toBe('2026-10-04');
  });
});
