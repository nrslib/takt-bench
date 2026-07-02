import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export interface PersonaRouting {
  provider: string;
  model?: string;
}

export interface Combo {
  id: string;
  description?: string;
  /** provider_routing にそのまま書き込む（tags / personas / steps） */
  routing: {
    tags?: Record<string, PersonaRouting>;
    personas?: Record<string, PersonaRouting>;
    steps?: Record<string, PersonaRouting>;
  };
}

export interface Matrix {
  workflow: string;
  task_file: string;
  repetitions: number;
  combos: Combo[];
  smoke?: Combo;
}

export const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const subjectDir = join(rootDir, 'subject');
export const runsDir = join(rootDir, 'runs');
export const resultsDir = join(rootDir, 'results');
export const taktrcDir = join(runsDir, 'taktrc');

export function loadMatrix(): Matrix {
  const raw = parse(readFileSync(join(rootDir, 'matrix.yaml'), 'utf-8')) as Matrix;
  if (!raw.workflow || !raw.task_file || !Array.isArray(raw.combos)) {
    throw new Error('matrix.yaml is missing workflow / task_file / combos');
  }
  if (!raw.repetitions || raw.repetitions < 1) {
    raw.repetitions = 1;
  }
  return raw;
}

export function loadTask(matrix: Matrix): string {
  return readFileSync(join(rootDir, matrix.task_file), 'utf-8').trim();
}

/** combo × repetition → runs/ 配下のディレクトリ名 */
export function comboRunDirs(matrix: Matrix, opts: { smoke?: boolean; filter?: string }): {
  combo: Combo;
  rep: number;
  dir: string;
}[] {
  const combos = opts.smoke
    ? (matrix.smoke ? [matrix.smoke] : [])
    : matrix.combos;
  const out: { combo: Combo; rep: number; dir: string }[] = [];
  for (const combo of combos) {
    const reps = opts.smoke ? 1 : matrix.repetitions;
    for (let rep = 1; rep <= reps; rep++) {
      if (opts.filter && !combo.id.includes(opts.filter)) continue;
      out.push({ combo, rep, dir: join(runsDir, `${combo.id}-r${rep}`) });
    }
  }
  return out;
}

export function readJsonIfExists<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}
