# コーディングレビュー

## 結果: REJECT

## サマリー

PR画像の正常系は動作しますが、汎用PR取得経路への副作用混入、終了時の一時ファイル cleanup 漏れ、画像番号衝突、リリース検証テスト分類違反があります。

## 契約入口チェック

| 入口・経路 | 元要件 | 実装根拠 | テスト根拠 | 判定 | 例外・未確認の根拠 |
|-----------|--------|----------|------------|------|-------------------|
| `add --pr` | PR画像を添付として保存する | `src/features/tasks/add/index.ts` | `src/__tests__/addTask.test.ts` | ⚠️ | 正常系は確認済み。番号衝突とcleanupに問題あり |
| interactive `--pr` | 画像添付をinteractive保存へ渡す | `src/app/cli/routing.ts:314-337` | `src/__tests__/cli-routing-pr-resolve.test.ts` | ❌ | `process.exit()` が cleanup を迂回する |
| pipeline `--pr` | 添付を後続workflow実行まで渡す | `src/features/pipeline/execute.ts`, `src/features/pipeline/steps.ts` | `src/__tests__/pipelineExecution.test.ts` | ⚠️ | 正常系は確認済み。分類検証が失敗 |
| PR画像抽出・検証 | GitHub URL、形式、サイズを検証する | `src/infra/github/pr-images.ts:184-207` | `src/__tests__/github-pr-images.test.ts` | ⚠️ | 既存 `[Image #N]` との衝突を未検証 |
| 汎用PRメタデータ取得 | 既存のPR取得・同期動作を維持する | `src/infra/github/pr.ts:464-481` | システム経路の回帰テストなし | ❌ | 画像取得・本文置換が汎用取得へ混入 |

## 非finding化した懸念

| 項目 | 場所 | 分類 | finding化しない根拠 |
|------|------|------|---------------------|
| 画像バリデータの共通化不足 | `src/infra/github/pr-images.ts` | outside_contract_jurisdiction | 重複自体による観測可能な契約違反を確認できないため |

## 問題系列の完了走査

| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|----------|----------------------|--------------------------|--------------|------------------|----------------------|---------------------------------------------------|----------------------------|------------|------|
| `pr-review-fetch-boundary` | PRメタデータ取得とタスク準備の境界 | 汎用PR取得は画像ダウンロードや本文置換を行わない | `fetchPrReviewComments` に画像処理を追加したため | `fetchPrReviewComments` → system context / sync / add / pipeline | `src/infra/github/pr.ts:464-481` | `DefaultSystemStepServices`, `system-sync-effects` | 画像取得失敗時に汎用PR取得も失敗 | `github-pr.test.ts` はtask用途のmockのみ | システム実API経路の実行は未確認 | `PRIMG-07-SYSTEM-FETCH-SIDE-EFFECT` |
| `pr-attachment-lifecycle` | 添付一時領域の所有者とcleanup | 成功・失敗・cancel・`process.exit()` でファイルとディレクトリを削除する | cleanup境界と終了経路を変更したため | download → routing/add/pipeline → cleanup | `pr-images.ts:289-307`, `routing.ts:342-347` | task spec準備後にworkflowへ再注入 | `routing.ts:145-147,319-321` は `finally` を迂回 | cancelテストはファイル削除のみ | `process.exit()` 経路は未テスト | `PRIMG-06-PROCESS-EXIT-CLEANUP`, `PRIMG-06-TEMP-DIRECTORY-CLEANUP` |
| `pr-image-reference-allocation` | PR画像参照番号の一意性 | 既存本文・既存添付と衝突しない番号を割り当てる | 抽出時に単純な件数採番を行うため | PR本文 → placeholder生成 → task attachment参照 | `pr-images.ts:190-204` | `formatPrReviewAsTask` / 添付manifest | 既存 `[Image #1]` がある本文で衝突を再現 | allocator単体テストは既存PR本文を含まない | 既存添付パスとの組合せは未確認 | `PRIMG-05-IMAGE-NUMBER-COLLISION` |
| `release-verification-wiring` | テスト分類とリリース検証配線 | 実filesystemを使うテストは適切なIT runnerで分類する | pipelineテストに実filesystem処理を追加したため | `pipelineExecution.test.ts` → release wiring classifier | `pipelineExecution.test.ts:2-4,1321-1368` | テストrunner分類 | `releaseVerificationWiring.test.ts` が分類違反で失敗 | 実filesystemを使うテストdoubleなし | full release gateは未確認 | `PRIMG-08-TEST-CLASSIFICATION` |

## 今回の指摘（new）

| # | finding_id | family_tag | 重大度 | 場所 | 問題 | 影響 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|------------|------------|--------|------|------|------|---------------------|------------------------------|--------|
| 1 | `PRIMG-07-SYSTEM-FETCH-SIDE-EFFECT` | `pr-review-fetch-boundary` | High | `src/infra/github/pr.ts:464-481` | 汎用の `fetchPrReviewComments()` 内で画像をダウンロードし本文を置換している | system context・PR同期など、添付を消費しない経路まで `gh api`、画像形式検証、失敗の影響を受ける | 初回は該当なし | — | メタデータ取得を純粋に戻し、画像準備をadd／interactive／pipeline専用境界へ分離する |
| 2 | `PRIMG-06-PROCESS-EXIT-CLEANUP` | `pr-attachment-lifecycle` | High | `src/app/cli/routing.ts:145-147,319-321` | `process.exit()` がcleanup用の `finally` を迂回する | PR画像の一時ファイルがエラー終了時に残る | 初回は該当なし | — | `process.exit()` 前に明示cleanupするか、終了処理を `finally` 管理下へ移す |
| 3 | `PRIMG-06-TEMP-DIRECTORY-CLEANUP` | `pr-attachment-lifecycle` | Medium | `src/infra/github/pr-images.ts:311-324` | cleanupが画像ファイルのみ削除し、親一時ディレクトリを残す | `/tmp/takt-github-pr-*` の空ディレクトリが蓄積する | 初回は該当なし | — | attachment単位の一時ディレクトリも所有し、最後に削除する |
| 4 | `PRIMG-05-IMAGE-NUMBER-COLLISION` | `pr-image-reference-allocation` | Medium | `src/infra/github/pr-images.ts:190-204` | 新規画像番号を検出件数だけで採番している | 既存本文の `[Image #1]` と新規画像が衝突し、既存参照が別画像を指す | 初回は該当なし | — | 本文中の既存placeholderと既存添付ファイル名を走査して未使用番号を採番する |
| 5 | `PRIMG-08-TEST-CLASSIFICATION` | `release-verification-wiring` | High | `src/__tests__/pipelineExecution.test.ts:2-4,1321-1368` | 実filesystemを使うテストがunit分類のまま追加されている | `releaseVerificationWiring.test.ts` が `pipelineExecution.test.ts` を分類違反として検出し、検証ゲートが失敗する | 初回は該当なし | — | 統合テストへ移すか、filesystem依存をmockしてunit分類を維持する |

## 継続指摘（persists）

なし。

## 解消済み（resolved）

なし。

## 裁定済みの対象外指摘

なし。

## 再開指摘（reopened）

なし。

## 検証証跡

- 差分確認: 指定された変更対象15ファイルと関連する下流consumerを確認。
- ビルド: 未確認。
- テスト: 対象テスト170件は成功。`releaseVerificationWiring.test.ts` は `src/__tests__/pipelineExecution.test.ts` の分類違反で失敗。
- 追加確認: 既存 `[Image #1]` との番号衝突、およびcleanup後の親一時ディレクトリ残存を再現。

## 再走査証跡（2回目以降のレビューで必須）

| 照合した Policy/Knowledge の章 | 差分側の根拠（`file:line` または「該当なし」） |
|-------------------------------|---------------------------------------------|
| 契約置換ポリシー | `src/infra/github/pr.ts:464-481`、`src/app/cli/routing.ts:121-147` |
| 主操作と終端 consumer | `src/features/pipeline/execute.ts`、`src/features/pipeline/steps.ts`、`src/features/tasks/add/index.ts` |
| 複数失敗を集約する境界 | 該当なし |