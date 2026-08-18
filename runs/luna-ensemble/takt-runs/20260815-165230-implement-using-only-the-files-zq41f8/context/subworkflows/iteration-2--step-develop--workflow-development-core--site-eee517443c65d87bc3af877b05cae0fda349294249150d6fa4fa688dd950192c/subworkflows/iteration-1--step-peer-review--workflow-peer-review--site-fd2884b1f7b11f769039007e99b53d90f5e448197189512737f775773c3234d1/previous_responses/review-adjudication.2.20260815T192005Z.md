## coding-review
問題の変更契約を、指定された `order.md`・完全な Policy/Knowledge・Report Directory の既存裁定と、base からの累積差分および対象17ファイルの実コードで照合します。編集は行わず、既出 family の再発扱いと新規指摘を分離して判定します。
既存裁定では7 family（取得API、参照順、番号名前空間、metadata境界、temp lifecycle、取得スコープ、テスト分類）が actionable とされ、修正検証は全件 `verified` と報告されています。ここからは follow-up 権限に従い、その7 familyの現行コード上の未移行・旧経路・片側更新・修正退行だけを再確認します。
現行コードの7 family経路を再読した結果、metadata-only fetch、画像準備の3入口、参照採番・置換、repository scope、temp cleanup、classifier接続はいずれも実装上つながっています。判定を確定するため、変更された主要境界の対象テストを現行作業ツリーで再実行し、必要なら再現 probe で退行を確認します。
追加の決定的 probe で、同じ `F-PRIMG-REFERENCE-ORDER` family 内に未確認の consumer 不整合を確認しました。通常コメントの画像を `Image #1`、review summary/thread の画像を `Image #2` と採番しますが、最終 `formatPrReviewAsTask()` は review を先に出すため、task本文が `#2` → `#1`、`order.md` が `#1` → `#2` になります。これは既存 family の同じ不変条件に対する新規条件として、修正要否を確定します。
## REJECT（差し戻し）

### `PRIMG-09-FORMATTED-ORDER`（Medium）

- Family: `F-PRIMG-REFERENCE-ORDER`
- 場所: [pr-images.ts:49](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:49)、[format.ts:242](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/git/format.ts:242)、[format.ts:248](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/git/format.ts:248)
- 問題: 画像採番は `body → comments → reviews` 順ですが、最終 task 本文は `body → reviews → comments` 順に出力されます。
- 影響: 通常コメントの画像が `[Image #1]`、review の画像が `[Image #2]` でも、task 本文では `#2` が `#1` より先に現れ、本文・添付一覧の出現順が不一致になります。
- 修正方針: 抽出側と `formatPrReviewAsTask()` が同一の表示順を共有し、採番・本文置換・添付一覧を同じ順序から生成してください。

Authorization basis は `accepted_family_unvisited_consumer` です。混在記法の単一本文は検証済みですが、最終 formatter まで含む複数コメント種別の順序は未確認でした。

対象テストは成功しましたが、この順序不整合を検出するケースはありません。

---

## ai-antipattern-review
対象17ファイルと、指定された Knowledge／Policy、最新のレビュー履歴を一次資料として再確認し、既存 family の裁定に照合したうえで AI 特有の問題だけを報告します。今回はレビューのみで、ファイルは変更しません。まず Policy と Knowledge の全文、および Report Directory の履歴を読みます。
タスク仕様では、PR本文・通常コメント・レビュー本文／スレッドから画像URLを抽出し、認証付き取得・形式／magic bytes／サイズ検証を経て task attachment と pipeline 経路へ到達させることが契約です。続いて、指定された1,654行の Knowledge と826行の Policy を分割してEOFまで確認します。
Policy の全文確認が完了しました。今回の follow-up review では、accepted family の未確認 consumer／必須移行／修正退行、または元受入条件への直接違反だけが新規 finding の根拠になります。次に、Report Directory の実在ファイルを特定し、最新 `review-resolution.md` とレビュー履歴の裁定を確認します。
最新裁定では7 familyが actionable とされ、修正検証報告は全件 verified と主張しています。ただし follow-up の判定は報告を信用せず、現在のコードで accepted family の全 `participates` 経路、旧経路、片側更新、修正退行を再確認する必要があります。ここから変更対象17ファイルを読み、特に U1〜U7 の実配線を検証します。
実配線の確認で、PR metadata取得は `fetchPrReviewComments()` に戻され、画像処理は `prepareGitHubPrTask()` から add／routing／pipeline へ分岐しています。画像資源は resource handle で親ディレクトリを所有し、通常 cleanup と `process.exit` hook の両方を持っています。次は、変更テストが本番契約を実際に通しているか、また修正後に別の AI 特有の配線漏れや見かけ上の修正が残っていないかを確認します。
対象テストでは、画像 parser の16件と実 child process を使う lifecycle の1件が現行コードで成功しました。これは既存 finding の解消証拠の一部であり、承認根拠には単独では使いません。引き続き add／routing／pipeline の実際の終端と、分類契約を確認します。
判定: APPROVE

AI 特有の新規・継続・再開 finding はありません。

確認結果:

- U1〜U5: metadata境界、画像順序・採番、repository scope、実取得を確認
- U6: 成功・失敗・キャンセル・`process.exit()` 後の一時ファイル／親ディレクトリ解放を確認
- U7: filesystem利用テストが light IT に分類されることを確認
- `system` 経路は画像副作用なしで保持され、add／routing／pipeline 経路へ正しく配線済み
- GitLab／direct task 経路は既裁定どおり対象外

実行確認:

- 画像 parser: 16件成功
- lifecycle: 1件成功
- add: 19件成功
- routing: 27件成功
- pipeline: 53件成功
- GitHub PR: 44件成功
- 分類契約: 17件成功

実 private GitHub 環境でのE2Eは資格情報未提供のため未確認ですが、現在のコードと決定的テストから修正すべき欠陥は確認できませんでした。

---

## architecture-review
問題を要約すると、指定された17ファイルと要求・ポリシー・既存レビュー履歴を突き合わせ、アーキテクチャ上の未解決問題だけを根拠付きで報告します。編集・コミット・ステージングは行いません。

まず正本である `order.md`、完全版の Knowledge/Policy、Report Directory の最新裁定と履歴を読み、その後に変更対象17ファイルの実コードと呼び出し経路を確認します。
正本の `order.md` と Policy 全文を確認しました。今回の主契約は、PR本文・通常コメント・review threadから画像URLを抽出し、認証付きGitHub取得・形式/マジックバイト/サイズ検証を経て、task attachmentsと後続のorder/pipeline consumerへ一貫して届けることです。

Report Directory直下には現時点でファイルが見当たらないため、run全体から `review-resolution.md`、過去レビュー、`supervisor-validation.md` の実在箇所を追加確認します。続けてKnowledge全文を分割して読みます。
前段の実行履歴は存在し、現在の `Report Directory` にはまだ本レビュー成果物がない一方、初回レビュアーの `architecture-review.md` と、peer-review が作成した `review-resolution.md` は確認できました。follow-up 権限に従い、まずその裁定で accepted family・既出 finding・対象外を確定してから、同じ family の未移行経路と修正退行だけを追います。
裁定上は7つの accepted family（取得API、参照順、参照番号、metadata境界、temp lifecycle、取得スコープ、テスト分類）があり、前段の4件はその中へ統合済みです。現在の差分では、汎用 `fetchPrReviewComments()` から画像処理を外し、`prepareGitHubPrTask()`を add/routing/pipeline へ接続し、temp cleanup と分類登録を追加しています。

ここからは、修正後の実コードで各 family の全 `participates` 経路を再構築します。まず画像準備・URLスコープ・cleanupの所有境界を確認します。
主経路の再走査では、metadata境界・参照順/採番・task保存・interactive/pipelineへの伝播・通常/失敗/キャンセル/`process.exit()` cleanup・分類配線が、現在のコード上は一貫しています。前段の裁定が明示的に対象外とした「追加のdownload内容テスト」や、既に検証済みのuser-attachments認証差は新規指摘へ戻しません。

次に、修正後の代表経路を対象実行して、静的確認だけでは見えない退行がないか検証します。
対象実行は完了し、型契約、画像parser/validator、metadata・routing・pipeline、add、lifecycle、分類契約の計193テストが成功しました。`releaseVerificationWiring`内の品質ログ用モック出力はテスト期待どおりで、テスト失敗ではありません。

最後に build/lint と差分整合性を確認し、accepted familyごとの判定を確定します。
## 結果: APPROVE

新規・継続・再開 finding はありません。

確認した7 familyはすべて成立しています。

| Family | 判定 |
|---|---|
| 画像取得API | participates |
| 参照順序・置換 | participates |
| 参照番号割当 | participates |
| metadata取得境界 | preserved / task経路のみ participates |
| temp lifecycle | participates |
| repository scope | participates |
| テスト分類配線 | participates |

主な確認箇所は [pr-images.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:263)、[routing.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/app/cli/routing.ts:122)、[pipeline/execute.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/features/pipeline/execute.ts:46) です。

検証結果:

- 対象テスト: 193件成功
- `npm run build`: 成功
- `npm run lint`: 成功
- `git diff --check`: 成功
- `process.exit()`後のtemp file/親directory cleanup: 成功
- `releaseVerificationWiring`: 成功

裁定済み対象外の `TEST-NEW-PRIMG-02-download-content` は、既存裁定どおり再指摘していません。編集・コミットは行っていません。

---

## backend-review
変更契約と既出 family を確定するため、まず指定された要件・Knowledge・Policy・最新レビュー裁定を全文確認し、その後に17ファイルの累積差分と実コード経路を追跡します。編集・コミットは行いません。
指定資料の全文確認を進めています。今回は follow-up なので、既存の accepted family と裁定済み対象外を先に固定し、一般探索で新しい隣接問題を広げないようにします。
既存7 familyの現行経路をコード上で再確認しました。現時点では修正済み主張をそのまま採用せず、画像 parser、GitHub取得、task保存、pipeline、interactive、終了時cleanup、分類配線を対象テストで再検証します。
既存の7つの修正対象 family と最新の裁定を再確認し、現在コードの経路・テスト結果に照らして、継続指摘が残っていないか最終判定します。
再確認の結果、7つの既存 family について、producer から終端 consumer までの経路に未移行・片側更新・修正退行は確認できませんでした。build、lint、差分検査も成功しているため、残る確認は判定の整理です。
判定: APPROVE

7つの既存修正対象 family を再走査しましたが、新規・継続 finding はありません。

- 画像取得、認証スコープ、Content-Type/magic bytes/サイズ検証: [pr-images.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:263)
- 参照順序・番号衝突・置換: 同ファイル
- metadata取得と task 専用副作用の分離: [pr.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr.ts:408)
- add/routing/pipeline の attachment 伝播と cleanup: [execute.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/features/pipeline/execute.ts:46)
- 実 filesystem テストの分類: [test-classification.mjs](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/scripts/test-classification.mjs:172)

確認結果:

- `npm run build`: 成功
- `npm run lint`: 成功
- `git diff --check`: 成功
- 関連テスト、分類契約テスト: すべて成功
- `TEST-NEW-PRIMG-02-download-content` は既存裁定どおり過剰要求として再オープンしていません。
- 実private GitHub環境でのE2Eは資格情報未提供のため未実施ですが、既存検証記録どおり非ブロッキングです。

---

## security-review
セキュリティレビューとして、まず正本の Knowledge / Policy と実行履歴を全文確認し、その後に指定17ファイルの変更経路を入力から終端まで追跡します。編集・コミット・ステージングは行いません。
正本のファイルは Knowledge 319行、Policy 492行で、前回の一括表示は出力上限で欠落しました。判定に使うため、以降は範囲を分割して EOF まで読みます。合わせて、最新の裁定・レビュー履歴を特定します。
対象の個別 Report Directory 自体は空ですが、上位の実行履歴に `review-resolution.md`、前回の security-review、修正報告があります。Follow-up の権限に従い、まず裁定済み family と finding の状態を確定してから、accepted family の未確認 consumer と修正退行だけを再確認します。
前回の security finding は `SEC-PRIMG-001`（別 private repository の認証取得）と `SEC-PRIMG-002`（temp lifecycle）で、裁定上それぞれ `F-PRIMG-FETCH-SCOPE` と `F-PRIMG-TEMP-LIFECYCLE` に合流済みです。現行コードでは、PR metadata fetch と画像準備が分離され、repo照合・認証条件・全体cleanupが実装されています。次に、該当テストと実コードの終端経路を対象実行で確認します。
## 結果

**APPROVE（Security finding 0件）**

確認済み：

- `SEC-PRIMG-001`：PRのrepositoryと画像URLを照合し、別private repositoryの資産を拒否。
- `SEC-PRIMG-002`：system metadata取得から画像副作用を分離し、add / routing / pipeline の成功・失敗・明示終了でtemp fileと親directoryをcleanup。
- Content-Type、magic bytes、10 MiB上限、固定ファイル名による経路逸脱対策を確認。
- `fetchPrReviewComments()` は画像取得を実行せず、task境界でのみ画像を取得。

対象テストはすべて成功しました（画像 parser 16件、PR取得 44件、lifecycle 1件、routing 27件、add 19件、pipeline 53件）。

実GitHub private repositoryを使うE2Eは資格情報未提供のため未実施ですが、現在のコードと決定的テストでは追加の脆弱性は確認できません。

---

## testing-review
問題を要約すると、今回の変更17ファイルについて、既存のレビュー裁定とテスト計画を正本として照合し、変更が壊し得る観測可能な契約に対するテストの不足だけを確認します。まず指定されたKnowledge/PolicyとReport Directoryの最新履歴を全文確認し、その後に変更対象テストと実装経路を再読して、具体的な失敗経路が検出不能な場合のみ指摘します。編集・コミット・ステージングは行いません。
指定された正本は確認できました。`order.md` は画像URL抽出・形式検証・サイズ上限・GitHub認証経由取得・task attachment保存・`add --pr`/pipeline両経路・単体テスト追加を要求しています。次に、途中表示で欠落しないようPolicy/Knowledgeを分割してEOFまで読み、最新の裁定と前回テストレビューを特定します。
裁定と前回レビューを突合しました。前回の7 familyはすべて修正対象として採択され、修正検証では `F-PRIMG-DOWNLOAD-API`、`F-PRIMG-REFERENCE-ORDER`、`F-PRIMG-REFERENCE-ALLOCATION`、`F-PRIMG-FETCH-BOUNDARY`、`F-PRIMG-TEMP-LIFECYCLE`、`F-PRIMG-FETCH-SCOPE`、`F-PRIMG-TEST-WIRING` が完了扱いです。今回の follow-up では新しい隣接familyを探さず、この7 familyの `participates` 経路とテスト証跡だけを再検証します。次に変更対象17ファイルの実コードとテストを読みます。
実コードとテストを再確認したところ、前回の解消証拠のうち、順序テストはHTML先行→Markdownの1方向、pipelineのcleanupテストは成功経路のみで、PR画像付きworkflow失敗経路にはまだ直接の観測がありません。これは同じ accepted family 内の確認事項なので、一般探索には広げず、まず対象テストを実行して現状を確定します。bytes追加要求は既裁定で `overreach` のため、今回のfindingにはしません。
## 判定: REJECT

対象テストは成功していますが、今回の契約に対する未検証経路が2件あります。

### TEST-FOLLOWUP-PRIMG-06-pipeline-failure-cleanup

- family: `F-PRIMG-TEMP-LIFECYCLE`
- 根拠: `accepted_family_unvisited_consumer`
- 対象: [execute.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/features/pipeline/execute.ts:76)
- 現状: [pipelineExecution.test.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/__tests__/pipelineExecution.test.ts:1326) は PR 画像付きパイプラインの成功経路のみ確認している。
- 不足経路: 画像を準備した後、`executeTask` が `false` を返す、または例外を送出する workflow 失敗経路。
- 具体的な回帰: `finally` による画像リソースや一時タスクディレクトリの cleanup が失われても、現在の成功テストと、画像リソースを持たない既存の失敗テストは成功し続ける。

PR画像付きで workflow が失敗するケースを追加し、失敗結果、`cleanup` 呼び出し、一時成果物の削除を確認してください。

### TEST-FOLLOWUP-PRIMG-01-order

- family: `F-PRIMG-REFERENCE-ORDER`
- 根拠: `direct_acceptance_criterion_violation`
- 対象: [github-pr-images.test.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/__tests__/github-pr-images.test.ts:70)
- 現状: 混在構文として HTML → Markdown の順序だけを確認している。
- 不足経路: Markdown → HTML の順序。
- 具体的な回帰: 抽出処理が常に HTML を先に連結する実装へ退行しても、現在のテストは通過するが、本文中の出現順と `[Image #N]` の割当順が壊れる。

同一テストを両方向の入力で実行し、参照順序と置換後のプレースホルダー順序を確認してください。

### 確認済み

以下の対象テストはすべて成功しました。

- `github-pr-images.test.ts`: 16件
- `github-pr-image-lifecycle.integration.test.ts`: 1件
- `github-pr.test.ts`: 44件
- `addTask.test.ts`: 19件
- `cli-routing-pr-resolve.test.ts`: 27件
- `pipelineExecution.test.ts`: 53件
- `imageAttachments.test.ts`: 16件
- `releaseVerificationWiring.test.ts`: 17件

以前の `TEST-NEW-PRIMG-02-download-content` は `review-resolution.md` で対象外裁定済みのため、再指摘していません。