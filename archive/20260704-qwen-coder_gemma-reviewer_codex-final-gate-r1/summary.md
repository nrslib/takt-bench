# ベンチマーク結果

収集日時: 2026-07-04T03:41:22.221Z

| combo | rep | exit | テスト | 型 | 所要時間 | 総トークン | 差分 |
|-------|-----|------|--------|-----|---------|-----------|------|
| codex-all | 1 | 0 | 51/51 | ✅ | 1064.3s | 1373850 | 5 files changed, 309 insertions(+), 57 deletions(-) |
| qwen-coder | 1 | 0 | 51/51 | ✅ | 2492.1s | 5520910 | 5 files changed, 278 insertions(+), 61 deletions(-) |
| qwen-coder_gemma-reviewer | 1 | 0 | 51/51 | ✅ | 3146.1s | - | 5 files changed, 298 insertions(+), 45 deletions(-) |
| qwen-coder_qwen-coder-reviewer | 1 | 0 | 51/51 | ✅ | 5787.1s | - | 5 files changed, 407 insertions(+), 49 deletions(-) |
| qwen-coder_qwen-instruct-reviewer | 1 | - | 0/21 | ✅ | - | - | (no diff) |

## ステップ別トークン消費

### codex-all (r1)

| step | provider | model | calls | in | out | total |
|------|----------|-------|-------|-----|-----|-------|
| implement | codex | gpt-5.5 | 1 | 436538 | 10155 | 446693 |
| reviewers | codex | gpt-5.5 | 2 | 0 | 0 | 0 |
| fix | codex | gpt-5.5 | 1 | 912476 | 14681 | 927157 |

usage_missing: 2 件（トークン数が取得できなかった呼び出し）

### qwen-coder (r1)

| step | provider | model | calls | in | out | total |
|------|----------|-------|-------|-----|-----|-------|
| implement | opencode | ollama-cloud/qwen3-coder-next | 1 | 0 | 0 | 0 |
| reviewers | codex | gpt-5.5 | 6 | 0 | 0 | 0 |
| fix | opencode | ollama-cloud/qwen3-coder-next | 5 | 0 | 0 | 0 |
| _loop_judge_reviewers_fix | codex | gpt-5.5 | 1 | 5478539 | 42371 | 5520910 |

usage_missing: 12 件（トークン数が取得できなかった呼び出し）

### qwen-coder_gemma-reviewer (r1)

| step | provider | model | calls | in | out | total |
|------|----------|-------|-------|-----|-----|-------|
| implement | opencode | ollama-cloud/qwen3-coder-next | 1 | 0 | 0 | 0 |
| reviewers | opencode | ollama-cloud/gemma4:31b | 6 | 0 | 0 | 0 |
| fix | opencode | ollama-cloud/qwen3-coder-next | 5 | 0 | 0 | 0 |
| final_gate | codex | gpt-5.5 | 6 | 0 | 0 | 0 |

usage_missing: 18 件（トークン数が取得できなかった呼び出し）

### qwen-coder_qwen-coder-reviewer (r1)

| step | provider | model | calls | in | out | total |
|------|----------|-------|-------|-----|-----|-------|
| implement | opencode | ollama-cloud/qwen3-coder-next | 1 | 0 | 0 | 0 |
| reviewers | opencode | ollama-cloud/qwen3-coder-next | 2 | 0 | 0 | 0 |
| fix | opencode | ollama-cloud/qwen3-coder-next | 1 | 0 | 0 | 0 |

usage_missing: 4 件（トークン数が取得できなかった呼び出し）

### qwen-coder_qwen-instruct-reviewer (r1)

(usage-events なし)
