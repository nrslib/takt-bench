# AI生成コードレビュー

## 結果: APPROVE

## サマリー

accepted family の全経路を再走査した結果、AI 特有の新規・継続・再開 finding は確認されませんでした。

## 検証した項目

| 観点 | 結果 | 備考 |
|------|------|------|
| 仮定の妥当性 | ✅ | `gh api` へのWeb URL誤渡しは解消され、`fetch()` と認証トークン取得へ移行済み |
| API/ライブラリの実在 | ✅ | Node.js標準の `fetch`、`Headers`、`Response` と `gh auth token` の実在・利用を確認 |
| コンテキスト適合 | ✅ | metadata取得とtask専用画像準備を分離し、既存のattachment保存経路へ接続済み |
| スコープ | ✅ | GitHub PR画像に必要な変更に限定され、不要な互換経路・抽象化は確認されず |

## 非finding化した懸念

| 項目 | 場所 | 分類 | finding化しない根拠 |
|------|------|------|---------------------|
| 実private GitHub環境での認証付きE2E | `src/infra/github/pr-images.ts` | environment_unverified | 資格情報と対象repositoryが未提供。決定的なHTTP、scope、payload検証、保存、cleanupの代替検証は完了している |
| payload途中失敗・追加bytes検証の拡張 | `src/__tests__/github-pr-images.test.ts` | overreach | 最新裁定で `TEST-NEW-PRIMG-02-download-content` は追加要求であり、現行コードの欠陥または元要件違反の証拠ではない |
| GitLab、Issue、direct task経路 | 複数 | outside_contract_jurisdiction | 今回のGitHub PR画像契約と担当箇所が異なる |

## 問題系列の完了走査

| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|----------|----------------------|--------------------------|--------------|------------------|----------------------|---------------------------------------------------|----------------------------|------------|------|
| `F-PRIMG-FETCH-BOUNDARY` | `fetchPrReviewComments()` とtask準備境界 | system metadata取得は画像副作用を持たず、task入口だけが画像処理を行う | 汎用fetchとtask専用副作用を同じ境界で扱わないため | add／routing／pipelineのtask準備経路 | `src/infra/github/pr.ts`、`prepareGitHubPrTask()` | add保存、routing interactive seed、pipeline task spec | system context／sync／enqueueはmetadata-onlyとして保持 | metadata mock、add／routing／pipeline tests | なし | 問題なし |
| `F-PRIMG-REFERENCE-ORDER` | `extractGitHubPrImageReferences()` / `replaceGitHubPrImageReferences()` | Markdown・HTML混在時も本文順、placeholder、filename、添付一覧が一致する | syntax別抽出結果を本文位置で統合する必要があるため | PR body／comments／reviews → parser → formatter → `order.md` | `src/infra/github/pr-images.ts` | task本文置換、attachment manifest、order.md | code fence／inline code／HTML comment除外を確認 | `github-pr-images.test.ts` 16件 | なし | 問題なし |
| `F-PRIMG-REFERENCE-ALLOCATION` | `extractGitHubPrImageReferences()` の採番 | 既存placeholderと同一batch内で番号が衝突しない | 使用済み番号集合を共通の採番元にする必要があるため | 既存placeholder走査 →採番→置換→filename | `existingImageNumbers()`、`nextAvailableImageNumber()` | placeholder、filename、attachment manifest | 同一URL重複と既存番号を確認 | parser／image attachment tests | なし | 問題なし |
| `F-PRIMG-FETCH-SCOPE` | `classifyGitHubAttachmentUrl()` | 現在のPR repository以外のprivate assetを認証取得しない | credential付与前にrepository scopeを確定する必要があるため | PR URL → repository identity → URL分類 → credential判断 | `src/infra/github/pr-images.ts`、`repository.ts` | 許可URLのみdownloadへ伝播 | repository assetとuser attachmentの認証差を確認 | scope tests、GitHub PR tests | 実private GitHub E2E | 問題なし |
| `F-PRIMG-DOWNLOAD-API` | `downloadGitHubPrImages()` | 許可URLが実在取得され、検証済み画像attachmentになる | Web asset URLとAPI endpointを同一視しないため | URL分類 → `fetch()` → Content-Type／magic bytes／size検証 → temp file | `fetchGitHubImage()`、`validateGitHubImagePayload()` | add／routing／pipelineへattachment伝播 | HTTP失敗、形式不一致、サイズ超過を確認 | parser／GitHub PR tests | 実private GitHub E2E | 問題なし |
| `F-PRIMG-TEMP-LIFECYCLE` | `createGitHubPrImageResource()` / `cleanup()` | 成功・失敗・cancel・明示終了後にfileと親directoryが解放される | temp directoryの所有情報をresource handleへ集約するため | download → task保存／workflow実行 → cleanup | `src/infra/github/pr-images.ts`、routing、pipeline | add／routing／pipelineの全終端 | `process.exit()` hook、workflow失敗、routing初期化失敗を確認 | lifecycle heavy test、routing／pipeline tests | SIGKILLは対象外 | 問題なし |
| `F-PRIMG-TEST-WIRING` | test classifier | 実filesystemテストがunit gateに残らずlight ITへ接続される | 実境界に基づくclassifierのsingle source of truthを維持するため | test file → classifier → light IT runner → release verification | `scripts/test-classification.mjs` | `github-pr.test.ts`、`pipelineExecution.test.ts` | unit除外、light IT包含、分類契約を確認 | `releaseVerificationWiring.test.ts` 17件 | なし | 問題なし |

## 今回の指摘（new）

| # | finding_id | family_tag | カテゴリ | 場所 | 問題 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|------------|------------|---------|------|------|---------------------|------------------------------|--------|
| - | - | - | - | - | なし | - | - | - |

## 継続指摘（persists）

| # | finding_id | family_tag | 前回根拠 | 今回根拠 | 問題 | 修正案 |
|---|------------|------------|----------|----------|------|--------|
| - | - | - | - | - | なし | - |

## 解消済み（resolved）

| finding_id | 解消根拠 |
|------------|----------|
| `AI-PRIMG-001` | `downloadGitHubPrImages()` が `fetchGitHubImage()` 経由の実在HTTP取得を使用し、旧 `gh api` 完全URL経路が残っていない |
| `AI-PRIMG-002` | `GitHubPrImageResource` が親directoryを所有し、通常cleanupと `process.exit()` hookでfile／directoryを削除する |
| `AI-PRIMG-003` | Markdown・HTML matchを本文位置でsortし、置換とattachment採番を同じ順序で行う |

## 裁定済みの対象外指摘

| finding_id | 最新の裁定 | 統合先 family | 裁定根拠 |
|------------|------------|---------------|----------|
| `ARCH-PRIMG-001` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | `review-resolution.md`で `AI-PRIMG-002` と同じ親directory cleanup欠陥へ統合 |
| `ARCH-PRIMG-003` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | `process.exit()`時cleanupという同一lifecycle欠陥へ統合 |
| `ARCH-PRIMG-004` | duplicate | `F-PRIMG-REFERENCE-ORDER` | syntax混在時の順序欠陥へ統合 |
| `CODE-NEW-src-infra-github-pr.ts-L464` | duplicate | `F-PRIMG-FETCH-BOUNDARY` | 汎用fetch副作用という同一原因へ統合 |
| `CODE-NEW-src-infra-github-pr-images.ts-L311` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | file／directory cleanup欠陥へ統合 |
| `CODE-NEW-src-infra-github-pr-images.ts-L184` | duplicate | `F-PRIMG-REFERENCE-ORDER` | regex結果の順序統合欠陥へ統合 |
| `PRIMG-07-SYSTEM-FETCH-SIDE-EFFECT` | duplicate | `F-PRIMG-FETCH-BOUNDARY` | system fetchへのtask副作用混入へ統合 |
| `PRIMG-06-PROCESS-EXIT-CLEANUP` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | exit時cleanup欠落へ統合 |
| `PRIMG-06-TEMP-DIRECTORY-CLEANUP` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | 親directory残留へ統合 |
| `PRIMG-05-IMAGE-NUMBER-COLLISION` | duplicate | `F-PRIMG-REFERENCE-ALLOCATION` | placeholder番号衝突へ統合 |
| `SEC-PRIMG-002` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | system経路のcleanup欠落と親directory残留へ統合 |
| `TEST-NEW-PRIMG-01-order` | duplicate | `F-PRIMG-REFERENCE-ORDER` | 混在記法の順序欠陥へ統合 |
| `TEST-NEW-PRIMG-06-cleanup` | duplicate | `F-PRIMG-TEMP-LIFECYCLE` | cleanup欠陥へ統合 |
| `TEST-NEW-PRIMG-02-download-content` | overreach | — | 現行コードの欠陥または元要件違反を示さない追加テスト要求 |

## 再開指摘（reopened）

| # | finding_id | family_tag | 直前の裁定 | 再開根拠（a-d） | 新しい証拠 | 問題 | 修正案 |
|---|------------|------------|------------|----------------|------------|--------|--------|
| - | - | - | - | - | - | なし | - |

## 再走査証跡（2回目以降のレビューで必須）

| 照合した Policy/Knowledge の章 | 差分側の根拠（`file:line` または「該当なし」） |
|-------------------------------|---------------------------------------------|
| 契約置換ポリシー：主操作と終端consumer | `routing-inputs.ts`、`routing.ts`、`steps.ts`、`add/index.ts`、`execute.ts` |
| 契約置換ポリシー：認証取得repository scope | `pr-images.ts` のURL分類とcredential付与前処理 |
| アーキテクチャ知識：複数結果の集約境界 | PR body／comments／reviewsを同一parser規則で処理 |
| アーキテクチャ知識：終了経路の完全性 | `createGitHubPrImageResource()` の通常cleanup／`process.exit()` hook |
| AI Antipattern：幻覚API・配線忘れ | `fetchGitHubImage()`、`prepareGitHubPrTask()`、add／routing／pipeline呼び出し元 |
| AI Antipattern：スコープクリープ・過剰抽象化 | 変更対象17ファイルと既存裁定済みfamily |
| テスト実行ポリシー：実境界分類 | `scripts/test-classification.mjs`、`releaseVerificationWiring.test.ts` |
| テスト知識：test double契約 | add／routing／pipelineのmockと本番task spec経路の確認 |

## REJECT判定条件

有効な `new`、`persists`、または再開根拠付きの `reopened` finding は0件です。

したがって、判定は `APPROVE` です。