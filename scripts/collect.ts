/**
 * 実行済み runs/ からメトリクスを収集し、results/summary.{json,md} を出力する。
 *
 *   node scripts/collect.ts [--smoke] [--filter <substr>]
 *
 * 収集内容: テスト合否・型チェック・所要時間・トークン消費（usage-events）・差分規模。
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadMatrix, comboRunDirs, resultsDir, readJsonIfExists,
} from './lib.ts';

const args = process.argv.slice(2);
const smoke = args.includes('--smoke');
const filterIdx = args.indexOf('--filter');
const filter = filterIdx !== -1 ? args[filterIdx + 1] : undefined;

interface UsageEventRecord {
  provider: string;
  provider_model: string;
  step: string;
  success: boolean;
  usage_missing?: boolean;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
}

interface StepUsage {
  step: string;
  provider: string;
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface RunSummary {
  comboId: string;
  rep: number;
  dir: string;
  exitCode: number | null;
  durationMs: number | null;
  testsPassed: number | null;
  testsTotal: number | null;
  typecheckOk: boolean | null;
  diffShortstat: string;
  usage: StepUsage[];
  usageMissingCalls: number;
  totalTokens: number;
}

function collectTests(dir: string): { passed: number; total: number } | null {
  try {
    execSync('npx vitest run --reporter=json --outputFile=.bench-test.json', {
      cwd: dir, stdio: 'pipe', timeout: 120_000,
    });
  } catch {
    // テスト失敗でも JSON は出力される。出力がなければ null を返す。
  }
  const result = readJsonIfExists<{ numTotalTests: number; numPassedTests: number }>(
    join(dir, '.bench-test.json'),
  );
  if (!result) return null;
  return { passed: result.numPassedTests, total: result.numTotalTests };
}

function collectTypecheck(dir: string): boolean {
  try {
    execSync('npx tsc --noEmit', { cwd: dir, stdio: 'pipe', timeout: 120_000 });
    return true;
  } catch {
    return false;
  }
}

/** usage-events は .takt/runs/<run>/logs/*-usage-events.jsonl に出力される */
function usageEventFiles(dir: string): string[] {
  const runsRoot = join(dir, '.takt', 'runs');
  if (!existsSync(runsRoot)) return [];
  const files: string[] = [];
  for (const run of readdirSync(runsRoot)) {
    const logsDir = join(runsRoot, run, 'logs');
    if (!existsSync(logsDir)) continue;
    for (const file of readdirSync(logsDir)) {
      if (file.endsWith('-usage-events.jsonl')) files.push(join(logsDir, file));
    }
  }
  return files;
}

function collectUsage(dir: string): { usage: StepUsage[]; missing: number } {
  const byKey = new Map<string, StepUsage>();
  let missing = 0;

  for (const path of usageEventFiles(dir)) {
    for (const line of readFileSync(path, 'utf-8').split('\n')) {
      if (!line.trim()) continue;
      const rec = JSON.parse(line) as UsageEventRecord;
      if (rec.usage_missing) missing += 1;
      const key = `${rec.step}|${rec.provider}|${rec.provider_model}`;
      const entry = byKey.get(key) ?? {
        step: rec.step,
        provider: rec.provider,
        model: rec.provider_model,
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };
      entry.calls += 1;
      entry.inputTokens += rec.usage?.input_tokens ?? 0;
      entry.outputTokens += rec.usage?.output_tokens ?? 0;
      entry.totalTokens += rec.usage?.total_tokens ?? 0;
      byKey.set(key, entry);
    }
  }
  return { usage: [...byKey.values()], missing };
}

function collectDiff(dir: string): string {
  try {
    // 新規モジュール（未追跡ファイル）も差分に含めるため、いったん index に載せて計測する
    execSync('git add -A', { cwd: dir, stdio: 'pipe' });
    const out = execSync(
      'git diff --cached --shortstat -- . ":(exclude).takt" ":(exclude).bench-test.json" ":(exclude)meta.json"',
      { cwd: dir, stdio: 'pipe', encoding: 'utf-8' },
    );
    return out.trim() || '(no diff)';
  } catch {
    return '(git error)';
  }
}

function collectOne(comboId: string, rep: number, dir: string): RunSummary {
  const runMeta = readJsonIfExists<{ durationMs: number; exitCode: number | null }>(
    join(dir, 'meta.run.json'),
  );
  const tests = collectTests(dir);
  const { usage, missing } = collectUsage(dir);
  return {
    comboId,
    rep,
    dir,
    exitCode: runMeta?.exitCode ?? null,
    durationMs: runMeta?.durationMs ?? null,
    testsPassed: tests?.passed ?? null,
    testsTotal: tests?.total ?? null,
    typecheckOk: collectTypecheck(dir),
    diffShortstat: collectDiff(dir),
    usage,
    usageMissingCalls: missing,
    totalTokens: usage.reduce((sum, u) => sum + u.totalTokens, 0),
  };
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return '-';
  return `${(ms / 1000).toFixed(1)}s`;
}

function buildMarkdown(summaries: RunSummary[]): string {
  const lines: string[] = [];
  lines.push('# ベンチマーク結果');
  lines.push('');
  lines.push(`収集日時: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('| combo | rep | exit | テスト | 型 | 所要時間 | 総トークン | 差分 |');
  lines.push('|-------|-----|------|--------|-----|---------|-----------|------|');
  for (const s of summaries) {
    const tests = s.testsTotal !== null ? `${s.testsPassed}/${s.testsTotal}` : '-';
    const type = s.typecheckOk === null ? '-' : s.typecheckOk ? '✅' : '❌';
    lines.push(
      `| ${s.comboId} | ${s.rep} | ${s.exitCode ?? '-'} | ${tests} | ${type} `
      + `| ${fmtDuration(s.durationMs)} | ${s.totalTokens || '-'} | ${s.diffShortstat} |`,
    );
  }
  lines.push('');
  lines.push('## ステップ別トークン消費');
  lines.push('');
  for (const s of summaries) {
    lines.push(`### ${s.comboId} (r${s.rep})`);
    lines.push('');
    if (s.usage.length === 0) {
      lines.push(`(usage-events なし${s.usageMissingCalls > 0 ? `、usage_missing ${s.usageMissingCalls} 件` : ''})`);
      lines.push('');
      continue;
    }
    lines.push('| step | provider | model | calls | in | out | total |');
    lines.push('|------|----------|-------|-------|-----|-----|-------|');
    for (const u of s.usage) {
      lines.push(
        `| ${u.step} | ${u.provider} | ${u.model} | ${u.calls} `
        + `| ${u.inputTokens} | ${u.outputTokens} | ${u.totalTokens} |`,
      );
    }
    if (s.usageMissingCalls > 0) {
      lines.push('');
      lines.push(`usage_missing: ${s.usageMissingCalls} 件（トークン数が取得できなかった呼び出し）`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

const matrix = loadMatrix();
const targets = comboRunDirs(matrix, { smoke, filter }).filter(({ dir }) => existsSync(dir));
if (targets.length === 0) {
  console.error('収集対象がありません');
  process.exit(1);
}

const summaries = targets.map(({ combo, rep, dir }) => {
  console.log(`collecting: ${dir}`);
  return collectOne(combo.id, rep, dir);
});

mkdirSync(resultsDir, { recursive: true });
writeFileSync(join(resultsDir, 'summary.json'), JSON.stringify(summaries, null, 2));
writeFileSync(join(resultsDir, 'summary.md'), buildMarkdown(summaries));
console.log(`\nwrote: results/summary.json, results/summary.md`);
console.log('');
console.log(buildMarkdown(summaries));
