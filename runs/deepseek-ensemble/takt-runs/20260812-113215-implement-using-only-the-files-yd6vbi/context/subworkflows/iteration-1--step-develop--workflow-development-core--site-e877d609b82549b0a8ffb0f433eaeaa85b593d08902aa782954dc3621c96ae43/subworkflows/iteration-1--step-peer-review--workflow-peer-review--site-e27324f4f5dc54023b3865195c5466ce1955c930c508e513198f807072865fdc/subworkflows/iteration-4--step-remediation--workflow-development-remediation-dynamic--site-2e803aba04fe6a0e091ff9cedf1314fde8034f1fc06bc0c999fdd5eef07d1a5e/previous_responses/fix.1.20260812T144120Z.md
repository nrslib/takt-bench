I'll start by reading the primary spec and the relevant source files.
Let me read the other consumer files and the GitProvider type definition.
Let me check the report directory and existing tests for these files.
Let me check the attachment types and the existing tests for the consumers.
Let me look at the tests for the consumers to understand what needs updating.
Let me check the addTask test and git-factory test to understand the mock patterns for the consumers.
Let me check the git-factory test and how the infra/git module is tested.
Now I understand the structure. Let me implement the plan. First, add the common `resolvePrImages` function in `src/infra/git/index.ts`.
Now add the `resolvePrImages` function. Let me add it after `resolveIssueTask`:
Now migrate the consumers. First `routing-inputs.ts`:
Now `steps.ts`:
Now `add/index.ts`:
Now let me build and lint to verify.
Build passes. Now lint:
The consumers now import `resolvePrImages`, so the test mocks for `../infra/git/index.js` need to provide it. Let me find all test files that mock this module.
The consumers now import `resolvePrImages`, so the mocks in `cli-routing-pr-resolve.test.ts` and `addTask.test.ts` need to provide it. Let me update them to delegate to the existing `mockResolvePrReviewImageAttachments`.
Let me check the pipeline tests that exercise the PR path, since `steps.ts` now uses `resolvePrImages`.
Let me check which tests exercise the pipeline PR image resolution path.
Let me check `pipelineExecution.test.ts` and `git-cwd-propagation.test.ts` since they exercise the pipeline PR path.
This test mocks `../infra/git/index.js` and exercises the pipeline PR path via `resolveTaskContent`. Since `steps.ts` now calls `resolvePrImages`, this mock needs it too. Let me check how `resolveTaskContent` is tested here.
`pipelineExecution.test.ts` exercises the PR path via `resolveTaskContent`. I need to add `resolvePrImages` to its mock too.
Now let me check `git-cwd-propagation.test.ts` which also exercises the pipeline PR path.
This test exercises the pipeline PR path. Let me add `resolvePrImages` to its mock.
Now let me add a unit test for the new `resolvePrImages` function in `git-factory.test.ts`. Let me check the imports there and add the test.
Now add the test cases for `resolvePrImages` at the end of the file:
Now let me run the covering test files.
The mock delegation passes the provider as first arg, but tests expect `(prReview, cwd)`. Let me fix the mock delegation to drop the provider argument.
All covering tests pass. Now let me run the full unit gate, then the integration and e2e gates.
Fast unit gate passes. Now the integration tests.
Integration tests pass. Now the mock E2E tests.
The e2e mock test timed out. Let me retry with a longer timeout.
E2E mock tests pass. Now let me do the self-scan. Let me verify the final state of the changed files and check for unused imports.
Let me verify `StoredImageAttachment` is still used in routing-inputs.ts and check `TaskAttachment` usage in steps.ts.
Both imports remain used. Let me verify the final state of `add/index.ts` around the change and confirm the `resolved` type annotation is still valid.
Let me verify the final diff of the production changes.
The diff includes prior work from earlier steps in this workflow. Let me confirm my specific changes removed all duplicate fallback logic in the 3 consumers.
All duplicate fallback logic is removed from the 3 consumers; only the interface definition remains. Let me run a final build and lint to confirm everything is clean after all edits.
All quality gates pass. Let me run the final `npm test` to confirm the fast unit gate after all edits.
## 作業結果
- 修正完了

## 変更内容と受入条件

**修正単位 `PRIMG-CAPABILITY-NORMALIZATION`**（全3工程を完了）

1. **境界変更** — `src/infra/git/index.ts` に共通解決関数 `resolvePrImages(gitProvider, prReview, cwd?)` と型 `ResolvedPrImages` を追加。`GitProvider.resolvePrReviewImageAttachments` が定義されていれば委譲し、未定義なら identity fallback（`attachments: []`, `cleanup: () => undefined`）を返す。判定と fallback 生成の正本を `infra/git` に一元化。
2. **利用側移行** — 3 consumer の重複三項演算子を `resolvePrImages` 呼び出しに置換:
   - `src/app/cli/routing-inputs.ts:67`（`resolvePrInput`）
   - `src/features/pipeline/steps.ts:230`（`resolveTaskContent`）
   - `src/features/tasks/add/index.ts:198`（`addTask`）
3. **削除** — 上記3ファイルの旧 fallback 生成コードを完全削除。`resolvePrReviewImageAttachments?` の判定は `src/infra/git/types.ts:159` のインターフェース定義のみに残存（grep で確認）。

**受入条件の反証方法・証拠:**
- [SCN-PRIMG-CAPABILITY-NORMALIZATION-P1] 対応プロバイダーで resolver 実行 → `git-factory.test.ts` の新規テストで resolver 呼び出し引数 `(prReview, cwd)` と返り値（attachments/cleanup）を検証。
- [SCN-PRIMG-CAPABILITY-NORMALIZATION-N1] 非対応プロバイダーで identity fallback → 同テストで `attachments: []`・`cleanup()` が `undefined` を返すことを検証。
- 既存契約（`resolvePrInput`/`resolveTaskContent`/`addTask` の戻り値・引数・cleanup 呼び出し順序）は不変。既存テスト（`cli-routing-pr-resolve`・`addTask`・`pipelineExecution`・`git-cwd-propagation`）が全件パスで保存を確認。

## 検証結果と証拠
- `npm run build` → 成功
- `npm run lint` → 成功
- `npm test`（fast unit gate）→ 4 shard 全パス（1526/1526 等）
- `HOME=/tmp/takt-bench-v3-home npm run test:it` → 158 files / 2357 tests 全パス
- `npm run test:e2e:mock` → 18 passed / 1 skipped（55 passed, 13 skipped, 30 todo）
- 対象テストファイル（変更コードをカバー）をファイル単位で実行:
  - `git-factory.test.ts`（新規 `resolvePrImages` テスト含む）
  - `cli-routing-pr-resolve.test.ts`
  - `addTask.test.ts`
  - `pipelineExecution.test.ts`
  - `git-cwd-propagation.test.ts`
  → 全パス（115 + 23 tests）

**セルフスキャン:** 未使用 import なし（`StoredImageAttachment`/`TaskAttachment` は各 consumer の戻り値型で使用継続）。依存方向は `infra/git`（共通所有者）→ consumer の正方向のみ。共通責務の重複実装は他に残存せず（grep で確認）。テスト mock は `resolvePrImages` の provider 引数を落として既存 `mockResolvePrReviewImageAttachments(prReview, cwd)` に委譲する形で整合。