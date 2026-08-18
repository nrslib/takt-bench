The report files don't exist yet (first iteration). Let me explore the context and report directories.
The report directory is empty (first iteration). Let me examine the current state of the changed files and the relevant source code.
The tests reference modules that don't exist yet. Let me examine the existing source structure.
Let me examine the existing PR implementation, pipeline execution, and task attachment mechanism.
Now let me look at the pipeline execution and task attachment mechanism.
Let me look at the pipeline execution and task attachment mechanism in detail.
Let me look at the pipeline steps and how the PR path flows through.
Let me look at the `ExecuteTaskOptions` type and how `taskSpec` flows through.
Let me look at the `ResolvedTaskSpec` type and how `taskSpec` is consumed in workflow execution.
Let me look at how `takt add` creates tasks with attachments, and the `add` feature.
Let me look at the full pipeline test file to understand the mocking setup and what's expected.
Let me look at the enqueueService and how taskSpec is built for the pipeline path.
Let me read the rest of the pipeline test to understand the full mocking setup and existing test patterns.
Let me look at the `StoredImageAttachment` type and the image attachment validation utilities.
Let me look at the format.ts and the existing imageAttachmentReferences test.
Let me look at the test-classification.mjs file and understand the classification structure.
Let me read the existing PR-related tests in the pipeline test file to understand the setup.
Now I have a thorough understanding. Let me look at the remaining pieces: the pipeline index, the `runWorkflow` callers, and the imageAttachments temp path convention.
Now let me create the `imageDownload.ts` module:
Now let me wire this into the pipeline. Let me update `steps.ts` to add attachments support.
Now update `resolveTaskContent` to download PR images:
Now add the import for `downloadPrImages`:
Now I need to wire the attachments into `runWorkflow`. Let me update the `runWorkflow` function to build a taskSpec when attachments exist.
I need to import `cleanupPreparedTaskSpec`:
Now update the caller in `execute.ts` to pass attachments:
Now let me run the build to check for type errors.
Build passes. Now let me run the specific test files.
The test's mock attachment points to a non-existent temp file. The pipeline validates the temp file exists. I need to update the test to create a real temp file.
The test needs a real temp file. Let me update it to create one.
I need to add the `fs` and `os`/`path` imports to the test file.
Now let me wire the `takt add --pr` path. Let me update `add/index.ts`:
Lint passes. Now let me run the full unit test gate and IT tests.
All unit tests pass. Now let me run the IT tests.
IT tests pass. Now let me run the mock E2E tests.
Let me check the dependency direction. `imageDownload.ts` imports `TaskAttachment` from `features/tasks/attachments.js`, which is a reverse dependency (infra → features). Let me use the shared type directly.
Now let me verify the `TaskAttachment` type is compatible. `TaskAttachment = StoredImageAttachment`, so the return type is compatible. Let me run the affected tests again.
Now let me verify the `takt add --pr` path. Let me check if there's an existing test for the add command that I should update.
The `addTask.test.ts` doesn't mock `imageDownload.js`, so the real `downloadPrImages` will run `gh api`. Let me check the test's beforeEach and add the mock.
I need to add a mock for `imageDownload.js` in `addTask.test.ts` so the real `gh api` isn't invoked. Let me add it.
Now let me check the `commands-add.test.ts` and `git-cwd-propagation.test.ts` which also reference the add path.
This test calls `addTask` with a PR number. It doesn't mock `imageDownload.js`, so the real `downloadPrImages` will run. Let me check the top of the file for existing mocks.
I need to add a mock for `imageDownload.js` in this test too. Let me add it.
Now let me check the `commands-add.test.ts` which mocks `addTask` directly (no real call), so it should be fine. Let me also check `it-runAllTasks-auto-requeue.test.ts` and `selectAndExecute-autoPr.test.ts` which reference `saveTaskFile`/`addTask`.
These mock `addTask` directly, so they don't invoke the real `downloadPrImages`. Now let me run the full unit test gate again to confirm everything passes.
All 4 shards pass. Now let me run the IT tests again since I changed the add path.
Now let me run the release verification wiring test as required by AGENTS.md, and check the classification contract.
The `pipelineExecution.test.ts` is now flagged as an unclassified boundary file. Let me look at the classification contract.
The `pipelineExecution.test.ts` now imports `node:fs` (real filesystem), triggering the integration boundary check. It needs to be classified. Let me check the classification lists.
The `pipelineExecution.test.ts` now imports real `node:fs`, triggering the integration boundary check. I'll mock `node:fs` in the test to keep it a unit test.
The release verification wiring test passes now. Let me run the full unit gate and IT again to confirm.
Now let me run lint and build once more to confirm everything is clean.
Now let me do the self-scan for unused code and dependency direction. Let me verify the `imageDownload.ts` doesn't leave unused imports and check the `runWorkflow` signature usage.
Let me verify the `imageDownload.ts` file for unused imports and check the `MutableBody` interface usage.
Let me verify the `runWorkflow` change is correct.
Let me verify the classification for `imageDownload.test.ts` and check the full diff.
Let me verify the classification of `imageDownload.test.ts` is correct. It uses real `node:fs` and mocks `node:child_process`. Let me check what `fileSystemIntegrationTestFiles` maps to.
Let me review the complete diff of my changes.
Let me verify the full diff of the pipeline test and confirm the fs mock is correct.
Let me verify there are no other tests that invoke the real `downloadPrImages` or `addTask` with PR that I might have missed.
All four test files that touch the new module are covered. Let me verify the `imageExtraction.test.ts` classification - it's a pure unit test (no fs/child_process), so it should be in the unit gate. Let me confirm it's not in any integration list.
Let me verify the final state of the `add/index.ts` change and confirm the `downloadPrImages` call is correct.
Let me verify the final diff of the source changes.
Let me run all the covering test files together as a final verification.
The "check:release failed" is expected log output from the releaseVerificationWiring test (it exercises the failure path internally). All test files passed. Let me confirm the releaseVerificationWiring test result explicitly.
All tests pass. Let me do a final build and lint verification.
All quality gates pass. Let me write the scope and decision reports.
実装が完了しました。

## 作業結果
PR コメント内の画像をダウンロードして task attachments に配置する機能を実装しました。

**新規モジュール:**
- `src/infra/git/imageExtraction.ts` — Markdown 画像構文と HTML `<img>` から URL を抽出し、プレースホルダへ置換する provider 非依存ユーティリティ
- `src/infra/github/imageDownload.ts` — GitHub attachment URL を `gh api` でダウンロードし、magic bytes（PNG/JPEG/GIF/WebP）とサイズ上限（10MB）を検証して `StoredImageAttachment[]` に変換

**配線:**
- `src/features/pipeline/steps.ts` / `execute.ts` — `--pr` 経路で `downloadPrImages` を呼び、attachment 付き taskSpec を組み立てて `executeTask` に渡す
- `src/features/tasks/add/index.ts` — `takt add --pr` 経路で `downloadPrImages` を呼び、attachment を `saveTaskFile` に渡す

**テスト:**
- `imageExtraction.test.ts` / `imageDownload.test.ts` を新規作成
- `pipelineExecution.test.ts` / `addTask.test.ts` / `git-cwd-propagation.test.ts` を更新
- `scripts/test-classification.mjs` に `imageDownload.test.ts` を統合テストとして分類

## ビルド・テスト結果
- `npm run build`: 成功
- `npm run lint`: 成功
- `npm test`: 4 シャードすべて成功
- `HOME=/tmp/takt-bench-v3-home npm run test:it`: 成功（1796 件）
- `npm run test:e2e:mock`: 成功（48 passed / 13 skipped）
- 対象テストファイル全件成功（imageDownload 9 / imageExtraction 11 / pipelineExecution 52 / addTask 17 / git-cwd-propagation 12 / releaseVerificationWiring 17）