#!/bin/bash
# 成果物の検収: 配布時点のテスト一式 + 成果物の src で検証する。
# 走行中にテストがどう変更されていても、測定はこの組み合わせで行う。
#   scripts/verify-artifact.sh <run-dir> <subject-dir>
set -euo pipefail
RUN_DIR="$1"; SUBJECT_DIR="$2"
TMP=$(mktemp -d /tmp/takt-bench-verify.XXXXXX)
trap 'rm -rf "$TMP"' EXIT
cp -R "$SUBJECT_DIR"/ "$TMP"/
rm -rf "$TMP/src"
cp -R "$RUN_DIR/src" "$TMP/src"
NM="$(cd "$SUBJECT_DIR" && pwd)/node_modules"
if [ ! -d "$NM" ]; then
  NM="$(cd "$(dirname "$SUBJECT_DIR")/subject" && pwd)/node_modules"
fi
rm -f "$TMP/node_modules"
ln -sfn "$NM" "$TMP/node_modules"
cd "$TMP"
OUT=$(npx vitest run 2>&1) || { echo "$OUT" | tail -5; exit 1; }
echo "$OUT" | grep -E "Tests " | tail -1
npx tsc --noEmit && echo "typecheck OK"
