# 修正計画

## 結果: 修正計画確定

## 指摘カバレッジ

| finding ID / 出典 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 分類 | 受入条件 |
|-------------------|------|----------------------|-----------------------------|------|----------|
| `CODE-NEW-pr-review-fragment-isolation-L92` / `coding-review.md` | `src/infra/git/format.ts:197-264`、`src/features/tasks/prReviewAttachments.ts:91-124`。連結文字列では画像ノード0件、後続本文単独では1件になることを確認 | `pr-review-markdown-fragment-isolation` | 後続コメント画像が欠落する → 連結済みtask全体を1回の`fromMarkdown()`へ渡す → 独立したMarkdown本文の解析境界を内部契約が保持していない | 構造 | PR本文に未閉鎖フェンスがあっても、後続の通常コメント・review summary・review thread画像が検出、保存、置換される。同一断片内のコードリテラル除外、URL重複排除、出現順、画像番号割当を維持し、3入口が共通経路を使う |
| `TEST-NEW-e2e-runner-attempt-boundary-L31` / `testing-review.md` | `scripts/run-e2e-mock-shards.mjs:138-157,183-216`、`scripts/teed-command.mjs:14-20`、`src/__tests__/e2eMockRunner.test.ts:49-181`、`src/__tests__/it-teed-command.test.ts:31-84` | `e2e-runner-attempt-boundary` | 本番attemptの環境伝播・cleanup回帰を検出できない → unitが`runAttempt`全体を差し替え、既存heavy ITも追加optionsを使わない → process・隔離資源の所有境界が実child processで検証可能になっていない | 構造 | 実child processで`cwd`と隔離`env`を観測し、attemptごとの環境分離、成功時と代表的な起動失敗時のcleanup、初回と再測定での同一attempt契約を検証する。変更したheavy ITと分類契約テストを対象実行する |

独立した局所問題、duplicate、環境要因により実証できない事項、後続確認はない。

## 欠陥 family の最終状態

| 修正単位 | 契約の正本 | 完了対象の全不変条件 | 変更後の責務・正本 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|----------|------------|----------------------|--------------------|--------------------|--------------------------|----------------|
| `pr-review-markdown-fragment-isolation` | `context/task/order.md`のPR本文・通常コメント・review thread画像検出要件、および現在のレビュー裁定 | 1. PR本文と各コメント本文は独立したMarkdown文書として解析する。2. review summary、active/outdated/resolved/legacy thread、通常コメントを現在のtask出力順で処理する。3. 同一断片内のfenced code、inline code、HTML comment、`pre`内は画像扱いしない。4. 全断片でURL重複排除を共有する。5. 全taskで予約済み画像番号と採番状態を共有する。6. placeholder置換順とattachment順を最終出現順に一致させる。7. download失敗時の一時保存cleanupを維持する | `src/infra/git/format.ts`が完成task文字列とMarkdown本文範囲の対応を一度だけ生成する。`prReviewAttachments.ts`はその契約を受け、断片単位の解析、task全体の重複排除・採番、download・置換を所有する | `PrReviewData`生成 → PR task整形 → 断片別画像抽出 → download → 一時attachment保存 → placeholder置換 → `takt add --pr`、対話CLI `--pr`、pipeline `--pr` → task spec保存・run context staging・実行 | 成立例: 正常な各本文のMarkdown画像・HTML img。失敗例: PR本文の未閉鎖フェンスが後続コメント画像を飲み込む現行入力。境界値: 同一断片内のコードリテラル、異なる断片の同一URL、既存`[Image #N]`、複数カテゴリをまたぐ画像順、画像のない断片 | `add/index.ts`、`routing-inputs.ts`、`pipeline/steps.ts`を断片付き内部契約へ移行する。連結済み文字列を直接attachment parserへ渡す3つの旧利用経路を削除する。既存`formatPrReviewAsTask(): string`の観測可能な整形契約は共通builderから維持し、legacy fallbackや別parserを追加しない |
| `e2e-runner-attempt-boundary` | 現在のレビュー裁定、TAKTテスト実行ポリシーの実境界分類・変更heavy IT自己検証・副作用cleanup要件 | 1. 非空shardの各attemptが新しい隔離環境を取得する。2. `cwd`、HOME/XDG/TMPDIR/TAKT系envを実childへ渡す。3. 正常終了とspawn失敗の両方で同じ所有者がcleanupする。4. cleanup後にattempt rootが残らない。5. 初回とbirpc再測定が同じattempt executorを通る。6. 再測定条件、shard構成、timeout、結果判定を変えない。7. 空shardはprocessを起動しない既存挙動を維持する | `run-e2e-mock-shards.mjs`内で、command組み立てと「隔離環境取得→`runTeedCommand`→finally cleanup」を分離する。後者を本番attemptとheavy ITが共用する。`runTeedCommand`はchild process生成とstdout/stderr収集を所有する | `npm run test:e2e:mock` → `runCli()` → `runE2eMockShards()` → 初回または再測定`executeAttempt()` → 共通attempt executor → `runTeedCommand()` → child process → cleanup → shard結果集約 | 成立例: childが指定cwdと隔離envを出力してexit 0。失敗例: 存在しないexecutableでspawn error。境界値: 同一shardの初回と再測定、複数attemptの異なるroot、空shard、非zero exitとspawn errorの区別 | 初回・再測定の実行関数を共通attempt executorへ統一する。unit用の全面process差し替えは再測定判断の検証に限定する。再測定条件、timeout、shard数、正式E2E外部挙動は変更しない |

## 実施順序

| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|------|----------|------|--------|----------|----------------|
| 1 | `pr-review-markdown-fragment-isolation` | 境界変更 | なし | `src/infra/git/format.ts:148-264`、必要な内部型・`src/infra/git/index.ts` | 現在と同じtask文字列に加え、PR本文と各コメント本文の範囲を最終出力順で取得でき、review分類ロジックの正本が1箇所に保たれる |
| 2 | `pr-review-markdown-fragment-isolation` | 局所修正 | 1 | `src/features/tasks/prReviewAttachments.ts:19-164` | 各本文を個別に`fromMarkdown()`へ渡し、局所offsetをtask全体へ対応付ける。重複排除、採番、置換、download cleanupは全断片で共有される |
| 3 | `pr-review-markdown-fragment-isolation` | 利用側移行・旧経路削除 | 2 | `src/features/tasks/add/index.ts:191-236`、`src/app/cli/routing-inputs.ts:52-84`、`src/features/pipeline/steps.ts:222-248` | 3入口すべてが同じ断片付き整形・attachment準備経路を使用し、連結済み文字列を直接解析する呼び出しが残らない。変更で不要になったimport・変数だけを削除する |
| 4 | `pr-review-markdown-fragment-isolation` | 回帰テスト | 3 | `src/__tests__/prReviewAttachments.test.ts`、`src/__tests__/pr-image-dataflow.integration.test.ts`、`src/__tests__/addTask.test.ts`、`src/__tests__/cli-routing-pr-resolve.test.ts`、`src/__tests__/pipelineExecution.test.ts` | 未閉鎖PR本文の後続にあるsummary・thread・通常コメント画像が検出され、実filesystem上のtask attachmentとrun contextまで保存される。コードリテラル除外、断片間重複排除、順序、採番、3入口配線が反証可能なassertionを持つ |
| 5 | `e2e-runner-attempt-boundary` | 境界変更 | なし | `scripts/run-e2e-mock-shards.mjs:30-158` | command組み立てと隔離attempt executorを分け、各呼び出しが新規環境を取得し、実`runTeedCommand`へ`cwd`・`env`を渡し、`finally`でcleanupする。初回と再測定は同じexecutorを使用する |
| 6 | `e2e-runner-attempt-boundary` | heavy IT追加 | 5 | 新規`src/__tests__/it-e2e-mock-runner-attempt.test.ts`、必要に応じて`src/__tests__/e2eMockRunner.test.ts` | 実Node childでcwd・隔離envを観測し、複数attemptのroot差異、成功後cleanup、spawn失敗後cleanup、初回・再測定の共通契約を検証する。orchestration unitは再測定条件と順序だけを担う |
| 7 | `e2e-runner-attempt-boundary` | 分類確認 | 6 | 既存`it-*.test.ts`分類規則、`src/__tests__/releaseVerificationWiring.test.ts` | 新規テストがunit/light ITから排除され、heavy parallel ITへ一意に接続される。分類のためだけの明示リスト追加は行わない |
| 8 | 両修正単位 | 品質ゲート | 4、7 | 変更全体 | 対象unit・light IT・変更heavy IT・分類契約・build・lint・unit gate・light IT gate・mock E2Eが完了し、開始事実ではなく終了コードを証拠として残す |

2つの修正単位は相互依存しない。実装上は各familyの境界変更とテストを完結させてから全体ゲートを実行する。

## 制約適合性

| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 | 品質ゲート |
|----------|--------------|--------------------------|-----------------------------|----------|--------------|
| `pr-review-markdown-fragment-isolation` | `context/task/order.md`、契約置換ポリシー、コーディングポリシーのフェーズ分離・契約整合、テストポリシーのparser境界・回帰テスト | 採用: formatterがtask本文とMarkdown断片位置の正本を生成し、attachment層が断片別解析と全体状態を所有する。非採用: parser交換、壊れたMarkdown補正、全体文字列の再解析継続、review分類ロジックのattachment側複製、raw文字列正規表現、legacy fallback。既存文字列formatterは変更対象外契約として共通builderから維持する | unitでASTに基づく検出・非検出、断片間重複排除・順序・採番を観測。light ITで保存済み`order.md`、attachment bytes、run contextの参照を観測。3入口テストで共通準備関数への入力とattachment伝播を観測 | 解析状態を断片境界で閉じつつ、download・認証・MIME・サイズ・保存契約を変更しない。新しい保証や互換経路を追加せず、裁定の受入条件だけを満たす | `npm test -- src/__tests__/prReviewAttachments.test.ts`、`npm test -- src/__tests__/pr-image-dataflow.integration.test.ts`、`npm test -- src/__tests__/releaseVerificationWiring.test.ts`、`npm run build`、`npm run lint`、`npm test`、`npm run test:it`、`npm run test:e2e:mock` |
| `e2e-runner-attempt-boundary` | TAKTテスト実行ポリシー、テストポリシーの副作用・状態遷移、現在のrunner公開挙動 | 採用: 本番とheavy ITが共用する小さなattempt executorを作り、隔離資源の取得・process options伝播・cleanupを同じ境界へ集約する。環境factoryを明示依存として渡す場合も、productionは既存`createShardEnv`、testはそれを観測用に包むだけとし、fake env契約を作らない。非採用: 全runner再設計、実E2E全体をheavy ITから起動、source文字列検査、cleanupログだけの確認、timeout延長、再測定条件変更 | heavy ITで実child出力から`process.cwd()`と対象envを確認し、取得したrootの不存在をcleanup後に確認する。存在しないexecutableで起動失敗を再現する。birpc初回・再測定で異なるrootと同一executor経路を確認する。すべて現在環境で決定的に実行可能 | 実process境界を通るためtest doubleだけでは得られない証拠を作り、正常・代表失敗双方の副作用解放を確認できる。公開E2E挙動、shard、timeout、再測定ポリシーは固定する | `npm test -- src/__tests__/it-e2e-mock-runner-attempt.test.ts`、`npm test -- src/__tests__/e2eMockRunner.test.ts`、`npm test -- src/__tests__/releaseVerificationWiring.test.ts`、`npm run build`、`npm run lint`、`npm test`、`npm run test:it`、`npm run test:e2e:mock` |

全heavy ITのローカル全件実行は完了条件に含めない。変更したheavy ITは対象指定で実行し、全heavy ITはPR gateの責務として区別する。

## 再計画事項

- なし。2件は同じ要求・設計前提のまま独立して修正可能であり、タスク全体の再計画、ユーザー判断、環境依存の後続確認を必要としない。