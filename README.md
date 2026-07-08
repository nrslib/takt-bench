# takt-bench

A benchmark harness for measuring how far **local / open LLMs** can go as practical coding agents when orchestrated as a team — coder, parallel specialist reviewers, a findings ledger, and a commercial-grade final gate.

Built on [TAKT](https://github.com/nrslib/takt), a multi-agent orchestration CLI.

## The headline experiment

The current lineup runs two fixed-spec implementation tasks (a task-management service layer and an event-sourcing inventory library) plus a feature-addition task on the TAKT codebase itself (89k lines), with:

- coder: Qwen3-Coder-next (ollama-cloud)
- reviewers: Gemma 4 31B × 4 in parallel (architecture / AI anti-patterns / coding / implementation semantics)
- findings ledger (TAKT Finding Contract): every finding is tracked; resolution requires reviewer confirmation evidence; disputes are adjudicated
- final gate + ledger adjudicator: codex (the only commercial roles — they judge, they never write code)

Official numbers live in `archive/*-RESULTS.md`; every published score is backed by an archived run (ledger, reports, artifact, judge samples). Early trial-and-error archives from superseded workflow lineages were removed — they remain in git history.

## How it works

- The subject task (`subject/`) is an event-sourcing inventory library with 51 tests and a verified reference implementation, seeded with architecture-level traps.
- `matrix.yaml` defines combos. Each combo gets an isolated run directory; the only variable is `provider_routing.tags` in that directory's `.takt/config.yaml` (coding seats vs review seats). Workflows never hardcode providers.
- Objective metrics: test pass/fail, type check, duration, token usage, diff size. Subjective quality is scored post-hoc by an adversarial codex judge (see Judging below).
- Reviewer honesty is audited separately (`audit/`): citation existence checks and template-fabrication detection.

## Judging

Two generations of quality scoring exist in this repo. Know which one a number came from.

1. **Diff-only judge (deprecated for official scores).** The work order and the artifact's diff are fed to codex with an adversarial rubric and a JSON schema (`judge.ts`, `scripts/judge-schema.json`). Fast, but the judge cannot read the rest of the repository: it can accuse code of leaking resources whose cleanup lives outside the diff, and it can miss a required code path that simply never appears in the diff.
2. **Repo-verified judge (current, official).** The judge runs inside the artifact's repo clone (read-only sandbox) and must verify every claim against the actual code before scoring: search the whole repo before claiming "X is never called", trace acquire/release pairs to their call sites, compare the change against the codebase's existing conventions, and cite a verified file:line for every issue. Prompt header: `v3-assets/judge-protocol-v2-header.txt`.

Switching protocols moved scores in both directions on the same artifacts — one run dropped 7→5 once real regressions outside the diff were verified, another rose 4→6 once diff-only accusations failed verification. Official numbers therefore always come from the repo-verified judge. Note the asymmetry this fixed: the in-run reviewer agents could always read the whole repository; it was the harness-side judge that was blind.

## Usage

```bash
npm install
npm run generate            # materialize run dirs from matrix.yaml
npm run bench               # run all combos (or -- --filter <combo-id>)
npm run judge               # post-hoc quality scoring
```

Requirements: `takt` on PATH, provider credentials via environment (`codex` CLI authenticated, ollama-cloud reachable through opencode). `TAKT_CONFIG_DIR` points into `runs/taktrc/`, so your personal `~/.takt` is never touched.

## Archive

`archive/` keeps the evidence behind published numbers: full-matrix baselines (5 combos, same-day conditions), the deep-lineup adoption run, and the Finding Contract lifecycle run described above — ledgers, reports, and final artifacts included.

日本語の詳細ドキュメントは [README.ja.md](README.ja.md) を参照してください。
