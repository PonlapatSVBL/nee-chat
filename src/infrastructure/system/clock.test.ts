import { afterEach, describe, expect, it, vi } from 'vitest';
import { SystemClock } from './clock';

describe('SystemClock.today', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rolls over to the next day at 00:00 Bangkok (17:00 UTC)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T17:30:00Z'));
    expect(new SystemClock().today().iso).toBe('2026-10-04');
  });

  it('is still the previous day just before midnight Bangkok', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T16:59:00Z'));
    expect(new SystemClock().today().iso).toBe('2026-10-03');
  });
});
