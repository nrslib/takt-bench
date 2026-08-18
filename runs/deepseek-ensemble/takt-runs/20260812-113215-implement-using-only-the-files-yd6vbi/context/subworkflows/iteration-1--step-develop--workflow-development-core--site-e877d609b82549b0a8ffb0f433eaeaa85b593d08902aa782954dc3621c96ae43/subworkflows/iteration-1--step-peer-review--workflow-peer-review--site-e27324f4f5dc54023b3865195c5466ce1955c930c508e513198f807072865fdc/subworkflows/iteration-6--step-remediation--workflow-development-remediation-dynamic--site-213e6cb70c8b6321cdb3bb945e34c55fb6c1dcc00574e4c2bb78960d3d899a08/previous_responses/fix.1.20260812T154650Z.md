I'll start by reading the task spec and understanding the current state.
Let me read the report file and the consumer files.
The report file wasn't found. Let me check the report directory structure.
Let me read the previous response and knowledge file to understand the full context.
Let me look at existing test files to understand conventions and find covering tests.
Now I have full context. Let me check for any other consumers of the placeholder grammar across the codebase.
Now I have full context. Let me check the policy and knowledge files to understand the required conventions, then check the classification contract test mentioned in the gates.
I now have full context. Let me set up a todo list and begin implementation.
Now I understand the full picture. Let me implement. First, the owner module:
Now the PR consumer. Let me update `collectExistingPlaceholderNumbers` and placeholder creation:
Now the interactive consumer:
Let me consolidate the imports into one statement:
Now the retry consumer. It has three places: `resolveMaxImageIndex`, `renumberRetryAttachments` (creation), and `adjustedRetryNote` replacement regex.
Now add unit tests for the new functions in imageAttachmentReferences.test.ts:
Now let me run build and the covering test files.
Build succeeds. Now run the covering tests:
The test assumption was wrong: `findImageAttachmentPlaceholders` is a lenient scanner (matching `\d+`), while strict validation happens at extraction. Let me fix the test to reflect the actual contract.
All 4 covering test files pass. Now run lint:
Lint passes. Now self-scan: verify no lingering consumer-specific placeholder regex/literals remain.
The remaining `\d+` is the `attachments/image-N.ext` fileName pattern, a distinct contract, correctly retained. Let me verify no placeholder literal/regex remains:
No placeholder literals/regexes remain in consumers. Now run the full fast unit gate and IT.
Fast unit gate passes. Now run the light IT gate:
IT passes. Since I changed the `retryTaskSpecAttachments` code, I need to run the classification contract test as instructed by AGENTS.md.
The test passed (20/20) but there's a "check:release failed" log line. Let me investigate whether that's related to my change or an environment artifact.
The classification test passes (20/20), but there's a release log closing artifact. Let me check if this is pre-existing and unrelated to my changes.
The classification test passed (20/20). The "check:release failed (exit=1)" log line appears to be a release-log closing artifact in the test harness. Let me verify this is unrelated to my changes by checking how the log write works.
The test passed 20/20, so this "check:release failed" log output is expected test harness output within the classification test, not a real gate failure. Let me confirm by checking thetest expectations.
The classification test's 20/20 pass with the "check:release failed" output is the test harness simulating a failed log write (expected behavior of that test). Now let me run the required mock E2E gate.
E2E mock exceeds the default timeout. Let me rerun with a larger timeout.
E2E mock passes (55 passed, rest skipped/todo as expected). Now let me complete the self-scan by verifying the final state of the modified files.
Let me verify the final interactive file state and confirm the dependency direction is correct:
Now let me run the smoke E2E gate, since my changes touch workflow execution path (PR attachments feeding task specs). Let me check whether the changed behavior affects CLI startup/workflow execution.

The changes are confined to placeholder grammar in image attachment handling (PR/interactive/retry consumers), which feed into task spec attachments used during workflow execution. Per the gate guidance, smoke E2E is required when the changed behavior affects "workflow execution, provider selection, config loading, sandboxing, or runtime preparation." This is an edge case. Let me run it to be safe.
All gates pass. Let me finalize the todos.
## 作業結果
- 修正完了

## 変更内容と受入条件

**修正単位 `PRIMG-PLACEHOLDER-GRAMMAR-OWNER`（工程1: 境界変更）**
`src/shared/utils/imageAttachmentReferences.ts` に、プレースホルダー文法の全責務を集約する関数を追加した。
- `extractImagePlaceholderNumber(placeholder)`: `isImageAttachmentPlaceholder`（正本 `/^\[Image #[1-9]\d*\]$/`）で正規と判定したときのみ番号を返し、`[Image #0]`・`[Image #01]` 等は `undefined`。**SCN-PRIMG-P1/N1/N2 を充足**。
- `createImageAttachmentPlaceholder(number)`: 正の整数（1以上）から正規プレースホルダーを生成し、非正・非安全整数は例外。
- `findImageAttachmentPlaceholders(text)`: 走査用の寛容な候補抽出（厳密検証は抽出・生成関数が担う）。

**工程2: 利用側移行（全 consumer）**
- `src/infra/github/prReviewImageAttachments.ts`: 独自 `\[Image #(\d+)\]` と `` `[Image #${number}]` `` を除去し、上記3関数に置換。採番（既存番号を避けた空き番号）は維持。
- `src/features/interactive/imageAttachments.ts`: 独自 `/^\[Image #(\d+)\]$/` と `` `[Image #${index}]` `` を除去し、`extractImagePlaceholderNumber`・`createImageAttachmentPlaceholder` に置換。採番（最大番号の次）は維持。
- `src/features/tasks/retryTaskSpecAttachments.ts`: 独自 `\[Image #(\d+)\]` と `` `[Image #${nextImageIndex}]` `` を除去し、正本関数に置換。`adjustedRetryNote` の置換も `findImageAttachmentPlaceholders` + `replaceAll` に変更。`attachments\/image-(\d+)\.[A-Za-z0-9]+` はファイル名という別契約のため正本関数化対象外として維持。

`rg` で全 consumer から `\[Image #` 系の独自リテラル・正規表現が消去されたことを確認（ファイル名パターン以外ゼロ件）。

## 検証結果と証拠

- `npm run build`: 成功。
- `npm run lint`: 成功（ESLint 警告なし）。
- `npm test`（fast unit gate、4シャード）: 1864 passed。
- 被覆テストファイル4本を全体実行（`imageAttachmentReferences.test.ts` / `prReviewImageAttachments.test.ts` / `imageAttachments.test.ts` / `retryTaskSpecAttachments.test.ts`）: 全pass。`extractImagePlaceholderNumber`・`createImageAttachmentPlaceholder`・`findImageAttachmentPlaceholders` の境界値テストを `imageAttachmentReferences.test.ts` に追加（[SCN-PRIMG-P1, N1, N2] 含む）。
- `HOME=/tmp/takt-bench-v3-home npm run test:it`: 2365 passed。
- 分類契約テスト `npm test -- src/__tests__/releaseVerificationWiring.test.ts`: 20/20 passed（出力中の `check:release failed` はテストが意図的に最終ログ書き込み失敗をシミュレートするハーネス出力であり、実ゲート失敗ではないことをテスト内容 L333-348 で確認）。
- `HOME=/tmp/takt-bench-v3-home npm run test:e2e:mock`: 55 passed（残りは既存 skip/todo）。
- `HOME=/tmp/takt-bench-v3-home npm run test:e2e:smoke`: 21 passed。

**セルフスキャン**: 今回の編集で未使用化・依存方向の逆転・同一契約の重複実装はなし。consumer の import は全て `shared/utils`（下位層）方向で規約どおり。`findImageAttachmentPlaceholders` は寛容な走査関数として意図的に公開し、厳密検証は抽出関数に分離した。走査範囲: 変更した3 consumer ファイルと所有者モジュール、被覆テスト。

なお、`git status` に多数の既存変更ファイル（`addTask.test.ts` 等）が本ワークフロー開始前から存在するが、これらは今回の修正スコープ外のため触れていない。