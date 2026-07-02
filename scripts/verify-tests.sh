#!/usr/bin/env bash
# テストスイート自体の妥当性検証。
# 参照実装を subject に一時コピーして全テストが通ることを確認する。
set -euo pipefail
cd "$(dirname "$0")/../subject"

cp src/cron.ts /tmp/cron-skeleton-backup.ts
trap 'mv /tmp/cron-skeleton-backup.ts src/cron.ts' EXIT

cp ../reference/cron-reference.ts src/cron.ts
npm test
npm run typecheck
echo "OK: 参照実装で全テスト成功（テストスイートは妥当）"
