# コーディングレビュー

## 結果: APPROVE

## サマリー

PR画像の抽出順、検証、添付生成、`add`・`pipeline` 経由の終端到達、および失敗・終了時の後片付けを確認しました。既存の修正対象 family に未解消の問題、新規指摘、再開指摘はありません。

## 契約入口チェック

| 入口・経路 | 元要件 | 実装根拠 | テスト根拠 | 判定 | 例外・未確認の根拠 |
|-----------|--------|----------|------------|------|-------------------|
| `takt add --pr` | PR本文・コメント・レビューコメントから画像を取得し、タスク添付へ渡す | `src/features/tasks/add/index.ts`、`src/infra/github/pr-images.ts:481-513` | `src/__tests__/addTask.test.ts`、`src/__tests__/github-pr-images.test.ts` | ✅ | なし |
| `pipeline --pr` | PR画像をワークフロー実行へ渡す | `src/features/pipeline/steps.ts`、`src/features/pipeline/execute.ts:46-107` | `src/__tests__/pipelineExecution.test.ts` | ✅ | なし |
| 画像参照順 | 抽出順と`order.md`上の表示順を一致させる | `src/infra/git/format.ts:201-304`、`src/infra/github/pr-images.ts:256-337` | `src/__tests__/github-pr-images.test.ts` | ✅ | なし |
| 検証・後片付け | Content-Type、マジックバイト、サイズ、失敗時の削除を保証する | `src/infra/github/pr-images.ts:210-225、359-479` | `src/__tests__/github-pr-images.test.ts`、`src/__tests__/github-pr-image-lifecycle.integration.test.ts` | ✅ | なし |

## 非finding化した懸念

| 項目 | 場所 | 分類 | finding化しない根拠 |
|------|------|------|---------------------|
| 追加のダウンロード内容・部分失敗テストの不足 | `src/infra/github/pr-images.ts` | overreach | 最新の`review-resolution.md`で、現行契約の受入条件を超える追加要求として裁定済み |

## 問題系列の完了走査

| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|----------|----------------------|--------------------------|--------------|------------------|----------------------|---------------------------------------------------|----------------------------|------------|------|
| `F-PRIMG-REFERENCE-ORDER` | `src/infra/git/format.ts`のレビューセクション定義 | 抽出・置換・タスク表示が本文→レビューセクション→会話コメントの同一順序になる | 抽出側と表示側の順序契約を同じ定義へ統合したため | PR本文→レビュー→コメント→`order.md`→ワークフロー | `getPrReviewSections`、`getPrReviewBodiesInTaskOrder`、参照位置順ソート | `prepareGitHubPrTask`で置換後、formatterと添付生成へ伝播 | 参照なし、重複、Markdown/HTML混在を確認 | `github-pr-images.test.ts`、`github-pr.test.ts` | なし | 問題なし |
| `F-PRIMG-TEMP-LIFECYCLE` | `GitHubPrImageResource`と各呼び出し側 | 一時画像と添付用一時ディレクトリが成功・失敗・終了時に削除される | PR画像取得を複数入口へ導入したため、所有権と終端処理を共通化した | add・interactive・pipelineの全入口 | `createGitHubPrImageResource`、ダウンロード時の検証・保存 | task specへコピー後、ワークフロー終了時に削除 | context失敗、task spec失敗、workflow false/例外、プロセス終了を確認 | `github-pr-image-lifecycle.integration.test.ts`、`pipelineExecution.test.ts` | なし | 問題なし |

## 今回の指摘（new）

なし。

## 継続指摘（persists）

なし。

## 解消済み（resolved）

| finding_id | 元の期待結果 | 解消根拠 |
|------------|--------------|----------|
| `PRIMG-09-FORMATTED-ORDER` | 画像抽出順と整形後タスク順の一致 | `src/infra/git/format.ts:248-304`で共通のレビュー順序を使用 |
| `TEST-FOLLOWUP-PRIMG-01-order` | Markdown/HTML混在時も参照順を保持 | `src/infra/github/pr-images.ts:264-275`で位置順に統合 |
| `TEST-FOLLOWUP-PRIMG-06-pipeline-failure-cleanup` | pipelineのfalse・例外時に一時資源を削除 | `src/features/pipeline/execute.ts:100-107`および対象テスト |
| `PRIMG-07-SYSTEM-FETCH-SIDE-EFFECT` | PR取得自体が画像ダウンロードを発生させない | `src/infra/github/pr.ts`と各呼び出し側の責務分離 |
| `PRIMG-06-PROCESS-EXIT-CLEANUP` | プロセス終了時に一時ディレクトリを削除 | `src/infra/github/pr-images.ts:410-434` |
| `PRIMG-05-IMAGE-NUMBER-COLLISION` | 既存プレースホルダーと番号が衝突しない | `src/infra/github/pr-images.ts:233-252`およびinteractive添付管理 |

## 裁定済みの対象外指摘

| finding_id | 最新の裁定 | 統合先 family | 裁定根拠 |
|------------|------------|---------------|----------|
| `TEST-NEW-PRIMG-02-download-content` | overreach | — | `review-resolution.md`で、現行の明示契約を超えるダウンロード内容・部分失敗テスト要求として対象外裁定 |

## 再開指摘（reopened）

なし。

## 検証証跡

- 差分確認: 対象ファイル、既存修正 family、主要な入口から終端 consumerまで確認。`git diff --check`も問題なし。
- ビルド: Report Directoryの最新検証記録で成功。
- テスト: 対象テスト実行は終了コード0。画像抽出、add、pipeline、ライフサイクル、release wiringを確認。

## 再走査証跡（2回目以降のレビューで必須）

| 照合した Policy/Knowledge の章 | 差分側の根拠（`file:line` または「該当なし」） |
|-------------------------------|---------------------------------------------|
| 契約置換ポリシー | `src/infra/github/pr.ts`、`src/features/tasks/add/index.ts`、`src/features/pipeline/steps.ts` |
| 主操作と終端 consumer | `src/features/pipeline/execute.ts:65-107`、`src/features/tasks/attachments.ts` |
| 複数失敗を集約する境界 | 該当なし。今回の変更に複数結果の統合判定はない |
| 副作用・状態変更・後片付け | `src/infra/github/pr-images.ts:410-479`、`src/features/pipeline/execute.ts:100-107` |
| パブリックAPIの公開範囲 | 該当なし。公開ドメインAPIへの不要なインフラ再公開は確認されない |