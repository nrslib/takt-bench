問題を「最新レビューレポートの提出済み finding だけを、要求・現行コード・実行証跡で再検証し、修正対象 family を確定する」と整理しました。まず正本の Policy / Knowledge、task 配下の全ファイル、Report Directory の最新レポートを特定して全文確認します。ソース編集やゲート再実行は行いません。
正本の全文確認が完了しました。今回直接適用されるのは、PR コメント画像の取得・検証・保存・両 `--pr` 経路への配線、既存 attachment 契約、変更テストの実境界分類と完了証拠です。広域リファクタリング、未要求の互換経路、追加の運用保証は非適用として扱います。次に最新の reviewer iteration（iteration-5）の提出 finding を抽出します。
最新レポートの current finding は1件です。加えて、同じ最新レポート内で過去 finding 3件が「resolved」として参照されています。追跡漏れを避けるため、current finding は正式裁定し、resolved 3件も現在コードとの一致を確認したうえで各IDを1行だけ `no_issue_after_verification` として記録します。これらを修正 family へ混入させません。
証拠照合の結果、hard exit が外側の `finally` を迂回する主張は成立しています。特に、workflow失敗、attachment取得後のPR branch検証失敗、head branch欠落の3経路はいずれも同じ一時store所有権と解放不変条件を破るため、1つの family に統合できます。修正方式は固定せず、所有スコープ内で必ずunwindしてcleanup後に終了状態へ変換されることを受入条件にします。
# レビュー指摘裁定

## 結果: 修正対象あり

最新 reviewer iteration 5 のIDを裁定した結果、1件を `actionable`、解消済み参照3件を `no_issue_after_verification` と確定しました。duplicate、未解決前提、再計画事項はありません。

## 修正対象 family

### `pr-attachment-cleanup-hard-exit`

- 対象: `AI-NEW-pr-attachment-cleanup-hard-exit-L307`
- 出典: `ai-antipattern-review.md`
- disposition: `actionable`
- 破られている不変条件: PR画像の一時storeを取得した後は、正常・失敗を問わずプロセス終了前に解放されること。
- 証拠:
  - cleanup所有者は [routing.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/app/cli/routing.ts:117) で保持され、解放は外側の `finally`（同ファイル345行目）だけ。
  - workflow失敗時は [selectAndExecute.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/execute/selectAndExecute.ts:211) が `process.exit(1)`する。
  - attachment取得後のPR検証失敗は `routing.ts:148`、head branch欠落は `routing.ts:321`でhard exitする。
  - 現環境でも `process.exit(7)`後に `finally` の出力はなく、終了状態7を確認した。
  - [cli-routing-pr-resolve.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/cli-routing-pr-resolve.test.ts:420) は本番実装をrejectするmockに置換し、同491行目のテストは `process.exit()`を例外化しているため、実終了時のcleanupを証明しない。
- 要求との関係: private repository画像を含むPR attachment機能で新設された一時ファイル所有経路に直接関係する、データ保護・副作用解放・テスト品質上の欠陥。

受入条件:

- workflow失敗、attachment取得後のPR検証失敗、head branch欠落の各経路で、一時画像がプロセス終了後に残らない。
- attachment所有スコープ内の失敗がcleanupを実行できる形で巻き戻され、その後に終了コードへ変換される。
- 既存の成功時挙動、終了状態、利用者向けエラー、非PR経路を維持する。
- 回帰テストは、`process.exit()`をthrowするmockだけに依存せず、実終了境界における一時ファイル不存在を観測する。
- heavy ITを追加・変更する場合は、対象実行と分類契約テストを完了する。

修正境界:

- 対象は対話CLIのPR attachment所有・cleanup経路と必要最小限の回帰テスト。
- `selectAndExecuteTask()`の全呼び出し元に対する既定終了契約の変更、add/pipeline経路、画像解析・認証・MIME・サイズ制限、広域CLI再設計は除外。
- reviewer提案の具体的な例外方式は必須方式ではなく、上記不変条件を満たす最小内部修正を正本とする。

## IDごとの一意な裁定

| finding ID | 出典 | disposition | family / 根拠 |
|---|---|---|---|
| `AI-NEW-pr-attachment-cleanup-hard-exit-L307` | AI antipattern review | `actionable` | `pr-attachment-cleanup-hard-exit` |
| `CODE-NEW-pr-review-fragment-isolation-L92` | AI・coding reviewのresolved表 | `no_issue_after_verification` | 現在は本文ごとの範囲生成と断片別解析が実装済み |
| `TEST-NEW-e2e-runner-attempt-boundary-L31` | AI・coding・testing reviewのresolved表 | `no_issue_after_verification` | 共通attempt executorと実child heavy ITが存在し、最新証跡で成功 |
| `ai-antipattern-review-companion-2` | AI reviewのresolved表 | `no_issue_after_verification` | `<pre>`範囲除外とinline/nested反例が実装・検証済み |

## Policy / Knowledge適用分類

- 適用: 証拠優先、直接関係、最小内部修正、責務・副作用所有、呼び出しチェーン、セキュリティ、テストダブル契約、振る舞い保証、実境界によるテスト分類、変更スコープ。
- 制約として適用: 契約置換。未要求の互換経路や全体終了契約の変更を認めない。
- 非適用: provider/model解決、WorkflowEngine、RuleEvaluator、facet、session、公開API、設定正規化、データ移行、広域E2Eルート網羅など、提出findingと影響経路を共有しない章。
- 要追加確認: なし。

次工程へ渡す正本は、上記1件の actionable familyだけです。ソース編集および実行ゲートの再実行は行っていません。