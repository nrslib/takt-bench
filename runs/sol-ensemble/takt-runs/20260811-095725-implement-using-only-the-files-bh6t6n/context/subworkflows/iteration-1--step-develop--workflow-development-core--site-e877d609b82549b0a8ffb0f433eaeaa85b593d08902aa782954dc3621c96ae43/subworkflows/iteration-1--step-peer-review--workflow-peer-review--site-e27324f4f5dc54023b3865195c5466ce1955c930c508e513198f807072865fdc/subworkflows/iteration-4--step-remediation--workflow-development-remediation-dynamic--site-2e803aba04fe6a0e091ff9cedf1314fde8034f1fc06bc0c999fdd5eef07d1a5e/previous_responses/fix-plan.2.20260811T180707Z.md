問題を「裁定済みの1 family（最終作業ツリーでの mock E2E 証跡不足）だけに絞り、実行結果に応じた最小修正計画を作ること」と整理しました。まず指定された Knowledge／Policy を全文確認し、task 正本、直近レポート、現在のコードとテスト配線を突き合わせます。このステップでは編集もテスト実行もせず、読み取りだけを行います。
Knowledge／Policy のうち今回適用されるのは、公開入口から全体を通す E2E の定義、プロジェクトスクリプト優先、開始ではなく終了コードを証拠にする基準です。契約置換・互換経路・構造リファクタリングなどは、裁定が「成功時はコード変更不要」と境界指定しているため非適用です。次に、レポート履歴から裁定・直近の修正内容・過去の mock E2E 実行条件だけを確認します。
直近の失敗は product spec の失敗ではありません。4つの結果 JSON はすべて `success: true` かつ失敗テスト0件ですが、shard 2 の Vitest worker が bare `onTaskUpdate` RPC timeout を出し、runner が非0をそのまま全体失敗にしています。現在の unit runner には、この厳密な出力形だけをローカルで1回再測定し、実失敗・再失敗・CI失敗は救済しない既存機構があります。一方、mock E2E runner は出力を収集しないため同じ判定を利用できていません。CI配線も確認して、適用境界を確定します。
# 修正計画

## 結論

修正対象は裁定済み family `final-state-mock-e2e-evidence`（`FINAL-NEW-MOCK-E2E-EVIDENCE-01`）のみです。

直近実行では4つの結果JSONすべてが失敗テスト0件・`success: true`でしたが、shard 2 が Vitest の bare `onTaskUpdate` RPC timeout により終了コード1となっています。したがって、今回は裁定の「失敗時のみ最小修正」に該当します。

## 根本原因

- 問題: 最終作業ツリーの `npm run test:e2e:mock` が終了コード0にならない。
- 直接原因: shard 2 が全テスト成功後に Vitest worker RPC timeout を報告した。
- 根本原因: [run-e2e-mock-shards.mjs](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/scripts/run-e2e-mock-shards.mjs:145) が出力を収集せず、既知の限定的な birpc noise と実テスト失敗を区別せずに非0終了を確定している。
- 分類: product機能の局所欠陥ではなく、4シャードを統括するテストrunner境界の構造問題。
- 同一原因の探索結果: 並列unit runnerは既に [vitest-birpc-noise.mjs](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/scripts/vitest-birpc-noise.mjs:28) を使って限定的な再測定を実装済み。mock E2E runnerだけが未適用。

## 修正単位 `FSME-01`

1. [teed-command.mjs](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/scripts/teed-command.mjs:14) を、既存の出力転送・収集契約を保ったまま `cwd` と `env` を受け取れるようにする。

2. `run-e2e-mock-shards.mjs`で各shardの出力を収集し、次の全条件を満たすローカル失敗だけを、全初回shard完了後に同じspec・引数で1回再測定する。

   - テスト成功数が1件以上
   - 失敗テストが0件
   - エラー見出しが bare `Timeout calling "onTaskUpdate"` のみ
   - CIではない

3. 再測定では新しい隔離HOME・XDG・TMPDIRを作成し、終了後にcleanupする。再測定結果が非0なら失敗を維持する。

4. 次は救済しない。

   - assertion失敗
   - 別種のエラー
   - 引数付きRPC timeout
   - signal終了、起動失敗
   - CI上のtimeout
   - 2回目も非0となった場合

5. runner本体をテスト可能な関数とCLI入口に分離し、既存のshard構成、並列初回実行、フィルタ、timeout、期待値、skipは変更しない。

## テスト

新規 `src/__tests__/e2eMockRunner.test.ts` で以下を検証します。

- 既知noiseのshardだけを、全初回shard完了後に1回再測定する
- 再測定成功時は全体終了コード0
- 再測定も失敗した場合は終了コード1
- 通常のテスト失敗や別エラーは再測定しない
- CIでは再測定しない
- 同じshardのspec・引数を維持する

既存のbirpc分類テストは再利用し、分類条件の重複実装や期待値の弱体化は行いません。

## 検証順序

1. `npm test -- src/__tests__/e2eMockRunner.test.ts`
2. `npm run build`
3. `npm run lint`
4. `npm test`
5. `npm run test:it`
6. `git diff --check`
7. 最終作業ツリーで `npm run test:e2e:mock`

完了条件は、最後の正式コマンドが4シャード完了・終了コード0となり、コマンド、終了コード、各shard結果が修正レポートへ記録されることです。

実private GitHub通信、全heavy IT、release gate、productコード、E2E spec追加、周辺リファクタリング、裁定上resolved／`adjudicated_non_actionable`の指摘は対象外です。