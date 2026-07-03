# ベンチマーク結果

収集日時: 2026-07-03T07:59:35.517Z

| combo | rep | exit | テスト | 型 | 所要時間 | 総トークン | 差分 |
|-------|-----|------|--------|-----|---------|-----------|------|
| qwen-coder | 1 | 0 | 51/51 | ✅ | 2492.1s | 5520910 | 5 files changed, 278 insertions(+), 61 deletions(-) |
| qwen-coder_gemma-reviewer | 1 | 0 | 51/51 | ✅ | 1146.2s | - | 6 files changed, 331 insertions(+), 49 deletions(-) |
| qwen-coder_qwen-coder-reviewer | 1 | 0 | 51/51 | ✅ | 993.1s | - | 5 files changed, 325 insertions(+), 58 deletions(-) |
| qwen-coder_qwen-instruct-reviewer | 1 | 3 | 51/51 | ✅ | 5056.2s | 1199751 | 7 files changed, 254 insertions(+), 59 deletions(-) |

## ステップ別トークン消費

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
| reviewers | opencode | ollama-cloud/gemma4:31b | 2 | 0 | 0 | 0 |
| fix | opencode | ollama-cloud/qwen3-coder-next | 1 | 0 | 0 | 0 |

usage_missing: 4 件（トークン数が取得できなかった呼び出し）

### qwen-coder_qwen-coder-reviewer (r1)

| step | provider | model | calls | in | out | total |
|------|----------|-------|-------|-----|-----|-------|
| implement | opencode | ollama-cloud/qwen3-coder-next | 1 | 0 | 0 | 0 |
| reviewers | opencode | ollama-cloud/qwen3-coder-next | 2 | 0 | 0 | 0 |
| fix | opencode | ollama-cloud/qwen3-coder-next | 1 | 0 | 0 | 0 |

usage_missing: 4 件（トークン数が取得できなかった呼び出し）

### qwen-coder_qwen-instruct-reviewer (r1)

| step | provider | model | calls | in | out | total |
|------|----------|-------|-------|-----|-----|-------|
| implement | opencode | ollama-cloud/qwen3-coder-next | 1 | 0 | 0 | 0 |
| reviewers | opencode | ollama-cloud/qwen3.5:397b | 3 | 0 | 0 | 0 |
| fix | opencode | ollama-cloud/qwen3-coder-next | 3 | 0 | 0 | 0 |
| _loop_judge_reviewers_fix | codex | gpt-5.5 | 1 | 1190325 | 9426 | 1199751 |

usage_missing: 7 件（トークン数が取得できなかった呼び出し）
