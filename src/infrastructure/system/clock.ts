import { DateOnly } from '@/domain/shared/date-only';
import type { Clock } from '@/application/ports/system';

/** Uses the server's local calendar for "today". Set TZ=Asia/Bangkok in production. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  today(): DateOnly {
    return DateOnly.fromDate(new Date());
  }
}
