import { DomainError } from './errors';
import { err, ok, type Result } from './result';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export class DateOnly {
  private constructor(readonly iso: string) {}

  static parse(input: string): Result<DateOnly> {
    const trimmed = input.trim();
    const match = ISO_DATE.exec(trimmed);
    if (!match) {
      return err(new DomainError('INVALID_DATE', `รูปแบบวันที่ไม่ถูกต้อง: "${input}"`));
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const probe = new Date(Date.UTC(year, month - 1, day));
    const real =
      probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
    if (!real) {
      return err(new DomainError('INVALID_DATE', `ไม่มีวันที่นี้ในปฏิทิน: "${input}"`));
    }
    return ok(new DateOnly(trimmed));
  }

  /** For trusted input (database rows, tests). Throws on invalid input. */
  static of(input: string): DateOnly {
    const result = DateOnly.parse(input);
    if (!result.ok) throw result.error;
    return result.value;
  }

  /** Uses the local calendar fields of the given Date. */
  static fromDate(date: Date): DateOnly {
    return new DateOnly(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
  }

  get year(): number {
    return Number(this.iso.slice(0, 4));
  }

  get month(): number {
    return Number(this.iso.slice(5, 7));
  }

  get day(): number {
    return Number(this.iso.slice(8, 10));
  }

  compare(other: DateOnly): -1 | 0 | 1 {
    if (this.iso < other.iso) return -1;
    if (this.iso > other.iso) return 1;
    return 0;
  }

  isAfter(other: DateOnly): boolean {
    return this.compare(other) === 1;
  }

  isBefore(other: DateOnly): boolean {
    return this.compare(other) === -1;
  }

  equals(other: DateOnly): boolean {
    return this.iso === other.iso;
  }

  /** UTC midnight of this calendar date. */
  toDate(): Date {
    return new Date(Date.UTC(this.year, this.month - 1, this.day));
  }
}
