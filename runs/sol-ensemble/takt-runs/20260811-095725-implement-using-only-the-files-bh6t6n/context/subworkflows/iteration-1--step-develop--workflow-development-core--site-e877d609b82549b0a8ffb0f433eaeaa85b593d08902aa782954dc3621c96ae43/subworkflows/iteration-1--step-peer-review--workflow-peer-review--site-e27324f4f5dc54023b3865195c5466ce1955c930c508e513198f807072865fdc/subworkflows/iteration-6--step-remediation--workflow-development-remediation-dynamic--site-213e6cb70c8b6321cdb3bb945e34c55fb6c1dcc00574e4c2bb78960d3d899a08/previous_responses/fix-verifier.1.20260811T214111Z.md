問題は、PR添付画像の一時storeが3つの`process.exit(1)`経路でも確実に解放される修正について、計画・最新レビュー・現在の差分・対象テストを独立に照合することです。まず指定されたKnowledge／Policy／task／Report Directoryを正本として全件読み、その後に不変条件ごとにコードとテストを追跡し、必要な対象テストだけを再実行します。ソース編集は行いません。
指定ファイルの正本確認を進めています。現時点で修正計画は、hard exitの3経路、同期cleanup、一回性、通常終了時のlistener解除、既存出力契約の維持を独立した義務として要求しています。次に、適用可能なPolicyを全文確認したうえで、最新レビューの原指摘と現在の実装を照合します。
コード追跡では、実装自体は`resolvePrInput()`直後に同期exit cleanupを登録し、外側`finally`で同じ終了関数を呼ぶ構造になっています。一方、3つのrouting回帰テストは`process.exit()`モックが最後に例外を投げるため、exit listenerが未配線でも外側`finally`でcleanupされて合格し得ることを確認しました。対象テストを再実行した後、この証拠能力不足が計画上の完了義務を満たすかを最終判定します。
## 結果: incomplete

実装自体は計画どおりに配線されていますが、hard-exit経路の回帰テストが受入条件違反を検出できません。

- [cli-routing-pr-resolve.test.ts:200](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/cli-routing-pr-resolve.test.ts:200) の`process.exit()`モックはexit listener実行後に例外を投げます。
- 3経路のassertionは例外後にcleanup回数を確認しています。したがって、旧実装の「生のcleanupを外側`finally`だけで実行」に戻っても、[routing.ts:346](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/app/cli/routing.ts:346)が実行されてテストは合格できます。
- heavy ITはcleanup helper単体の実process挙動を証明しますが、routingがそのhelperへ配線されていることは証明しません。
- 正常終了・取消テストもcleanup回数だけを確認しており、routing完了後にexit listenerが残らないことを直接観測していません。

次回修正では、3つのhard-exitテストすべてで、exit listener呼び出し直後かつモックが例外を投げる前にcleanup済みであることをassertしてください。併せて、正常終了・取消後の`process.rawListeners('exit')`が実行前と一致することを確認すれば一括で閉じられます。

現在の実装については、store取得直後の登録、一回性、外側`finally`からの終了関数呼び出し、終了コード・エラー文言の維持をコード上で確認しています。以下の対象実行もすべて成功しました。

- cleanup unit: 2件
- routing回帰: 30件
- 実child process heavy IT: 1件
- 分類契約: 19件
- `git diff --check`: 成功

環境要因による未確認事項はありません。ソースは編集していません。