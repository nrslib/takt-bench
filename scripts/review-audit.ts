/**
 * レビュアー監査: 各 combo のレビューレポートを機械検証 + codex 監査で採点し、
 * レビュアーモデルの品質（グラウンディング・検出力・規律）をレポートする。
 *
 *   node scripts/review-audit.ts [--filter <substr>] [--no-llm]
 *
 * 機械検証（LLM 不要）:
 *   - 指摘が引用する `file:line` の実在チェック（存在しないファイル = 捏造）
 *   - 出力契約テンプレートの例示行の丸写し検出
 * codex 監査（--no-llm でスキップ）:
 *   - 既知の罠（audit/known-traps.md）の検出/見逃し
 *   - スコープ外指摘（変更禁止ファイルへの修正要求）・思考漏れ・判定整合性
 *
 * 出力: results/review-audit.json, results/review-audit.md
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadMatrix, comboRunDirs, rootDir, resultsDir } from './lib.ts';

const args = process.argv.slice(2);
const filterIdx = args.indexOf('--filter');
const filter = filterIdx !== -1 ? args[filterIdx + 1] : undefined;
const noLlm = args.includes('--no-llm');

const AUDIT_MODEL = 'gpt-5.5';

/** 出力契約テンプレートの例示行に由来する典型的な捏造パターン */
const TEMPLATE_ECHO_PATTERNS = [
  /`src\/file\.tsx?:\d+`/,
  /\|\s*問題の説明\s*\|/,
  /\|\s*修正方法\s*\|/,
];

interface ReportRound {
  name: string;
  round: string;
  content: string;
}

interface CitationCheck {
  report: string;
  round: string;
  citation: string;
  fileExists: boolean;
  lineInRange: boolean | null;
}

interface MechanicalResult {
  citations: CitationCheck[];
  hallucinatedCitations: number;
  templateEchoes: { report: string; round: string }[];
}

interface LlmAudit {
  traps: { trap_id: string; present_in_final_code: boolean; caught_by_reviewers: boolean; note: string }[];
  fabricated_findings: string[];
  out_of_scope_findings: string[];
  thinking_leak: boolean;
  verdict_consistency: string;
  reviewer_grade: number;
  summary: string;
}

interface ComboAudit {
  comboId: string;
  rep: number;
  reviewerRouting: string;
  mechanical: MechanicalResult;
  llm: LlmAudit | null;
  llmError?: string;
}

function collectReportRounds(dir: string): ReportRound[] {
  const runsRoot = join(dir, '.takt', 'runs');
  if (!existsSync(runsRoot)) return [];
  const rounds: ReportRound[] = [];
  for (const run of readdirSync(runsRoot)) {
    const reportsDir = join(runsRoot, run, 'reports');
    if (!existsSync(reportsDir)) continue;
    for (const file of readdirSync(reportsDir)) {
      if (!file.includes('review') && !file.includes('validation')) continue;
      const match = file.match(/^(.+\.md)(?:\.(\d{8}T\d{6}Z))?$/);
      if (!match) continue;
      rounds.push({
        name: match[1] ?? file,
        round: match[2] ?? 'final',
        content: readFileSync(join(reportsDir, file), 'utf-8'),
      });
    }
  }
  return rounds;
}

function countFileLines(path: string): number {
  return readFileSync(path, 'utf-8').split('\n').length;
}

function runMechanicalChecks(dir: string, rounds: ReportRound[]): MechanicalResult {
  const citations: CitationCheck[] = [];
  const templateEchoes: { report: string; round: string }[] = [];

  for (const { name, round, content } of rounds) {
    for (const match of content.matchAll(/`((?:src|tests)\/[A-Za-z0-9_./-]+\.ts)(?::(\d+))?`/g)) {
      const relPath = match[1];
      if (!relPath) continue;
      const absPath = join(dir, relPath);
      const fileExists = existsSync(absPath);
      const line = match[2] !== undefined ? parseInt(match[2], 10) : undefined;
      citations.push({
        report: name,
        round,
        citation: match[0],
        fileExists,
        lineInRange: fileExists && line !== undefined ? line <= countFileLines(absPath) : null,
      });
    }
    if (TEMPLATE_ECHO_PATTERNS.some((pattern) => pattern.test(content))) {
      templateEchoes.push({ report: name, round });
    }
  }

  return {
    citations,
    hallucinatedCitations: citations.filter((c) => !c.fileExists).length,
    templateEchoes,
  };
}

function bundleSources(root: string): string {
  const chunks: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
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

function runLlmAudit(
  comboId: string,
  rep: number,
  dir: string,
  rounds: ReportRound[],
  mechanical: MechanicalResult,
): { llm: LlmAudit | null; llmError?: string } {
  const knownTraps = readFileSync(join(rootDir, 'audit', 'known-traps.md'), 'utf-8');
  const finalCode = bundleSources(join(dir, 'src'));
  const reportsBlock = rounds
    .map(({ name, round, content }) => `### ${name} (round: ${round})\n${content}`)
    .join('\n\n---\n\n');

  const prompt = [
    'あなたはレビュアー品質の監査人です。AI レビュアーが書いたレビューレポート群を、',
    '最終コードと既知の罠カタログに照らして監査してください。',
    'レビュアー自身の判定は信用せず、レポートの記述とコードの実態だけを根拠にすること。',
    '',
    '監査観点:',
    '- traps: カタログの各罠について、最終コードに残っているか、レビューレポート群（全ラウンド）で指摘されたか',
    '- fabricated_findings: 実在しないコード・ファイル・変更内容への言及（機械検証の結果も参考にする）',
    '- out_of_scope_findings: 変更禁止対象（tests/ と src/types.ts）への修正要求',
    '- thinking_leak: レポート本文に思考過程・メタ発言（"The user wants me to..." 等）が漏れているか',
    '- verdict_consistency: 最終ラウンドの APPROVE/REJECT が最終コードの実態と整合しているかの短評',
    '- reviewer_grade: レビュアー品質の総合点（1-10。検出力・正確さ・規律）',
    '',
    '## 既知の罠カタログ',
    knownTraps,
    '',
    '## 機械検証の結果',
    `- 実在しないファイルへの引用: ${mechanical.hallucinatedCitations} 件`,
    `- テンプレート例示行の丸写し: ${mechanical.templateEchoes.length} 件 (${mechanical.templateEchoes.map((e) => `${e.report}@${e.round}`).join(', ') || 'なし'})`,
    '',
    '## レビューレポート（全ラウンド）',
    reportsBlock,
    '',
    '## 最終コード（src/ 全ファイル）',
    '```typescript',
    finalCode,
    '```',
  ].join('\n');

  const outFile = join(tmpdir(), `takt-bench-audit-${comboId}-r${rep}.json`);
  try {
    execSync(
      [
        'codex exec -',
        `--model ${AUDIT_MODEL}`,
        '--sandbox read-only',
        '--skip-git-repo-check',
        '--ephemeral',
        `--output-schema ${join(rootDir, 'scripts', 'audit-schema.json')}`,
        `-o ${outFile}`,
      ].join(' '),
      { input: prompt, encoding: 'utf-8', timeout: 600_000, maxBuffer: 20 * 1024 * 1024 },
    );
    return { llm: JSON.parse(readFileSync(outFile, 'utf-8')) as LlmAudit };
  } catch (e) {
    return { llm: null, llmError: e instanceof Error ? e.message : String(e) };
  } finally {
    rmSync(outFile, { force: true });
  }
}

function buildMarkdown(audits: ComboAudit[]): string {
  const lines: string[] = [];
  lines.push('# レビュアー監査レポート');
  lines.push('');
  lines.push(`監査日時: ${new Date().toISOString()} / 監査人: codex ${AUDIT_MODEL} + 機械検証`);
  lines.push('');
  lines.push('| combo | reviewer | 引用実在率 | 捏造引用 | テンプレ丸写し | 罠検出 | スコープ外指摘 | 思考漏れ | 総合点 |');
  lines.push('|-------|----------|-----------|---------|---------------|--------|---------------|---------|--------|');
  for (const a of audits) {
    const total = a.mechanical.citations.length;
    const grounded = total - a.mechanical.hallucinatedCitations;
    const rate = total > 0 ? `${grounded}/${total}` : '-';
    const traps = a.llm
      ? `${a.llm.traps.filter((t) => t.present_in_final_code && t.caught_by_reviewers).length}捕捉/${a.llm.traps.filter((t) => t.present_in_final_code).length}残存`
      : '-';
    lines.push(
      `| ${a.comboId} | ${a.reviewerRouting} | ${rate} | ${a.mechanical.hallucinatedCitations} `
      + `| ${a.mechanical.templateEchoes.length} | ${traps} | ${a.llm?.out_of_scope_findings.length ?? '-'} `
      + `| ${a.llm ? (a.llm.thinking_leak ? 'あり' : 'なし') : '-'} | ${a.llm?.reviewer_grade ?? '-'} |`,
    );
  }
  lines.push('');
  for (const a of audits) {
    lines.push(`## ${a.comboId} (r${a.rep})`);
    lines.push('');
    if (a.mechanical.hallucinatedCitations > 0) {
      lines.push('**捏造引用:**');
      for (const c of a.mechanical.citations.filter((c) => !c.fileExists)) {
        lines.push(`- ${c.citation}（${c.report} @ ${c.round}）`);
      }
      lines.push('');
    }
    if (!a.llm) {
      lines.push(`(codex 監査なし${a.llmError ? `: ${a.llmError.slice(0, 120)}` : ''})`);
      lines.push('');
      continue;
    }
    lines.push(`**総評**: ${a.llm.summary}`);
    lines.push('');
    lines.push(`**判定整合性**: ${a.llm.verdict_consistency}`);
    lines.push('');
    lines.push('| 罠 | 最終コードに残存 | レビューで指摘 | 備考 |');
    lines.push('|-----|-----------------|---------------|------|');
    for (const t of a.llm.traps) {
      lines.push(`| ${t.trap_id} | ${t.present_in_final_code ? '❌ 残存' : '✅ なし'} | ${t.caught_by_reviewers ? '✅' : '—'} | ${t.note} |`);
    }
    lines.push('');
    if (a.llm.fabricated_findings.length > 0) {
      lines.push('**捏造指摘（codex 判定）:**');
      for (const f of a.llm.fabricated_findings) lines.push(`- ${f}`);
      lines.push('');
    }
    if (a.llm.out_of_scope_findings.length > 0) {
      lines.push('**スコープ外指摘（変更禁止対象への要求）:**');
      for (const f of a.llm.out_of_scope_findings) lines.push(`- ${f}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

const matrix = loadMatrix();
const targets = comboRunDirs(matrix, { filter }).filter(({ dir }) => existsSync(dir));
if (targets.length === 0) {
  console.error('監査対象がありません');
  process.exit(1);
}

const audits: ComboAudit[] = [];
for (const { combo, rep, dir } of targets) {
  console.log(`auditing: ${combo.id}-r${rep}`);
  const rounds = collectReportRounds(dir);
  if (rounds.length === 0) {
    console.log('  (レビューレポートなし — スキップ)');
    continue;
  }
  const mechanical = runMechanicalChecks(dir, rounds);
  const llmResult = noLlm ? { llm: null } : runLlmAudit(combo.id, rep, dir, rounds, mechanical);
  audits.push({
    comboId: combo.id,
    rep,
    reviewerRouting: JSON.stringify(combo.routing.tags?.review ?? combo.routing.personas ?? {}),
    mechanical,
    ...llmResult,
  });
}

mkdirSync(resultsDir, { recursive: true });
writeFileSync(join(resultsDir, 'review-audit.json'), JSON.stringify(audits, null, 2));
writeFileSync(join(resultsDir, 'review-audit.md'), buildMarkdown(audits));
console.log('\nwrote: results/review-audit.json, results/review-audit.md\n');
console.log(buildMarkdown(audits));
