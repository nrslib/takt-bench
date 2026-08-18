問題は、修正報告の自己申告に依存せず、計画で定義された2つの完了義務を、現在の差分・実コード・対象テスト・実行結果から独立に検証することです。まず正本の Knowledge / Policy と最新レポートを全文確認し、その後に各不変条件の成立例・失敗例・境界を個別に追跡します。ソースは変更しません。
正本と実行履歴を全文確認しました。計画上の受入条件は、(1) `InteractiveMode` の全分岐が assertion なしで結果を確定し、追加モードを exhaustive check で検出できること、(2) PR head branch 欠落時に cleanup が `process.exit(1)` より前に実行されたことをテストが直接観測することです。次に、現在の差分と実際の呼び出し経路を照合します。
差分上、`assertNever(selectedMode)` は実際に `switch` の default に入り、`result!` は除去されています。dispatch の受け側は `InteractiveModeResult` 必須型なので、型チェックで「全モード分岐後に結果が確定する」ことを独立確認します。続いて、terminal-exit テストは cleanup モックと exit の呼び出し順を対象テスト単体で再実行します。
ビルドと対象テストを現在の作業ツリーで再実行し、いずれも成功しました（build、31テスト）。静的には `selectInteractiveMode` の戻り値が `InteractiveMode | null`、正本の union が5値、`switch` が5値＋default の構成で、`dispatchConversationAction` へは必須の `InteractiveModeResult` を渡していることを確認しています。次は cleanup family の全実在経路と、terminal-exit テストが本当に対象 cleanup を観測しているかを確認します。
cleanup の水平経路も確認しました。producer はダウンロード失敗時に一時領域を削除し、返却 cleanup は二重呼び出しをガードします。pipeline は成功・既知失敗・例外を `finally` で、`add --pr` は選択キャンセル・選択例外・保存例外を各経路で cleanup します。加えて、それらの対象テストを実行し、add 54件・pipeline 23件が成功しました。最後に全 interactive mode の既存経路を対象テストで確認します。
## 結果: verified

2つの修正単位を独立検証し、不足は確認されませんでした。

- `routing.ts`: `result!` は除去済み。`INTERACTIVE_MODES` の全5モードを処理し、`assertNever` により未処理モードを型検査で検出できます。[routing.ts](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/app/cli/routing.ts:225)
- PR head branch 欠落時: cleanup が `process.exit(1)` より前に呼ばれることをテストが直接検証しています。[cli-routing-pr-resolve.test.ts](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/__tests__/cli-routing-pr-resolve.test.ts:367)

確認結果:

- `npm run build` 成功
- PR routing: 31 tests passed
- Issue routing: 32 tests passed
- `add --pr`: 54 tests passed
- pipeline: 23 tests passed

未確認の環境要因はありません。