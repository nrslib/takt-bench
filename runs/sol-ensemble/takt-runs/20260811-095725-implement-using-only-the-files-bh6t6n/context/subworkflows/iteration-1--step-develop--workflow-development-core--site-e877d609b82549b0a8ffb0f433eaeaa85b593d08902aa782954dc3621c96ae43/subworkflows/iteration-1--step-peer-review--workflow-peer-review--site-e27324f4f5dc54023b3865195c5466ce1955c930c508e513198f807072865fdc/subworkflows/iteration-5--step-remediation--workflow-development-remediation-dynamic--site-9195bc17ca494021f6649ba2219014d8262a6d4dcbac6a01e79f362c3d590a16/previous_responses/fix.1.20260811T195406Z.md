問題は、PRレビュー本文のMarkdown断片境界を保持して画像を処理することと、E2E mock runnerのattempt境界を実child processで検証可能にすることです。まず正本の`order.md`、直近レポート、完全版Policy/Knowledge、現在の差分を照合します。実装・レビュー作業なので`coding`スキルを適用し、その規約も読了してから編集します。
正本ではPR本文・通常コメント・review thread画像の保存と、pipeline経路までが要求されています。現在の作業ツリーには既存実装差分が広く残っているため、それを所有者不明の既存変更として保持し、今回の2件に直接関係する箇所だけを追加修正します。次に、確定計画と現在コードの契約差を行単位で確認します。
照合結果として計画は矛盾していません。PR側の直接原因は、3入口すべてが整形済み全文を`preparePrReviewAttachments()`へ渡していることです。formatterに本文範囲を持つ共通結果型を追加し、既存の文字列整形APIは同じbuilderの射影として保持します。E2E側は本番の隔離環境取得・child起動・cleanupを1つのexecutorに閉じ、heavy ITがその同じ境界を呼べる形にします。
PR断片境界の実装と3入口の移行を反映しました。既存の文字列formatterは共通builderから同一内容を返し、attachment層には断片付き契約だけが入るため、旧「全文1回解析」経路は残していません。ここでCompanion受信箱を再確認し、まずPR画像の対象unitを実行して差分を固めます。
E2E runner側も、command構築と「隔離環境取得→実child→finally cleanup」を分離し、初回・再測定が同じexecutorへ入る構造にしました。heavy ITは実Node childで`cwd`と全隔離環境値を読み取り、成功・spawn失敗・再測定の各cleanupを実パス不存在で確認します。受信箱を確認後、unitと新規heavy ITを順に実行します。
PR画像unit、E2E orchestration unit、新規heavy ITはいずれも成功しました。heavy ITでは2回の同一shard実行が異なるrootを取得し、spawn不能時を含め全rootがcleanup後に消失したことを確認できています。Companionの旧wrapper削除指摘は、確定計画が明示する既存`formatPrReviewAsTask(): string`契約の保持と衝突するため採用せず、共通builderからの薄い射影として維持します。次に3入口と保存・staging経路の対象テストを順次確認します。
対象テストで入口配線と分類契約まで成功しています。品質ゲート前に必須セルフスキャンを行い、今回追加したexport/import/引数の参照数、旧全文解析呼び出しの残存、重複責務、差分の構文汚れを機械的に確認します。ここで見つかった問題を直した場合は、影響する対象テストを再実行してから全体ゲートへ進みます。
セルフスキャンでは、旧全文解析呼び出し・未参照export/import・同一責務の重複は見つかりませんでした。sharedとinteractiveの画像storeは、後者が貼付画像用MIME検証を加えるadapterであり別契約です。差分チェックで検出したテスト1行の改行混在だけを修正し、影響した対象テストも再実行して全件成功しました。これから必須のbuild、lint、unit、light IT、mock E2E、該当するsmoke E2Eを順に実行します。
ビルドと lint は終了コード 0 で完了しました。続けて、編集完了後の fast unit gate を実行します。
fast unit gate は 4 shard 合計 380 file・6068 test、light IT は 159 file・2358 test がすべて通過しました。次に正式な mock E2E を実行し、その後、変更範囲に該当する smoke E2E を確認します。
mock E2E は一度 `vitest-worker` の `onTaskUpdate` timeout を検出し、ランナーの既存再測定経路に入りました。現在、その再測定を含む正式コマンドの最終終了コードを待っています。
必須ゲートはすべて終了コード 0 です。mock E2E は birpc ノイズ判定後の shard 2 再測定も成功し、smoke E2E も通過しました。完了宣言前の Companion 受信箱、差分整合性、旧経路・未使用参照を最終確認します。
## 作業結果

- 修正完了

## 変更内容と受入条件

- `pr-review-markdown-fragment-isolation`
  - [format.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/infra/git/format.ts:241) で、既存task文字列とPR本文・各コメント本文のMarkdown範囲を同時生成する契約を追加しました。
  - [prReviewAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:132) は断片ごとにMarkdownを解析し、task全体でURL重複排除、採番、出現順、置換順を共有します。
  - add、対話CLI、pipelineの3入口を構造化フォーマッター経路へ移行しました。
  - 未閉鎖フェンス後のsummary・各thread分類・通常コメント画像、コードリテラル除外、断片間重複、予約済み番号、保存・run context伝播を回帰テストで確認しました。
  - `formatPrReviewAsTask(): string` は修正計画の明示条件に従い、共通builderを使う既存公開契約として維持しています。これと矛盾するCompanion指摘は要求ソースと照合して不採用としました。

- `e2e-runner-attempt-boundary`
  - [run-e2e-mock-shards.mjs](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/scripts/run-e2e-mock-shards.mjs:155) に「隔離環境取得→実child起動→finally cleanup」の共通attempt executorを実装しました。
  - 初回とbirpc再測定は同じexecutorを使用し、空shard、再測定条件、shard構成、結果判定は維持しています。
  - [it-e2e-mock-runner-attempt.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/it-e2e-mock-runner-attempt.test.ts:65) で実Node childのcwd・HOME/XDG/TMPDIR/TAKT環境、attempt間のroot分離、正常終了・spawn失敗後のcleanup、初回・再測定経路を検証しました。
  - 新規テストは命名規則によりheavy ITへ一意に分類されています。

- 編集後セルフスキャン：未使用参照、依存方向、共通責務、旧直接解析経路を検索し、問題なし。検出した改行由来の末尾空白1件は修正済みです。

## 検証結果と証拠

すべて終了コード0です。

- `npm run build`
- `npm run lint`
- `npm test`：4 shard、全テスト通過
- `HOME=/tmp/takt-bench-v3-home npm run test:it`：159 files、2358 tests通過
- `npm run test:e2e:mock`：birpcノイズによるshard 2再測定を含めて成功
- `npm run test:e2e:smoke`：21 tests通過、1 skipped
- `git diff --check`：指摘なし

対象ファイル単位でも以下を実行し、すべて通過しました。

- `prReviewAttachments.test.ts`：33 tests
- `git-format.test.ts`：25 tests
- `pr-image-dataflow.integration.test.ts`：1 test
- `e2eMockRunner.test.ts`：7 tests
- `it-e2e-mock-runner-attempt.test.ts`：3 tests
- `it-teed-command.test.ts`：4 tests
- `addTask.test.ts`：21 tests
- `cli-routing-pr-resolve.test.ts`：29 tests
- `pipelineExecution.test.ts`：56 tests
- `git-cwd-propagation.test.ts`：12 tests
- `cli-routing-issue-resolve.test.ts`：32 tests
- `releaseVerificationWiring.test.ts`：19 tests

修正計画の指定どおり、全heavy IT一括実行は行わず、変更したheavy ITと分類契約を対象実行しました。