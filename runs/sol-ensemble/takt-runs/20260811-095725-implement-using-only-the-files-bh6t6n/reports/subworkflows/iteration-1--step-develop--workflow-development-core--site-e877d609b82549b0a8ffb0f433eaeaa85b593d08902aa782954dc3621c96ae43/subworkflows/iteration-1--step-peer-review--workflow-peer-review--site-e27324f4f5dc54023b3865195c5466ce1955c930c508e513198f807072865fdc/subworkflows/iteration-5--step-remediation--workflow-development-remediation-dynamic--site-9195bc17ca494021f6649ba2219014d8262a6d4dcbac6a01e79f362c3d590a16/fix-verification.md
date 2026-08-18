# 修正完了検証

## 結果: verified

## サマリー

修正計画の2修正単位について、全完了義務を現行コード、呼び出し経路、反例テスト、実process・filesystem境界で独立検証した。

`pr-review-markdown-fragment-isolation`では、PR本文と各コメントの解析分離、カテゴリ横断順序、コードリテラル除外、URL重複排除、採番、cleanup、3入口移行、旧経路削除、公開formatter契約、task保存からrun context stagingまで成立した。直前に不足していたinline／nested inline `<pre>`についても、内部画像を保持し、閉じタグ後の通常画像のみを添付することを確認した。

`e2e-runner-attempt-boundary`では、実child processへのcwd・隔離env伝播、attemptごとのroot分離、正常時とspawn失敗時のcleanup、初回・再測定の共通executor利用、空shard・再測定条件・結果判定、heavy IT分類を確認した。

対象実行は、unit 154件、light IT 1件、heavy IT・分類契約43件がすべて成功した。未完了義務、計画不備、環境要因による後続確認はない。

## 修正単位の整合性

| 修正単位 | 対象 finding | 前提・方法・証拠能力の整合性 | 判定 |
|----------|--------------|------------------------------|------|
| `pr-review-markdown-fragment-isolation` | `CODE-NEW-pr-review-fragment-isolation-L92`、`ai-antipattern-review-companion-2` | formatterがtask文字列とMarkdown断片範囲を一度だけ生成し、attachment層が断片別解析とtask全体の重複排除・採番・置換を所有する構造を確認した。inline `<pre>`を含む反例は現在環境で決定的に検証可能であり、3入口とfilesystem保存経路まで追跡できる | 適合 |
| `e2e-runner-attempt-boundary` | `TEST-NEW-e2e-runner-attempt-boundary-L31` | command構築とattempt executorが分離され、本番とheavy ITが実`runTeedCommand()`境界を共有する。child出力と一時rootの実在性からcwd・env・cleanupを直接観測できる | 適合 |

## 完了義務の独立検証

| 修正単位 | 義務ID | 対象 finding | 不変条件と対象経路 | 独立に用いた反例・観測点 | 観測結果 | 証拠 | 判定 |
|----------|--------|--------------|--------------------|----------------------------|----------|------|------|
| `pr-review-markdown-fragment-isolation` | `PR-FRAGMENT-01` | `CODE-NEW-pr-review-fragment-isolation-L92` | PR本文と各review・conversation本文を独立したMarkdown文書として解析する | 未閉鎖コードフェンスを持つPR本文の後にsummary、active、outdated、resolved、legacy、conversation画像を配置 | 成立 | `formatPrReviewTask()`が本文ごとの範囲を生成し、`findTaskImageReferences()`が断片ごとに解析。対象unit成功 | 完了 |
| 同上 | `PR-ORDER-02` | 同上 | summary、active、outdated、resolved、legacy、conversationのtask出力順とattachment順を維持する | 全カテゴリへ異なるURLを配置し、本文placeholder、download引数、attachment配列を比較 | 成立 | download順とplaceholderが最終task出現順に一致するassertionが成功 | 完了 |
| 同上 | `PR-LITERAL-03` | 同上、`ai-antipattern-review-companion-2` | fenced code、inline code、HTML comment、`pre`内の画像を添付対象にしない | block `<pre>`、段落内inline `<pre>`、`span`配下nested inline `<pre>`、未閉鎖`<pre>`、HTML commentを確認し、直後の通常画像と対比 | 成立 | Markdown断片全体のHTMLノードをsource offset付きでparse5へ渡し、`pre`範囲内のHTML・Markdown画像を除外。inline反例2件を含む対象unit成功 | 完了 |
| 同上 | `PR-DEDUPE-04` | `CODE-NEW-pr-review-fragment-isolation-L92` | 全断片で同一URLの重複排除を共有する | 異なる断片およびMarkdown／HTML記法に同一URLを配置 | 成立 | download・保存は1回、両参照が同一placeholder、attachmentは1件 | 完了 |
| 同上 | `PR-INDEX-05` | 同上 | 予約済み画像番号と新規採番状態をtask全体で共有する | 既存placeholder、attachment path、安全整数境界外および400桁識別子、複数画像を併置 | 成立 | 予約済み番号を避けた最小未使用番号が割り当てられ、精度損失や衝突なし | 完了 |
| 同上 | `PR-CLEANUP-06` | 同上 | download・保存失敗時に一時attachment storeをcleanupし、元エラーを保持する | 2件目download失敗とcleanup同時失敗を実行 | 成立 | cleanupが呼ばれ、cleanup失敗時も元の`download failed`が伝播 | 完了 |
| 同上 | `PR-MIGRATE-07` | 同上 | add、対話CLI、pipelineが構造化formatterを使用する | 3入口のformatter入力とattachment伝播をコード・対象テストで追跡 | 成立 | 3入口すべてが`formatPrReviewTask()`の結果を`preparePrReviewAttachments()`へ渡す | 完了 |
| 同上 | `PR-OLDPATH-08` | 同上 | 完成task文字列を直接attachment parserへ渡す旧本番経路を残さない | formatterおよびattachment準備関数の本番参照を検索 | 成立 | 旧3入口の直接文字列解析呼び出しなし。公開文字列formatterはattachment処理に使用されていない | 完了 |
| 同上 | `PR-PUBLIC-09` | 同上 | `formatPrReviewAsTask(): string`の既存整形契約を維持する | metadata付きconversation commentの完全一致と各review分類の出力順を確認 | 成立 | 公開formatterは共通builderの`taskContent`を返し、conversation commentへ旧契約にないmetadata行を追加しない | 完了 |
| 同上 | `PR-DATAFLOW-10` | 同上 | 画像参照とbytesをtask attachmentおよびrun contextへ伝播する | 未閉鎖PR本文後のconversation画像を実filesystemへ保存し、run contextへstage | 成立 | 保存済み`order.md`、task attachment bytes、staged `order.md`、run context attachment bytesをlight ITで確認 | 完了 |
| `e2e-runner-attempt-boundary` | `E2E-ENV-01` | `TEST-NEW-e2e-runner-attempt-boundary-L31` | 非空shardのattemptごとに新しい隔離環境を取得する | 同一shardを複数回実行し、生成rootを比較 | 成立 | すべてのattempt rootが一意 | 完了 |
| 同上 | `E2E-PROPAGATE-02` | 同上 | cwd、HOME、XDG、TMPDIR、TAKT系envを実childへ渡す | childから`process.cwd()`と対象envをJSON出力 | 成立 | child観測値がcommand cwdおよび生成された隔離環境と一致 | 完了 |
| 同上 | `E2E-CLEANUP-03` | 同上 | 正常終了後にattempt rootを削除する | child exit 0後に各rootの存在を確認 | 成立 | cleanup後は全rootが不存在 | 完了 |
| 同上 | `E2E-SPAWN-04` | 同上 | child起動失敗後も同じattempt所有者がcleanupする | 存在しないexecutableでENOENTを発生 | 成立 | ENOENTが伝播し、finally後にrootが不存在 | 完了 |
| 同上 | `E2E-REMEASURE-05` | 同上 | 初回とbirpc再測定が同じattempt executorを通る | shard 2の初回だけbirpc noiseを返し、attempt順とrootを記録 | 成立 | attempt順は`[1,2,3,4,2]`、5回すべてが実child executorを通り、一意rootを使用 | 完了 |
| 同上 | `E2E-POLICY-06` | 同上 | 空shard、再測定条件、shard構成、timeout、結果判定を維持する | 単一spec filter、通常失敗、別error、CI、signal、spawn失敗、再測定再失敗を確認 | 成立 | 空shardはprocess未起動。既知noise以外は再測定されず、失敗結果が維持された | 完了 |
| 同上 | `E2E-CLASSIFY-07` | 同上 | 実child process ITをheavy gateへ一意に接続する | 対象指定runnerと分類契約を実行 | 成立 | `it-*.test.ts`規則によりheavy parallel ITへ接続され、unit・light ITから排除 | 完了 |

## 不成立・未確認事項

なし。

## 環境要因により実証できない後続確認（判定非ブロッキング）

なし。

## 実行証跡

| 対象 | 方法 | 結果 |
|------|------|------|
| PR断片分離、HTML／Markdown literal、順序、重複排除、採番、cleanup | `npm test -- src/__tests__/prReviewAttachments.test.ts src/__tests__/git-format.test.ts ...`による対象unit実行 | 5 files・154 tests成功 |
| task保存からrun context stagingまでの画像データフロー | 同コマンドから`src/__tests__/pr-image-dataflow.integration.test.ts`をlight ITへ分類実行 | 1 file・1 test成功 |
| add、対話CLI、pipelineの構造化formatter移行とattachment伝播 | `addTask.test.ts`、`cli-routing-pr-resolve.test.ts`、`pipelineExecution.test.ts`の対象実行と本番参照検索 | 成功 |
| attemptごとのcwd・env伝播、分離、正常／spawn失敗cleanup、再測定 | `src/__tests__/it-e2e-mock-runner-attempt.test.ts`の実child process実行 | 成功 |
| E2E再測定ポリシーと分類契約 | `e2eMockRunner.test.ts`、`releaseVerificationWiring.test.ts`の対象実行 | heavy IT・分類契約3 files・43 tests成功 |
| inline／nested inline `<pre>`のsource offset境界 | 既存反例テストに加え、mdastノード分割後のparse5要素範囲を閉鎖・未閉鎖・ネスト・comment入力で観測 | 成功 |
| 差分整合性 | `git diff --check` | 成功 |