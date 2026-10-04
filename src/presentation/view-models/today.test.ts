import { describe, expect, it } from 'vitest';
import { todayIso } from './today';

describe('todayIso', () => {
  it('returns the Bangkok calendar date', () => {
    expect(todayIso(new Date('2026-10-03T17:30:00Z'))).toBe('2026-10-04');
    expect(todayIso(new Date('2026-10-03T16:59:00Z'))).toBe('2026-10-03');
  });
});
