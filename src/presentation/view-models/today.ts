const bangkokDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's calendar date in Asia/Bangkok as `YYYY-MM-DD`, independent of the browser/server time zone. */
export function todayIso(now: Date = new Date()): string {
  return bangkokDate.format(now);
}
