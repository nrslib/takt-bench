#!/usr/bin/env bash
# テストスイート自体の妥当性検証。
# 参照実装（reference/src）を subject に一時コピーして全テストが通ることを確認する。
set -euo pipefail
cd "$(dirname "$0")/../subject"

BACKUP=$(mktemp -d)
cp -R src "$BACKUP/src"
trap 'rm -rf src && mv "$BACKUP/src" src && rm -rf "$BACKUP"' EXIT

rm -rf src
cp -R ../reference/src src
npm test
npm run typecheck
echo "OK: 参照実装で全テスト成功（テストスイートは妥当）"
