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
ln -sfn "$(cd "$SUBJECT_DIR" && pwd)/node_modules" "$TMP/node_modules" 2>/dev/null || true
cd "$TMP"
npx vitest run 2>&1 | grep -E "Tests " | tail -1
npx tsc --noEmit && echo "typecheck OK"
