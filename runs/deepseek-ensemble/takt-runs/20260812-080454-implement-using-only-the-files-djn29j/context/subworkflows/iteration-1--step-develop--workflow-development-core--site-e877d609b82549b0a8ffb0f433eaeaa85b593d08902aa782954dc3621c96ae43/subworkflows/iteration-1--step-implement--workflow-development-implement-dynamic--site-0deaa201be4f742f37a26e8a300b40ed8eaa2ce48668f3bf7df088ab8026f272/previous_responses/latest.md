I'll start by reading the task specification and report files to understand what needs to be implemented.
Let me read the report files and the policy/knowledge source files.
The report directory for this step is empty (this is the first run of implement). The primary plan is in the develop subworkflow. Let me read the plan and related files.
This is a large task. Let me check the current state of the repo and test files.
Let me continue reading the policy and knowledge files, and examine the test files that were created.
Let me read the test files that were created to understand the expected API contracts.
Let me read the integration test and the other test files.
Let me read the remaining test files that were modified.
Now let me read the diffs for the remaining modified test files.
Let me create a todo list and examine the key production files.
Let me examine the key production files. Let me look at the interactive image handling and existing image format knowledge.
Let me look at the interactive seed input type and the pipeline files.
Let me look at the task execution path and task spec context for pipeline wiring.
Let me examine the addTask test helpers and the `executeTask`/`PipelineExecutionOptions` types.
I now have a thorough understanding. Let me check a couple more details: how `gh` token is obtained and the format.ts.
Let me check existing patterns for `gh auth token` and http fetch usage in the codebase.
Let me check the pipeline index and testUtils helper.
Now I have a thorough understanding. Let me start implementing. First, the shared image format utility.
Now let me create the PR review image attachments module. This is the core new logic.
Let me remove the unused `writtenPaths` variable.
Now update the git types to add the capability.
Let me remove the local `StoredImageAttachment` definition and keep only the import.
Now update the git index to export the new capability type, and update the GitHubProvider.
Now add the capability method to GitHubProvider.
Now let me refactor the interactive image files to use the shared imageFormat and fix numbering.
Now update `imageAttachments.ts` to use shared imageFormat for extension and to number after initial attachments.
Now add the `nextAttachmentNumber` helper function.Let me add it near the top of the file.
I need to reconsider the add flow. The tests expect `resolvePrReviewImageAttachments` to always be called for PRs, and cleanup in all exit paths. Let me rewrite the PR branch.
I should only pass attachments when non-empty to preserve existing behavior for image-less PRs.
Now update `routing-inputs.ts` to resolve PR images.
Now update routing.ts to handle attachments and cleanup.
Now let me wire the pipeline. First update `steps.ts`.
Let me make `resolveTaskContent` async and resolve PR images, and update `runWorkflow` to build the task spec.
Now update `runWorkflow` to accept attachments and build the task spec.
I need to pass `reportDirName` (not `runSlug`) to `executeTask`, consistent with `selectAndExecute`. Let me fix and add the imports.
Now update `execute.ts` to pass attachments to runWorkflow and handle cleanup.
Let me check `prepareEnqueuedTaskSpecDirectory` behavior for the pipeline test (which uses `/tmp/test` as cwd).
Let me build to check for compile errors before running tests.
Build passes. Now let me run the targeted test files.
The tests expect extraction-stage `fileName` to already be `image-N.png`, and the download should preserve `reference.fileName`. Let me fix the extraction and download logic. First let me check which 4 tests failed.
The `fileName` should be `image-N.png` at extraction time, and download should use it directly. Let me look at the failing code tests and fix both the extraction fileName and the split logic.
Now fix the download to use the reference fileName base with the detected extension.
Now I need to fix the code-block extraction. The `splitNonCodeSegments` accumulates everything including code. Let me rewrite it to return only non-code content.
Both extraction tests pass. Now let me run the integration test and the other modified tests.
The test mock provides plain-object headers, not a `Headers` instance. Let me make header reading compatible with both.
The mock provides `body` directly as a Buffer. Let me handle both forms.
Let me fix the `readResponseBody` type to accept the Response type.
Let me check how the repo handles similar fetch-token patterns before adjusting.
The test expects the first argument to `fetch` to expose `.headers`. Let me check how the mock's `RequestInit`-typed first argument is intended. Let me experiment with the actual behavior.
Let me test how the Headers/Request matching behaves.
The test reads `mock.calls[0]![0]` (first arg) as the RequestInit with `.headers`. My implementation passes the URL as first arg and init as second. Let me verify what form satisfies the test's `objectContaining` matcher against a `Headers` instance.
I need to understand what the test expects. It reads `calls[0][0]` (first fetch arg) as a `RequestInit`. Let me check whether a plain object vs Headers matches the matcher.
Let me verify whether a Request's headers matches objectContaining.
The test reads `fetchMock.mock.calls[0]![0]` as the first fetch argument and expects `.headers`. Let me verify whether a `Request` object's headers matches this matcher in this vitest version.
The test expects the first fetch arg to be a plain object with `.headers`. Let me check how the repo's other fetch-based code is invoked/asserted.
Now let me run the other modified tests: github-provider, imageAttachments, addTask, cli-routing-pr-resolve, pipelineExecution.
The existing tests didn't set up `mockResolvePrReviewImageAttachments`. Let me check the existing PR tests in addTask to set up the default mock.
The existing PR tests need a default `resolvePrReviewImageAttachments` mock. Let me add it to `beforeEach`.
The test's default mock returns `prReview: undefined`. It should return the passed prReview.
The pipeline tests pass a non-existent temp file path. The real `prepareTaskSpecDirectory` requires the file to exist. I'll create the temp file in these two tests.
These two tests reference a non-existent temp image. Let me create real temp files.
I need to add imports for `fs`, `path`, `os`. Let me check the top of the file.
That edit was wrong. Let me fix it.
I accidentally removed the `mockBuildTaktManagedPrOptions` setup. Let me restore it.
Now let me run the pipeline tests.
All targeted tests pass. Now let me run the classification contract test, then build and lint.
The `pipelineExecution.test.ts` now imports `node:fs`, `node:os`, `node:path` unmocked, which triggers the integration-boundary detection. I'll mock the task-spec helper functions instead of doing real filesystem I/O, keeping it a unit test.
I need to mock the attachments helpers instead of doing real filesystem I/O. Let me revert the two test changes and mock the modules.
I need to mock the attachments/taskSpec modules in the pipeline test. Let me add those mocks.
Lint passes. Let me run the full unit gate.
My PNG detection is now stricter (8-byte signature) than the original 4-byte check. Let me check what the lineEditor test uses.
The existing `inlineImagePaste` uses a lenient 4-byte PNG check, while the shared `detectImageMimeType` is stricter (8-byte). These are different contracts — the download path needs strict validation, the paste path is lenient. I should not refactor the paste detection. Let me revert that change.
Let me move the import to the top for style consistency.
The `git-cwd-propagation.test.ts` mock provider doesn't include the new capability. Let me add it.
Unit gate passes. Now run the light IT gate.
Light IT passes. Now let me run the E2E mock tests.
All E2E mock tests pass. Since the change affects CLI routing and workflow execution, let me run the smoke E2E gate.
Let me re-run build and lint to confirm everything is still clean after the edits.
Build and lint pass. Now let me do the self-scan of my edits for dead code, unused exports, and dependency direction.
Let me review the full extraction logic for the now-redundant `fileNameByPlaceholder` map.
The `fileNameByPlaceholder` map is redundant since `fileName` is now `image-${number}.png`. Let me simplify.
Let me simplify by building references directly in the loop instead of a separate pass.
Let me rebuild and re-run the affected tests after the refactor.
Now let me check the `routing.ts` import of `InteractiveImageAttachment` is used, and review the whole diff for dead code.
Let me verify the routing-inputs cleanup return type and its use.
The capability is optional (GitLab doesn't implement it). I need to guard the calls so GitLab `--pr` flow still works without image resolution. Let me update the call sites to check capability presence.
Let me run lint and the full unit gate once more to confirm all clean.
Let me re-run the light IT gate afterthe capability-guard changes.
Let me re-run the mock E2E after the capability-guard refactor to confirm no regression.
All gates pass. Let me re-run the smoke E2E since routing/pipeline code changed.
Let me review the final production diff for correctness and dead code.
There's an accidental newline removal in `git/index.ts`. Let me fix that.
Let me fix the import placement in `types.ts` (imports should be at top).
Let me review the add/index.ts PR branch and pipeline execute for correctness.
Let me do a final build and lint verification.
Let me do a final self-scan for unused exports and verify the complete production diff is coherent.
The grep output shows a display artifact (`n` replacing identifiers). Let me verify the actual file content directly.
The grep display was just a rendering artifact. Everything is correctly named. Let me verify the build once more after all edits.
All gates pass. Let me write the implementation report to the report directory.
Let me write the implementation report and decisions to the report directory.
The implementation is complete. Let me do a final verification of the complete production diff.
The implementation is complete. Let me mark the final todo as done and provide a summary.
実装が完了しました。

## 作業結果
PR コメント内の画像をダウンロードして task attachments に配置する機能を、計画（plan.md）に基づいて実装しました。

## 変更内容
- **新規作成**
  - `src/shared/utils/imageFormat.ts` — PNG/JPEG/GIF/WebP の magic bytes 判定・MIME→拡張子変換・共通上限（10 MiB）
  - `src/infra/github/prReviewImageAttachments.ts` — 画像 URL 抽出（Markdown/HTML、コード領域除外）、認証付き取得・検証、一時保存、cleanup
  - 単体テスト3ファイル（`imageFormat` / `prReviewImageAttachments` / `prReviewImageAttachments.integration`）
- **配線変更**
  - `GitProvider` へ任意 capability `resolvePrReviewImageAttachments` を追加（GitHub のみ実装、GitLab は変更なし）
  - `add --pr`・直接 `--pr`（routing）・pipeline `--pr` の3入口で画像解決を実行し、全終了経路で cleanup
  - pipeline は既存 `prepareTaskSpecDirectory`→`resolveTaskSpecForExecution` を利用して attachment 付き task spec を実行
  - 対話モードの採番を初期 attachment と衝突しないよう修正

## ビルド結果
- `npm run build`、`npm run lint`: 成功

## テスト結果
- `npm test`: 成功（unit gate 全 pass）
- `HOME=/tmp/takt-bench-v3-home npm run test:it`: 成功（2357 tests）
- `npm run test:e2e:mock`: 成功（55 passed）
- `npm run test:e2e:smoke`: 成功（21 passed）
- 対象テストファイル群: 全て pass

セルフスキャン実施済み（未使用化・依存方向・共通責務）。実 GitHub API 連携は外部依存のため test double で検証、実連携確認は手動/E2E が必要です。