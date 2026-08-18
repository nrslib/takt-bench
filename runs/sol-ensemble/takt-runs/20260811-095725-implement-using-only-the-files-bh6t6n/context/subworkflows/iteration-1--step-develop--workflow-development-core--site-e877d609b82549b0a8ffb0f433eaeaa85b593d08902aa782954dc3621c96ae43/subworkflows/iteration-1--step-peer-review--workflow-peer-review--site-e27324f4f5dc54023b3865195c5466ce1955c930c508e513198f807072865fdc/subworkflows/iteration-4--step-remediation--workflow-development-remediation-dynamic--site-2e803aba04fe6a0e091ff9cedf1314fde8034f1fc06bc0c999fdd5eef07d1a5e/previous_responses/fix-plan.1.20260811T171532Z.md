問題は、裁定で唯一採用された `final-state-mock-e2e-evidence` だけを対象に、現行コードと実行履歴を再確認して実行計画へ落とすことです。まず指定された正本・Knowledge・Policy・Report Directory を読み切り、その後に mock E2E の配線と現在の作業ツリーを照合します。ソース編集は行いません。
正本と判断基準の読了が完了しました。今回の family はコード欠陥ではなく「最終作業ツリーに対する公開入口 E2E の完了証拠不足」と裁定されています。次に、Report Directory の現行レポートと各履歴を最大2件ずつ確認し、後続変更の内容と mock E2E の実行条件を事実として固定します。
現行コードでは、対話経路は `resolvePrInput` の attachment を `InteractiveSeedInput` へ渡し、conversation store が初期画像番号を予約しています。pipeline 経路は attachment 付き task spec を作成し、run context へ stage します。どちらも iteration 3 後の対象テストで確認済みで、残件は構造修正ではなく、現在の全 mock E2E を完了させて終了状態を記録する単独の検証義務です。最終判断前に裁定と実行スクリプトを再照合します。
## 調査結論

修正対象は裁定済み family `final-state-mock-e2e-evidence` の1件だけです。

| finding ID | 分類 | 根本原因 | 受入条件 |
|---|---|---|---|
| `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | 独立した検証証跡不足。構造問題・コード欠陥ではない | iteration 3 の対話seed、retry attachment、共通allocator変更後に mock E2E を再実行しなかった | 現在の作業ツリーで `npm run test:e2e:mock` が終了コード0で完了し、結果がレポートへ記録される |

現行コードでは、対話CLIのattachment付きseedからconversation storeへの伝播と、pipelineのattachment付きtask specからrun contextへのstageが配線済みです。iteration 3の対象テストも成功しているため、初手のソース変更は不要です。

## 実行計画

1. 現在の作業ツリーを変更せず、プロジェクト定義の `npm run test:e2e:mock` を完了まで実行する。

   - [package.json](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/package.json:70) の正式なスクリプトを使用する。
   - 4シャードすべての終了を待つ。対象specの部分実行や開始ログだけでは完了扱いにしない。
   - コマンド、終了コード、成功したテスト・シャード数を `fix-report` に記録する。
   - 終了コード0ならソース、テスト、設定を変更せず完了とする。

2. 失敗した場合だけ、失敗したspecを同じrunner経由で `npm run test:e2e:mock -- <spec-path>` として再現する。

   - stdoutと該当する `e2e/results/mock-shard-*.json`から期待結果、実結果、失敗経路を特定する。
   - 再現できない失敗を推測でフレーク扱いしない。
   - 現行変更に起因する決定的な欠陥だけを最小修正する。テストのskip、期待値の弱体化、周辺リファクタリングは行わない。

3. コード修正が必要になった場合は、修正対象に応じた対象テスト、`npm run build`、`npm run lint`、`npm test`、`npm run test:it`を再実行する。ITを変更した場合は分類契約も実行し、最後に必ず全体の `npm run test:e2e:mock`を再実行する。

## 修正境界

実private GitHub通信、全heavy IT、`npm run check:release`、互換経路追加、既に非actionableまたはresolvedと裁定されたfindingは対象外です。mock E2Eは資格情報を必要とせず現在環境で取得可能なため、環境要因として完了条件から分離しません。

このfix-planフェーズでは、テスト実行およびソース編集は行っていません。タスク全体の再計画は不要です。