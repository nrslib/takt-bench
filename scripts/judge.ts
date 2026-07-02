/**
 * 事後審判: ワークフロー終了後の最終コードを、固定審判（codex exec ヘッドレス、
 * gpt-5.5）が同一ルーブリックで採点する。テスト合否ではなくコードの質を見る。
 *
 *   node scripts/judge.ts [--filter <substr>]
 *
 * 出力: results/judge.json, results/judge.md
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadMatrix, comboRunDirs, rootDir, resultsDir } from './lib.ts';

const args = process.argv.slice(2);
const filterIdx = args.indexOf('--filter');
const filter = filterIdx !== -1 ? args[filterIdx + 1] : undefined;

const JUDGE_MODEL = 'gpt-5.5';

interface JudgeScore {
  correctness: number;
  design: number;
  readability: number;
  robustness: number;
  overall: number;
  summary: string;
  issues: string[];
}

interface JudgeResult {
  comboId: string;
  rep: number;
  judgeModel: string;
  score: JudgeScore | null;
  error?: string;
}

const RUBRIC = `あなたはコード品質の審判です。cron 式パーサーの実装を採点してください。

仕様: 5 フィールド cron 式の解析（*、数値、リスト、範囲、ステップ、曜日 7=0 正規化）と、
UTC 基準の次回実行時刻計算（strictly after、日/曜日両制限時は OR）。
テストは既に全件通っている前提なので、テスト合否ではなく「コードの質」だけを見ること。

採点観点（各 1-10 点）:
- correctness: テストが覆っていないエッジケースへの正しさ（境界値、不正入力の網羅）
- design: 構造の筋の良さ（責務分割、重複のなさ、データフローの明瞭さ）
- readability: 可読性（命名、複雑度、コメントの過不足）
- robustness: 堅牢性（Fail Fast、フォールバックで誤魔化していないか、型の使い方）
- overall: 総合（上記の加重ではなく、このコードをレビューなしでマージできるかの度合い）

summary は 1-2 文の総評、issues は具体的な問題点のリスト（なければ空配列）。`;

function judgeOne(comboId: string, rep: number, dir: string): JudgeResult {
  const codePath = join(dir, 'src', 'cron.ts');
  if (!existsSync(codePath)) {
    return { comboId, rep, judgeModel: JUDGE_MODEL, score: null, error: 'src/cron.ts not found' };
  }
  const code = readFileSync(codePath, 'utf-8');
  if (code.includes("throw new Error('Not implemented')")) {
    return { comboId, rep, judgeModel: JUDGE_MODEL, score: null, error: 'unimplemented (skeleton)' };
  }
  const reference = readFileSync(join(rootDir, 'reference', 'cron-reference.ts'), 'utf-8');

  const prompt = [
    RUBRIC,
    '',
    '--- 採点対象のコード (src/cron.ts) ---',
    '```typescript',
    code,
    '```',
    '',
    '--- 参考: 検証済みの参照実装（採点対象ではない。仕様理解の補助のみ） ---',
    '```typescript',
    reference,
    '```',
  ].join('\n');

  const outFile = join(tmpdir(), `takt-bench-judge-${comboId}-r${rep}.json`);
  try {
    execSync(
      [
        'codex exec -',
        `--model ${JUDGE_MODEL}`,
        '--sandbox read-only',
        '--skip-git-repo-check',
        '--ephemeral',
        `--output-schema ${join(rootDir, 'scripts', 'judge-schema.json')}`,
        `-o ${outFile}`,
      ].join(' '),
      {
        input: prompt,
        encoding: 'utf-8',
        timeout: 600_000,
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );
    const lastMessage = readFileSync(outFile, 'utf-8');
    return { comboId, rep, judgeModel: JUDGE_MODEL, score: JSON.parse(lastMessage) as JudgeScore };
  } catch (e) {
    return {
      comboId, rep, judgeModel: JUDGE_MODEL, score: null,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    rmSync(outFile, { force: true });
  }
}

function buildMarkdown(results: JudgeResult[]): string {
  const lines: string[] = [];
  lines.push(`# 事後審判（codex ${JUDGE_MODEL} 固定審判による最終コード品質採点）`);
  lines.push('');
  lines.push('| combo | rep | correctness | design | readability | robustness | overall | 総評 |');
  lines.push('|-------|-----|-------------|--------|-------------|------------|---------|------|');
  for (const r of results) {
    if (!r.score) {
      lines.push(`| ${r.comboId} | ${r.rep} | - | - | - | - | - | (${r.error}) |`);
      continue;
    }
    const s = r.score;
    lines.push(
      `| ${r.comboId} | ${r.rep} | ${s.correctness} | ${s.design} | ${s.readability} `
      + `| ${s.robustness} | ${s.overall} | ${s.summary} |`,
    );
  }
  lines.push('');
  for (const r of results) {
    if (!r.score || r.score.issues.length === 0) continue;
    lines.push(`## ${r.comboId} (r${r.rep}) の指摘`);
    for (const issue of r.score.issues) {
      lines.push(`- ${issue}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

const matrix = loadMatrix();
const targets = comboRunDirs(matrix, { filter }).filter(({ dir }) => existsSync(dir));
if (targets.length === 0) {
  console.error('採点対象がありません');
  process.exit(1);
}

const results = targets.map(({ combo, rep, dir }) => {
  console.log(`judging: ${combo.id}-r${rep}`);
  return judgeOne(combo.id, rep, dir);
});

mkdirSync(resultsDir, { recursive: true });
writeFileSync(join(resultsDir, 'judge.json'), JSON.stringify(results, null, 2));
writeFileSync(join(resultsDir, 'judge.md'), buildMarkdown(results));
console.log('\nwrote: results/judge.json, results/judge.md\n');
console.log(buildMarkdown(results));
