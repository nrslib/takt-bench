問題は実装本体ではなく、回帰テストの観測点が弱く旧実装への退行を検出できない点です。`coding` スキルを適用し、正本の仕様・Policy・Knowledge・最新レポートを再読したうえで、3つの hard-exit 経路の終了直前観測と通常完了時の listener 解放をテストで直接証明します。
正本と実行履歴を照合しました。適用対象は `PACH-03`〜`PACH-06` の証拠強化のみで、production 実装、add/pipeline、画像取得処理は対象外です。前回証拠の問題は「弱い観測点」であり、hard-exit モックの例外後ではなく exit listener 実行直後に検証する必要があります。
テスト修正を反映しました。3つの hard-exit テストは exit listener 実行直後・モック例外送出前に cleanup 完了を確認し、正常実行・取消・通常例外は routing 呼び出し前後の `exit` listener 集合一致を確認するようにしました。現在、対象 routing テストを実行しています。
対象テストはすべて成功しました。routing 31件、cleanup unit 2件、実 child process heavy IT 1件、分類契約 19件が成功しています。続いて、再開した全義務の回帰確認として build・lint・全 unit・light IT・mock E2E を実行します。
mock E2E の初回 shard で Vitest worker の RPC timeout が1件発生しました。プロジェクトの runner がこの既知ノイズを自動再計測するため、最終終了状態まで監視しています。対象テスト自体の失敗は現時点で報告されていません。
build、lint、全 unit（4 shard）、light IT（159ファイル・2358件）は成功しました。mock E2E は残りの shard と自動再計測の完了待ちです。停止や実テスト失敗はなく、runner の最終結果を確認してから差分セルフスキャンへ進みます。
Companion に `routing-inputs.ts` の optional `cwd` フォールバックに関する `should_fix` が1件届きました。これは今回追加したテスト差分ではなく既存の累積実装への指摘です。指示としては扱わず、正本・全呼び出し元・現在の修正 family に照らして、今回の編集権限内かを独立確認します。
Companion 指摘は実コード上も妥当でした。`resolvePrInput` の production 呼び出し元はすべて解決済み `cwd` を渡しており、省略時フォールバックは元仕様にも必要ありません。`cwd` を必須化して `process.cwd()` フォールバックと旧省略テストを削除しました。この変更で先ほどの検証結果が無効になったため、関連ゲートを再実行します。
Companion レコードは `resolved` になりました。最終コードで build、lint、全 unit、light IT、関連 unit を再実行し、すべて成功しています。最終成果物の品質ゲートを揃えるため、mock E2E も再実行します。
最終 mock E2E でも同じ shard 2 の Vitest RPC timeout が発生しましたが、実テストは全件成功しており、runner が規定どおり shard 2 を再計測します。他 shard は継続中です。最終終了コードまで確認します。
## 作業結果

- 修正完了

## 変更内容と受入条件

- `PACH-03`〜`PACH-05`：3つの hard-exit 経路で、exit listener 実行後・例外送出前に cleanup 完了を直接検証。
- `PACH-06`：正常完了、取消、通常例外の前後で `process.rawListeners('exit')` が一致することを検証。
- `PACH-01`、`PACH-02`、`PACH-07`〜`PACH-09`：実 child process、登録順、一回性、旧経路不在、既存契約を再確認。
- Companion 指摘に対応し、`resolvePrInput()` の `cwd` を必須化。不要な `process.cwd()` フォールバックと旧省略テストを削除。レコードは `resolved`。
- `coding` スキルの基準に従い、不要な互換経路を残さず、観測可能な振る舞いで検証した。

## 検証結果と証拠

すべて成功しました。

- routing 回帰：31件
- cwd 伝播：11件
- cleanup unit：2件
- 実 child process heavy IT：1件
- 分類契約：19件
- `npm run build`
- `npm run lint`
- `npm test`：4 shard 全成功
- `npm run test:it`：159ファイル、2358件
- `npm run test:e2e:mock`：終了コード0。RPC timeout の shard は自動再計測後に成功
- `git diff --check`

セルフスキャンでは、未使用化、旧 cleanup 経路、不要なフォールバック、依存方向違反、同一責務の重複を確認し、新規問題は検出されませんでした。