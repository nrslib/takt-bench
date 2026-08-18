I'll start by reading the primary spec, the target implementation file, and the test file.
Let me read the policy file and the fix-plan report.
Let me read the rest of the policy and the fix-plan report.
The fix-plan is clear. Let me set up a todo list and check the current git state.
Now I'll implement the fix. First, modify `downloadImage` to use `gh api --include` and return Content-Type, then add validation in `downloadPrImages`.
Now update the test file to use the `--include` format and add Content-Type tests.
Now let me verify the final implementation file and run the targeted test.
The implementation looks correct. Now let me run the targeted test.
All 11 tests pass. Now let me run build and lint.
Build and lint pass. Now let me run the full unit test gate and light IT gate.
All unit tests pass. Now let me run the light IT gate.
Light IT passes. Now let me run the mock E2E tests.
The E2E mock test timed out. Let me retry with a larger timeout.
All E2E mock tests pass. Now let me run the smoke E2E since the change affects workflow execution / runtime behavior.
All quality gates pass. Let me do the self-scan for unused code and verify no other callers of `downloadImage` expect a Buffer.
Self-scan complete: `downloadImage` is only used internally and its new return shape is fully consumed; `SUPPORTED_CONTENT_TYPES` is used; no new imports or dependency direction changes. No unused code introduced.
修正計画 U1（画像ダウンロード時の Content-Type ヘッダ検証）を実装しました。

## 変更内容

**`src/infra/github/imageDownload.ts`**
- `downloadImage` を `gh api --include` でヘッダ込みを取得するよう変更し、`\r\n\r\n` でヘッダとボディを分割して `content-type` を lower-case 正規化してパースし、`{ contentType, data }` を返すようにした（imageDownload.ts:64-84）
- `SUPPORTED_CONTENT_TYPES`（`image/png` / `image/jpeg` / `image/gif` / `image/webp`）を定義（imageDownload.ts:62）
- `downloadPrImages` で Content-Type が supported 形式以外・欠落の場合に throw する検証を追加。magic bytes 検証（`detectImageFormat`）は維持し、両方通過時のみ保存（imageDownload.ts:126-131）

**`src/__tests__/imageDownload.test.ts`**
- 既存テストを `--include` 形式（`HTTP/2 200 OK\r\ncontent-type: ...\r\n\r\n<bytes>`）のモックへ更新
- Content-Type 不一致（`text/html`）拒否、Content-Type 欠落拒否のテストを追加

## 検証結果
- `npm test -- src/__tests__/imageDownload.test.ts`: 11 passed
- `npm run build`: 成功
- `npm run lint`: 成功
- `npm test`: 全シャード成功（849/1597/1453/1351 passed）
- `HOME=/tmp/takt-bench-v3-home npm run test:it`: 1798 passed
- `npm run test:e2e:mock`: 48 passed / 13 skipped
- `npm run test:e2e:smoke`: 16 passed / 1 skipped

## セルフスキャン
`downloadImage` は内部のみで使用され、新戻り値は完全に消費。`SUPPORTED_CONTENT_TYPES` は使用済み。新規 import・依存方向の変更なし。未使用コードなし。

修正境界は計画どおり `imageDownload.ts` と `imageDownload.test.ts` のみで、外部契約（`add/index.ts`・`steps.ts` の `downloadPrImages` シグネチャ）は変更していません。