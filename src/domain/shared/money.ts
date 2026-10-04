import Decimal from 'decimal.js';
import { DomainError } from './errors';
import { err, ok, type Result } from './result';

const TWO_DECIMALS = /^-?\d+(\.\d{1,2})?$/;

export class Money {
  private constructor(private readonly value: Decimal) {}

  static parse(input: string): Result<Money> {
    const cleaned = input.trim().replace(/,/g, '');
    if (!TWO_DECIMALS.test(cleaned)) {
      return err(new DomainError('INVALID_AMOUNT', `ไม่ใช่จำนวนเงินที่ถูกต้อง: "${input}"`));
    }
    return ok(new Money(new Decimal(cleaned)));
  }

  /** For trusted input (database rows, tests). Throws on invalid input. */
  static of(input: string): Money {
    const result = Money.parse(input);
    if (!result.ok) throw result.error;
    return result.value;
  }

  static zero(): Money {
    return new Money(new Decimal(0));
  }

  add(other: Money): Money {
    return new Money(this.value.plus(other.value));
  }

  subtract(other: Money): Money {
    return new Money(this.value.minus(other.value));
  }

  isPositive(): boolean {
    return this.value.greaterThan(0);
  }

  isNegative(): boolean {
    return this.value.lessThan(0);
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  equals(other: Money): boolean {
    return this.value.equals(other.value);
  }

  compare(other: Money): -1 | 0 | 1 {
    return this.value.comparedTo(other.value) as -1 | 0 | 1;
  }

  toString(): string {
    return this.value.toFixed(2);
  }

  toNumber(): number {
    return this.value.toNumber();
  }
}
