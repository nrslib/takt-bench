/**
 * テストスイート検証用の参照実装。
 * subject には配布しない（runs/ の clone は subject/ のみコピーされる）。
 * テストを変更した場合は、この実装を subject/src/cron.ts に一時コピーして
 * 全テストが通ることを確認する（scripts/verify-tests.sh）。
 */

export interface CronSchedule {
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  daysOfWeek: number[];
  domRestricted: boolean;
  dowRestricted: boolean;
}

interface FieldSpec {
  min: number;
  max: number;
  normalize?: (v: number) => number;
}

const FIELDS: FieldSpec[] = [
  { min: 0, max: 59 },
  { min: 0, max: 23 },
  { min: 1, max: 31 },
  { min: 1, max: 12 },
  { min: 0, max: 7, normalize: (v) => (v === 7 ? 0 : v) },
];

function parseNumber(token: string, spec: FieldSpec): number {
  if (!/^\d+$/.test(token)) {
    throw new Error(`Invalid numeric token: "${token}"`);
  }
  const value = parseInt(token, 10);
  if (value < spec.min || value > spec.max) {
    throw new Error(`Value ${value} out of range ${spec.min}-${spec.max}`);
  }
  return value;
}

function expandPart(part: string, spec: FieldSpec): number[] {
  let rangePart = part;
  let step = 1;
  const stepIdx = part.indexOf('/');
  if (stepIdx !== -1) {
    rangePart = part.slice(0, stepIdx);
    const stepToken = part.slice(stepIdx + 1);
    if (!/^\d+$/.test(stepToken)) {
      throw new Error(`Invalid step: "${stepToken}"`);
    }
    step = parseInt(stepToken, 10);
    if (step === 0) {
      throw new Error('Step must be >= 1');
    }
  }

  let lo: number;
  let hi: number;
  if (rangePart === '*') {
    lo = spec.min;
    hi = spec.max;
  } else if (rangePart.includes('-')) {
    const [a, b, ...rest] = rangePart.split('-');
    if (rest.length > 0 || a === undefined || b === undefined) {
      throw new Error(`Invalid range: "${rangePart}"`);
    }
    lo = parseNumber(a, spec);
    hi = parseNumber(b, spec);
    if (lo > hi) {
      throw new Error(`Reversed range: "${rangePart}"`);
    }
  } else {
    lo = parseNumber(rangePart, spec);
    hi = lo;
  }

  const values: number[] = [];
  for (let v = lo; v <= hi; v += step) {
    values.push(spec.normalize ? spec.normalize(v) : v);
  }
  return values;
}

function expandField(field: string, spec: FieldSpec): number[] {
  if (field.length === 0) {
    throw new Error('Empty field');
  }
  const values = new Set<number>();
  for (const part of field.split(',')) {
    for (const v of expandPart(part, spec)) {
      values.add(v);
    }
  }
  return [...values].sort((a, b) => a - b);
}

function isUnrestricted(field: string): boolean {
  return field === '*' || field.startsWith('*/');
}

export function parseCron(expr: string): CronSchedule {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5 || fields.some((f) => f.length === 0)) {
    throw new Error(`Expected 5 fields, got ${fields.length}`);
  }
  const [minute, hour, dom, month, dow] = fields as [string, string, string, string, string];
  return {
    minutes: expandField(minute, FIELDS[0]!),
    hours: expandField(hour, FIELDS[1]!),
    daysOfMonth: expandField(dom, FIELDS[2]!),
    months: expandField(month, FIELDS[3]!),
    daysOfWeek: expandField(dow, FIELDS[4]!),
    domRestricted: !isUnrestricted(dom),
    dowRestricted: !isUnrestricted(dow),
  };
}

function dayMatches(schedule: CronSchedule, date: Date): boolean {
  const domMatch = schedule.daysOfMonth.includes(date.getUTCDate());
  const dowMatch = schedule.daysOfWeek.includes(date.getUTCDay());
  if (schedule.domRestricted && schedule.dowRestricted) {
    return domMatch || dowMatch;
  }
  if (schedule.domRestricted) {
    return domMatch;
  }
  if (schedule.dowRestricted) {
    return dowMatch;
  }
  return true;
}

export function nextRun(expr: string, from: Date): Date {
  const schedule = parseCron(expr);
  // 次の分境界（strictly after）から探索する
  const candidate = new Date(from.getTime());
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);

  // 4年+1ヶ月あれば閏年ケースも必ず到達する
  const limit = Date.UTC(
    candidate.getUTCFullYear() + 5,
    candidate.getUTCMonth(),
    1,
  );

  while (candidate.getTime() < limit) {
    if (!schedule.months.includes(candidate.getUTCMonth() + 1)) {
      candidate.setUTCMonth(candidate.getUTCMonth() + 1, 1);
      candidate.setUTCHours(0, 0, 0, 0);
      continue;
    }
    if (!dayMatches(schedule, candidate)) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
      candidate.setUTCHours(0, 0, 0, 0);
      continue;
    }
    if (!schedule.hours.includes(candidate.getUTCHours())) {
      candidate.setUTCHours(candidate.getUTCHours() + 1, 0, 0, 0);
      continue;
    }
    if (!schedule.minutes.includes(candidate.getUTCMinutes())) {
      candidate.setUTCMinutes(candidate.getUTCMinutes() + 1, 0, 0);
      continue;
    }
    return candidate;
  }
  throw new Error(`No matching time found for "${expr}"`);
}
