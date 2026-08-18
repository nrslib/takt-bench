# コーディングレビュー

## 結果: APPROVE


## サマリー

画像抽出・認証付き取得・添付保存・pipeline 連携・後片付けの変更契約を確認しました。既存の actionable finding 3件は解消されており、新規・継続・再開指摘はありません。


## 契約入口チェック

| 入口・経路 | 元要件 | 実装根拠 | テスト根拠 | 判定 | 例外・未確認の根拠 |
|-----------|--------|----------|------------|------|-------------------|
| `takt add --pr` | PR本文・通常コメント・review threadの画像を添付保存 | `src/features/tasks/add/index.ts`、`src/infra/github/pr-images.ts:481` | `src/__tests__/addTask.test.ts`、`src/__tests__/github-pr.test.ts` | ✅ | なし |
| `takt --pr` routing | 画像付きPRをinteractive経路へ渡す | `src/app/cli/routing-inputs.ts`、`src/app/cli/routing.ts` | `src/__tests__/cli-routing-pr-resolve.test.ts` | ✅ | なし |
| pipeline `--pr` | 添付付きtask specをworkflowへ渡す | `src/features/pipeline/steps.ts`、`src/features/pipeline/execute.ts:65-107` | `src/__tests__/pipelineExecution.test.ts:1325-1456` | ✅ | なし |
| URL・認証・payload検証 | GitHub URL限定、private repo認証、形式・サイズ検証 | `src/infra/github/pr-images.ts:150-225`、`src/infra/github/repository.ts` | `src/__tests__/github-pr-images.test.ts`、`src/__tests__/github-pr.test.ts` | ✅ | 実private GitHub E2Eは環境依存で未実施 |
| 本文参照・添付一覧 | `[Image #N]`と添付順序を一致させる | `src/infra/github/pr-images.ts:233-337`、`src/infra/git/format.ts:248-285` | `src/__tests__/github-pr-images.test.ts:60-92` | ✅ | なし |


## 非finding化した懸念

| 項目 | 場所 | 分類 | finding化しない根拠 |
|------|------|------|---------------------|
| 明示終了時の画像一時directory cleanup | `src/infra/github/pr-images.ts:410-434` | no_issue_after_verification | exit時cleanupをintegration testで確認済み |
| pipeline false・例外時のtask spec cleanup | `src/features/pipeline/execute.ts:100-107` | no_issue_after_verification | `pipelineExecution.test.ts`でtask spec・画像directoryの消滅を確認済み |
| 実private GitHub repositoryを使ったE2E未実施 | `fix-verification.md` | environment_unverified | 資格情報・対象repository未提供による環境制約であり、決定的なscope/auth/payload検証は実施済み |


## 問題系列の完了走査

| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|----------|----------------------|--------------------------|--------------|------------------|----------------------|---------------------------------------------------|----------------------------|------------|------|
| `F-PRIMG-FETCH-BOUNDARY` | `fetchPrReviewComments()` | metadata取得自体が画像取得副作用を持たない | metadata境界とtask専用準備境界を分離するため | なし | `src/infra/github/pr.ts` | add/routing/pipelineの準備経路 | fetch失敗・準備失敗 | `github-pr.test.ts` | 実GitHub接続 | 問題なし |
| `F-PRIMG-REFERENCE-ORDER` | `extractGitHubPrImageReferences()` / `replaceGitHubPrImageReferences()` | placeholder・本文・filename・添付一覧の順序が一致 | parserとformatterが同じ順序契約を共有するため | formatter・manifest経路を追加確認 | `pr-images.ts`、`format.ts` | `order.md`、task spec、workflow | Markdown/HTML混在、既存placeholder | `github-pr-images.test.ts` | なし | 問題なし |
| `F-PRIMG-REFERENCE-ALLOCATION` | 画像参照採番 | 既存placeholderと新規番号が衝突しない | 同一名前空間を全入力本文で共有するため | なし | `pr-images.ts:233-245` | add/routing/pipeline | 重複URL・既存番号 | `github-pr-images.test.ts` | なし | 問題なし |
| `F-PRIMG-FETCH-SCOPE` | URL分類・repository parser | 許可されたGitHub attachment URLだけ取得し、private repoだけ認証する | credential付与境界を単一化するため | なし | `pr-images.ts:150-182`、`repository.ts` | `fetchGitHubImage()` | 外部URL・別repository・認証失敗 | `github-pr-images.test.ts` | 実private repository | 問題なし |
| `F-PRIMG-DOWNLOAD-API` | `downloadGitHubPrImages()` | Content-Type、magic bytes、サイズ上限を検証する | 実画像取得とpayload validatorを同一経路にするため | なし | `pr-images.ts:210-225、436-479` | task attachments | HTTP失敗・不正payload・途中失敗 | `github-pr-images.test.ts` | なし | 問題なし |
| `F-PRIMG-TEMP-LIFECYCLE` | resource cleanup・`runPipeline()` | 成功・失敗・cancel・明示終了で一時資源を解放する | 同じresourceの終端経路を閉じるため | pipeline false/例外経路 | `pr-images.ts:410-434`、`execute.ts:100-107` | task spec・画像directory | false・例外・exit・routing失敗 | lifecycle/pipeline tests | 強制終了時のpipeline task specは既存裁定範囲外 | 問題なし |
| `F-PRIMG-TEST-WIRING` | test classifier | 実境界テストが適切なrunnerで実行される | filesystem・child process境界の分類を維持するため | lifecycle integration test | `scripts/test-classification.mjs` | release verification | unit/light/heavy分類 | `releaseVerificationWiring.test.ts` | なし | 問題なし |


## 今回の指摘（new）

| # | finding_id | family_tag | 重大度 | 場所 | 問題 | 影響 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|------------|------------|--------|------|------|------|---------------------|------------------------------|--------|
| — | — | — | — | — | 指摘なし | — | — | — | — |


## 継続指摘（persists）

| # | finding_id | family_tag | 前回根拠 | 今回根拠 | 問題 | 修正案 |
|---|------------|------------|----------|----------|------|--------|
| — | — | — | — | — | 継続指摘なし | — |


## 解消済み（resolved）

| finding_id | 元の期待結果 | 解消根拠 |
|------------|--------------|----------|
| `PRIMG-09-FORMATTED-ORDER` | formatter本文と画像採番・添付一覧の順序一致 | `src/infra/git/format.ts:248-285`と`src/__tests__/github-pr-images.test.ts:60-92` |
| `TEST-FOLLOWUP-PRIMG-01-order` | Markdown→HTML、HTML→Markdown双方の混在順序を検証 | `src/__tests__/github-pr-images.test.ts`の双方向テスト |
| `TEST-FOLLOWUP-PRIMG-06-pipeline-failure-cleanup` | pipeline false・例外時のtask spec・画像resource cleanup | `src/features/pipeline/execute.ts:100-107`、`src/__tests__/pipelineExecution.test.ts:1383-1451` |


## 裁定済みの対象外指摘

| finding_id | 最新の裁定 | 統合先 family | 裁定根拠 |
|------------|------------|---------------|----------|
| `AI-PRIMG-001` | no_issue_after_verification | — | HTTP取得へ置換済み |
| `AI-PRIMG-002` | no_issue_after_verification | — | resource cleanup確認済み |
| `AI-PRIMG-003` | no_issue_after_verification | — | parser内の位置順統合確認済み |
| `ARCH-PRIMG-001` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | 親directory cleanupの同一契約 |
| `ARCH-PRIMG-002` | no_issue_after_verification | — | metadata-only fetch確認済み |
| `ARCH-PRIMG-003` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | 明示終了時cleanupの同一契約 |
| `ARCH-PRIMG-004` | duplicate | `F-PRIMG-REFERENCE-ORDER` | syntax混在時の順序の同一契約 |
| `CODE-NEW-src-infra-github-pr.ts-L464` | duplicate | `F-PRIMG-FETCH-BOUNDARY` | metadata fetch副作用の同一原因 |
| `CODE-NEW-src-infra-github-pr-images.ts-L311` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | file/directory cleanupの同一契約 |
| `CODE-NEW-src-infra-github-pr-images.ts-L198` | no_issue_after_verification | — | 既存placeholder回避確認済み |
| `CODE-NEW-src-infra-github-pr-images.ts-L184` | duplicate | `F-PRIMG-REFERENCE-ORDER` | syntax別抽出順序の同一原因 |
| `PRIMG-07-SYSTEM-FETCH-SIDE-EFFECT` | duplicate | `F-PRIMG-FETCH-BOUNDARY` | metadata境界副作用の同一契約 |
| `PRIMG-06-PROCESS-EXIT-CLEANUP` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | exit時cleanupの同一契約 |
| `PRIMG-06-TEMP-DIRECTORY-CLEANUP` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | 親directory cleanupの同一契約 |
| `PRIMG-05-IMAGE-NUMBER-COLLISION` | duplicate | `F-PRIMG-REFERENCE-ALLOCATION` | placeholder採番の同一原因 |
| `PRIMG-08-TEST-CLASSIFICATION` | no_issue_after_verification | — | classifierとrelease wiring確認済み |
| `SEC-PRIMG-001` | no_issue_after_verification | — | repository scope・Authorization確認済み |
| `SEC-PRIMG-002` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | system経路のcleanup同一契約 |
| `TEST-NEW-PRIMG-01-order` | duplicate | `F-PRIMG-REFERENCE-ORDER` | 混在記法順序の同一契約 |
| `TEST-NEW-PRIMG-02-download-content` | overreach | — | 現行欠陥の具体的証拠がない追加要求 |
| `TEST-NEW-PRIMG-06-cleanup` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | cleanupの同一契約 |


## 再開指摘（reopened）

| # | finding_id | family_tag | 直前の裁定 | 再開根拠（a-d） | 新しい証拠 | 問題 | 修正案 |
|---|------------|------------|------------|----------------|------------|------|--------|
| — | — | — | — | — | — | 再開指摘なし | — |


## 検証証跡

- 差分確認: `git diff --check` 成功。対象変更ファイルと未追跡成果物を確認。
- ビルド: `fix-verification.md`に`npm run build`成功を記録。
- lint: `fix-verification.md`に`npm run lint`成功を記録。
- テスト: 型契約を含む対象テストが終了コード0。画像・lifecycle・pipeline・add・routing・PR・interactive・release wiringを合計197件確認。
- lifecycle integration test、pipeline false/例外、順序のMarkdown/HTML双方向テストを確認。


## 再走査証跡（2回目以降のレビューで必須）

| 照合した Policy/Knowledge の章 | 差分側の根拠（`file:line` または「該当なし」） |
|-------------------------------|---------------------------------------------|
| Follow-up review・既出family照合 | `review-resolution.md`の修正対象family、finding裁定、最新`fix-verification.md` |
| 契約置換ポリシー | 旧順序経路を共通helperへ統合し、既存利用側を移行 |
| 主操作と終端consumer | `src/infra/github/pr-images.ts:436-513` → `src/features/pipeline/execute.ts:65-107` → task spec/workflow |
| 一時資源の正常・失敗・中断・明示終了 | `src/infra/github/pr-images.ts:410-434`、`src/__tests__/github-pr-image-lifecycle.integration.test.ts` |
| テスト不足の判定基準 | `src/__tests__/github-pr-images.test.ts:60-92`、`src/__tests__/pipelineExecution.test.ts:1383-1451` |
| ヘキサゴナルアーキテクチャ | `src/infra` → `src/features` の依存方向を確認。違反なし |