# 修正レポート

## サマリー

最新の完了検証で未完了となった、段落内のinline `<pre>`にある画像が添付対象になる問題を修正した。

- mdastがHTML開始タグ・画像・終了タグを兄弟ノードへ分割しても、Markdown断片全体でHTML状態を解析するよう変更した。
- `<pre>`内のHTML画像、Markdown画像、Markdown参照画像を添付対象から除外する。
- `<pre>`直後の通常画像は従来どおりダウンロード・置換する。
- inline `<pre>`とnested inline `<pre>`の反例テストを追加した。修正前は2件とも失敗し、修正後は既存テストを含む36件が成功した。
- 断片分離、出現順、URL重複排除、採番、cleanup、3入口移行、既存formatter契約、filesystem保存を再確認した。
- `e2e-runner-attempt-boundary`も対象heavy ITと分類契約を再実行し、完了状態を確認した。

## 修正単位

| 修正単位 | 対象 finding | 契約の正本 | 実施内容・反映先 | 状態 |
|----------|--------------|------------|-----------------|------|
| `pr-review-markdown-fragment-isolation` | `CODE-NEW-pr-review-fragment-isolation-L92`、`ai-antipattern-review-companion-2` | `order.md`のPR本文・通常コメント・review thread画像要件、および確定修正計画のコードリテラル除外契約 | `src/features/tasks/prReviewAttachments.ts`でMarkdown断片全体のHTML構造を解析し、`pre`範囲内のHTML・Markdown画像を除外。`src/__tests__/prReviewAttachments.test.ts`へinline反例を追加 | 完了 |
| `e2e-runner-attempt-boundary` | `TEST-NEW-e2e-runner-attempt-boundary-L31` | 確定修正計画の実process境界、隔離環境、cleanup、再測定、分類契約 | 実装変更なし。対象heavy IT、runner unit、分類契約、mock E2Eを再実行 | 完了 |

## 完了義務

| 修正単位 | 義務ID | 種別 | 対象 finding | 不変条件と対象経路 | 違反を検出する反例・観測点 | 修正前または差し戻し時の結果 | 実装根拠 | 修正後の証拠 | 状態 |
|----------|--------|------|--------------|--------------------|------------------------------|--------------------------------|----------|--------------|------|
| `pr-review-markdown-fragment-isolation` | `PR-FRAGMENT-01` | 振る舞い修正 | `CODE-NEW-pr-review-fragment-isolation-L92` | PR本文と各コメント本文を独立したMarkdown文書として解析する | 未閉鎖PR本文後のsummary、thread、conversation画像 | 連結解析では後続画像が欠落していた | `formatPrReviewTask()`の断片範囲と断片単位解析を維持 | 対象unitとdataflow IT成功 | 完了 |
| 同上 | `PR-ORDER-02` | 既存契約保存 | 同上 | summary、active、outdated、resolved、legacy、conversationの出力・添付順を維持する | 全分類に異なるURLを配置し、placeholderとdownload順を比較 | 全体parser状態に後続カテゴリが依存していた | task全体の参照列をsource offset順に処理 | カテゴリ横断assertion成功 | 完了 |
| 同上 | `PR-LITERAL-03` | 振る舞い修正 | 同上、`ai-antipattern-review-companion-2` | fenced code、inline code、HTML comment、`pre`内を画像扱いしない | `Prefix <pre><img ...></pre>`とnested inline `<pre>`内Markdown画像の直後に通常画像を配置 | inline `<pre>`内画像がダウンロードされ、直後の画像が`Image #2`になっていた | mdastのHTMLノードだけを元offsetで再構成し、断片全体をparse5で解析。取得した`pre`範囲でHTML・Markdown画像を除外 | 修正前2件失敗、修正後は対象36件成功。Companionは`resolved` | 完了 |
| 同上 | `PR-DEDUPE-04` | 既存契約保存 | `CODE-NEW-pr-review-fragment-isolation-L92` | 全断片でURL重複排除を共有する | 異なる断片に同一URLを配置 | 断片単位状態では重複保存し得た | task全体の`placeholderByUrl`を維持 | download 1回、同一placeholderを確認 | 完了 |
| 同上 | `PR-INDEX-05` | 既存契約保存 | 同上 | 予約済み画像番号と採番状態をtask全体で共有する | 既存placeholder、attachment path、巨大識別子と新規画像 | 断片単位採番では衝突し得た | task全体のindex assignerを維持 | 採番境界テスト成功 | 完了 |
| 同上 | `PR-CLEANUP-06` | 既存契約保存 | 同上 | download・保存失敗時に一時storeをcleanupする | 途中download失敗とcleanup失敗 | parser境界変更後もcleanup契約の再確認が必要だった | 共通store所有者のcatchとcleanupを維持 | cleanup呼出しと元download error保持を確認 | 完了 |
| 同上 | `PR-MIGRATE-07` | 利用側移行 | 同上 | add、対話CLI、pipelineが構造化formatterを使用する | 3入口のformatter入力とattachment伝播 | 旧実装は完成task文字列を直接解析していた | 3入口とも`formatPrReviewTask()`を使用 | add、CLI、pipeline対象テスト成功 | 完了 |
| 同上 | `PR-OLDPATH-08` | 旧経路削除 | 同上 | 完成task文字列を直接attachment parserへ渡さない | formatterとattachment準備関数の本番参照検索 | 旧3入口が連結文字列を渡していた | 本番3入口を`FormattedPrReviewTask`へ統一 | 旧直接解析呼び出しなし | 完了 |
| 同上 | `PR-PUBLIC-09` | 既存契約保存 | 同上 | `formatPrReviewAsTask(): string`の既存整形結果を維持する | metadata付きconversation commentの完全一致 | 一時的に従来存在しないFile／URL行が追加されていた | 公開formatterは共通builderへの委譲を維持 | formatter対象テスト成功 | 完了 |
| 同上 | `PR-DATAFLOW-10` | 利用側移行 | 同上 | task attachmentとrun contextへ画像参照を伝播する | 未閉鎖本文後の画像を実filesystemへ保存・staging | parser unitだけでは保存経路を証明できなかった | task保存と`prepareTaskSpecDirectory()`の実経路を維持 | light IT成功 | 完了 |
| `e2e-runner-attempt-boundary` | `E2E-ENV-01`～`E2E-CLASSIFY-07` | 既存契約保存 | `TEST-NEW-e2e-runner-attempt-boundary-L31` | attempt分離、env伝播、正常・spawn失敗cleanup、再測定、分類契約 | 実child process、ENOENT、birpc再測定、空shard | 最新検証で全反例が成立済み | 共通attempt executorとheavy ITを維持 | 対象heavy IT／分類契約43件、mock E2E成功 | 完了 |

## 受入条件

| finding ID | 受入条件 | 証拠 | 状態 |
|------------|----------|------|------|
| `CODE-NEW-pr-review-fragment-isolation-L92` | 未閉鎖PR本文後の各コメント画像を検出・保存・置換し、コードリテラル除外、重複排除、順序、採番、cleanup、3入口を維持する | 対象unit 154件、light IT 1件、全unit・light IT gate成功 | 完了 |
| `TEST-NEW-e2e-runner-attempt-boundary-L31` | 実childでcwd・隔離env、attempt分離、正常・spawn失敗cleanup、初回・再測定共通契約を確認する | 対象heavy IT／分類契約43件成功、mock E2E終了コード0 | 完了 |
| `ai-antipattern-review-companion-2` | inline `<pre>`の開始・終了状態をMarkdown断片全体で追跡する | inline HTML画像・nested inline Markdown画像の反例成功、Companion `resolved` | 完了 |
| `ai-antipattern-review-companion-1` | `formatPrReviewAsTask()`が置換対象の旧契約なら削除する | 確定修正計画は同APIの既存公開文字列契約維持を明示し、Companionも`wontfix_accepted` | 異議 |

## 差し戻し後の証拠修正

| 修正単位 | 義務ID | verifier が確認した不足 | 前回の証拠が検出できなかった理由 | 修正した反例・観測点 | 同じ証明手段から再開・再確認した義務 |
|----------|--------|--------------------------|----------------------------------|----------------------|----------------------------------------|
| `pr-review-markdown-fragment-isolation` | `PR-LITERAL-03` | 段落内inline `<pre>`では開始タグ・画像・終了タグが別mdastノードになり、HTML画像とMarkdown画像がダウンロード対象になる | 未実行の反例。行頭block `<pre>`では全体が単一HTMLノードとなり、ノード間状態欠落を検出できなかった | inline `<pre>`内HTML画像と、`span`配下inline `<pre>`内Markdown画像を、それぞれ直後の通常画像と対にしてdownload引数・本文・採番を検証 | `PR-FRAGMENT-01`、`PR-ORDER-02`、`PR-LITERAL-03`、`PR-DEDUPE-04`、`PR-INDEX-05`、`PR-CLEANUP-06`、`PR-MIGRATE-07`、`PR-OLDPATH-08`、`PR-PUBLIC-09`、`PR-DATAFLOW-10`。計画全体として`E2E-ENV-01`～`E2E-CLASSIFY-07`も再確認 |

## 品質ゲート

| 種別 | 結果 | 証拠 |
|------|------|------|
| 反例テスト | 成功 | 修正前はinline `<pre>`の2件が失敗。修正後`npm test -- src/__tests__/prReviewAttachments.test.ts`で36件成功 |
| 対象テスト | 成功 | unit 154件、light IT 1件、heavy IT／分類契約43件成功 |
| ビルド | 成功 | `npm run build`、終了コード0 |
| lint | 成功 | `npm run lint`、終了コード0 |
| fast unit gate | 成功 | `npm test`、4 shard・合計6,072件成功 |
| light IT gate | 成功 | `npm run test:it`、159 files・2,358件成功 |
| mock E2E | 成功 | `npm run test:e2e:mock`。shard 2のbirpc noiseを再測定し、終了コード0 |
| 差分セルフスキャン | 成功 | 未使用参照、依存方向、共通責務重複、3入口配線、空白エラーを確認。`git diff --check`成功 |
| Companion最終確認 | 成功 | inline `<pre>`指摘は`resolved`、公開formatter指摘は`wontfix_accepted` |

## 未完了義務

- なし。