import type { DateOnly } from '@/domain/shared/date-only';

export interface Clock {
  now(): Date;
  today(): DateOnly;
}

export interface IdGenerator {
  next(): string;
}
