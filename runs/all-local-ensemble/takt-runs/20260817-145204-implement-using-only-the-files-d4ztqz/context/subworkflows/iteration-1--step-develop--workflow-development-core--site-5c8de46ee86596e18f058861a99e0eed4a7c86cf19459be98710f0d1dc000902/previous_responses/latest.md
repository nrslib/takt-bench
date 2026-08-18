I'll start by reading the task spec, plan, policy, and report directory to understand the current state.
The plan has been updated with IMG-1 through IMG-6 contracts. This is the write_tests step. Let me read the full policy and the relevant source files.
Let me read the rest of the policy and check the internal history.
Let me check the internal history and the knowledge file, plus the key source files.
Now let me examine the key source files to understand types and conventions for writing tests.
Let me look at the existing tests and the source files that will be modified.
Let me look at the existing tests and the attachments/pipeline source to understand conventions.
Let me look at the pipeline steps, execute, format, and github pr source files.
Let me look at the pipeline execute.ts, format.ts, github pr.ts, and existing pipeline tests.
Let me look at the github pr.ts, git index exports, and existing pipeline tests.
Let me look at the existing pipeline tests, imageAttachments test, and the StoredImageAttachment type.
Let me look at the existing git-format and github-pr tests, and the imageAttachments test.
Let me look at the github-pr test and addTask test to understand mocking conventions.
Let me check the git status and the pipeline-pr-submission test to understand pipeline test conventions.
Let me check the test classification contract and how tests are routed.
Let me check the test classification script to understand how new test files are classified.
Let me look at the pipeline execution tests and test-setup to understand conventions.
Let me check the releaseVerificationWiring test and how classification is verified.
Now I have a good understanding. Let me check the git index exports and the pipeline index to understand module structure, then write the tests.
Now I have a thorough understanding. Let me check the git index exports and the plan's scenario requirements, then write the tests. Let me verify the plan's contract details once more and check the `git/index.ts` exports for the new modules.
Now I have a thorough understanding. Let me create the test files for the new modules. First, the image extraction tests (IMG-1, IMG-4, and scenarios SCN-IMG-1-P1/N1, SCN-IMG-3-P1/N1).
Now the image download tests (IMG-2, IMG-6):
Let me fix the last test to match the plan's contract (bodies should be replaced with placeholders).
The first of those two tests asserts unchanged bodies, which contradicts the replacement contract. Let me remove it since the replacement test covers the same scenario.
Now let me verify the tests compile and run. First, let me check the test classification - these new test files use `node:fs` (imageDownload) and `node:child_process` (mocked). Let me check whether they need classification.
Dependencies aren't installed. Let me install them.
Now let me run the new tests. But first, the new modules don't exist yet (this is test-first). Let me run them to confirm they fail due to missing production code.
There's a syntax error in imageDownload.test.ts. Let me fix it.
There's an extra closing brace. Let me fix it.
The tests fail as expected (production modules don't exist yet - test-first). Now I need to handle test classification. `imageDownload.test.ts` imports `node:fs` unmocked, so it crosses a real filesystem boundary and must be classified as a light IT. Let me verify this is required.
The `imageDownload.test.ts` imports `node:fs` unmocked (real filesystem), so it must be classified as a light IT. Let me add it to the classification file.
Now let me verify the classification contract test passes with the new file.
The classification contract passes. Now let me verify the new tests fail for the right reason (missing production modules) and that the test files themselves are syntactically valid. Let me run them through the light IT runner since imageDownload is now classified as light IT.
Both tests fail as expected (missing production modules - test-first). Let me confirm imageExtraction also fails only due to the missing module, not a syntax error.
Both new test files fail only due to missing production modules (expected test-first behavior), confirming the test files are syntactically valid. Let me do the self-scan and verify the final test files.
Let me consolidate the duplicate vitest import in imageDownload.test.ts.
Now let me run lint on the new test files to ensure they pass the project's lint rules.
The test files are excluded from lint (expected). Let me verify the type-contracts check doesn't include test files (which reference non-existent modules).
The type-contracts check only covers `src/__tests__/type-contracts/**` and `src/types/**`, so my new test files (which reference not-yet-implemented modules) don't break the build. The main tsconfig excludes `src/__tests__`. Let me verify the build still passes since production code is unchanged.
Build passes. Now let me verify the classification contract test still passes after my edit, and run the full unit gate to ensure no regressions.
The classification contract passes. Now let me run the full unit gate to ensure no regressions from my changes.
The unit gate failed on shard 1/4. Let me investigate.
The unit gate failure is expected: `imageExtraction.test.ts` fails only because the production module `imageExtraction.js` doesn't exist yet (test-first). This is the intended test-first state. Let me confirm the git status shows only my intended changes.
The `package-lock.json` was modified by `npm install` (a side effect, not part of my test work). Let me check and revert it.
The `package-lock.json` change is an unintended side effect of `npm install` (removing integrity hashes). This is not part of my test work. Let me revert it.
Now the working tree only contains my intended changes. Let me do the self-scan: verify no unused imports in my test files.
All imports are used. Let me verify the final state of the classification change and confirm the test files are complete.
The classification change is correct: `imageDownload.test.ts` uses real filesystem (`node:fs` unmocked) so it's a light IT; `imageExtraction.test.ts` is a pure unit test. Let me do a final verification that the classification contract passes and confirm the test-first state.
The classification contract passes. Now let me address the plan's IMG-5 contract (pipeline `--pr` path passes attachments to `executeTask`). This is a wiring contract that needs an integration test. Let me add a focused test to `pipelineExecution.test.ts` that verifies the pipeline `--pr` path calls `downloadPrImages` and passes attachments to `executeTask`.
The plan's IMG-5 contract (pipeline `--pr` path passes attachments to `executeTask`) needs a wiring test. Let me add a mock for `downloadPrImages` and a test to `pipelineExecution.test.ts`.
Now let me add the IMG-5 wiring test in the `--pr pipeline` describe block.
I made an error - I accidentally removed the body of the first test. Let me revert that.
Now let me add the IMG-5 wiring test at the end of the `--pr pipeline` describe block. Let me find the end of that block.
Now let me add the IMG-5 wiring test at the end of the `--pr pipeline` describe block (before line 1546's closing `});`).
Let me verify the actual `executeTask` signature to write a correct IMG-5 test. The plan says pipeline should pass a task spec (via `prepareTaskSpecDirectory` + `resolveTaskSpecForExecution`), not `attachments` directly.
The plan says pipeline should pass attachments via `taskSpec` (prepared via `prepareTaskSpecDirectory` + `resolveTaskSpecForExecution`), not an `attachments` field. Let me check how `selectAndExecuteTask` builds the taskSpec.
The plan's approach (step 4) is to pass attachments via `taskSpec` (built by `prepareTaskSpecDirectory` + `resolveTaskSpecForExecution`), not an `attachments` field. Let me fix my IMG-5 test to assert the correct contract.
Let me run the pipelineExecution test to confirm the IMG-5 test fails in test-first state (production code doesn't call `downloadPrImages` yet).
The IMG-5 test fails as expected (production code doesn't call `downloadPrImages` yet - test-first). Let me verify the failure reason is the expected one.
The IMG-5 test fails for the expected reason: `downloadPrImages` is not called by the production pipeline code yet (test-first). This confirms the test correctly detects the missing wiring.

Now let me verify the full unit gate passes (excluding the expected test-first failures) and run the classification contract. Let me run the unit gate excluding the new test files to confirm no regressions.
The unit gate has 2 expected test-first failures (imageExtraction missing module, pipelineExecution IMG-5 wiring). Let me confirm the full unit gate only has these expected failures.
The unit gate has exactly 2 expected test-first failures (missing production code), all other tests pass. Let me do the final self-scan and verify the working tree state.
The pipelineExecution diff shows 23 deletions - let me verify I didn't accidentally break the existing test.The diff shows 23 deletions. Let me check what was removed - I need to verify I didn't accidentally break the existing test.
The diff shows my edits introduced CRLF line endings (the `+` lines have `\r`). Let me check and normalize to LF to match the original file.
The file now has mixed CRLF/LF line endings. Let me normalize to LF to match the original.
Now the file is normalized to LF. Let me verify the diff is now clean (only my intended additions).
The whole file shows as changed because the original had CRLF line endings and I converted everything to LF. I need to restore the original and re-apply my edits while preserving CRLF. Let me restore and redo.
The original file uses CRLF line endings. My edits introduced LF. Let me re-apply the edits and then convert the whole file back to CRLF to match the original.
Now let me convert the whole file back to CRLF to match the original.
Now the file is all CRLF. Let me verify the diff is now minimal (only my intended additions).
The diff is still huge because the original file has mixed CRLF/LF line endings and my conversion made it all CRLF. Let me restore and check the original line-ending pattern precisely.
The original file has mixed line endings (928 CRLF, 611 LF). My line-ending conversion caused the whole-file diff. Let me re-apply the edits without any line-ending conversion, letting the edit tool preserve existing endings.
Now let me check the diff to see if the edit tool preserved the original line endings.
The diff is now minimal (71 lines changed, only my intended additions). The removed lines are just the re-inserted mock block (the edit tool replaced the block to add `mockDownloadPrImages`). Let me verify the diff is clean.
The diff is now minimal and clean. Let me verify the test still runs correctly (IMG-5 fails as expected in test-first state).
The IMG-5 test fails as expected (test-first). Let me verify the classification contract still passes and do the final self-scan.
Let me do the final self-scan and verify the complete working tree state.
The working tree is clean with only my intended changes. Let me do a final verification that the new test files fail only due to missing production modules (not syntax errors), confirming test-first state.
Both new test files fail only due to missing production modules (expected test-first state). All work is complete.

## 完了報告

### 作成したテスト（test-first）

**1. `src/__tests__/imageExtraction.test.ts`**（unit）
- `extractImageUrls`: Markdown 画像構文・HTML `<img>` の抽出、コードフェンス/インラインコード内の非抽出、文書順の抽出（IMG-1、SCN-IMG-1-P1/N1）
- `replaceImageReferences`: プレースホルダ置換、採番衝突回避（既存 `[Image #1]` との非衝突）、未マップ URL の保持（IMG-4、SCN-IMG-3-P1/N1）

**2. `src/__tests__/imageDownload.test.ts`**（light IT、実 filesystem 使用）
- `isGitHubAttachmentUrl`: GitHub attachment URL の受容、外部 URL・非 https の拒否（IMG-6）
- `downloadPrImages`: ダウンロード・保存・本文置換、magic bytes 検証、サイズ上限、外部 URL スキップ、全コメント種別の置換（IMG-2）

**3. `src/__tests__/pipelineExecution.test.ts`**（既存ファイルに IMG-5 配線テスト追加）
- pipeline `--pr` 経路で `downloadPrImages` が呼ばれ、`executeTask` へ taskSpec が渡ることを検証

**4. `scripts/test-classification.mjs`**: `imageDownload.test.ts` を light IT に分類（実 filesystem 境界のため）

### 検証結果
- 全テストが**未実装のプロダクションコード**（`imageExtraction.js` / `imageDownload.js` / pipeline 配線）を理由に失敗することを確認（test-first の意図どおり）
- `npm run build` 成功、分類契約テスト 17/17 成功、unit gate は上記の想定内失敗のみで他は全パス
- セルフスキャン: 未使用 import なし、依存方向の違反なし、`package-lock.json` の意図しない変更は revert 済み

### 完了契約-テスト対応
| 契約ID | テスト |
|--------|--------|
| IMG-1 | `imageExtraction.test.ts` extractImageUrls 群 |
| IMG-2 | `imageDownload.test.ts` downloadPrImages 群 |
| IMG-4 | `imageExtraction.test.ts` replaceImageReferences 群 |
| IMG-6 | `imageDownload.test.ts` isGitHubAttachmentUrl 群 |
| IMG-5 | `pipelineExecution.test.ts` "should download PR images and pass a task spec to task execution" |

IMG-3（`attachments/` 配置・`order.md` 追記）は既存 `prepareTaskSpecDirectory` / `buildTaskOrderContent` の既存テスト（`imageAttachments.test.ts` 等）でカバー済みのため、新規テストは不要。