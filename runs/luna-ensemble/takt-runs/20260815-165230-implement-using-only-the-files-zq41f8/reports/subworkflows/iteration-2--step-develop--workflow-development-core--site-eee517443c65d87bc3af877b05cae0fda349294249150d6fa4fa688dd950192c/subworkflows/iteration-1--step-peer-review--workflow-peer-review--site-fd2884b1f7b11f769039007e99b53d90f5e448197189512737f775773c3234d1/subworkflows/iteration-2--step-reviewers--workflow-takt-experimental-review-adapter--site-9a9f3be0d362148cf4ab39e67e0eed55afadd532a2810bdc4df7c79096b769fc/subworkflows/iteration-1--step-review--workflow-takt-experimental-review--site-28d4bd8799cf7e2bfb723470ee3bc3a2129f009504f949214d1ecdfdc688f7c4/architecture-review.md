# アーキテクチャレビュー

## 結果: APPROVE

## サマリー

前回裁定された `F-PRIMG-REFERENCE-ORDER` と `F-PRIMG-TEMP-LIFECYCLE` を再走査し、formatter・attachment保存・pipeline終端まで契約が一貫していることを確認しました。`new`、`persists`、`reopened` はありません。

## 裁定済みの対象外指摘

| finding_id | 最新の裁定 | 統合先 family | 裁定根拠 |
|---|---|---|---|
| `AI-PRIMG-001` | `no_issue_after_verification` | — | 取得方式が修正済み |
| `AI-PRIMG-002` | `no_issue_after_verification` | — | resource cleanupを確認済み |
| `AI-PRIMG-003` | `no_issue_after_verification` | — | parser内の順序統合を確認済み |
| `ARCH-PRIMG-001` | `duplicate` | `F-PRIMG-TEMP-LIFECYCLE` | 親directory cleanupの同一契約 |
| `ARCH-PRIMG-002` | `no_issue_after_verification` | — | metadata-only fetchを確認済み |
| `ARCH-PRIMG-003` | `duplicate` | `F-PRIMG-TEMP-LIFECYCLE` | 明示終了時cleanupの同一契約 |
| `ARCH-PRIMG-004` | `duplicate` | `F-PRIMG-REFERENCE-ORDER` | 混在記法の順序契約 |
| `CODE-NEW-src-infra-github-pr.ts-L464` | `duplicate` | `F-PRIMG-FETCH-BOUNDARY` | metadata取得副作用の同一原因 |
| `CODE-NEW-src-infra-github-pr-images.ts-L311` | `duplicate` | `F-PRIMG-TEMP-LIFECYCLE` | temp cleanupの同一契約 |
| `CODE-NEW-src-infra-github-pr-images.ts-L198` | `no_issue_after_verification` | — | 既存placeholder回避を確認済み |
| `CODE-NEW-src-infra-github-pr-images.ts-L184` | `duplicate` | `F-PRIMG-REFERENCE-ORDER` | 抽出順序の同一原因 |
| `PRIMG-07-SYSTEM-FETCH-SIDE-EFFECT` | `duplicate` | `F-PRIMG-FETCH-BOUNDARY` | metadata境界副作用の同一契約 |
| `PRIMG-06-PROCESS-EXIT-CLEANUP` | `duplicate` | `F-PRIMG-TEMP-LIFECYCLE` | exit時cleanupの同一契約 |
| `PRIMG-06-TEMP-DIRECTORY-CLEANUP` | `duplicate` | `F-PRIMG-TEMP-LIFECYCLE` | 親directory残留の同一契約 |
| `PRIMG-05-IMAGE-NUMBER-COLLISION` | `duplicate` | `F-PRIMG-REFERENCE-ALLOCATION` | placeholder採番の同一原因 |
| `PRIMG-08-TEST-CLASSIFICATION` | `no_issue_after_verification` | — | 分類契約を確認済み |
| `SEC-PRIMG-001` | `no_issue_after_verification` | — | repository scopeを確認済み |
| `SEC-PRIMG-002` | `duplicate` | `F-PRIMG-TEMP-LIFECYCLE` | temp残留の同一契約 |
| `TEST-NEW-PRIMG-01-order` | `duplicate` | `F-PRIMG-REFERENCE-ORDER` | 混在記法順序の同一契約 |
| `TEST-NEW-PRIMG-02-download-content` | `overreach` | — | 実装欠陥または要件違反の証拠なし |
| `TEST-NEW-PRIMG-06-cleanup` | `duplicate` | `F-PRIMG-TEMP-LIFECYCLE` | cleanup検証の同一契約 |

## 検証証跡

- ビルド: `npm run build` 成功。
- Lint: `npm run lint` 成功。
- テスト: 画像18件、pipeline55件、lifecycle1件、分類17件、add19件、routing27件、image attachment16件、GitHub PR44件、formatter25件がすべて成功。
- 動作確認: `format.ts` の共通レビュー節順を画像抽出・本文置換が利用し、add・routing・pipelineの各終端でtask specと画像resourceがcleanupされることを確認。

## 再走査証跡

| 照合した Policy/Knowledge の章 | 差分側の根拠 |
|---|---|
| 契約置換ポリシー | `src/infra/git/format.ts:201-254`、`src/infra/github/pr-images.ts:256-337` |
| 主操作と終端 consumer | `src/infra/github/pr-images.ts:481-513`、`src/features/pipeline/execute.ts:46-107` |
| 呼び出しチェーン検証 | `src/features/tasks/add/index.ts:184-230`、`src/app/cli/routing.ts:122-347`、`src/features/pipeline/steps.ts:221-249` |
| 終了経路の完全性 | `src/infra/github/pr-images.ts:410-478`、pipelineのnested `finally` |
| テストレイヤーと実行ゲート | `scripts/test-classification.mjs`、`releaseVerificationWiring.test.ts` |
| 責務分離・依存方向 | formatterの共通順序定義とGitHub画像準備境界の分離 |