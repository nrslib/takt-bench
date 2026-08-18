I'll start by reading the task spec and the plan to understand what tests to write.
Let me examine the existing source files and tests to understand the structure.
Let me look at the existing test files and source files referenced in the plan.
Let me look at the existing test files and the source files that will be modified.
Let me look at the other test files and source files referenced in the plan.
Let me look at the remaining source files and test files referenced in the plan.
Let me look at the pipeline files, GitHubProvider, and remaining test files.
Let me look at the GitHubProvider, the pipeline test, github-provider test, and the shared image types/utils.
Let me look at the pipeline test, github-provider test, inlineImagePaste, and test helpers.
Let me look at the remaining relevant files: inlineImagePaste, routing.ts, test helpers, and the classification contract.
Let me check the classification contract test, git index exports, and shared utils index.
Let me check the test classification script and an existing integration test for patterns.
Let me check the report directory and interactive.ts for the seed input structure.
Let me read the plan report and check the interactive.ts seed handling and the gitlab provider.
Let me look at the remaining key files: interactive.ts seed handling, taskSpecContext, selectAndExecute, and gitlab provider.
Let me look at selectAndExecute.ts and the gitlab provider.
Let me check the shared utils index, run-slug, and existing image-related tests.
Let me look at the taskExecution and run-paths, plus existing image test patterns.
Let me look at existing image-related test patterns and the ExecuteTaskOptions type.
Let me check git status and how seed attachments flow into the interactive store.
I now have a thorough understanding of the codebase and the plan. Let me set up a todo list and start writing the tests.
I have a thorough understanding now. Let me start writing the tests. First, the pure unit test for the shared image format module.
Now the core pure unit test for PR review image extraction/classification/numbering.
Now the light integration test for fetch/validation/cleanup. Let me design it against the planned API with injectable dependencies.
Now let me update the existing tests. First, `imageAttachments.test.ts` for non-sequential initial attachment numbering.
Now update `github-provider.test.ts` for capability delegation. Let me add a mock for the new module and a test.
Now add a test for the capability delegation in the GitHubProvider describe block.
Now update `addTask.test.ts` for PR image saving. Let me add the mock for the new capability and tests.
Now let me add tests to `addTask.test.ts` for PR image saving.
Now update `cli-routing-pr-resolve.test.ts` for seed attachments. Let me add the mock and tests.
Now add a default mock in `beforeEach` so existing tests don't break, and add new tests.
Now add tests for seed attachments in the `--pr option` describe block.
Now update `pipelineExecution.test.ts`. Let me add the capability mock and tests.
Now add a test in the `--pr pipeline` describe block for attachment task spec.
Now let me run the tests to confirm they fail due to unimplemented production behavior. Let me first check the classification contract for the new integration test.
Dependencies aren't installed. Let me install them.
The new unit tests fail because the production modules don't exist yet — expected test-first behavior. Now let me run the modified existing tests to confirm they fail only due to unimplemented production behavior.
These files are classified as integration tests (in `auditedIntegrationBoundaryTestFiles`), so they run in the heavy IT gate. Let me run them there.
Both failures are due to unimplemented production behavior. Now let me run the addTask, cli-routing, and pipeline tests.
The addTask tests fail as expected. Let me verify the cli-routing and pipeline tests ran and check their results.
The cli-routing test isn't in the heavy IT list. Let me check where it's classified.
These run in the unit gate. Let me run them there.
All new tests fail due to unimplemented production behavior. Let me see the full failure list to confirm all are expected.
All 5 new tests fail due to unimplemented production behavior; existing tests pass. Now let me verify the new integration test fails due to missing module and run the classification contract test.
The new integration test matches the heavy parallel glob. Let me check the light IT config to determine proper classification.
The new IT file matches the heavy parallel glob. Let me run the classification contract test to verify it doesn't break.
The classification contract passes. Let me verify the new integration test fails due to missing module in the heavy IT config.
All new tests fail due to unimplemented production behavior; existing tests pass. Let me update the todos and do the self-scan.
Let me do the self-scan of my edits. Let me verify the new test files don't reference non-existent exports and check for unused imports.
The `package-lock.json` was modified by `npm install`. Let me check if it's a meaningful change I should revert.
The package-lock.json change is an incidental npm artifact (integrity hash stripping), unrelated to my task. Let me revert it to keep the diff clean.
Now let me do the self-scan. Let me verify the new test files don't have unused imports and that the referenced production exports are consistent with the plan.
TypeScript compiles cleanly. Let me run lint on the test files to check for unused imports/vars.
Test files are eslint-ignored (expected). Let me verify how tsc passed given the production modules don't exist yet.
All tests are in place and verified. Let me do a final self-scan confirmation of the new test files' imports being used.
All imports are used. Let me write the test report to the report file.
Test-first 工程を完了しました。

## 成果物

**新規テスト**
- `src/__tests__/imageFormat.test.ts` — magic bytes 判定・MIME→拡張子・サイズ上限
- `src/__tests__/prReviewImageAttachments.test.ts` — 抽出・分類・採番（本文/コメント/thread、Markdown/HTML、コード領域・外部URLの非検出、重複集約、衝突回避、入力不変）
- `src/__tests__/prReviewImageAttachments.integration.test.ts` — 認証付き取得・Content-Type/magic/サイズ検証・途中失敗時清掃

**更新テスト**
- `imageAttachments.test.ts`（非連番初期attachment後の採番）
- `github-provider.test.ts`（capability委譲）
- `addTask.test.ts`（PR画像保存・添付節・本文画像のみ・清掃）
- `cli-routing-pr-resolve.test.ts`（seed attachments・キャンセル/例外時清掃）
- `pipelineExecution.test.ts`（attachment付きtask spec・失敗時清掃）

## 検証結果

全新規テストが**未実装のプロダクション動作を理由に失敗**することを確認（test-first の期待どおり）。既存テストは回帰なし。`releaseVerificationWiring.test.ts` 20件成功（分類契約維持）、`tsc --noEmit` 成功。

プロダクションコードは一切変更していません。次の `implement` ステップで `src/shared/utils/imageFormat.ts`、`src/infra/github/prReviewImageAttachments.ts`、各入口配線を実装すれば、これらのテストが通る設計です。