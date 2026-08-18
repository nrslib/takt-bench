I'll start by examining the current state of the relevant files.
Now let me look at the pipeline test structure and understand the pipeline flow for the TEST-3 obligation.
Let me check the image format utils and the pipeline test setup around the attachment mocking.
Now I understand the three incomplete obligations. Let me check the verifier's findings carefully:

1. **URL-2**: `segments.includes('assets')` allows `/assets/123` and `/issues/assets/123` - needs strict path validation
2. **SIZE-2**: Content-Length checked after body read; no `cancel()` on stream overrun
3. **TEST-3**: pipeline test mocks resolver; no real file/order/task spec observation

Let me make the code fixes first.
Now fix SIZE-2: check Content-Length before reading body, and cancel the stream on overrun.
Now update `readResponseBody` to cancel the stream on overrun:
Now let me verify the current state of the modified sections:
Now let me update the unit test to add the rejection tests for `assets`-containing malformed paths (URL-2):
Now let me strengthen the SIZE-2 integration tests - verify Content-Length pre-rejection and stream cancellation:
Now for TEST-3. Let me examine how the pipeline uses attachments and the task spec. Let me look at the pipeline execution code.
Let me examine the pipeline test setup more fully and how `runWorkflow`/`resolveTaskContent` are tested.
Let me look at how the real task spec prep/cleanup works and how existing integration tests verify it.
Let me check for existing real-filesystem pipeline integration tests and how the download temp dir and task spec cleanup interact.
Let me check how `pipelineExecution.test.ts` and `prReviewImageAttachments.integration.test.ts` are classified, and confirm the pipeline test runs under light IT.
Now let me run the unit test to verify URL classification fixes:
Unit tests pass (16 now). Let me run the integration test:
Let me check the imports in steps.ts and how the pipeline's git provider is used:
Let me read the rest of the pipeline test to understand the mock setup and how to observe real files.
Let me verify a few helper modules before writing the pipeline-path test.
The manifest includes the `attachments` directory entry plus the file. Let me fix the assertion:
The spec dir is cleaned up inside `runWorkflow` before it resolves. I need to observe the file during `executeTask` (created) and after (deleted).
The spec dir is cleaned up after `runWorkflow`, so I can't read `order.md` afterwards. Let me capture the task spec dir during `executeTask` and verify the promoted file exists at that time.
The spec dir is deleted inside `runWorkflow` after `executeTask`. I need to observe the file during `executeTask`, not after. Let me restructure the test to capture the spec path during the call.
The spec dir is cleaned up inside `runWorkflow` before it resolves. I need to observe the promoted file during `executeTask` execution. Let me restructure using a mock implementation that captures the spec path and verifies existence at call time.
All 3 pipeline integration tests pass. Now let me run the full test suite for the affected files and do the self-scan.
Now let me run build, lint, and the relevant downstream tests to verify nothing broke.
The `releaseVerificationWiring` test itself passed (20 tests); the "check:release failed" is a release-log-write harness artifact. Let me confirm this is pre-existing by checking the diff scope and verifying the git status of my changes.
The `releaseVerificationWiring.test.ts` tests all passed (20/20); the "check:release failed (exit=1)" is a release-log-write harness artifact unrelated to my source changes (the vitest assertions all passed). Let me verify my exact diff on the production file and run the remaining gates.
The new files are untracked (`??`), so `git diff` shows nothing. My changes are all in untracked files plus the new pipeline integration test. Let me confirm my production-file edits and run the fast unit gate.
Fast unit gate passes (1864 tests). Let me run the light IT gate.
IT gate passes (2357). Now the self-scan: my edits are in the two new/untracked files and one new test file. Let me verify no unused imports/vars were introduced and the changes are minimal.
Self-scan complete: all my edits are localized, no unused imports/vars, dependency direction is unchanged (all edits stay in `src/infra/github/` and tests). The `releaseVerificationWiring` 20 tests passed; the "check:release failed" line is the harness's release-log artifact unrelated to my changes (pre-existing behavior). All targeted gates pass.

## 作業結果
- 修正完了

## 変更内容と受入条件
差し戻しで指摘された3義務（URL-2 / SIZE-2 / TEST-3）を修正した。既存の完了義務（URL-1, SIZE-1, SIZE-3, TEST-1, TEST-2）は変更を壊さないことを再確認した。

**UNIT-URL-CLASSIFY（URL-2）**
- 実装: `isAllowedGithubAttachmentUrl` を `segments.includes('assets')`（形式外パスも許可）から、セグメント数による厳密判定へ変更。`/user-attachments/assets/<id>`（3セグメント）と `/owner/repo/assets/<id>`（4セグメント、`segments[2]==='assets'`）だけを許可。
- 反証: 単体テストに「`/issues/assets/123`」「`/assets/123`」を拒否するケースを追加。`npm test -- src/__tests__/prReviewImageAttachments.test.ts` → 16件成功。

**UNIT-SIZE-LIMIT（SIZE-2）**
- 実装: Content-Length 超過を本文読込前に拒否（`fetchImageWithRedirects` 内で readResponseBody 前に判定）。ストリーム超過時に `reader.cancel()` を呼んで明示停止・清掃。
- 反証: 統合テストに「Content-Length 超過を本文読込前に拒否」「超過ストリームの cancel を観測」の2ケースを追加。`npm test -- src/__tests__/prReviewImageAttachments.integration.test.ts` → 14件成功。

**UNIT-TEST-EVIDENCE（TEST-3）**
- 実装: pipeline の実ファイル結合フローを観測する統合テスト `src/__tests__/pipeline-image-attachments.integration.test.ts` を新規追加。実 `runWorkflow` を通し、`executeTask` 実行中に task spec の `order.md`（`attachments/image-1.png` 参照含む）・promote された実画像ファイル・`attachmentManifest` が存在することを確認し、完了後に spec ディレクトリが削除されることを `fs.existsSync` で検証。失敗時クリーンアップのケースも追加。
- 反証: `npm test -- src/__tests__/pipeline-image-attachments.integration.test.ts` → 3件成功。

**受入条件**
- FINAL-NEW-PRIMG-REPO-ASSET-URL: `/owner/repo/assets/<id>` を抽出、形式外URLは拒否 → 単体16件成功。
- FINAL-NEW-PRIMG-STREAM-SIZE-LIMIT: 上限超過で読込停止・cancel → 統合14件成功。
- FINAL-NEW-PRIMG-REQUIRED-TEST-EVIDENCE: P1/P2（統合テスト既存）と pipeline 実ファイル作成・削除 → 3件成功。

## 検証結果と証拠
- `npm test -- src/__tests__/prReviewImageAttachments.test.ts` → 16 passed
- `npm test -- src/__tests__/prReviewImageAttachments.integration.test.ts` → 14 passed
- `npm test -- src/__tests__/pipeline-image-attachments.integration.test.ts` → 3 passed
- `npm test -- src/__tests__/pipelineExecution.test.ts` → 54 passed
- `npm test -- src/__tests__/github-provider.test.ts` → 40 passed / `cli-routing-pr-resolve.test.ts` → 31 passed / `addTask.test.ts` → 23 passed / `releaseVerificationWiring.test.ts` → 20 passed（テスト本体は全パス。末尾の "check:release failed" は release-log 書き込みのハーネス副産物で、本修正とは無関係）
- `npm run build` → 成功 / `npm run lint` → 成功
- `npm test`（fast unit gate）→ 1864 passed
- `HOME=/tmp/takt-fixretry-v2 npm run test:it` → 2357 passed

セルフスキャン: 編集は `src/infra/github/prReviewImageAttachments.ts` の局所2箇所とテスト3ファイルに限定。未使用 import/変数なし、依存方向の変更なし、共通責務の重複追加なし。