# アーキテクチャレビュー

## 結果: APPROVE

## サマリー

前段で確定した7つの修正対象 family について、取得境界、参照順序・番号、task保存、pipeline/routing伝播、temp cleanup、テスト分類を再走査しました。新規・継続・再開 finding はありません。

## 裁定済みの対象外指摘

| finding_id | 最新の裁定 | 統合先 family | 裁定根拠 |
|---|---|---|---|
| `TEST-NEW-PRIMG-02-download-content` | overreach | — | `review-resolution.md`で、追加のbytes検証・途中失敗テストは実装欠陥や元要件違反の証拠がなく、対象外と裁定 |
| `ARCH-PRIMG-001` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | 親directory cleanup欠陥として統合 |
| `ARCH-PRIMG-003` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | `process.exit()`時cleanup欠陥として統合 |
| `ARCH-PRIMG-004` | duplicate | `F-PRIMG-REFERENCE-ORDER` | 混在記法の順序欠陥として統合 |
| `CODE-NEW-src-infra-github-pr.ts-L464` | duplicate | `F-PRIMG-FETCH-BOUNDARY` | metadata取得への副作用混入として統合 |
| `CODE-NEW-src-infra-github-pr-images.ts-L311` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | temp cleanup欠陥として統合 |
| `CODE-NEW-src-infra-github-pr-images.ts-L184` | duplicate | `F-PRIMG-REFERENCE-ORDER` | 抽出順序欠陥として統合 |
| `PRIMG-07-SYSTEM-FETCH-SIDE-EFFECT` | duplicate | `F-PRIMG-FETCH-BOUNDARY` | 汎用fetch副作用として統合 |
| `PRIMG-06-PROCESS-EXIT-CLEANUP` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | 明示終了時cleanup欠陥として統合 |
| `PRIMG-06-TEMP-DIRECTORY-CLEANUP` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | 親directory残留として統合 |
| `PRIMG-05-IMAGE-NUMBER-COLLISION` | duplicate | `F-PRIMG-REFERENCE-ALLOCATION` | 参照番号衝突として統合 |
| `TEST-NEW-PRIMG-01-order` | duplicate | `F-PRIMG-REFERENCE-ORDER` | 混在記法テスト不足として統合 |
| `TEST-NEW-PRIMG-06-cleanup` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | cleanup検証不足として統合 |
| `SEC-PRIMG-002` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | system経路のcleanup欠陥として統合 |

## 検証証跡

- ビルド: `npm run build` 成功。
- Lint: `npm run lint` 成功。
- テスト: 対象8ファイル、unit・light IT・heavy IT 合計193件成功。lifecycle、routing、pipeline、add、分類契約を含む。
- 動作確認: `fetchPrReviewComments()`のmetadata専用化、画像参照の本文出現順採番、既存番号回避、repository scope検証、task attachment伝播、通常終了・失敗・キャンセル・`process.exit()`後のtemp file/親directory cleanupを確認。

## 再走査証跡（2回目以降のレビューで必須）

| 照合した Policy/Knowledge の章 | 差分側の根拠 |
|---|---|
| 契約置換ポリシー | `src/infra/github/pr.ts:408-445`、`src/app/cli/routing-inputs.ts:69-85`、`src/features/tasks/add/index.ts:187-230`、`src/features/pipeline/steps.ts:225-249` |
| 主操作と終端 consumer | `src/infra/github/pr-images.ts:263-299,443-521`、`src/features/pipeline/execute.ts:65-107` |
| 呼び出しチェーン検証 | add/routing/pipelineのtask準備境界からattachment保存・workflow実行まで確認 |
| 終了経路の完全性 | `src/infra/github/pr-images.ts:417-440`、`src/app/cli/routing.ts`、`src/features/tasks/add/index.ts:228-230` |
| テストレイヤーと実行ゲート | `scripts/test-classification.mjs:200,226`、`src/__tests__/github-pr-image-lifecycle.integration.test.ts` |
| 責務分離・依存方向 | 汎用PR metadata取得とGitHub PR task画像準備を分離し、system consumerへ画像副作用を伝播させない構造を確認 |