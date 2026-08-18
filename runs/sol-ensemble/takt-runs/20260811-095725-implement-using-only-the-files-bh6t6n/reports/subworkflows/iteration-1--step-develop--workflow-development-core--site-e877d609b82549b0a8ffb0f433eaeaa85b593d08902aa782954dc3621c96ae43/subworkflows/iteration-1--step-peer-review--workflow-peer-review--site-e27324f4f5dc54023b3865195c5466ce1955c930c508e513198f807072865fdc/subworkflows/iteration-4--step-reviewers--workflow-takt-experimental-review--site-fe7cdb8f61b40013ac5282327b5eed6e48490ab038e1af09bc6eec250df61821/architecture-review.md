# アーキテクチャレビュー

## 結果: APPROVE

## サマリー

提示された変更対象40ファイルと直接影響経路を再走査した。PR画像の解析・取得・保存・再注入、画像番号採番、mock E2E runnerの責務境界と配線にブロッキング問題は確認されなかった。

## 検証証跡

- ビルド: `npm run build`は本レビューでは再実行していない。対象テスト実行時のTypeScript型契約検査は成功。
- テスト: PR画像解析、採番、add、対話CLI、pipeline、retry、保存済みtaskからrun contextへのデータフロー、E2E runnerを対象に8ファイル・159件が成功。
- 動作確認: Markdown／HTML ASTによる画像検出、GitHub固有処理のinfra層への隔離、任意長番号の採番、task spec保存・cleanup、限定的birpc noiseの1回再測定と通常失敗の維持を確認。旧採番処理・旧GitHub URL helperの参照はなく、`git diff --check`も成功。

## 再走査証跡（2回目以降のレビューで必須）

| 照合した Policy/Knowledge の章 | 差分側の根拠（`file:line` または「該当なし」） |
|-------------------------------|---------------------------------------------|
| 契約影響経路・呼び出しチェーン | `src/features/tasks/prReviewAttachments.ts:91-164`、`src/features/tasks/add/index.ts:194-236`、`src/features/pipeline/steps.ts:222-248,371-418` |
| レイヤー設計・責務所有 | `src/features/tasks/prReviewAttachments.ts:1-17`、`src/infra/github/attachmentUrl.ts:1-20`、`src/infra/github/prImageDownload.ts:1-148`、`src/shared/utils/imageAttachmentStore.ts:1-126` |
| 共通helperの契約一貫性 | `src/shared/utils/imageAttachmentReferences.ts:21-44`、`src/features/tasks/attachments.ts:32-50`、`src/features/tasks/retryTaskSpecAttachments.ts:46-101` |
| 副作用・失敗時整合性 | `src/features/tasks/prReviewAttachments.ts:140-163`、`src/features/pipeline/steps.ts:371-418`、`src/features/pipeline/execute.ts:35-92` |
| 契約置換・旧経路削除 | 旧数値採番、旧Markdown独自解析、旧`shared/utils/githubAttachmentUrl`参照は該当なし |
| テストレイヤーと実行ゲート | `scripts/test-classification.mjs:343-377`、`src/__tests__/pr-image-dataflow.integration.test.ts:1-112` |
| E2E runnerの状態整合性 | `scripts/run-e2e-mock-shards.mjs:138-238`、`scripts/teed-command.mjs:14-72`、`src/__tests__/e2eMockRunner.test.ts:1-208` |