/**
 * matrix.yaml から combo ごとの実行ディレクトリを runs/ 配下に生成する。
 *
 *   node scripts/generate.ts [--smoke] [--filter <substr>] [--force]
 *
 * 各ディレクトリは subject/ のコピー + .takt/（ワークフロー・ファセット・
 * combo 固有の provider_routing を持つ config.yaml）+ git 初期コミット。
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { stringify } from 'yaml';
import {
  loadMatrix, comboRunDirs, rootDir, subjectDir, runsDir, taktrcDir,
  type Combo,
} from './lib.ts';

const args = process.argv.slice(2);
const smoke = args.includes('--smoke');
const force = args.includes('--force');
const filterIdx = args.indexOf('--filter');
const filter = filterIdx !== -1 ? args[filterIdx + 1] : undefined;

function sh(cmd: string, cwd: string): void {
  execSync(cmd, { cwd, stdio: 'pipe' });
}

function buildProjectConfig(combo: Combo): string {
  return stringify({
    provider_routing: combo.routing,
    ...(combo.persona_providers !== undefined ? { persona_providers: combo.persona_providers } : {}),
    observability: {
      enabled: true,
      monitor: true,
    },
  });
}

function generateOne(combo: Combo, dir: string): void {
  if (existsSync(dir)) {
    if (!force) {
      console.log(`skip (exists): ${dir} — 上書きするには --force`);
      return;
    }
    rmSync(dir, { recursive: true, force: true });
  }

  cpSync(combo.subject !== undefined ? join(rootDir, combo.subject) : subjectDir, dir, { recursive: true });
  cpSync(join(rootDir, 'template', 'takt-project'), join(dir, '.takt'), { recursive: true });
  writeFileSync(join(dir, '.takt', 'config.yaml'), buildProjectConfig(combo));
  writeFileSync(
    join(dir, '.gitignore'),
    ['node_modules/', '.takt/logs/', '.takt/runs/', 'bench-run.log', 'meta.run.json', ''].join('\n'),
  );

  sh('git init -q', dir);
  sh('git add -A', dir);
  sh('git -c user.name=bench -c user.email=bench@localhost commit -qm "initial: subject skeleton"', dir);

  writeFileSync(join(dir, 'meta.json'), JSON.stringify({
    comboId: combo.id,
    description: combo.description ?? '',
    routing: combo.routing,
    generatedAt: new Date().toISOString(),
  }, null, 2));

  console.log(`generated: ${dir}`);
}

const matrix = loadMatrix();

if (!existsSync(join(subjectDir, 'node_modules'))) {
  console.log('subject/node_modules がないため npm install を実行します…');
  execSync('npm install --no-audit --no-fund', { cwd: subjectDir, stdio: 'inherit' });
}

mkdirSync(runsDir, { recursive: true });
if (!existsSync(taktrcDir)) {
  cpSync(join(rootDir, 'template', 'taktrc'), taktrcDir, { recursive: true });
  console.log(`generated: ${taktrcDir} (TAKT_CONFIG_DIR)`);
}

const targets = comboRunDirs(matrix, { smoke, filter });
if (targets.length === 0) {
  console.error('対象 combo がありません（--filter を確認）');
  process.exit(1);
}
for (const { combo, dir } of targets) {
  generateOne(combo, dir);
}
