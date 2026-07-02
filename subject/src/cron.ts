/**
 * cron 式パーサーと次回実行時刻計算。
 * 仕様は README.md を参照。テスト（src/cron.test.ts）がすべて通るように実装すること。
 */

export interface CronSchedule {
  /** 0-59、昇順・重複なし */
  minutes: number[];
  /** 0-23、昇順・重複なし */
  hours: number[];
  /** 1-31、昇順・重複なし */
  daysOfMonth: number[];
  /** 1-12、昇順・重複なし */
  months: number[];
  /** 0-6（0=日曜）、昇順・重複なし。7 は 0 に正規化 */
  daysOfWeek: number[];
  /** 日フィールドが `*`（ステップ付き含む）以外で制限されているか */
  domRestricted: boolean;
  /** 曜日フィールドが `*`（ステップ付き含む）以外で制限されているか */
  dowRestricted: boolean;
}

export function parseCron(expr: string): CronSchedule {
  throw new Error('Not implemented');
}

export function nextRun(expr: string, from: Date): Date {
  throw new Error('Not implemented');
}
