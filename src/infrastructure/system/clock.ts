import { DateOnly } from '@/domain/shared/date-only';
import type { Clock } from '@/application/ports/system';

const bangkokDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  /** Calendar date in Asia/Bangkok regardless of server TZ. */
  today(): DateOnly {
    return DateOnly.of(bangkokDate.format(new Date()));
  }
}
