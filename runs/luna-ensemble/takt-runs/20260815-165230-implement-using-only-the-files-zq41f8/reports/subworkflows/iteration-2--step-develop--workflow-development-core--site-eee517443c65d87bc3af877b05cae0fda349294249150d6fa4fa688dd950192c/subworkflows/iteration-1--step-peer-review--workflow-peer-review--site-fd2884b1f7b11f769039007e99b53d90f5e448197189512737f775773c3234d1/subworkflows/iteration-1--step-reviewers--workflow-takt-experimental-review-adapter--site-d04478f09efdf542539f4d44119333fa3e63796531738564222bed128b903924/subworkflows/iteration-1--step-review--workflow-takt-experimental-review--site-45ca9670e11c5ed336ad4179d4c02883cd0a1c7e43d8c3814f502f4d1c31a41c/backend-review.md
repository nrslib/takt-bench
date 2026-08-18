# コーディングレビュー

## 結果: APPROVE

## サマリー

既存の7つの修正対象 family を再走査しました。producer から終端 consumer、失敗・キャンセル・明示終了経路まで確認し、新規・継続・再開 finding はありません。

## 契約入口チェック

| 入口・経路 | 元要件 | 実装根拠 | テスト根拠 | 判定 | 例外・未確認の根拠 |
|-----------|--------|----------|------------|------|-------------------|
| `takt add --pr` | PR本文・通常コメント・review threadの画像を取得し、task attachmentへ保存 | `src/features/tasks/add/index.ts:184-229`、`src/infra/github/pr-images.ts:488-520` | `addTask.test.ts` 19件、`github-pr.test.ts` 44件 | ✅ | 実private GitHub E2Eは資格情報未提供 |
| `takt --pr` 通常経路 | 画像をinteractive seedへ渡し、実行・保存時に利用 | `src/app/cli/routing-inputs.ts:54-85`、`src/app/cli/routing.ts:122-347` | `cli-routing-pr-resolve.test.ts` 27件 | ✅ | なし |
| pipeline `--pr` | attachment付きtask specを生成し、workflow実行まで伝播 | `src/features/pipeline/steps.ts:221-250`、`src/features/pipeline/execute.ts:46-107` | `pipelineExecution.test.ts` 53件 | ✅ | なし |
| 汎用PR metadata取得 | metadata取得自体は画像取得・本文置換の副作用を持たない | `src/infra/github/pr.ts:408-445` | `github-pr.test.ts:769-827` | ✅ | なし |
| 画像取得境界 | GitHub attachment URLのみを許可し、private repository assetだけ認証する | `src/infra/github/pr-images.ts:147-189,443-480` | `github-pr-images.test.ts`、`github-pr.test.ts` | ✅ | なし |
| テスト分類 | 実filesystem境界をunit gateから除外する | `scripts/test-classification.mjs:172-226` | `releaseVerificationWiring.test.ts` 17件 | ✅ | なし |

## 非finding化した懸念

| 項目 | 場所 | 分類 | finding化しない根拠 |
|------|------|------|---------------------|
| `TEST-NEW-PRIMG-02-download-content` | `src/infra/github/pr-images.ts` | overreach | 最新の`review-resolution.md`で過剰要求と裁定済み。現行コードはresponse body、Content-Type、magic bytes、サイズ検証を実装しており、具体的な欠陥は確認できない |
| 実private GitHub認証付きE2E未実施 | `src/__tests__/github-pr.test.ts` | environment_unverified | 資格情報と対象repositoryが未提供。決定的なHTTP、認証ヘッダー、scope、保存、cleanupのテストは成功している |

## 問題系列の完了走査

| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|----------|----------------------|--------------------------|--------------|------------------|----------------------|---------------------------------------------------|----------------------------|------------|------|
| `F-PRIMG-DOWNLOAD-API` | `downloadGitHubPrImages()` | 許可URLが実在する画像ファイルになる | Web URLを誤った`gh api` endpointとして扱わないため | なし | `pr-images.ts:398-415,443-485` | add/routing/pipelineへattachment伝播 | 取得失敗時にresource全体をcleanup | `github-pr.test.ts:769-827` | 実GitHub通信 | 問題なし |
| `F-PRIMG-REFERENCE-ORDER` | 抽出・置換処理 | placeholder、filename、本文参照が出現順に一致する | MarkdownとHTMLを位置順に統合するため | なし | `pr-images.ts:263-299,302-344` | task order生成へ伝播 | 非render領域を除外 | `github-pr-images.test.ts:70-86,105-152` | なし | 問題なし |
| `F-PRIMG-REFERENCE-ALLOCATION` | 画像番号採番 | 既存・同一batch内の番号と衝突しない | 使用済み番号集合を単一採番境界で管理するため | なし | `pr-images.ts:240-260,284-296` | placeholderとfilenameへ同一番号を伝播 | 重複URLをdedupe | `github-pr-images.test.ts:88-95`、`imageAttachments.test.ts` 16件 | なし | 問題なし |
| `F-PRIMG-FETCH-BOUNDARY` | `fetchPrReviewComments()` | 汎用metadata取得に画像副作用がない | task専用準備を各task入口へ移したため | なし | `pr.ts:408-445` | add/routing/pipelineのみprepareを呼ぶ | system consumerはraw metadataを維持 | `github-pr.test.ts:769-827` | なし | 問題なし |
| `F-PRIMG-TEMP-LIFECYCLE` | resource cleanup | 成功・失敗・cancel・明示終了でfile/directoryを解放する | 親directoryをresource ownerが管理するため | なし | `pr-images.ts:417-485` | add/routing/pipelineのfinallyへ伝播 | `process.exit()`時の同期cleanupを確認 | `github-pr-image-lifecycle.integration.test.ts` 1件 | SIGKILLは対象外 | 問題なし |
| `F-PRIMG-FETCH-SCOPE` | URL分類とrepository context | 無関係なprivate repositoryへ認証取得しない | credential付与前にPR repository scopeを検証するため | なし | `pr-images.ts:147-189,452-473` | 許可URLのみdownloadへ到達 | 別repository assetを事前拒否 | scopeテスト、`github-pr.test.ts` | 実private repository | 問題なし |
| `F-PRIMG-TEST-WIRING` | test classifier | 実filesystemテストがunit gateへ混入しない | `github-pr.test.ts`と`pipelineExecution.test.ts`をIT分類へ移したため | なし | `scripts/test-classification.mjs:172-226` | release verificationへ接続 | unit/IT分類の重複なし | `releaseVerificationWiring.test.ts` 17件 | なし | 問題なし |

## 今回の指摘（new）

なし。

## 継続指摘（persists）

なし。

## 解消済み（resolved）

| finding_id | 元の期待結果 | 解消根拠 |
|------------|--------------|----------|
| `AI-PRIMG-001` | 許可画像URLを実在する認証付き経路で取得する | `src/infra/github/pr-images.ts:398-415,443-480` |
| `AI-PRIMG-002` | temp fileと親directoryを終端経路で解放する | `src/infra/github/pr-images.ts:417-440,482-485` |
| `AI-PRIMG-003` | Markdown/HTML混在時も出現順を維持する | `src/infra/github/pr-images.ts:271-299` |
| `ARCH-PRIMG-002` | 汎用metadata取得から画像副作用を分離する | `src/infra/github/pr.ts:408-445` |
| `CODE-NEW-src-infra-github-pr-images.ts-L198` | 既存placeholderと新規番号を衝突させない | `src/infra/github/pr-images.ts:240-260,284-296` |
| `PRIMG-08-TEST-CLASSIFICATION` | filesystemテストを正しいIT runnerへ分類する | `scripts/test-classification.mjs:172-226` |
| `SEC-PRIMG-001` | 認証取得対象を現在のPR repository scopeに限定する | `src/infra/github/pr-images.ts:147-189,452-473` |

## 裁定済みの対象外指摘

| finding_id | 最新の裁定 | 統合先 family | 裁定根拠 |
|------------|------------|---------------|----------|
| `ARCH-PRIMG-001` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | 親directory cleanup欠陥として`AI-PRIMG-002`へ統合済み |
| `ARCH-PRIMG-003` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | 終了時cleanup欠陥として`AI-PRIMG-002`へ統合済み |
| `ARCH-PRIMG-004` | duplicate | `F-PRIMG-REFERENCE-ORDER` | Markdown/HTML抽出順序欠陥として`AI-PRIMG-003`へ統合済み |
| `CODE-NEW-src-infra-github-pr.ts-L464` | duplicate | `F-PRIMG-FETCH-BOUNDARY` | 汎用fetch副作用欠陥として`ARCH-PRIMG-002`へ統合済み |
| `CODE-NEW-src-infra-github-pr-images.ts-L311` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | temp cleanup欠陥として`AI-PRIMG-002`へ統合済み |
| `CODE-NEW-src-infra-github-pr-images.ts-L184` | duplicate | `F-PRIMG-REFERENCE-ORDER` | 抽出順序欠陥として`AI-PRIMG-003`へ統合済み |
| `PRIMG-07-SYSTEM-FETCH-SIDE-EFFECT` | duplicate | `F-PRIMG-FETCH-BOUNDARY` | metadata境界欠陥として`ARCH-PRIMG-002`へ統合済み |
| `PRIMG-06-PROCESS-EXIT-CLEANUP` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | exit時cleanup欠陥として`AI-PRIMG-002`へ統合済み |
| `PRIMG-06-TEMP-DIRECTORY-CLEANUP` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | 親directory残留欠陥として`AI-PRIMG-002`へ統合済み |
| `PRIMG-05-IMAGE-NUMBER-COLLISION` | duplicate | `F-PRIMG-REFERENCE-ALLOCATION` | 採番衝突欠陥としてcanonical findingへ統合済み |
| `SEC-PRIMG-002` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | temp resource lifecycle欠陥として`AI-PRIMG-002`へ統合済み |
| `TEST-NEW-PRIMG-01-order` | duplicate | `F-PRIMG-REFERENCE-ORDER` | 参照順序欠陥として`AI-PRIMG-003`へ統合済み |
| `TEST-NEW-PRIMG-02-download-content` | overreach | — | 追加テスト要求のみで、現行コードの具体的欠陥または受入条件違反を示さない |
| `TEST-NEW-PRIMG-06-cleanup` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | cleanup欠陥として`AI-PRIMG-002`へ統合済み |

## 再開指摘（reopened）

なし。

## 検証証跡

- 差分確認: `git diff --check` 成功。
- ビルド: `npm run build` 成功。
- lint: `npm run lint` 成功。
- 画像parser/validator: `github-pr-images.test.ts` 16件成功。
- PR metadata・画像準備: `github-pr.test.ts` 44件成功。
- lifecycle: `github-pr-image-lifecycle.integration.test.ts` 1件成功。
- routing: `cli-routing-pr-resolve.test.ts` 27件成功。
- add: `addTask.test.ts` 19件成功。
- pipeline: `pipelineExecution.test.ts` 53件成功。
- interactive attachment allocator: `imageAttachments.test.ts` 16件成功。
- 分類契約: `releaseVerificationWiring.test.ts` 17件成功。
- 既存の`fix-verification.md`にもfast unit、light IT、対象familyの検証成功が記録されている。

## 再走査証跡（2回目以降のレビューで必須）

| 照合した Policy/Knowledge の章 | 差分側の根拠（`file:line` または「該当なし」） |
|-------------------------------|---------------------------------------------|
| Contract family role: `follow-up-review` | 7つの既存familyを同一の担当箇所・不変条件・変更理由で再利用し、追加familyを作成していない |
| 契約置換ポリシー | `src/infra/github/pr.ts:408-445`でmetadata契約を保持し、add/routing/pipeline側へtask専用処理を移行 |
| 主操作と終端consumer | `src/features/tasks/add/index.ts:207-225`、`src/features/pipeline/execute.ts:65-107` |
| 副作用・状態変更の終端確認 | `src/infra/github/pr-images.ts:417-485`、`src/app/cli/routing.ts:342-347` |
| テスト追加・分類の判定 | `scripts/test-classification.mjs:172-226`、`releaseVerificationWiring.test.ts` 17件 |