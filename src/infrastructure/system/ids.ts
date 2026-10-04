import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '@/application/ports/system';

export class UuidIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
