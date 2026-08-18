問題を、裁定済み2 familyだけに限定した修正計画の作成と捉えました。まず指定された Knowledge・Policy を全文確認し、次に task 正本、Report Directory の履歴、現行コードとテストを照合します。このステップでは編集しません。
正本では、PR本文・通常コメント・review summary・review threadを対象にし、3入口で共通の attachment 経路を使う必要があります。Report Directory は現時点で空で、指定パターンの過去レポートも存在しないため、対象追加はせず、提示された現裁定と現行コードを根拠に進めます。次に producer から保存・実行までの実経路と E2E runner の process 境界を追います。
現行コードで根本原因を確認できました。連結Markdownでは画像ノードが0件、後続本文だけなら1件になり、先行断片の未閉鎖フェンスが後続へ漏れています。また、E2E runner は本番 `runShardAttempt()` で隔離環境を作成・`finally` cleanupしていますが、unit はその関数を全面的に差し替え、既存heavy ITも `cwd`/`env` optionsを使っていません。両件とも環境依存ではなく、決定的な回帰テストを作れる構造問題です。
## 調査結果

修正対象は裁定済みの2 familyのみです。duplicate、非修正対象、環境要因による後続確認はありません。Report Directory は空であり、参照対象となる過去レポートもありませんでした。

- `CODE-NEW-pr-review-fragment-isolation-L92`
  - 構造問題。独立したMarkdown本文を連結後に一括解析していることが根本原因です。
  - 実測でも、未閉鎖フェンスを含む連結文字列は画像ノード0件、後続本文単独では1件でした。
- `TEST-NEW-e2e-runner-attempt-boundary-L31`
  - 構造問題。本番process境界がunit test doubleに置換され、隔離環境とcleanupを永続テストが観測していません。
- 独立した局所問題、現在環境で実証不能な事項はありません。

## 実装計画

### 1. `pr-review-markdown-fragment-isolation`

対象 finding: `CODE-NEW-pr-review-fragment-isolation-L92`

1. [format.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/infra/git/format.ts:148)に、完成したtask文字列と、その中の各Markdown本文範囲を最終出現順で保持する内部契約を追加します。
   - 対象断片はPR本文、review summary、各review thread、legacy review comment、通常コメントの各`body`です。
   - 既存の`formatPrReviewAsTask(): string`は同じ組み立て処理から文字列を返し、既存の観測可能な整形結果を維持します。
   - 断片順は現在のtask出力順を正本とし、reviewの分類ロジックをattachment側へ複製しません。

2. [prReviewAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:91)を、各Markdown断片へ個別に`fromMarkdown()`を適用する構造へ変更します。
   - 断片内offsetを完成task文字列上のoffsetへ対応付け、置換は全断片を通した出現順で行います。
   - URL重複排除用`Map`、予約済み画像番号の走査、画像番号割当はtask全体で共有します。
   - 同一断片内のコードフェンス、inline code、HTMLコメント、`pre`などは引き続き画像として扱いません。
   - Markdown parser、download、MIME、サイズ、認証、URL許可条件、cleanup契約は変更しません。

3. 次の3入口を新しい断片付き内部契約へ移行し、連結済み文字列を直接解析する旧利用経路を残しません。
   - `takt add --pr`: [add/index.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/add/index.ts:203)
   - 対話CLI `--pr`: [routing-inputs.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/app/cli/routing-inputs.ts:52)
   - pipeline `--pr`: [steps.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/pipeline/steps.ts:222)

4. 回帰テストを更新します。
   - [prReviewAttachments.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/prReviewAttachments.test.ts:59)
     - PR本文の未閉鎖フェンス後でも、review summary・review thread・通常コメントの画像が検出・置換される。
     - 未閉鎖フェンス内の画像らしい文字列は検出されない。
     - 同一URLを異なる断片に置いた場合も1回だけdownloadする。
     - 断片間の出現順、予約済み番号、画像番号割当を維持する。
   - [pr-image-dataflow.integration.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/pr-image-dataflow.integration.test.ts:36)
     - 未閉鎖PR本文と後続コメント画像を入力し、保存済みtask、`attachments/`、run contextの`order.md`まで画像とplaceholderが届くことを実filesystemで検証する。
   - `addTask.test.ts`、`cli-routing-pr-resolve.test.ts`、`pipelineExecution.test.ts`のmock契約と期待値を新しい内部契約に合わせ、3入口が共通経路を利用することを確認します。

完了条件は、先行断片の構文状態が後続断片へ漏れず、全対象本文の画像が保存・置換される一方、同一断片内のリテラル除外と既存の順序・重複排除・採番が維持されることです。

### 2. `e2e-runner-attempt-boundary`

対象 finding: `TEST-NEW-e2e-runner-attempt-boundary-L31`

1. [run-e2e-mock-shards.mjs](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/scripts/run-e2e-mock-shards.mjs:138)で、本番attemptの次の責務を1つのテスト可能な境界として抽出します。
   - attemptごとの隔離環境生成
   - executable、args、`cwd`、隔離`env`の`runTeedCommand()`への伝播
   - 成功・起動失敗を問わない`finally` cleanup
   - `runShardAttempt()`はこの境界を直接使用し、別の実装を持ちません。

2. orchestrationの再測定条件、shard構成、timeout、結果判定は変更しません。
   - 初回とbirpc再測定は同じattempt実行関数を通す現在の構造を維持します。
   - [teed-command.mjs](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/scripts/teed-command.mjs:14)のprocess実行契約は変更せず、実境界テストから`cwd`と`env`を観測します。

3. `src/__tests__/it-e2e-mock-runner-attempt.test.ts`をheavy ITとして追加します。
   - 実Node child processが指定`cwd`と隔離された`HOME`、XDG、`TMPDIR`、`TAKT_CONFIG_DIR`を受け取ることをchild出力から確認する。
   - 複数attemptの隔離rootが異なることを確認する。
   - 正常終了後に各rootが削除されることを確認する。
   - 存在しないexecutableによる代表的なspawn失敗でもrootが削除され、失敗が上位へ伝播することを確認する。
   - birpc noiseを返す初回と再測定を同じ本番attempt境界で実行し、両方が独立環境を持つことを確認する。
   - `it-*.test.ts`の既存分類規則によりheavy ITへ接続し、分類定義の追加変更は行いません。

4. [e2eMockRunner.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/e2eMockRunner.test.ts:49)は、再測定判断と初回完了後の順序検証に限定し、heavy ITと役割を分けます。

完了条件は、本番と同じattempt境界を通る実child processで伝播・分離・cleanupが観測され、初回と再測定の双方に同じ契約が適用されることです。

## 実施順と検証

2 familyは独立しています。各修正と対象テストを完了後、以下を実行します。

1. `npm test -- src/__tests__/prReviewAttachments.test.ts`
2. `npm test -- src/__tests__/pr-image-dataflow.integration.test.ts`
3. `npm test -- src/__tests__/it-e2e-mock-runner-attempt.test.ts`
4. `npm test -- src/__tests__/releaseVerificationWiring.test.ts`
5. `npm run build`
6. `npm run lint`
7. `npm test`
8. `npm run test:it`
9. `npm run test:e2e:mock`

全heavy ITのローカル実行、parser交換、Markdown補正、runner再設計、timeout・shard・再測定条件変更、legacy fallback、周辺リファクタリングは実施しません。