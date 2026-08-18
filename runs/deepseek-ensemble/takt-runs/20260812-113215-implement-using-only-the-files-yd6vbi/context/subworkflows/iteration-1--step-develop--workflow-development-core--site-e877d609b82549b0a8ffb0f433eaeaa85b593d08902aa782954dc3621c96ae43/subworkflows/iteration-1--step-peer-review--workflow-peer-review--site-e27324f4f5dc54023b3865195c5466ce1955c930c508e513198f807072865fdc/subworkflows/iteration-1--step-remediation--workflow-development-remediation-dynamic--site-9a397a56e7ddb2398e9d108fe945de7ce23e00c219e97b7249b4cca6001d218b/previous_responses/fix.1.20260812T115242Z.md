I'll start by reading the primary spec and understanding the current state.
I need to examine the current code state for the two fix units. Let me read the relevant files.
Let me verify the interactive module types and the PR image attachments infrastructure.
Let me check the report history and look for existing exhaustiveness helpers.
Let me examine `routing-inputs.ts` and the git provider mock to understand cleanup flow for the test fix.
Now I understand both fixes. Let me implement them.

**Fix 1: F-INTERACTIVE-RESULT-TOTALITY** (routing.ts) — eliminate `result!`, add exhaustive default case and runtime guard:
Now let me verify the narrowing behavior. Let me build to check whether TS narrows `result` after the exhaustive switch (which determines if the runtime guard is redundant):
The build passes. Let me verify whether the runtime guard is redundant (dead code) by checking TS's narrowing, since an unreachable guard would be a self-scan finding.
The diff stat shows far more changes than my edit. Let me check for unintended changes (possibly line-ending/formatting).
The diff shows the working tree already differs from HEAD substantially. Let me check git status to understand the baseline state.
The working tree already contains the full feature implementation from the prior develop step (uncommitted). My edits are just the two remediation fixes. Let me check whether my runtime guard in routing.ts is dead code under TS narrowing.
Let me verify whether the `result === undefined` guard is dead code under TS narrowing (since all handlers assign and `default` throws):
The external write was blocked; routing.ts is unchanged. Let me test the narrowing by temporarily removing the guard via the edit tool.
TS compiles fine even without the runtime guard — proving the `result === undefined` check is dead code under the exhaustive switch. The plan's constraint requires a compile-time exhaustive check (`モード追加時の handler 漏れをコンパイル時に検出できる`). The proper idiom is `assertNever`. Let me restructure:
TS control-flow analysis narrows `result` to non-undefined after the exhaustive switch (throwing default terminates). But crucially, the throwing-default approach does **not** give compile-time detection when a new mode is added without a handler — the missing case would fall to `default` and throw at runtime, not compile time. The finding's acceptance criterion is compile-time detection.

The correct exhaustive idiom is `assertNever`. Let me use it:
Now add the `assertNever` helper locally in routing.ts:
Let me verify the compile-time detection actually works by testing with a hypothetical added mode in a temp file:
Let me create the probe file inside the workspace temporarily to verify the compile-time detection:
Confirmed: adding an unhandled mode produces compile error TS2345, proving compile-time exhaustiveness detection works. Let me remove the probe file.
Now let me verify the current routing.ts diff to confirm the narrowing is sound (result is non-undefined after switch). Let me view the final state of the switch region.
Fix 1 (F-INTERACTIVE-RESULT-TOTALITY) is complete and verified. Now **Fix 2: F-PR-IMAGE-LIFECYCLE** — update the test at lines 367-387 to verify `prAttachmentsCleanup` is called before exit.
The routing save_task branch calls `prAttachmentsCleanup?.()` then `process.exit(1)`, and the `finally` block calls it again after exit throws. Let me update the test to capture the cleanup mock and assert it's called before exit:
Now run the covering test file:
Test passes. Now run the quality gates.
Now run the full test gates:
IT passes. Now the mock E2E tests:
All quality gates pass. Let me run the self-scan on my edits — verify no unused code, correct dependency direction, and no leftover references.
All quality gates pass. Self-scan complete: `assertNever` is a local helper matching existing codebase pattern (`workflowTerminalStatus.ts`, `interpretation-case-model.ts`); `result!` fully removed; no new imports or dependency-direction issues; test assertions correctly bound to mocks.

## 作業結果
- {修正完了}

## 変更内容と受入条件

**F-INTERACTIVE-RESULT-TOTALITY** (`src/app/cli/routing.ts`)
- 非null assertion `result!`（旧283行）を除去し `const confirmedResult = result;` に変更。
- `switch (selectedMode)` の `default:` に local `assertNever(selectedMode)`（`value: never` を受け取り throw）を追加。
- これにより全 `InteractiveMode` が handler を持たずに済んだ場合、コンパイル時に TS2345 で検出される。probe で検証済み（未処理モード追加 → `Argument of type '"c"' is not assignable to parameter of type 'never'`）。
- 不変条件「全 `InteractiveMode` が対応 handler を持ち必ず `InteractiveModeResult` を生成する」を静的型チェックで回復。`INTERACTIVE_MODES`(closed union) を契約正本として維持。反証: モード追加時にビルド失敗。

**F-PR-IMAGE-LIFECYCLE** (`src/__tests__/cli-routing-pr-resolve.test.ts:367`)
- PR head branch 欠落の exit テストに `prCleanup` モック（`mockResolvePrReviewImageAttachments` 経由）を追加。
- `prCleanup` が呼ばれること、かつ `prCleanup.mock.invocationCallOrder[0]` が `mockExit.mock.invocationCallOrder[0]` より前であることを assert。
- 不変条件「異常終了時も添付ファイル cleanup が exit より先に実行される」を決定的に観測。反証: cleanup 呼び出し欠落・順序逆転でテスト失敗。

## 検証結果と証拠
- `npx tsc --noEmit -p tsconfig.json` → 成功（結果なし）
- assertNever の網羅検出 probe（未処理モード `'c'`）→ `error TS2345: Argument of type '"c"' is not assignable to parameter of type 'never'`
- `npm test -- src/__tests__/cli-routing-pr-resolve.test.ts` → 31 passed
- `npm run build` → 成功
- `npm run lint` → 成功
- `npm test` → 全シャード成功（95 files / 1499, 1864, 1519 tests）
- `HOME=/tmp/takt-bench-v3-home npm run test:it` → 158 files / 2357 tests passed
- `npm run test:e2e:mock` → 18 files / 55 passed, 13 skipped, 30 todo
- セルフスキャン: 編集差分で未使用・逆依存なし。`assertNever` は既存同型ヘルパーと同パターンの local helper。走査範囲: `routing.ts` の switch 周辺とテストファイルの該当テストのみ。