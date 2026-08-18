# 修正レポート

## サマリー

U2・U6の修正計画を完了しました。

- U2では、formatterと画像抽出が同じレビュー節順を利用するよう共通化しました。
- U2では、Markdown→HTMLおよびHTML→Markdownの混在順、formatter本文、添付一覧、既存placeholder衝突を検証しました。
- U6では、本番cleanup実装を変更せず、PR画像付きpipelineのfalse／例外終端で一時画像・親directory・task specが解放されることを実filesystemで検証しました。
- 指定された全品質ゲートに成功しています。

## 修正単位

| 修正単位 | 対象 finding | 守る契約 | 実施内容・反映先 | 状態 |
|----------|--------------|------------|-----------------|------|
| U2-画像参照出現順整合 | `PRIMG-09-FORMATTED-ORDER`, `TEST-FOLLOWUP-PRIMG-01-order`, `ARCH-PRIMG-004`, `CODE-NEW-src-infra-github-pr-images.ts-L184`, `TEST-NEW-PRIMG-01-order` | `F-PRIMG-REFERENCE-ORDER`。`formatPrReviewAsTask()`のレビュー節順を単一の責務・参照元として、画像placeholder、filename、本文、添付一覧の順序を一致させる | `src/infra/git/format.ts`にレビュー節分類・順序の共通定義を追加し、`src/infra/github/pr-images.ts`が利用するよう移行。Markdown/HTML双方向、formatter本文、添付一覧、既存番号衝突のテストを追加 | 全完了義務を閉じた場合のみ完了 |
| U6-temp資源終端解放 | `TEST-FOLLOWUP-PRIMG-06-pipeline-failure-cleanup`, `ARCH-PRIMG-001`, `ARCH-PRIMG-003`, `CODE-NEW-src-infra-github-pr-images.ts-L311`, `PRIMG-06-PROCESS-EXIT-CLEANUP`, `PRIMG-06-TEMP-DIRECTORY-CLEANUP`, `SEC-PRIMG-002`, `TEST-NEW-PRIMG-06-cleanup` | `F-PRIMG-TEMP-LIFECYCLE`。既存resource handleと`runPipeline()`のnested `finally`により、全pipeline terminalで一時資源を解放する | 本番コードは変更せず、`pipelineExecution.test.ts`にfalse／例外終端の実filesystemテストを追加。cleanup回数、画像file、画像親directory、task spec、`.takt/tasks`を確認 | 全完了義務を閉じた場合のみ完了 |

## 不変条件台帳の引き継ぎ

引き継ぎ元: `../../review-resolution.md`。同一remediation内に先行する公開済み`fix-verification.md`はなく、同ファイルに記録された引き継ぎ元は`subworkflows/iteration-1--step-remediation--workflow-development-remediation-dynamic--site-d9addbd19e4443d2c14133ce9f102ca3b49843833a159a516825cd1ee29a7a86/fix-verification.md`。

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|----------|-----------|------------------|---------------------|----------------------------|----------------------------|----------|----------|------------------------|-------------------------|-----------|------------|--------------|
| U1-PR metadata副作用分離 | `F-PRIMG-FETCH-BOUNDARY` | PR metadata副作用分離 | `fetchPrReviewComments()` | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | task専用PR準備境界 | 完全 |
| U2-画像参照出現順整合 | `F-PRIMG-REFERENCE-ORDER` | 画像参照出現順整合 | `extractGitHubPrImageReferences()` / `replaceGitHubPrImageReferences()` | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | parser内のmatch位置統合 | 完全 |
| U3-画像参照名前空間一意性 | `F-PRIMG-REFERENCE-ALLOCATION` | 画像参照名前空間一意性 | `extractGitHubPrImageReferences()`の採番責務 | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | 使用済み番号集合による単一採番 | 完全 |
| U4-認証取得repository scope | `F-PRIMG-FETCH-SCOPE` | 認証取得repository scope | `isAllowedGitHubAttachmentUrl()`とPR repository context | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | credential付与直前の単一分類境界 | 完全 |
| U5-実在画像取得 | `F-PRIMG-DOWNLOAD-API` | 許可画像の実在取得 | `downloadGitHubPrImages()` | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | HTTP取得と既存payload validator | 完全 |
| U6-temp資源終端解放 | `F-PRIMG-TEMP-LIFECYCLE` | PR画像一時資源終端解放 | `downloadGitHubPrImages()` / resource cleanup | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | 親directoryを所有するresource handleと同期exit cleanup | 完全 |
| U7-実境界テスト分類 | `F-PRIMG-TEST-WIRING` | 実境界テスト分類 | test classifier | なし（据え置き） | なし | なし | なし | 判定できない（初回） | 0 | 未確認 | filesystem分類のsingle source of truth | 完全 |

## 引き継ぎ不足

- なし。

## 完了義務

| 修正単位 | 義務ID | 種別 | 対象 finding | 不変条件と対象経路 | 違反を検出する反例・観測点 | 修正前または差し戻し時の結果 | 実装根拠 | 修正後の証拠 | 状態 |
|----------|--------|------|--------------|--------------------|------------------------------|--------------------------------|----------|--------------|------|
| U2-画像参照出現順整合 | U2-ORDER-BOUNDARY | 振る舞い修正 | `PRIMG-09-FORMATTED-ORDER`, `ARCH-PRIMG-004`, `CODE-NEW-src-infra-github-pr-images.ts-L184` | PR body → review summary → active/outdated/resolved review → legacy review → conversation commentの順序を、formatterと画像抽出で共有する経路 | review画像とconversation画像が混在し、placeholder順とformatter本文順が異なる入力 | formatterはreviewを先に表示する一方、画像抽出はcommentsを先に走査していた | `getPrReviewSections()`と`getPrReviewBodiesInTaskOrder()`を`src/infra/git/format.ts`に追加 | `github-pr-images.test.ts`でreview画像がconversation画像より先に採番されることを確認 | 完了 |
| U2-画像参照出現順整合 | U2-ORDER-CONSUMER | 利用側移行 | `PRIMG-09-FORMATTED-ORDER` | `extractGitHubPrImageReferences()`、既存placeholder検出、本文置換が共通順序を利用する経路 | `reviewBodies()`が独自のcomments先行順序を保持している場合の検索 | 旧`reviewBodies()`がcomments→reviews順で走査していた | `pr-images.ts`から旧helperを削除し、共通helperを直接import | `rg`で旧helperの残存がなく、targeted test・build・lintが成功 | 完了 |
| U2-画像参照出現順整合 | U2-ORDER-LEGACY-REMOVAL | 旧経路削除 | `TEST-NEW-PRIMG-01-order` | 旧順序を補うfallbackや別名経路を追加せず、単一の順序定義へ移行する経路 | 共通helperとは別のreview走査順やfallbackが残る場合の静的検索 | formatterと画像抽出に順序定義が二重化していた | 旧comments先行走査を削除し、formatterの分類順を単一参照元にした | 変更差分・`rg`・TypeScript type contractで未移行consumerがないことを確認 | 完了 |
| U2-画像参照出現順整合 | U2-ORDER-BIDIRECTIONAL | 振る舞い修正 | `TEST-FOLLOWUP-PRIMG-01-order`, `TEST-NEW-PRIMG-01-order` | Markdown→HTML、HTML→Markdownの両方向で抽出順、placeholder、置換後本文が一致する経路 | 混在記法の出現順を反転した2ケース | 既存テストはHTML→Markdown方向のみで、反対方向の退行を検出できなかった | `github-pr-images.test.ts`にMarkdown先行ケースを追加 | 画像テスト18件が成功し、両方向のplaceholder置換を確認 | 完了 |
| U2-画像参照出現順整合 | U2-ORDER-FINAL-MANIFEST | 既存契約保存 | `PRIMG-09-FORMATTED-ORDER` | formatter本文、`buildTaskOrderContent()`の添付一覧、`image-N` filenameが同じreference順を保持する経路 | review画像とcomment画像をformatter、order生成まで通した最終本文・一覧の順序確認 | 最終formatter consumerと添付一覧を同時に観測するテストが不足していた | formatter出力を置換済みPR本文へ適用し、添付一覧を同じreferencesから生成するテストを追加 | review／comment本文、`image-1.png`／`image-2.png`、添付placeholderの順序を確認 | 完了 |
| U2-画像参照出現順整合 | U2-ORDER-PRESERVE | 既存契約保存 | `ARCH-PRIMG-004`, `CODE-NEW-src-infra-github-pr-images.ts-L184` | 同一本文内のMarkdown/HTML match位置順、コード文脈除外、既存placeholder回避を維持する経路 | Markdown/HTML混在、inline/fenced code、既存`[Image #1]`を含む入力 | match位置統合と既存番号回避は既存実装で成立していた | parser刷新や番号採番変更を行わず、順序sourceだけを移行 | 画像テスト、formatterテスト、全unit gateが成功 | 完了 |
| U6-temp資源終端解放 | U6-CLEANUP-FALSE | 振る舞い修正 | `TEST-FOLLOWUP-PRIMG-06-pipeline-failure-cleanup` | PR画像付きpipeline → task spec生成 → workflow false → task spec cleanup → image resource cleanup | workflowが`false`を返し、終了コード3になるケースで全filesystem残存物を確認 | PR画像付きpipelineの成功経路は確認済みだったが、false terminalは未訪問だった | `pipelineExecution.test.ts`にfalse terminalを追加 | 終了コード3、cleanup 1回、画像file・親directory・task spec・`.takt/tasks`消滅を確認 | 完了 |
| U6-temp資源終端解放 | U6-CLEANUP-EXCEPTION | 振る舞い修正 | `TEST-FOLLOWUP-PRIMG-06-pipeline-failure-cleanup` | PR画像付きpipeline → task spec生成 → workflow例外 → nested `finally` → task spec/resource cleanup | workflow mockが元例外をthrowするケースで、例外伝播とfilesystem cleanupを確認 | 一般workflow例外経路は存在したが、PR画像resourceを伴う例外経路は未訪問だった | `pipelineExecution.test.ts`に例外 terminalを追加 | 元例外の伝播、cleanup 1回、画像file・親directory・task spec・`.takt/tasks`消滅を確認 | 完了 |
| U6-temp資源終端解放 | U6-CLEANUP-ONCE | 振る舞い修正 | `ARCH-PRIMG-001`, `ARCH-PRIMG-003`, `CODE-NEW-src-infra-github-pr-images.ts-L311`, `PRIMG-06-PROCESS-EXIT-CLEANUP`, `PRIMG-06-TEMP-DIRECTORY-CLEANUP`, `SEC-PRIMG-002`, `TEST-NEW-PRIMG-06-cleanup` | resource handleが親directoryを所有し、pipeline terminalで一度だけcleanupする経路 | cleanup spyの呼び出し回数と親directoryの消滅を同時に確認 | cleanup所有境界とprocess exit cleanupは実装済みだが、pipeline失敗terminalからの呼び出し証拠が不足していた | 本番resource handleとnested `finally`は維持し、失敗terminalの実filesystem観測を追加 | false／例外の両方でcleanup 1回、画像親directory消滅を確認 | 完了 |
| U6-temp資源終端解放 | U6-CLEANUP-PRESERVE | 既存契約保存 | `ARCH-PRIMG-001`, `ARCH-PRIMG-003`, `PRIMG-06-PROCESS-EXIT-CLEANUP` | 成功、add cancel、routing失敗、process exitの既存cleanup経路を変更せず保持する経路 | 既存成功・routing・exitテストと、今回追加したfalse／例外テストの全体確認 | 既存の成功、routing失敗、process exit契約は成立済み | 本番cleanup実装を変更せず、pipeline failure terminalのテストだけを追加 | build、lint、unit、light IT、mock E2E、smoke E2Eが成功 | 完了 |

## 受入条件

| finding ID | 受入条件 | 証拠 | 状態 |
|------------|----------|------|------|
| `PRIMG-09-FORMATTED-ORDER` | formatterの既存review節順を維持し、placeholder・filename・本文・添付一覧の表示順を一致させる | `format.ts`の共通section定義、`github-pr-images.test.ts`のformatter本文・添付一覧テスト、`git-format.test.ts` 25件成功 | 完了 |
| `TEST-FOLLOWUP-PRIMG-01-order` | Markdown→HTMLとHTML→Markdownの双方で抽出順・placeholder・置換後本文を検証する | `github-pr-images.test.ts` 18件成功 | 完了 |
| `ARCH-PRIMG-004` | 同一本文内のMarkdown/HTML match位置順統合を維持する | 双方向混在テスト、既存コード文脈除外テスト、全unit gate成功 | 完了 |
| `CODE-NEW-src-infra-github-pr-images.ts-L184` | syntax別抽出結果をmatch位置順へ統合し、旧別経路を残さない | `pr-images.ts`の共通順序利用、旧`reviewBodies`不在検索、build成功 | 完了 |
| `TEST-NEW-PRIMG-01-order` | 既存HTML→Markdownケースを保持し、Markdown→HTMLケースを追加する | 画像テスト全体成功 | 完了 |
| `TEST-FOLLOWUP-PRIMG-06-pipeline-failure-cleanup` | PR画像付きpipelineのfalse／例外で全temporary resourceを解放する | `pipelineExecution.test.ts`の実filesystem検証、55件成功 | 完了 |
| `ARCH-PRIMG-001` | file単位ではなく画像親directory全体をcleanupする | false／例外テストで親directory消滅を確認 | 完了 |
| `ARCH-PRIMG-003` | process exit cleanup契約を変更せず保持する | lifecycle関連既存テスト、全unit・IT・E2E成功 | 完了 |
| `CODE-NEW-src-infra-github-pr-images.ts-L311` | downloader、resource handle、pipeline所有権を維持する | 本番コード無変更、pipeline terminalテスト成功 | 完了 |
| `PRIMG-06-PROCESS-EXIT-CLEANUP` | exit listenerを変更せず、pipeline terminal検証だけを追加する | `pr-images.ts`のexit cleanup無変更、全品質ゲート成功 | 完了 |
| `PRIMG-06-TEMP-DIRECTORY-CLEANUP` | false／例外で親directoryも消滅する | 実filesystem assertion成功 | 完了 |
| `SEC-PRIMG-002` | 一般temp janitorや認証・取得scopeを変更せずresource lifecycleを閉じる | U6対象範囲のみ変更、画像関連テスト・全品質ゲート成功 | 完了 |
| `TEST-NEW-PRIMG-06-cleanup` | 既存テストを重複追加せず、未訪問のfalse／例外terminalだけを追加する | `pipelineExecution.test.ts`の追加ケースと全体成功 | 完了 |

## 差し戻し後の証拠修正

| 修正単位 | 義務ID | verifier が確認した不足 | 前回の証拠が検出できなかった理由 | 修正した反例・観測点 | 同じ証明手段から再開・再確認した義務 |
|----------|--------|--------------------------|----------------------------------|----------------------|----------------------------------------|
| U2-画像参照出現順整合 | U2-ORDER-BOUNDARY, U2-ORDER-CONSUMER, U2-ORDER-FINAL-MANIFEST | parser内の順序確認だけではformatter最終表示順との不一致を検出できなかった | formatterがreview節を分類して表示する一方、画像抽出がcomments先行で独立走査していた | formatterのsection分類を単一定義化し、review／conversation commentを含む最終task本文と添付一覧を同時観測 | U2-ORDER-BOUNDARY, U2-ORDER-CONSUMER, U2-ORDER-FINAL-MANIFEST |
| U2-画像参照出現順整合 | U2-ORDER-BIDIRECTIONAL, U2-ORDER-PRESERVE | HTML→Markdown方向のみで、Markdown→HTMLの退行を検出できなかった | 既存の混在syntaxテストが一方向だけだった | Markdown先行・HTML後続の抽出順、placeholder、本文置換を追加確認 | U2-ORDER-BIDIRECTIONAL, U2-ORDER-PRESERVE |
| U6-temp資源終端解放 | U6-CLEANUP-FALSE, U6-CLEANUP-EXCEPTION, U6-CLEANUP-ONCE | PR画像付きpipelineの失敗terminalを直接観測していなかった | 成功、routing失敗、process exit、および一般workflow失敗は確認済みだったが、PR画像resourceとの共存条件が未訪問だった | PR画像付きpipelineでworkflow false／例外を実行し、終了結果、例外伝播、cleanup回数、実filesystem残存物を確認 | U6-CLEANUP-FALSE, U6-CLEANUP-EXCEPTION, U6-CLEANUP-ONCE, U6-CLEANUP-PRESERVE |

## 確立済み不変条件への差分走査

| family ID | 不変条件の名前 | 担当箇所 | 状態 | 証拠 | 理由・後続対応 |
|-----------|------------------|----------|------|------|----------------|
| `F-PRIMG-FETCH-BOUNDARY` | PR metadata副作用分離 | `fetchPrReviewComments()` | 維持 | 今回の編集はmetadata取得経路を変更していない。全unit gate・light IT・mock E2Eが成功 | なし |
| `F-PRIMG-REFERENCE-ORDER` | 画像参照出現順整合 | `extractGitHubPrImageReferences()` / `replaceGitHubPrImageReferences()` | 維持 | formatterの分類順、画像抽出、本文置換、添付一覧を有界経路として走査。双方向混在・review/comment最終本文・添付一覧テストが成功 | なし |
| `F-PRIMG-REFERENCE-ALLOCATION` | 画像参照名前空間一意性 | `extractGitHubPrImageReferences()`の採番責務 | 維持 | 共通順序sourceのみを変更し、`existingImageNumbers()`と`nextAvailableImageNumber()`は保持。既存`[Image #1]`衝突テストが成功 | なし |
| `F-PRIMG-FETCH-SCOPE` | 認証取得repository scope | `isAllowedGitHubAttachmentUrl()`とPR repository context | 維持 | URL分類・repository scope・認証境界は変更せず、GitHub画像テストと全品質ゲートが成功 | なし |
| `F-PRIMG-DOWNLOAD-API` | 許可画像の実在取得 | `downloadGitHubPrImages()` | 維持 | downloader、Content-Type、magic bytes、サイズ検証は変更せず、画像テスト18件と全品質ゲートが成功 | なし |
| `F-PRIMG-TEMP-LIFECYCLE` | PR画像一時資源終端解放 | `downloadGitHubPrImages()` / resource cleanup | 維持 | 成功・false・例外pipeline経路を走査し、cleanup 1回、画像file・親directory・task spec・`.takt/tasks`消滅を確認。既存exit cleanupも保持 | なし |
| `F-PRIMG-TEST-WIRING` | 実境界テスト分類 | test classifier | 維持 | `releaseVerificationWiring.test.ts` 17件、light IT 133 files／2148件、mock E2E 16 filesが成功 | なし |

## 品質ゲート

| 種別 | 結果 | 証拠 |
|------|------|------|
| ビルド | 成功 | `npm run build` |
| lint | 成功 | `npm run lint` |
| 対象画像テスト | 成功 | `npm test -- src/__tests__/github-pr-images.test.ts`、18件 |
| 対象formatterテスト | 成功 | `npm test -- src/__tests__/git-format.test.ts`、25件 |
| 対象pipelineテスト | 成功 | `npm test -- src/__tests__/pipelineExecution.test.ts`、55件 |
| 分類契約 | 成功 | `npm test -- src/__tests__/releaseVerificationWiring.test.ts`、17件 |
| Fast Unit Gate | 成功 | `npm test`、86 files、5337 tests |
| 軽量IT | 成功 | `HOME=/tmp/takt-bench-v3-home npm run test:it`、133 files、2148 tests |
| Mock E2E | 成功 | `npm run test:e2e:mock`、48 passed、13 skipped |
| Smoke E2E | 成功 | `npm run test:e2e:smoke`、21 passed、1 skipped |
| 差分整合 | 成功 | `git diff --check`、エラーなし |
| 編集後セルフスキャン | 成功 | 旧`reviewBodies`、未使用参照、別順序経路を検索し、共通helperと利用側だけが残存 |

## 未完了義務

- なし。