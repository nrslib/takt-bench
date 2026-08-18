#!/usr/bin/env node
// 検査表judgeログの集計(評価プロトコルv3)。
// 使い方: node aggregate.mjs <題材rubric.md> <label>=<logprefix> [<label>=<logprefix> ...]
// 例: node eval/scripts/aggregate.mjs eval/rubrics/pr-image-attachments.md \
//        mix=eval/results/pr-image-attachments/mix sol=eval/results/pr-image-attachments/sol
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, basename, join } from 'node:path';

const CLASS_ORDER = ['correctness', 'safety', 'discipline', 'design'];
const CLASS_JA = { correctness: '正しさ破壊', safety: '安全余裕', discipline: '規律', design: '設計' };

const [rubricPath, ...specs] = process.argv.slice(2);
if (!rubricPath || specs.length === 0) {
  console.error('usage: aggregate.mjs <rubric.md> <label>=<logprefix> ...');
  process.exit(1);
}

// 分類: F節は rubric の classification フェンス、AP=discipline / AR=design、Tはプロファイル外
const rubric = readFileSync(rubricPath, 'utf8');
const fence = rubric.match(/```json classification\n([\s\S]*?)```/);
if (!fence) throw new Error('rubric に ```json classification フェンスがない');
const fClasses = JSON.parse(fence[1]);
const classOf = (item) => {
  if (item.startsWith('AP')) return 'discipline';
  if (item.startsWith('AR')) return 'design';
  if (item.startsWith('T')) return null;
  const c = fClasses[item];
  if (!c) throw new Error(`分類未定義の項目: ${item}`);
  return c;
};

function extractScores(text) {
  const at = text.lastIndexOf('"scores"');
  if (at < 0) return null;
  const start = text.lastIndexOf('{', at);
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) {
      try { return JSON.parse(text.slice(start, i + 1)).scores ?? null; } catch { return null; }
    }
  }
  return null;
}

const bucket = (mean) => (mean < 0.5 ? '欠落' : mean < 1.5 ? '不完全' : '成立');

const lineups = specs.map((spec) => {
  const eq = spec.indexOf('=');
  const label = spec.slice(0, eq);
  const prefix = spec.slice(eq + 1);
  const dir = dirname(prefix);
  const base = basename(prefix);
  const files = readdirSync(dir).filter((f) => f.startsWith(base) && f.endsWith('.log')).sort();
  const runs = files.map((f) => ({ file: f, scores: extractScores(readFileSync(join(dir, f), 'utf8')) }));
  for (const r of runs.filter((r) => !r.scores)) console.error(`警告: ${r.file} からJSONを抽出できず除外`);
  const valid = runs.filter((r) => r.scores);
  if (valid.length === 0) throw new Error(`${label}: 有効な採点ログなし (${prefix}*)`);

  const items = [...new Set(valid.flatMap((r) => Object.keys(r.scores)))].sort();
  const means = Object.fromEntries(items.map((it) => {
    const vals = valid.map((r) => r.scores[it]).filter((v) => typeof v === 'number');
    return [it, vals.reduce((a, b) => a + b, 0) / vals.length];
  }));
  // 欠陥プロファイル: 分類ごとの欠落/不完全項目
  const profile = Object.fromEntries(CLASS_ORDER.map((c) => [c, { 欠落: [], 不完全: [] }]));
  for (const it of items) {
    const cls = classOf(it);
    if (!cls) continue;
    const b = bucket(means[it]);
    if (b !== '成立') profile[cls][b].push(it);
  }
  const sectionTotal = (p) => items.filter((i) => i.startsWith(p) && /\d/.test(i[p.length])).reduce((a, i) => a + means[i], 0);
  return { label, n: valid.length, means, profile, items,
    totals: { AP: sectionTotal('AP'), AR: sectionTotal('AR'), F: sectionTotal('F'), T: sectionTotal('T') } };
});

for (const l of lineups) {
  console.log(`\n== ${l.label} (n=${l.n})`);
  const t = l.totals;
  console.log(`節合計(参考): AP ${t.AP.toFixed(1)}/12  AR ${t.AR.toFixed(1)}/12  F ${t.F.toFixed(1)}/${l.items.filter(i=>/^F\d/.test(i)).length*2}  T ${t.T.toFixed(1)}/4  計 ${(t.AP+t.AR+t.F).toFixed(1)}(実装) + ${t.T.toFixed(1)}(テスト)`);
  for (const c of CLASS_ORDER) {
    const p = l.profile[c];
    if (p.欠落.length || p.不完全.length)
      console.log(`  ${CLASS_JA[c]}: 欠落 [${p.欠落}]  不完全 [${p.不完全}]`);
  }
}

if (lineups.length === 2) {
  const [a, b] = lineups;
  console.log(`\n== 辞書式判定 (${a.label} vs ${b.label})`);
  let verdict = '同等';
  for (const c of CLASS_ORDER) {
    const pa = a.profile[c], pb = b.profile[c];
    const ka = [pa.欠落.length, pa.不完全.length], kb = [pb.欠落.length, pb.不完全.length];
    console.log(`  ${CLASS_JA[c]}: ${a.label} 欠落${ka[0]}/不完全${ka[1]}  ${b.label} 欠落${kb[0]}/不完全${kb[1]}`);
    if (ka[0] !== kb[0] || ka[1] !== kb[1]) {
      verdict = `${ka[0] < kb[0] || (ka[0] === kb[0] && ka[1] < kb[1]) ? a.label : b.label} 優位(第一決着階層: ${CLASS_JA[c]})`;
      break;
    }
  }
  console.log(`  判定: ${verdict}`);
}
