/**
 * 生成済みの runs/<combo>-r<N>/ で takt を実行する。
 *
 *   node scripts/run.ts [--smoke] [--filter <substr>] [--parallel <N>]
 *
 * 既定は逐次実行（同一プロバイダの rate limit で時間計測が歪むのを防ぐ）。
 * 実行ログは <dir>/bench-run.log、実行メタは <dir>/meta.run.json に書く。
 */
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadMatrix, loadTask, comboRunDirs, rootDir, taktrcDir } from './lib.ts';

const args = process.argv.slice(2);
const smoke = args.includes('--smoke');
const filterIdx = args.indexOf('--filter');
const filter = filterIdx !== -1 ? args[filterIdx + 1] : undefined;
const parallelIdx = args.indexOf('--parallel');
const parallel = parallelIdx !== -1 ? Math.max(1, parseInt(args[parallelIdx + 1] ?? '1', 10)) : 1;

const matrix = loadMatrix();

interface RunResult {
  dir: string;
  exitCode: number | null;
  durationMs: number;
}

function runOne(dir: string, workflow: string, task: string): Promise<RunResult> {
  return new Promise((resolvePromise) => {
    const log = createWriteStream(join(dir, 'bench-run.log'));
    const startedAt = new Date();
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      TAKT_CONFIG_DIR: taktrcDir,
    };
    if (smoke) {
      env.TAKT_MOCK_SCENARIO = join(rootDir, 'mock', 'scenario.json');
    }

    const child = spawn(
      'takt',
      ['-t', task, '-w', workflow, '--pipeline', '--skip-git', '-q'],
      { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    child.stdout.pipe(log);
    child.stderr.pipe(log);

    child.on('close', (exitCode) => {
      const endedAt = new Date();
      const durationMs = endedAt.getTime() - startedAt.getTime();
      writeFileSync(join(dir, 'meta.run.json'), JSON.stringify({
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs,
        exitCode,
        smoke,
      }, null, 2));
      console.log(`done: ${dir} (exit=${exitCode}, ${(durationMs / 1000).toFixed(1)}s)`);
      resolvePromise({ dir, exitCode, durationMs });
    });
  });
}

async function main(): Promise<void> {
  const targets = comboRunDirs(matrix, { smoke, filter })
    .filter(({ dir }) => {
      if (!existsSync(dir)) {
        console.error(`missing: ${dir} — 先に \`npm run generate${smoke ? ' -- --smoke' : ''}\` を実行`);
        return false;
      }
      return true;
    });
  if (targets.length === 0) process.exit(1);

  for (const { combo, dir } of targets) {
    const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf-8')) as { comboId: string };
    if (meta.comboId !== combo.id) {
      throw new Error(`meta.json mismatch in ${dir}: ${meta.comboId} != ${combo.id}`);
    }
  }

  console.log(`実行対象: ${targets.length} 件（並列度 ${parallel}）`);
  const queue = [...targets];
  const results: RunResult[] = [];
  const workers = Array.from({ length: Math.min(parallel, queue.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      console.log(`start: ${next.dir}`);
      results.push(await runOne(next.dir, next.combo.workflow ?? matrix.workflow, loadTask(matrix, next.combo)));
    }
  });
  await Promise.all(workers);

  const failed = results.filter((r) => r.exitCode !== 0);
  console.log(`\n完了: ${results.length - failed.length}/${results.length} 成功`);
  if (failed.length > 0) {
    for (const f of failed) console.log(`  failed: ${f.dir}`);
    process.exitCode = 1;
  }
}

await main();
