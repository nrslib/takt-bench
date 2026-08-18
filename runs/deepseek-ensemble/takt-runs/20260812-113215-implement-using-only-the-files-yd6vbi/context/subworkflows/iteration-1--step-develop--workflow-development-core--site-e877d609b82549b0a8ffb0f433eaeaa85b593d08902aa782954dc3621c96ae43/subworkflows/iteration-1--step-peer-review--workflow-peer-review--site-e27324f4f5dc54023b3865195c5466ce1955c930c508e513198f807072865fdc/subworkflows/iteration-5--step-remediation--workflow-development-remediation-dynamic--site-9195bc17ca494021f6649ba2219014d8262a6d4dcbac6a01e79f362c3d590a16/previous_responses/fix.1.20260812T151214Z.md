Now let me check the existing integration test file to add the new scenarios.
Now I'll add the two new test scenarios for the unique temp directory contract.
Now let me build and run the covering test file.
Now lint and the light IT gate.
Now the fast unit gate and e2e mock.
All quality gates pass. Let me verify the final edited code.
Self-scan: edit replaced `fs.mkdirSync` with `fs.mkdtempSync`; `path` and `fs` imports still used elsewhere, no unused imports/exports introduced, no layer violations.

## 作業結果
- 修正完了

## 変更内容と受入条件
- **`TEMP-DIR-UNIQUE`（修正単位）**: `src/infra/github/prReviewImageAttachments.ts:425-428` の `createTempDownloadDir` を、固定名 `takt-pr-images` を返す実装から、`fs.mkdtempSync(path.join(tmpRoot, 'takt-pr-images-'))` で一意な private 一時ディレクトリを返す実装に修正した。
  - 不変条件「1回の解決処理は他から隔離された専用領域を所有し、そのcleanupは所有領域のみを削除して他を破壊しない」を充足。
  - finding の受入条件（同一 `tmpRoot` で2回解決し、両結果を未cleanupで保持してもファイルが独立生成され、個別cleanupで他方を削除しない）を満たす。
  - 変更対象外の公開API・引数・戻り値・契約は維持。移行・削除対象なし。
- **テスト（修正単位）**: `src/__tests__/prReviewImageAttachments.integration.test.ts` に、シナリオ [SCN-TEMP-DIR-UNIQUE-P1]（同一tmpRootで2回解決 → パスが異なる `takt-pr-images-XXXXXX` 配下、両ファイル実在）と [SCN-TEMP-DIR-UNIQUE-N1]（1回目cleanup後も2回目のファイル実在）のテストを追加した。

## 検証結果と証拠
- `npm run build`: 成功（tsc + copy-build-assets）。
- `npm run lint`: 成功。
- `npm test -- src/__tests__/prReviewImageAttachments.integration.test.ts`: 16件パス。
- `HOME=/tmp/takt-bench-v3-home npm run test:it`: 158 files / 2357 tests パス。
- `npm test`: 全シャードパス（95/95, 95/95, 94/94 files）。
- `npm run test:e2e:mock`: 18 passed / 1 skipped（55 passed / 13 skipped / 30 todo）。
- 修正コード確認: `createTempDownloadDir` が `fs.mkdtempSync` で一意パスを返すことを確認済み。

## セルフスキャン結果
今回の編集差分（`createTempDownloadDir` の置換とテスト2件追加）のみを走査。未使用化・依存方向の違反・共通責務候補の新規問題なし。