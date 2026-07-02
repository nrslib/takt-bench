import { describe, it, expect } from 'vitest';
import { parseCron, nextRun } from './cron';

const utc = (
  y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0,
): Date => new Date(Date.UTC(y, mo - 1, d, h, mi, s, ms));

describe('parseCron', () => {
  it('parses wildcard-only expression', () => {
    const s = parseCron('* * * * *');
    expect(s.minutes).toHaveLength(60);
    expect(s.minutes[0]).toBe(0);
    expect(s.minutes[59]).toBe(59);
    expect(s.hours).toHaveLength(24);
    expect(s.daysOfMonth).toHaveLength(31);
    expect(s.months).toHaveLength(12);
    expect(s.daysOfWeek).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(s.domRestricted).toBe(false);
    expect(s.dowRestricted).toBe(false);
  });

  it('parses fixed values', () => {
    const s = parseCron('5 0 * 8 *');
    expect(s.minutes).toEqual([5]);
    expect(s.hours).toEqual([0]);
    expect(s.months).toEqual([8]);
    expect(s.domRestricted).toBe(false);
  });

  it('parses lists', () => {
    expect(parseCron('15,45 * * * *').minutes).toEqual([15, 45]);
  });

  it('sorts and dedupes list values', () => {
    expect(parseCron('30,10,20,10 * * * *').minutes).toEqual([10, 20, 30]);
  });

  it('parses ranges', () => {
    expect(parseCron('* 9-17 * * *').hours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });

  it('parses steps on wildcard', () => {
    expect(parseCron('*/15 * * * *').minutes).toEqual([0, 15, 30, 45]);
  });

  it('parses steps on range', () => {
    expect(parseCron('10-30/7 * * * *').minutes).toEqual([10, 17, 24]);
  });

  it('normalizes day-of-week 7 to 0 (Sunday)', () => {
    expect(parseCron('0 0 * * 7').daysOfWeek).toEqual([0]);
  });

  it('marks restricted day fields', () => {
    const s = parseCron('0 0 15 * 1');
    expect(s.domRestricted).toBe(true);
    expect(s.dowRestricted).toBe(true);
  });

  it('treats stepped wildcard day fields as unrestricted values but full coverage', () => {
    const s = parseCron('0 0 */2 * *');
    expect(s.daysOfMonth).toEqual([
      1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31,
    ]);
  });

  it.each([
    ['* * * *', 'four fields'],
    ['* * * * * *', 'six fields'],
    ['60 * * * *', 'minute out of range'],
    ['* 24 * * *', 'hour out of range'],
    ['* * 0 * *', 'day-of-month zero'],
    ['* * 32 * *', 'day-of-month out of range'],
    ['* * * 0 *', 'month zero'],
    ['* * * 13 *', 'month out of range'],
    ['* * * * 8', 'day-of-week out of range'],
    ['a * * * *', 'non-numeric token'],
    ['*/0 * * * *', 'zero step'],
    ['5-1 * * * *', 'reversed range'],
    ['', 'empty expression'],
  ])('throws on invalid expression %j (%s)', (expr) => {
    expect(() => parseCron(expr)).toThrow();
  });
});

describe('nextRun', () => {
  // 2026-03-10 is a Tuesday.
  const base = utc(2026, 3, 10, 12, 30, 45, 123);

  it('returns the next minute boundary for * * * * *', () => {
    expect(nextRun('* * * * *', base)).toEqual(utc(2026, 3, 10, 12, 31));
  });

  it('is strictly after `from` even when `from` matches exactly', () => {
    expect(nextRun('* * * * *', utc(2026, 3, 10, 12, 30))).toEqual(
      utc(2026, 3, 10, 12, 31),
    );
  });

  it('truncates seconds and milliseconds', () => {
    expect(nextRun('* * * * *', utc(2026, 3, 10, 12, 30, 59, 999))).toEqual(
      utc(2026, 3, 10, 12, 31),
    );
  });

  it('rolls over to the next hour', () => {
    expect(nextRun('0 * * * *', base)).toEqual(utc(2026, 3, 10, 13, 0));
  });

  it('finds the next step within the hour', () => {
    expect(nextRun('*/15 * * * *', base)).toEqual(utc(2026, 3, 10, 12, 45));
  });

  it('rolls over to the next day when today is past the time', () => {
    expect(nextRun('30 9 * * *', base)).toEqual(utc(2026, 3, 11, 9, 30));
  });

  it('combines minute and hour rollover', () => {
    expect(nextRun('30 14 * * *', utc(2026, 3, 10, 14, 31))).toEqual(
      utc(2026, 3, 11, 14, 30),
    );
  });

  it('finds the first day of the next month', () => {
    expect(nextRun('0 0 1 * *', base)).toEqual(utc(2026, 4, 1, 0, 0));
  });

  it('skips months without the requested day', () => {
    // April has no 31st; strictly after 03-31 00:00 → 05-31 00:00
    expect(nextRun('0 0 31 * *', utc(2026, 3, 31, 0, 0))).toEqual(
      utc(2026, 5, 31, 0, 0),
    );
  });

  it('waits for a leap year for Feb 29', () => {
    expect(nextRun('0 0 29 2 *', utc(2026, 1, 1, 0, 0))).toEqual(
      utc(2028, 2, 29, 0, 0),
    );
  });

  it('matches day-of-week only', () => {
    // Next Monday after Tuesday 2026-03-10 is 2026-03-16
    expect(nextRun('0 12 * * 1', base)).toEqual(utc(2026, 3, 16, 12, 0));
  });

  it('matches day-of-week Friday', () => {
    expect(nextRun('45 23 * * 5', base)).toEqual(utc(2026, 3, 13, 23, 45));
  });

  it('applies OR when both day-of-month and day-of-week are restricted', () => {
    // 15th (Sunday 2026-03-15) comes before next Monday (2026-03-16)
    expect(nextRun('0 0 15 * 1', base)).toEqual(utc(2026, 3, 15, 0, 0));
  });

  it('uses only day-of-month when day-of-week is a wildcard', () => {
    expect(nextRun('0 0 15 * *', utc(2026, 3, 16, 0, 0))).toEqual(
      utc(2026, 4, 15, 0, 0),
    );
  });

  it('rolls over to the next year for a fixed month', () => {
    expect(nextRun('0 0 * 1 *', base)).toEqual(utc(2027, 1, 1, 0, 0));
  });

  it('does not mutate the input date', () => {
    const from = utc(2026, 3, 10, 12, 30, 45, 123);
    const copy = new Date(from.getTime());
    nextRun('* * * * *', from);
    expect(from).toEqual(copy);
  });

  it('throws on invalid expressions', () => {
    expect(() => nextRun('61 * * * *', base)).toThrow();
  });
});
