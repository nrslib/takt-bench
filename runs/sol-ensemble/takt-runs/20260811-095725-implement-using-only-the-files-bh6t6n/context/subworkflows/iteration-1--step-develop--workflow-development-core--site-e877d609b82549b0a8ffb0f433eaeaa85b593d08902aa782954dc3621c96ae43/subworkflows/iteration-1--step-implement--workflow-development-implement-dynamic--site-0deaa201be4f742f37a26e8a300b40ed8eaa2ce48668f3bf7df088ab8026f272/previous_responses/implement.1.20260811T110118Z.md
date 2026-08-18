タスク指定ファイル、正本のPolicy／Knowledge、指定Report Directoryの履歴を先頭からEOFまで確認し、変更契約と対象ファイルを確定します。実装・レビューに該当するため `coding` スキルも読み、その基準を適用します。まず既存レポートを再確認したうえで、実装開始時のスコープ宣言を更新します。
作業ディレクトリ名の転記誤りで最初の読み取りコマンドが起動しませんでした。ファイル変更は発生していません。正しい指定ディレクトリで再実行します。
正本のタスクは、GitHub由来のPR本文・通常コメント・レビュー要約・review threadから安全に画像を取得し、既存のtask attachment経路へ渡して、`add --pr` とpipeline `--pr` の両方で参照可能にするものです。指定Report Directoryの3ファイルは現時点で未作成のため、実行履歴は空です。引き続き正本Policy／Knowledge全体を確認し、既存コードの実在経路に照らして変更予定を確定します。
変更契約は次の3点に固定しました。画像取得境界ではGitHub attachment URLのみ許可し、認証・サイズ・Content-Type・magic bytesを検証します。変換境界ではPRの全整形セクションを出現順で置換し、同一URLを1回だけ保存します。各入口では既存のtask attachment機構へ渡し、成功・失敗・取消の全経路で一時資源を解放します。`coding` スキルの基準により、既存のinline画像と共通するmagic bytes判定は共有所有者へ集約します。
Companion受信箱の指摘を実コードで確認しました。逆向き依存はすでに共有定数へ移して解消済みです。追加で、Content-Length拒否時にもresponse bodyを中止する必要があり、またPR/taskとinteractiveが共有する一時画像ストアの所有者がinteractive配下では不適切なため、既存APIを維持したまま共有層へ移します。ストリーム上限テストも後段チャンクを読まないことまで検証する形へ更新します。
主要な実装と3入口の配線が完了しました。テスト開始前のCompanion確認では、共有層への移動、Content-Length／HTTPエラー時のbody中止、cleanup失敗時の元エラー維持を追加で反映済みです。まず型チェックを兼ねたビルドを実行し、コンパイル上の片側更新を解消します。
ビルドは成功しました。ここから変更契約を直接観測するテストをファイル単位で順次実行します。最初にダウンロード境界とPR本文変換の新規単体テスト、その後に共有画像ストア、inline画像回帰、`add --pr`、対話CLI、pipelineの各結合テストを確認します。
変更契約を直接観測する8ファイルの対象実行はすべて成功しました。変更したheavy IT（`addTask.test.ts`）と分類契約も対象実行済みです。ここでCompanionの新規レコードを再確認し、残件があれば全体ゲート前に修正します。
対象テストとlintは成功しています。Companionの既存指摘はコード上すべて反映済みで、新規の未対応指摘は増えていません。続いて必須ゲートを順番に実行します。まずfast unit全体、次に隔離HOMEのlight IT、mock E2E、対象範囲に該当するsmoke E2Eです。
mock E2E全体では、変更箇所とは無関係なshard 2が全テスト成功後にVitest workerの `onTaskUpdate` 通信タイムアウトで終了コード1となりました。他3 shardは成功しています。Quality Gateの規定に従い、推測でフレーク扱いせず、実行スクリプトからshard 2の正確な再現コマンドを確認して同じ失敗範囲を再実行します。
全ゲートは、mock E2Eの初回shard 2のみVitest worker通信タイムアウトで終了しましたが、同一shard全11ファイルを正確な同条件で再実行して28テストすべて成功しました。smoke E2Eも成功です。ここから必須セルフスキャンとして、差分全体の未使用化、import依存方向、同一責務の重複、意図しない契約変更、空白エラーを機械的に確認します。
セルフスキャンで、正規表現一致時の空文字フォールバックと、ストリーム読取エラー判定の文字列依存を見つけました。どちらも今回追加した差分内なので、明示的な不整合検出と構造化したエラー処理へ直し、影響テストを再実行します。
受信箱の新規指摘を確認しました。不正な `Content-Length` の中止処理は現コードにありますが、直接テストが不足しています。また `cancel()` 失敗が本来の検証エラーを上書きする点は実在するため、best-effort の中止処理と失敗ケースのテストを追加します。
依存方向と参照元を走査し、共有層から上位層への逆向き import、今回追加した未参照 export、同契約の重複実装がないことを確認しました。受信箱もテスト直前に再確認済みです。ここから変更した2つのテストファイル、ビルド、lint、最後の単体ゲートを順番に再検証します。
ビルドで Node 24 の型設定には `ReadableStreamReadResult` のグローバル名が露出していないことを確認しました。実行契約は変えず、読取処理を型推論できる局所関数へ置き換えてから再検証します。
再検証は、影響テスト2ファイル、ビルド、lint、最終単体ゲートまで成功しました。既に完了している統合・E2Eゲートの結果と合わせ、契約ごとの証拠をレポートへ整理し、最後に差分と受信箱を再走査します。
## 作業結果

- PR本文、通常コメント、レビュー要約、review thread内のMarkdown／HTML画像を抽出する機能を実装しました。
- GitHub attachment URLのみを認証付きで取得し、PNG/JPEG/GIF/WebP、Content-Type、magic bytes、10MB上限を検証します。
- `takt add --pr`、対話CLIの`--pr`、pipelineの`--pr`へattachmentを配線しました。
- 一時画像とpipeline用task specは成功・失敗・キャンセル時に解放されます。

## 変更内容

- 画像取得処理: [prImageDownload.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunrodo-shite-bc1d7fe94d416276/src/infra/github/prImageDownload.ts)
- PR本文の抽出・置換処理: [prReviewAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunrodo-shite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts)
- 共有画像ストア、URL・MIME検証を追加
- attachment保存、`order.md`参照、pipeline一時task specのテストを追加
- スコープ宣言と決定ログを指定Report Directoryへ記録しました。
- セルフスキャン: 未使用化、import依存方向、重複責務、`git diff --check`を確認し、問題なし。Companion指摘11件はすべて解消済みです。

## ビルド結果

- `npm run build`: 成功
- `npm run lint`: 成功

## テスト結果

- 変更対象のテスト8ファイル: すべて成功
- `npm test`: 4 shard、全6,024テスト成功
- `HOME=/tmp/takt-bench-v3-home npm run test:it`: 158ファイル、2,354テスト成功
- `npm run test:e2e:smoke`: 21成功、1スキップ
- `npm run test:e2e:mock`: 全specのテスト本体は成功。初回は終了時の`onTaskUpdate` RPCタイムアウトでexit 1となりましたが、該当shard全体を再実行し、11ファイル・28テストの成功を確認しました。