I'll start by reading the task spec and the relevant source files.
Let me look at the report directory, existing tests, and related files.
Let me examine the pipeline execution test and the flow for PR attachments.
The plan references `src/__tests__/core/pipelineExecution.test.ts` but the actual file is `src/__tests__/pipelineExecution.test.ts`. Let me examine it and the pipeline steps flow.
Let me look at the pipeline steps flow and the rest of the test file.
Let me examine the image format util, the GitHub provider test, and check for a `core` test directory.
Let me read the pipeline index to understand how attachment cleanup is invoked, and check the git types.
Let me check the git status and the test classification setup.
Let me check the test classification config to understand how these tests are routed.
Let me understand the test classification system to know which runner each test uses.
Let me look at the existing image attachment tests and test setup to understand conventions.
Now I have a clear understanding. Let me set up my todo list and begin implementing the three fix units.
Now I understand the full picture. Let me implement the fixes. First, the URL classification fix in the source:
Let me verify the edit and check the current state of the function:
Now let me implement the streaming size limit. Let me view the current fetch/read functions:
Now let me rewrite `readResponseBody` to stream with a size limit:
Now let me add dependency injection to `resolvePrReviewImageAttachments` for end-to-end tests. Let me check the current signature and callers:
I'll add an optional deps parameter to `resolvePrReviewImageAttachments` for test injection, keeping the existing contract intact:
Now let me add the URL classification unit tests. Let me add them to the existing test file:
The third test I added contradicts the plan's chosen approach (`assets` segment presence check). Let me remove it:
Now let me update the integration test to add streaming tests (SCN-SIZE-P1/N1) and end-to-end resolve tests (SCN-TEST-P1/P2). Let me add a helper for ReadableStream bodies and the new tests:
Now let me add the streaming size-limit tests and end-to-end resolve tests at the end of the file:
Now let me add the SCN-PIPE-P1 lifecycle test (real file create → cleanup → delete) to the integration test file. The plan references `src/__tests__/core/pipelineExecution.test.ts` which doesn't exist; the actual pipeline test mocks attachment resolution, so real-file lifecycle observation belongs in the integration test file:
Let me verify the `PrReviewData` type is exported from the git index:
Now let me run the build and the specific test files to verify my changes.
Build passes. Now let me run the specific covering test files:
Unit tests pass. Now the integration test:
Integration tests pass. Now let me run the pipeline and github-provider tests that touch the changed code:
Now let me run lint and the full unit gate:
Lint passes. Let me update todos and run the full unit gate and IT gate.
Full unit gate passes. Now the IT gate:
IT gate passes. Now the mock E2E suite:
Mock E2E passes. Now let me do the self-scan of my edits. Let me verify the final source state and check for unused code:
Let me verify the full diff of my changes and run the self-scan:
The file is untracked (new file), so `git diff` shows nothing. Let me verify the final state of the resolve function and check for unused imports:
Let me verify the final integration test file and confirm no unused imports remain:
Let me verify the final integration test file and run the self-scan checks:
Let me verify the source file imports are all still used:
All imports remain used. Let me run the releaseVerificationWiring test as required by AGENTS.md since I added/changed an IT:
The releaseVerificationWiring test passes (20 tests; the "check:release failed" is expected test output). Let me verify the final unit test file state:
All quality gates pass. Let me do a final self-scan verification of my edits for unused code and dependency direction:
All self-scan checks pass. Let me finalize the todos:
## 作業結果
- 修正完了

## 変更内容と受入条件

**UNIT-URL-CLASSIFY**（`src/infra/github/prReviewImageAttachments.ts:45-60`）
- `isAllowedGithubAttachmentUrl` を、パスセグメントのインデックス固定判定（`segments.length === 3 && segments[2] === 'assets'`）から、`assets` セグメントの存在確認（`segments.includes('assets')`）に変更。`https://github.com/<owner>/<repo>/assets/<id>` 形式を抽出可能にし、外部ホスト・非HTTPS・`/issues/123` 等の無関係URLは従来どおり拒否。
- 単体テスト追加: `prReviewImageAttachments.test.ts` に SCN-URL-P1（リポジトリアセットURL抽出）と SCN-URL-N1（`/owner/repo/issues/123` 拒否）を追加。15件パス。

**UNIT-SIZE-LIMIT**（`prReviewImageAttachments.ts:302-332`）
- `readResponseBody` を `arrayBuffer()` 全読込から、`ReadableStream` を `getReader().read()` で逐次消費しながら `MAX_IMAGE_BYTES` を超えた時点で即座に throw する制限付き読込へ変更。Buffer フォールバック時も上限チェックを追加。`finally` で `releaseLock()` により読込を停止・清掃。
- 統合テスト追加: SCN-SIZE-P1（ストリーム正常読込→Buffer返却）と SCN-SIZE-N1（上限超過で即時 reject）。12件パス。

**UNIT-TEST-EVIDENCE**（`prReviewImageAttachments.ts:445-469`, `prReviewImageAttachments.integration.test.ts`）
- `resolvePrReviewImageAttachments` に最小限の依存注入（`deps?: Partial<PrReviewImageDownloadDeps>`）を追加。既存の公開契約（引数・戻り値）は維持し、呼び出し側（GitHubProvider, routing-inputs, pipeline steps, add）は無変更。
- 統合テスト追加: SCN-TEST-P1（置換本文 `[Image #1]` + 一時ファイル1件）、SCN-TEST-P2（通常コメント2URLから一意な placeholder とファイル名）、SCN-PIPE-P1（実ファイル作成→`cleanup` で物理削除を `fs.existsSync` で観測）。

**セルフスキャン**: 今回の編集差分を走査。未使用化（`arrayBuffer` 参照の消滅、import 全使用維持）、依存方向（新規 import なし、層方向の違反なし）、共通責務候補（既存の `downloadPrReviewImageAttachments` を再利用、重複実装なし）を確認。問題なし。

## 検証結果と証拠
- `npm run build` → 成功
- `npm run lint` → 成功
- `npm test`（fast unit gate 4 shard）→ 全パス（1864件）
- `HOME=/tmp/takt-bench-v3-home npm run test:it` → 全パス（2357件）
- `npm run test:e2e:mock` → 55 passed / 13 skipped / 30 todo
- 対象テストファイル（全体実行）:
  - `npm test -- src/__tests__/prReviewImageAttachments.test.ts` → 15件パス
  - `npm test -- src/__tests__/prReviewImageAttachments.integration.test.ts` → 12件パス
  - `npm test -- src/__tests__/pipelineExecution.test.ts` → 54件パス
  - `npm test -- src/__tests__/github-provider.test.ts` → 40件パス
  - `npm test -- src/__tests__/releaseVerificationWiring.test.ts` → 20件パス（IT追加に伴う必須確認）

補足: 修正計画の変更対象に `src/__tests__/core/pipelineExecution.test.ts` とあったが、実在しない（実際は `src/__tests__/pipelineExecution.test.ts`）。pipeline テストは attachment 解決をモックしており実ファイル生存期間の観測に不向きなため、SCN-PIPE-P1 の実ファイル作成・削除検証は `prReviewImageAttachments.integration.test.ts` に配置した。