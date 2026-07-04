# ベンチマーク結果

収集日時: 2026-07-04T11:15:17.616Z

| combo | rep | exit | テスト | 型 | 所要時間 | 総トークン | 差分 |
|-------|-----|------|--------|-----|---------|-----------|------|
| codex-all | 1 | 0 | 51/51 | ✅ | 975.3s | 1111245 | 5 files changed, 247 insertions(+), 57 deletions(-) |
| qwen-coder | 1 | 0 | 51/51 | ✅ | 2572.6s | - | 5 files changed, 262 insertions(+), 57 deletions(-) |
| qwen-coder_gemma-reviewer | 1 | 3 | 51/51 | ✅ | 2981.5s | - | 5 files changed, 376 insertions(+), 56 deletions(-) |
| qwen-coder_qwen-coder-reviewer | 1 | 3 | 51/51 | ✅ | 2124.2s | 5011477 | 5 files changed, 230 insertions(+), 57 deletions(-) |
| qwen-coder_qwen-instruct-reviewer | 1 | 0 | 51/51 | ✅ | 3186.0s | - | 5 files changed, 275 insertions(+), 55 deletions(-) |

## ステップ別トークン消費

### codex-all (r1)

| step | provider | model | calls | in | out | total |
|------|----------|-------|-------|-----|-----|-------|
| implement | codex | gpt-5.5 | 1 | 324397 | 5164 | 329561 |
| reviewers | codex | gpt-5.5 | 2 | 0 | 0 | 0 |
| fix | codex | gpt-5.5 | 1 | 770522 | 11162 | 781684 |
| final_gate | codex | gpt-5.5 | 2 | 0 | 0 | 0 |

usage_missing: 4 件（トークン数が取得できなかった呼び出し）

### qwen-coder (r1)

| step | provider | model | calls | in | out | total |
|------|----------|-------|-------|-----|-----|-------|
| implement | opencode | ollama-cloud/qwen3-coder-next | 1 | 0 | 0 | 0 |
| reviewers | codex | gpt-5.5 | 7 | 0 | 0 | 0 |
| fix | opencode | ollama-cloud/qwen3-coder-next | 6 | 0 | 0 | 0 |
| final_gate | codex | gpt-5.5 | 2 | 0 | 0 | 0 |

usage_missing: 16 件（トークン数が取得できなかった呼び出し）

### qwen-coder_gemma-reviewer (r1)

| step | provider | model | calls | in | out | total |
|------|----------|-------|-------|-----|-----|-------|
| implement | opencode | ollama-cloud/qwen3-coder-next | 1 | 0 | 0 | 0 |
| reviewers | opencode | ollama-cloud/gemma4:31b | 5 | 0 | 0 | 0 |
| fix | opencode | ollama-cloud/qwen3-coder-next | 4 | 0 | 0 | 0 |

usage_missing: 10 件（トークン数が取得できなかった呼び出し）

### qwen-coder_qwen-coder-reviewer (r1)

| step | provider | model | calls | in | out | total |
|------|----------|-------|-------|-----|-----|-------|
| implement | opencode | ollama-cloud/qwen3-coder-next | 1 | 0 | 0 | 0 |
| reviewers | opencode | ollama-cloud/qwen3-coder-next | 3 | 0 | 0 | 0 |
| final_gate | codex | gpt-5.5 | 6 | 0 | 0 | 0 |
| fix | opencode | ollama-cloud/qwen3-coder-next | 3 | 0 | 0 | 0 |
| _loop_judge_reviewers_final-gate_fix | codex | gpt-5.5 | 1 | 4964226 | 47251 | 5011477 |

usage_missing: 13 件（トークン数が取得できなかった呼び出し）

### qwen-coder_qwen-instruct-reviewer (r1)

| step | provider | model | calls | in | out | total |
|------|----------|-------|-------|-----|-----|-------|
| implement | opencode | ollama-cloud/qwen3-coder-next | 1 | 0 | 0 | 0 |
| reviewers | opencode | ollama-cloud/qwen3.5:397b | 6 | 0 | 0 | 0 |
| fix | opencode | ollama-cloud/qwen3-coder-next | 5 | 0 | 0 | 0 |
| final_gate | codex | gpt-5.5 | 6 | 0 | 0 | 0 |

usage_missing: 18 件（トークン数が取得できなかった呼び出し）
