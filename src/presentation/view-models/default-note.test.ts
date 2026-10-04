import { describe, expect, it } from 'vitest';
import { DateOnly } from '@/domain/shared/date-only';
import { buildDefaultNote } from './default-note';

describe('buildDefaultNote', () => {
  it('names the current month in Thai with Buddhist year', () => {
    expect(buildDefaultNote(DateOnly.of('2026-10-04'))).toBe('ชำระงวดเดือน ต.ค. 2569');
  });
});
