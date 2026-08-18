The verifier found that `determineWorkflow()` (line 174) and `selectInteractiveMode()` (line 193) rejections fall outside the cleanup `finally` (lines 283-347). I need to extend the cleanup guarantee boundary to cover the selection phase. Let me restructure `routing.ts`.
Now I need to close the switch inside the try and restructure the dispatch try/finally. Let me re-read the current state.
Now I'll merge the dispatch into the same try block so the finally covers selection, mode execution, and dispatch. Let me replace the switch-close and dispatch section.
Now let me verify the full file compiles correctly by checking the structure.
Now let me verify the file compiles. Let me run the TypeScript compiler check.
The switch always assigns `result` in every case, but TS can't narrow it. I'll use a non-null assertion at the dispatch call since the switch is exhaustive.
The closures reference `result` which is still typed as possibly undefined. Let me capture a non-null local after the switch.
Compiles clean. Now let me add regression tests for the workflow/mode selection exception paths in the routing test.
Now let me address the `OBL-4-SAVE-EXCEPTION` evidence gap. Let me check the addTask test for a saveTaskFile rejection test.
Let me check how `saveTaskFile` is mocked in the addTask test.
The `saveTaskFile` in `add/index.ts` calls `saveEnqueuedTaskFile` from `enqueuedTaskFile.js`. To test the save-exception path, I need to mock that module. Let me add the mock and a regression test.
The mock would break existing tests that rely on real file saving. Let me use `importOriginal` to preserve real behavior and only override for the rejection test.
I need to capture the real implementation to delegate by default. Let me update the mock setup.
Now add the save-exception regression test after the workflow-selection-throws test.
Now let me run the affected tests.
The hoisted mock factory references `realSaveEnqueuedTaskFile` before init. I need to use `vi.hoisted`.
Both test files pass. Now let me run the routing test again to confirm, and run lint.
Lint passes. Let me run the full build and the other affected test files.
All affected tests pass. Let me run the classification contract test and the full unit gate.
The test passed (20 tests). The "check:release failed" is a wrapper log artifact, not a test failure. Let me run the full unit gate.
All 4 unit shards pass. Let me run the light IT gate.
All light IT tests pass (2357). Let me run the mock E2E suite since I touched CLI routing behavior.
All E2E mock tests pass. Let me do the self-scan of my edits. Let me verify the final routing.ts structure is clean.
The structure is clean. Let me verify the final dispatch/finally section once more.
The structure is correct. The `finally` now covers the entire selection + mode execution + dispatch phase, guaranteeing `prAttachmentsCleanup` runs on workflow-selection exceptions, mode-selection exceptions, and dispatch exceptions.

Let me verify the git diff to confirm my changes are scoped correctly.
All verifier-identified gaps are now closed. Let me confirm the final state of the routing finally block covers all selection exceptions.
All verifier-identified gaps are now closed. The `finally` block at `routing.ts:343-348` now covers the entire selection phase (workflow selection, mode selection), mode execution, and dispatch, guaranteeing `prAttachmentsCleanup` runs on all exception paths.

## 作業結果
- {修正完了}

## 変更内容と受入条件

verifier が指摘した3つの未完了義務をすべて解消した。

**`OBL-3-WORKFLOW-EXCEPTION` / `OBL-3-MODE-EXCEPTION`（routing 選択処理例外）**
- `src/app/cli/routing.ts` を再構成し、`determineWorkflow()`（`:176`）と `selectInteractiveMode()`（`:194`）の reject を、dispatch 後の `finally`（`:343-348`）と同じ保証境界内に収めた。`try` ブロックが workflow 選択開始から dispatch 完了までを覆い、`finally` で `prAttachmentsCleanup?.()` が必ず実行される。
- 反証方法: `determineWorkflow` / `selectInteractiveMode` を reject させ、cleanup が1回呼ばれることを確認する回帰テストを `cli-routing-pr-resolve.test.ts` に追加。
- 証拠: 追加テスト2件（workflow選択例外・mode選択例外）を含む routing テスト31件成功。

**`OBL-4-SAVE-EXCEPTION`（addTask 保存例外の直接証拠）**
- `src/features/tasks/add/index.ts:235-245` の finally は既に `resolved.cleanup()` を保証していたが、保存例外時の直接回帰テストが無かった。`enqueuedTaskFile.js` をモックし、`saveTaskFile` reject 時に cleanup とエラー伝播を確認するテストを `addTask.test.ts` に追加。
- 証拠: 追加テスト1件を含む addTask テスト23件成功。

**受入条件**: 一時ディレクトリ生成後の成功・失敗・キャンセル・例外すべてで削除される。producer（token失敗）、pipeline（workflow例外）、routing（workflow/mode選択キャンセル・例外、dispatch例外）、addTask（workflow選択例外・保存例外）の全経路で cleanup 実行を確認。

## 検証結果と証拠
- `npx tsc --noEmit` 成功
- `npm run build` 成功
- `npm run lint` 成功
- `npm test` 全4シャード成功（1864 / 1519 / 1499 / 1161 件、失敗なし）
- `npm test -- cli-routing-pr-resolve.test.ts addTask.test.ts prReviewImageAttachments.integration.test.ts pipelineExecution.test.ts` 全成功
- `npm test -- src/__tests__/releaseVerificationWiring.test.ts` 成功（20件）
- `HOME=/tmp/takt-bench-v3-home npm run test:it` 全成功（2357件）
- `npm run test:e2e:mock` 全成功（55 passed / 13 skipped / 30 todo）

編集後セルフスキャン: 追加した import / 変数 / 分岐に未使用化・依存方向違反・共通責務の重複は確認されず、`confirmedResult` は dispatch 内の全参照に使用され、`result` は finally の cleanup にのみ使用された。