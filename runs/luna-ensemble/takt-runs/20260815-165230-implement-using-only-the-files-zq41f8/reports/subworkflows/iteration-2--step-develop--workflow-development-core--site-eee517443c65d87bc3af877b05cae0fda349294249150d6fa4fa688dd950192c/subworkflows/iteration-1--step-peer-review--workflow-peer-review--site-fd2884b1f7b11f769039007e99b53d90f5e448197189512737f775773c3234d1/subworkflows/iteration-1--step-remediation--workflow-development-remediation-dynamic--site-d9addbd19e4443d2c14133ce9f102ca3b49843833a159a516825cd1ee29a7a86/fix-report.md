# 修正レポート

## サマリー

U6の明示終了・routing初期化失敗時のtemp resource cleanup不足と、U7の`github-pr.test.ts`分類漏れを修正した。実プロセス終了、routing初期化失敗、分類契約、unit、light IT、build、lintを再確認し、完了義務を満たした。

## 修正単位

| 修正単位 | 対象 finding | 守る契約 | 実施内容・反映先 | 状態 |
|----------|--------------|------------|-----------------|------|
| U1-PR metadata副作用分離 | `ARCH-PRIMG-002`, `CODE-NEW-src-infra-github-pr.ts-L464`, `PRIMG-07-SYSTEM-FETCH-SIDE-EFFECT`, `SEC-PRIMG-002` | metadata取得責務とtask画像準備責務を分離 | 既存実装と全consumer移行を再確認 | 全完了義務を閉じた場合のみ完了 |
| U2-画像参照出現順整合 | `AI-PRIMG-003`, `ARCH-PRIMG-004`, `CODE-NEW-src-infra-github-pr-images.ts-L184`, `TEST-NEW-PRIMG-01-order` | Markdown/HTML混在時の本文順を維持 | 既存実装とparserテストを再確認 | 全完了義務を閉じた場合のみ完了 |
| U3-画像参照名前空間一意性 | `CODE-NEW-src-infra-github-pr-images.ts-L198`, `PRIMG-05-IMAGE-NUMBER-COLLISION` | 既存番号と新規番号の衝突を防止 | 既存実装とfilename伝播を再確認 | 全完了義務を閉じた場合のみ完了 |
| U4-認証取得repository scope | `SEC-PRIMG-001` | 現PR repositoryの資産だけを認証取得 | 既存scope判定と関連テストを再確認 | 全完了義務を閉じた場合のみ完了 |
| U5-実在画像取得 | `AI-PRIMG-001` | 実HTTP取得・形式検証・保存 | 既存HTTP取得とvalidatorを再確認 | 全完了義務を閉じた場合のみ完了 |
| U6-temp資源終端解放 | `AI-PRIMG-002`, `ARCH-PRIMG-001`, `ARCH-PRIMG-003`, `CODE-NEW-src-infra-github-pr-images.ts-L311`, `PRIMG-06-PROCESS-EXIT-CLEANUP`, `PRIMG-06-TEMP-DIRECTORY-CLEANUP`, `SEC-PRIMG-002` | 成功・失敗・cancel・明示終了時にfileと親directoryを解放 | temp生成直後のresource owner登録、routing全体の`finally` cleanup、明示終了・初期化失敗テストを追加 | 全完了義務を閉じた場合のみ完了 |
| U7-実境界テスト分類 | `PRIMG-08-TEST-CLASSIFICATION` | 実filesystemテストをunitから除外しlight ITで実行 | `github-pr.test.ts`をfilesystem分類へ追加し、分類契約を再実行 | 全完了義務を閉じた場合のみ完了 |

## 不変条件台帳の引き継ぎ

引き継ぎ元: `../../review-resolution.md`（記載: **先行 remediation なし**）

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|----------|-----------|------------------|---------------------|----------------------------|----------------------------|----------|----------|------------------------|-------------------------|-----------|------------|--------------|
| U1-PR metadata副作用分離 | `F-PRIMG-FETCH-BOUNDARY` | PR metadata副作用分離 | `fetchPrReviewComments()` | なし（fix-verifierで記録） | なし | なし | なし（fix-verifierで記録） | 未判定（fix-verifierで初回判定） | 0 | 未確認 | task専用PR準備境界だけが画像処理を開始 | 完全 |
| U2-画像参照出現順整合 | `F-PRIMG-REFERENCE-ORDER` | 画像参照出現順整合 | `extractGitHubPrImageReferences()` / `replaceGitHubPrImageReferences()` | なし（fix-verifierで記録） | なし | なし | なし（fix-verifierで記録） | 未判定（fix-verifierで初回判定） | 0 | 未確認 | 既存parser内でmatch位置を統合 | 完全 |
| U3-画像参照名前空間一意性 | `F-PRIMG-REFERENCE-ALLOCATION` | 画像参照名前空間一意性 | `extractGitHubPrImageReferences()`の採番責務 | なし（fix-verifierで記録） | なし | なし | なし（fix-verifierで記録） | 未判定（fix-verifierで初回判定） | 0 | 未確認 | 使用済み番号集合からの単一採番 | 完全 |
| U4-認証取得repository scope | `F-PRIMG-FETCH-SCOPE` | 認証取得repository scope | `isAllowedGitHubAttachmentUrl()`とPR repository context | なし（fix-verifierで記録） | なし | なし | なし（fix-verifierで記録） | 未判定（fix-verifierで初回判定） | 0 | 未確認 | credential付与直前の単一分類境界 | 完全 |
| U5-実在画像取得 | `F-PRIMG-DOWNLOAD-API` | 許可画像の実在取得 | `downloadGitHubPrImages()` | なし（fix-verifierで記録） | なし | なし | なし（fix-verifierで記録） | 未判定（fix-verifierで初回判定） | 0 | 未確認 | HTTP取得と既存payload validator | 完全 |
| U6-temp資源終端解放 | `F-PRIMG-TEMP-LIFECYCLE` | PR画像一時資源終端解放 | `downloadGitHubPrImages()` / resource cleanup | なし（fix-verifierで記録） | なし | なし | なし（fix-verifierで記録） | 未判定（fix-verifierで初回判定） | 0 | 未確認 | 親directoryを所有するresource handleと同期exit cleanup | 完全 |
| U7-実境界テスト分類 | `F-PRIMG-TEST-WIRING` | 実境界テスト分類 | test classifier | なし（fix-verifierで記録） | なし | なし | なし（fix-verifierで記録） | 未判定（fix-verifierで初回判定） | 0 | 未確認 | filesystem分類のsingle source of truth | 完全 |

## 引き継ぎ不足

- なし

## 完了義務

| 修正単位 | 義務ID | 種別 | 対象 finding | 不変条件と対象経路 | 違反を検出する反例・観測点 | 修正前または差し戻し時の結果 | 実装根拠 | 修正後の証拠 | 状態 |
|----------|--------|------|--------------|--------------------|------------------------------|--------------------------------|----------|--------------|------|
| U6-temp資源終端解放 | U6-01 | 振る舞い修正 | `AI-PRIMG-002`, `ARCH-PRIMG-001`, `CODE-NEW-src-infra-github-pr-images.ts-L311`, `PRIMG-06-TEMP-DIRECTORY-CLEANUP` | 通常cleanupでfileと親directoryを解放 | cleanup後の親directory存在確認 | 通常経路は成立済み | resource handleが親directoryを削除 | 影響テストでcleanupを再確認 | 完了 |
| U6-temp資源終端解放 | U6-02 | 利用側移行 | `SEC-PRIMG-002` | add/routing/pipelineへresourceを伝播 | 各consumerでcleanupされること | 伝播経路は成立済み | resource handleを各task入口へ伝播 | add、routing、pipelineテスト成功 | 完了 |
| U6-temp資源終端解放 | U6-03 | 振る舞い修正 | `ARCH-PRIMG-003`, `PRIMG-06-PROCESS-EXIT-CLEANUP` | download中の明示終了とrouting初期化失敗 | 実child processの`process.exit()`、`resolveBaseBranch()`失敗 | download後にhook登録、初期化失敗が外側cleanup範囲外 | temp生成直後に同期exit hookを登録し、routing全体を`finally`で包含 | heavy lifecycle test成功、routing cleanup test成功 | 完了 |
| U6-temp資源終端解放 | U6-04 | 既存契約保存 | `PRIMG-06-PROCESS-EXIT-CLEANUP` | interactive cleanupとPR resource cleanupを分離 | 二重cleanupの有無と責務境界 | 分離済み | resource cleanupとinteractive cleanupを別責務で保持 | routing影響テスト成功 | 完了 |
| U7-実境界テスト分類 | U7-01 | 振る舞い修正 | `PRIMG-08-TEST-CLASSIFICATION` | `github-pr.test.ts`をunitから除外しlight ITへ接続 | classifier出力と実runner | unit runnerで44件実行されていた | filesystem integration listへ追加 | 対象テスト44件がlight IT、分類契約17件成功 | 完了 |
| U1-PR metadata副作用分離 | U1-01〜U1-05 | 振る舞い修正 / 利用側移行 / 旧経路削除 | U1対象finding | metadata-only fetchとtask入口準備 | raw本文、画像HTTP回数、旧attachments参照 | 既存修正済み | fetchとtask準備境界を分離 | `github-pr.test.ts`、add/routing/pipelineテスト成功 | 完了 |
| U2-画像参照出現順整合 | U2-01〜U2-02 | 振る舞い修正 / 既存契約保存 | U2対象finding | Markdown/HTML混在順序と非render領域保持 | HTML先行、code fence、inline code | 既存修正済み | match位置統合と既存除外処理 | `github-pr-images.test.ts`成功 | 完了 |
| U3-画像参照名前空間一意性 | U3-01〜U3-02 | 振る舞い修正 / 利用側移行 | U3対象finding | 既存番号回避とfilename一致 | `[Image #1]`と同一batch重複URL | 既存修正済み | 使用済み番号集合とplaceholder由来filename | parser・add・pipelineテスト成功 | 完了 |
| U4-認証取得repository scope | U4-01〜U4-02 | 振る舞い修正 | `SEC-PRIMG-001` | 現PR repositoryだけを認証取得 | 別repository、user-attachmentsのAuthorization | 既存修正済み | credential付与前のscope分類 | `github-pr.test.ts`成功 | 完了 |
| U5-実在画像取得 | U5-01〜U5-02 | 振る舞い修正 / 既存契約保存 | `AI-PRIMG-001` | HTTP取得、Content-Type、magic bytes、size検証 | Web URLを`gh api`へ渡す経路、形式不一致 | 既存修正済み | `fetch()`と既存validator | `github-pr.test.ts`、`github-pr-images.test.ts`成功 | 完了 |

## 受入条件

| finding ID | 受入条件 | 証拠 | 状態 |
|------------|----------|------|------|
| `AI-PRIMG-001` | Web画像URLから検証済みattachmentを生成し、`gh api`へ渡さない | 影響テスト、build、lint、unit成功 | 完了 |
| `AI-PRIMG-002` | 成功・失敗・cancel・明示終了後にfileと親directoryを解放 | child process lifecycle test、routing cleanup test | 完了 |
| `AI-PRIMG-003` | Markdown/HTML混在記法を本文出現順で採番・置換 | `github-pr-images.test.ts` | 完了 |
| `ARCH-PRIMG-001` | 親directoryをresource ownerへ統合 | resource cleanup実装と影響テスト | 完了 |
| `ARCH-PRIMG-002` | system consumerは元metadataを受け画像処理を開始しない | metadata-only fetchテスト | 完了 |
| `ARCH-PRIMG-003` | 明示終了経路でもresource cleanupへ到達する | 実`process.exit()` test、routing初期化失敗test | 完了 |
| `CODE-NEW-src-infra-github-pr.ts-L464` | 汎用fetch契約を保持しtask入口へ移行 | metadata、add/routing/pipelineテスト | 完了 |
| `CODE-NEW-src-infra-github-pr-images.ts-L198` | 既存番号と同一batch内で衝突しない | placeholder・filenameテスト | 完了 |
| `CODE-NEW-src-infra-github-pr-images.ts-L184` | syntax横断の本文順を保持する | 混在記法テスト | 完了 |
| `CODE-NEW-src-infra-github-pr-images.ts-L311` | fileと親directoryを全terminalで解放する | lifecycle testとstatic scan | 完了 |
| `PRIMG-05-IMAGE-NUMBER-COLLISION` | 既存placeholderを予約して採番する | parserテスト | 完了 |
| `PRIMG-06-PROCESS-EXIT-CLEANUP` | `process.exit()`によるfinally迂回を解消する | child process・routing test | 完了 |
| `PRIMG-06-TEMP-DIRECTORY-CLEANUP` | temp親directoryをcleanup対象に含める | lifecycle test | 完了 |
| `PRIMG-07-SYSTEM-FETCH-SIDE-EFFECT` | system fetchに画像副作用を持ち込まない | metadata-only test | 完了 |
| `PRIMG-08-TEST-CLASSIFICATION` | `github-pr.test.ts`をlight ITから一意に実行する | 分類契約17件、light IT実行 | 完了 |
| `SEC-PRIMG-001` | 現PR repository以外のprivate assetを認証取得しない | scopeテスト | 完了 |
| `SEC-PRIMG-002` | system経路に不要downloadとtemp残留を持ち込まない | metadata-only、cleanup test | 完了 |
| `TEST-NEW-PRIMG-01-order` | 混在記法の順序回帰を検出する | parserテスト | 完了 |

## 差し戻し後の証拠修正

| 修正単位 | 義務ID | verifier が確認した不足 | 前回の証拠が検出できなかった理由 | 修正した反例・観測点 | 同じ証明手段から再開・再確認した義務 |
|----------|--------|--------------------------|----------------------------------|----------------------|----------------------------------------|
| U6-temp資源終端解放 | U6-03 | download中の明示終了とrouting初期化失敗でcleanupへ到達しない | 未走査経路、未実行の明示終了反例、初期化失敗を通常成功経路で代用していた | temp生成直後のresource owner登録、routing外側`finally`、実child processの`process.exit()`、routing失敗テストを追加 | U6-01、U6-02、U6-03、U6-04 |
| U7-実境界テスト分類 | U7-01 | `github-pr.test.ts`がunit runnerに残っていた | classifierの直接`node:fs`検出だけではproduction経由のfilesystem利用を検出できず、未移行だった | classifierへ対象ファイルを明示接続し、対象テストと分類契約を再実行 | U7-01 |

## 確立済み不変条件への差分走査

| family ID | 不変条件の名前 | 担当箇所 | 状態 | 証拠 | 理由・後続対応 |
|-----------|------------------|----------|------|------|----------------|
| `F-PRIMG-FETCH-BOUNDARY` | PR metadata副作用分離 | `fetchPrReviewComments()` | 維持 | metadata fetch、system consumer、add/routing/pipeline task準備の有界経路を再確認 | なし |
| `F-PRIMG-REFERENCE-ORDER` | 画像参照出現順整合 | `extractGitHubPrImageReferences()` / `replaceGitHubPrImageReferences()` | 維持 | raw body、非render除外、match位置統合、dedupe、置換を再確認 | なし |
| `F-PRIMG-REFERENCE-ALLOCATION` | 画像参照名前空間一意性 | `extractGitHubPrImageReferences()`の採番責務 | 維持 | 既存番号走査、使用済み集合、placeholderとfilenameの一致を再確認 | なし |
| `F-PRIMG-FETCH-SCOPE` | 認証取得repository scope | `isAllowedGitHubAttachmentUrl()`とPR repository context | 維持 | PR repository解析、request分類、credential付与順序を再確認 | なし |
| `F-PRIMG-DOWNLOAD-API` | 許可画像の実在取得 | `downloadGitHubPrImages()` | 維持 | `fetch()`、response検証、temp file生成、旧`gh api`経路のscoped scanを確認 | なし |
| `F-PRIMG-TEMP-LIFECYCLE` | PR画像一時資源終端解放 | `downloadGitHubPrImages()` / resource cleanup | 維持 | temp生成、resource owner登録、add/routing/pipeline、失敗・cancel・明示終了、親directory削除を確認 | なし |
| `F-PRIMG-TEST-WIRING` | 実境界テスト分類 | test classifier | 維持 | `github-pr.test.ts`のlight IT routing、unit gate除外、分類契約、light IT全体を確認 | なし |

## 品質ゲート

| 種別 | 結果 | 証拠 |
|------|------|------|
| ビルド | 成功 | `npm run build` |
| lint | 成功 | `npm run lint` |
| fast unit | 成功 | `npm test`、341ファイル・5335テスト |
| 影響テスト | 成功 | 画像parser/routing 43件、PR metadata/pipeline 97件、addTask 19件 |
| lifecycle heavy test | 成功 | `npm test -- src/__tests__/github-pr-image-lifecycle.integration.test.ts`、1件 |
| 分類契約 | 成功 | `npm test -- src/__tests__/releaseVerificationWiring.test.ts`、17件 |
| light IT | 成功 | `npm run test:it`、133ファイル・2146テスト |
| 差分検査 | 成功 | `git diff --check` |
| 編集後セルフスキャン | 成功 | 旧cleanup、旧`PrReviewData.attachments`、PR画像側の旧`gh api`経路、未使用参照、依存方向をscoped scan |

## 未完了義務

- なし。実private GitHub repositoryを使う認証付きE2Eは資格情報未提供のため未実施だが、計画上の非ブロッキングな後続確認であり、決定的なtransport・scope・保存・cleanup検証は完了している。