Let me examine the caller and test files to understand the expected behavior.
Let me look at the verifier's specific concerns and the current routing.ts structure. I've read the file. Now let me make the structural fixes for the three remaining obligations.
Now I'll restructure the main try block to include the prContext setup and config resolution within the cleanup boundary.
Now handle the `process.exit(1)` in the save_task handler which bypasses the finally block. Let me view the current state:
Let me check the cleanup function's idempotency and the test expectations around the process.exit path.
Let me check the `resolvePrInput` cleanup idempotency and the `prReviewImageAttachments.ts` producer.
Now I'll handle the `process.exit(1)` in the save_task handler which bypasses the finally block. I need to call cleanup before exiting:
Let me verify the full file structure now:
Now let me verify the full file and check that `resolveBaseBranch` is still used (it's now inside the try block):
The structure looks correct. Now let me run the routing tests to verify.
All 31 routing tests pass. Now let me run the other affected test files and the classification contract.
All tests pass (86 + 50). The `check:release failed` message is expected output from the releaseVerificationWiring test. Let me run lint and the full unit gate.
Lint passes. Let me run the full unit test gate.
All 4 shards pass. Let me run the build and light IT gate.
All gates pass. Let me do the self-scan for unused imports/variables in the edited file.
All imports remain used. Let me verify the final save_task and finally block:
The `process.exit` path now cleans up before exiting. Since both cleanups are idempotent (producer uses `cleaned` flag, `cleanupInteractiveResultAttachments` uses `cleanupAttachments` with `cleaned` flag), the mocked-exit test path (where `process.exit` throws and finally runs) is also safe.

Let me run the mock E2E since I touched CLI routing behavior.
All gates pass. Let me write the report.
## 作業結果
- 修正完了

## 変更内容と受入条件
`F-PR-IMAGE-LIFECYCLE` の修正計画を完了させ、verifier が指摘した3つの未完了義務（`OBL-3-PRE-DISPATCH-EXCEPTION` / `OBL-3-CONFIG-EXCEPTION` / `OBL-3-TERMINAL-EXIT`）をすべて解消した。

`src/app/cli/routing.ts` を再構成し、PR 解決後の prContext 構築（`resolveBaseBranch` / `createPullRequestContext`）と設定解決（`resolveConfigValues` / `resolveLanguage`）を cleanup 保証境界（try/finally）内へ移動した。これにより cleanup 関数取得後から dispatch 完了までの全例外経路で `prAttachmentsCleanup` が実行される。実 `process.exit(1)` 経路（save_task の head branch 欠落）は、終了前に `cleanupInteractiveResultAttachments(result)` と `prAttachmentsCleanup?.()` を明示実行してから exit する構造へ変更した。

受入条件「一時ディレクトリ生成後の成功・失敗・キャンセル・例外すべてで削除されること」を満たす。cleanup の冪等性（`cleaned` フラグ）は維持。

## 検証結果と証拠
- `npm run build` 成功
- `npm run lint` 成功
- `npm test` 全シャード成功（1864 / 1519 / 1499 / 1161 件、失敗なし）
- 対象テスト `npm test -- cli-routing-pr-resolve.test.ts cli-routing-issue-resolve.test.ts addTask.test.ts prReviewImageAttachments.integration.test.ts pipelineExecution.test.ts releaseVerificationWiring.test.ts` 全成功（31 + 86 + 50 件）
- `HOME=/tmp/takt-bench-v3-home npm run test:it` 全成功（2357 件）
- `npm run test:e2e:mock` 全成功（55 passed / 13 skipped / 30 todo）

編集後セルフスキャン: 追加・変更した import / 変数 / 分岐に未使用化・依存方向違反・共通責務の重複は確認されず、`resolveBaseBranch` / `createPullRequestContext` / `resolveConfigValues` / `resolveLanguage` はすべて try 内で使用され、`prAttachmentsCleanup` は finally と save_task exit 分岐で使用された。