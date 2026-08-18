#!/usr/bin/env bash
# 検査表judge実行(評価プロトコルv3)。
# 使い方: judge.sh <worktree> <題材rubric.md> <出力prefix> [n=3]
# 例: eval/scripts/judge.sh /path/to/worktree eval/rubrics/pr-image-attachments.md eval/results/pr-image-attachments/mix
set -euo pipefail

WORKTREE=$1
RUBRIC=$2
OUT_PREFIX=$3
N=${4:-3}

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
COMMON="$SCRIPT_DIR/../rubrics/_common.md"
MODEL=gpt-5.6-sol
EFFORT=high

mkdir -p "$(dirname "$OUT_PREFIX")"
PROMPT=$(python3 - "$COMMON" "$RUBRIC" <<'PY'
import re, sys
common = open(sys.argv[1]).read()
rubric = open(sys.argv[2]).read()
# 題材ファイルから F節(## F. 〜 分類ブロック直前)だけを差し込む
m = re.search(r'^## F\..*?(?=^## 分類)', rubric, re.M | re.S)
if not m:
    sys.exit('題材rubricに "## F." 節と "## 分類" 節が必要')
print(common.replace('{{F_SECTION}}', m.group(0).rstrip()))
PY
)

for i in $(seq 1 "$N"); do
  LOG="${OUT_PREFIX}-r${i}.log"
  echo "== judge r${i} -> ${LOG}" >&2
  codex exec --sandbox read-only --cd "$WORKTREE" \
    -m "$MODEL" -c model_reasoning_effort="$EFFORT" \
    "$PROMPT" < /dev/null > "$LOG" 2>&1 &
done
wait
echo "done: ${OUT_PREFIX}-r1..r${N}.log" >&2
