/**
 * 事後審判: ワークフロー終了後の最終コードを、固定審判（codex exec ヘッドレス、
 * gpt-5.5）が同一ルーブリックで採点する。テスト合否ではなくコードの質を見る。
 *
 *   node scripts/judge.ts [--filter <substr>]
 *
 * 出力: results/judge.json, results/judge.md
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const RUBRIC = `あなたはコード品質の審判です。イベントソーシングの在庫管理ライブラリの実装を採点してください。

仕様: decide/evolve の純粋なドメイン層、EventStore ポートと InMemory 実装（楽観的並行性制御）、
load → replay → decide → append の CommandHandler、イベントのみから構築する StockProjection。
テストは既に全件通っている前提なので、テスト合否ではなく「コードの質」だけを見ること。

採点観点（各 1-10 点）:
- correctness: テストが覆っていないエッジケースへの正しさ（境界値、不変条件の網羅）
- design: アーキテクチャの筋の良さ（層分離、依存方向がドメイン→ポートに向いているか、
  ドメインの純粋性、プロジェクションの独立性、モジュール分割の妥当性。
  全部を 1 ファイルに詰め込んでいないか、逆に過剰分割していないか）
- readability: 可読性（命名、複雑度、コメントの過不足）
- robustness: 堅牢性（Fail Fast、フォールバックで誤魔化していないか、不変性の維持、型の使い方）
- overall: 総合（上記の加重ではなく、このコードをレビューなしでマージできるかの度合い）

summary は 1-2 文の総評、issues は具体的な問題点のリスト（なければ空配列）。`;

/** ディレクトリ配下の .ts を再帰的に集め、パスヘッダ付きで連結する */
function bundleSources(root: string): string {
  const chunks: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.name.endsWith('.ts')) {
        chunks.push(`// ===== ${path.slice(root.length + 1)} =====\n${readFileSync(path, 'utf-8')}`);
      }
    }
  };
  walk(root);
  return chunks.join('\n\n');
}

function judgeOne(comboId: string, rep: number, dir: string): JudgeResult {
  const srcDir = join(dir, 'src');
  if (!existsSync(srcDir)) {
    return { comboId, rep, judgeModel: JUDGE_MODEL, score: null, error: 'src/ not found' };
  }
  const code = bundleSources(srcDir);
  if (code.includes("throw new Error('Not implemented')")) {
    return { comboId, rep, judgeModel: JUDGE_MODEL, score: null, error: 'unimplemented (skeleton)' };
  }
  const reference = bundleSources(join(rootDir, 'reference', 'src'));

  const prompt = [
    RUBRIC,
    '',
    '--- 採点対象のコード（src/ 全ファイル、パスヘッダ付き） ---',
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
