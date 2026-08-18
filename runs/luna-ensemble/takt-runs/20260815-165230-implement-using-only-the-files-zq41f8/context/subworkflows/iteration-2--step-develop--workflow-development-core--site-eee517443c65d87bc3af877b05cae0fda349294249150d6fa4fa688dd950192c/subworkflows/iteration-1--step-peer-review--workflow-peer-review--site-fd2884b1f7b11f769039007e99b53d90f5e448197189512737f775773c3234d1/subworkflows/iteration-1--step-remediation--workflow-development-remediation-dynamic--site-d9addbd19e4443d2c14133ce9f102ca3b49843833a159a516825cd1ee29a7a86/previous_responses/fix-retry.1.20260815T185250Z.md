問題は、最新検証で未完了とされた U6（画像一時資源の明示終了・初期化失敗経路）と U7（`github-pr.test.ts` の実 filesystem テスト分類）を、計画の範囲内で修正することです。まず必須の実装方針・ポリシー・完了検証を原文で確認し、対象経路を再走査してから編集します。コード変更のため `coding` スキルも適用します。
必須スキルの参照資料（Coder、AIアンチパターン、Architecture、コーディング方針）とタスク正本 `order.md` は確認しました。次に、今回の remediation 専用 Knowledge / Policy を全量確認し、最新検証で指定された U6・U7 の実コードとテスト分類の現状を照合します。
最新の `fix-verification.md` と `fix-plan.md` を確認し、再発判定は計画どおり消費します。U6 は初回の `判定できない（初回）/未確認` で、U7 も同じ状態です。前回の「通常経路は成立」という証拠は維持し、今回の編集対象は未到達の明示終了・routing初期化失敗と `github-pr.test.ts` の分類配線に限定します。ここから実コードの全呼び出し経路を確認します。
実コードの再確認で原因を確定しました。`downloadGitHubPrImages()` は temp directory 作成後、全画像取得が終わるまで `process.once('exit', ...)` を登録していないため、取得中の `process.exit()` で cleanup できません。また routing は `resolvePrInput()` が返した resource を保持した後、外側の cleanup 範囲に入る前に `resolveBaseBranch()` を呼ぶため、初期化例外で cleanup を迂回します。U7 は classifier の filesystem 配列に `pipelineExecution.test.ts` しかなく、実 filesystem を通る `github-pr.test.ts` が未接続です。これらを直接修正し、実 process exit の回帰テストも追加します。
U6 の owner 登録を temp directory 作成直後へ移し、失敗時も同じ resource handle の cleanup を通すようにしました。routing は PR resource 取得から workflow 初期化・interactive dispatch までを単一 `try/finally` の範囲に含めました。U7 は `github-pr.test.ts` を light IT の filesystem 分類へ移し、実 `process.exit()` を子プロセスで検証する U6 回帰テストを追加しました。まず対象テストを実行します。
U6の実プロセス終了経路テストを実行中です。完了後、影響テスト・分類契約・ビルド・lintを再確認し、編集差分の未使用参照と依存方向も走査します。
子プロセスの終了コード不一致は、検証用の `--eval` 文字列にTypeScriptの非nullアサーション（`!`）を含めていたことが原因でした。実装側ではなくテストプローブの構文問題なので、プローブを実行時JavaScriptへ修正します。
U6の実プロセス終了テストは成功し、終了コード17の直前に出力したtemp fileと親directoryの不存在を確認できました。次に、routing初期化失敗、画像準備、pipeline/add利用側、分類契約を再実行します。
影響テストは全て成功しました。`github-pr.test.ts`と`pipelineExecution.test.ts`はlight IT、`addTask.test.ts`はheavy IT、画像parserとroutingはunitへ分類され、分類契約も17件成功しています。分類契約内の想定エラー出力はテストが通過しており、次に品質ゲートを確認します。
light ITは133ファイル・2146テスト全て成功しました。U6/U7の実装検証は通っているため、最後にunit全体、差分と依存方向のセルフスキャンを行い、必要なら追加の修正後に該当ゲートを再実行します。
## 作業結果

- 修正完了

## 変更内容と受入条件

- U6: temp生成直後にresource ownerと同期終了cleanupを登録し、routing初期化失敗時も外側`finally`でcleanupする構造へ修正。
- U7: `github-pr.test.ts`をfilesystem分類へ追加し、unitではなくlight ITで実行。
- 明示的な`process.exit()`、routing初期化失敗、親directory削除を回帰テストで検証。

## 検証結果と証拠

- heavy lifecycle test: 1件成功
- 影響テスト: 5ファイル・159件成功
- 分類契約: 17件成功
- light IT: 133ファイル・2146件成功
- unit: 341ファイル・5335件成功
- `npm run build`、`npm run lint`、`git diff --check` 成功
- 編集後の旧cleanup経路・未使用参照・依存方向を走査済み

主な変更箇所: [pr-images.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/infra/github/pr-images.ts:417)、[routing.ts](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/src/app/cli/routing.ts:115)、[test-classification.mjs](/Users/nrs/work/git/takt-worktrees/20260815T0946-pr-komento-no-wodaunroodoshite-fcfa1dc27f5ea53f/scripts/test-classification.mjs:200)。