import { describe, expect, it } from 'vitest';
import { Money } from './money';

describe('Money', () => {
  it('parses plain and comma-formatted strings to two decimals', () => {
    expect(Money.of('3000').toString()).toBe('3000.00');
    expect(Money.of('3,000.5').toString()).toBe('3000.50');
    expect(Money.of(' 182420.50 ').toString()).toBe('182420.50');
  });

  it('rejects more than two decimals, empty and non-numeric input', () => {
    for (const bad of ['1.234', '', 'abc', '12.3.4', '1e3']) {
      const r = Money.parse(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('INVALID_AMOUNT');
    }
  });

  it('adds and subtracts without float drift', () => {
    const a = Money.of('0.10');
    const b = Money.of('0.20');
    expect(a.add(b).toString()).toBe('0.30');
    expect(Money.of('195420.50').subtract(Money.of('3000')).toString()).toBe('192420.50');
  });

  it('compares', () => {
    expect(Money.of('1').compare(Money.of('2'))).toBe(-1);
    expect(Money.of('2').compare(Money.of('2'))).toBe(0);
    expect(Money.of('3').compare(Money.of('2'))).toBe(1);
    expect(Money.of('5').isPositive()).toBe(true);
    expect(Money.of('-5').isNegative()).toBe(true);
    expect(Money.zero().isZero()).toBe(true);
    expect(Money.of('1.5').equals(Money.of('1.50'))).toBe(true);
  });
});
