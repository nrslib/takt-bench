問題は、PR添付画像の所有中に既存の `process.exit(1)` が走ると外側の `finally` が実行されず、一時ファイルが残ることです。まず正本の `order.md`、全Policy/Knowledge、直近レポート、codingスキルを全文確認し、現コードと照合してから、確定計画どおり実装・テストします。codingスキルは実装時の必須手順とプロジェクト規約を守るために使用します。
正本・計画と現コードは整合しています。対象は、`resolvePrInput()` が返す同期cleanupを `routing.ts` が取得した直後にhard-exit境界へ登録し、通常経路では同じ終了関数でlistener解除と一度だけのcleanupを行う変更に限定します。add・pipeline・画像取得処理・既存の終了文言や終了コードは対象外として保持します。
実装は完了しました。専用helperで `exit` listenerと通常cleanupを同じ一回性境界に統合し、routingはPR attachment取得直後に登録します。route回帰はworkflow失敗・PR context検証失敗・head branch欠落の3経路で、終了handler実行時のcleanupを観測し、heavy ITは実child processの非0終了後に画像とsessionディレクトリがないことを確認します。Companion受信箱には現時点で新規レコードはありません。これから対象ファイルを順番に実行します。
対象検証はすべて成功しました。unit helper 2件、routing 30件（3つのhard-exit経路を含む）、実child process heavy IT 1件、分類契約 19件が通過し、新規ITは期待どおりheavy runnerへ配線されています。次に受信箱を再確認し、build・lint・全unit・light IT・mock E2E・smoke E2Eを順番に実行します。
Companionに `processExitCleanup.ts` が未配線という `must_fix` が届きましたが、現在のコードでは [routing.ts] がimportし、`resolvePrInput()`成功直後に呼び出していることを再確認しました。この指摘は生成時点より後の利用側移行で既に解消されているため、追加変更は不要です。現状態を正として品質ゲートへ進みます。
build、lint、全unit（4 shard）、light ITはいずれも成功しています。mock E2Eは現在も実行中で、これまでの各シナリオは成功しており、実provider専用の既定skip以外に失敗は出ていません。完了まで継続監視します。
mock E2Eは長時間シナリオを継続中です。1 shardで既知のVitest worker RPC `onTaskUpdate` timeoutが一度記録されましたが、各テスト本体は成功しています。最終runnerがこれを再試行・失敗のどちらとして確定するか、プロセスの終了コードまで確認して判断します。
mock E2Eは引き続き進行し、長時間のobservability・dynamic facet・provider override・finding contract各シナリオも成功しています。先のRPC timeout以外にテスト失敗はなく、runner全体の終了を待っています。
すべての品質ゲートが成功しました。mock E2EはRPCノイズのあったshardを自動再計測し、再実行28件を含め終了コード0、smoke E2Eも21件成功（外部GitHub依存1件は既定skip）です。これから今回の差分だけを対象に、未使用化・依存方向・同一責務重複・旧cleanup経路残存を機械的に走査し、最後にCompanionを再確認します。
## 作業結果

- 修正完了

## 変更内容と受入条件

- [processExitCleanup.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/app/cli/processExitCleanup.ts:1) を追加。終了listenerの解除、同期cleanup、一回性を実装しました。
- [routing.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/app/cli/routing.ts:121) でPR添付取得直後にcleanupを登録し、通常の`finally`でも同じ終了関数を使用します。
- workflow失敗、PR context検証失敗、head branch欠落の3つの`process.exit(1)`経路で、終了前にcleanupされることを確認しました。
- 正常終了、取消、二重呼び出しではcleanupが一度だけ実行され、listenerも残りません。
- 既存の終了コード、エラー文言、attachment伝播は維持しています。
- 実child processの非0終了後に、一時画像とsessionディレクトリが存在しないことをheavy ITで証明しました。
- codingスキルに従い、hard-exit境界だけを専用helperへ分離し、add・pipeline・画像取得処理には変更を広げていません。

## 検証結果と証拠

すべて成功しました。

- `npm test -- src/__tests__/processExitCleanup.test.ts`：2件成功
- `npm test -- src/__tests__/cli-routing-pr-resolve.test.ts`：30件成功
- `npm test -- src/__tests__/it-pr-attachment-process-exit-cleanup.test.ts`：1件成功、heavy runner配線
- `npm test -- src/__tests__/releaseVerificationWiring.test.ts`：19件成功
- `npm run build`
- `npm run lint`
- `npm test`：全4 shard成功
- `HOME=/tmp/takt-bench-v3-home npm run test:it`：159ファイル、2358件成功
- `npm run test:e2e:mock`：RPCノイズ発生shardを自動再計測後、終了コード0
- `npm run test:e2e:smoke`：21件成功、外部GitHub依存1件は既定skip
- `git diff --check`：問題なし
- セルフスキャン：未使用import/export、旧cleanup経路、依存方向違反、同一責務の重複はありません。
- Companionの未配線指摘は現コードのimport・呼び出しを再確認後、`resolved`になっています。