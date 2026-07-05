# takt-bench

A benchmark harness for measuring how far **local / open LLMs** can go as practical coding agents when orchestrated as a team — coder, parallel specialist reviewers, a findings ledger, and a commercial-grade final gate.

Built on [TAKT](https://github.com/nrslib/takt), a multi-agent orchestration CLI.

## The headline experiment

The `qwen-coder_gemma-reviewer-fc` combo runs an event-sourcing inventory task with:

- coder: Qwen3-Coder-next (ollama-cloud)
- reviewers: Gemma 4 31B × 4 in parallel (architecture / AI anti-patterns / coding / implementation semantics)
- findings ledger (TAKT Finding Contract): every finding is tracked; resolution requires reviewer confirmation evidence; disputes are adjudicated
- final gate + ledger adjudicator: codex (the only commercial seats — they judge, they never write code)

In the archived run (`archive/deep-fc-gemma-run1-20260705/`), the team worked autonomously for 73 minutes: it found 12 issues, fixed and confirmed 11, caught one reviewer's false "this is fixed" claim through cross-review, and escalated the final unresolved issue to a human with evidence — which turned out to be a real bug worth human eyes.

## How it works

- The subject task (`subject/`) is an event-sourcing inventory library with 51 tests and a verified reference implementation, seeded with architecture-level traps.
- `matrix.yaml` defines combos. Each combo gets an isolated run directory; the only variable is `provider_routing.tags` in that directory's `.takt/config.yaml` (coding seats vs review seats). Workflows never hardcode providers.
- Objective metrics: test pass/fail, type check, duration, token usage, diff size. Subjective quality is scored post-hoc by `judge.ts` (codex + JSON Schema, adversarial rubric).
- Reviewer honesty is audited separately (`audit/`): citation existence checks and template-fabrication detection.

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
