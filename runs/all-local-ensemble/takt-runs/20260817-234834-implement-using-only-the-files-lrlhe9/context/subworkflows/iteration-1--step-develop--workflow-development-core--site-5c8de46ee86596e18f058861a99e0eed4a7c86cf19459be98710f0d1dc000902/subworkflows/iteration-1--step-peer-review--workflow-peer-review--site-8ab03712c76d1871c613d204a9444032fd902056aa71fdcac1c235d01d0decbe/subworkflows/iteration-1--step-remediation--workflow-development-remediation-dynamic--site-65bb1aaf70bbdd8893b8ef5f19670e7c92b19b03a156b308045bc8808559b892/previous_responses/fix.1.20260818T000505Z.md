Let me look at the existing pipeline test for attachment propagation to understand the test pattern.
The plan is clear: add a test to `addTask.test.ts` verifying attachment propagation through the `addTask --pr` path. Let me add the test.
Now let me run the specific test file to verify.
Test passes. Now running the quality gates.
Build and lint pass. Now running the full unit gate and integration tests.
Unit gate passes. Now integration tests.
Integration tests pass. Now the mock E2E tests.
All E2E mock tests pass. Let me verify the final state of the test file and run the self-scan.
The test is complete and all quality gates pass. Let me check the output contract for the fix report.
Let me read the fix policy to understand the output contract for the fix report.
Let me find the output contract for the fix report.
The policy file doesn't define the fix-report output contract directly. Let me check the workflow definition for the output contract.
The fix step uses `peer-review-fix`. Let me find its report format definition.
Now I understand the output contract. Let me verify my change is the only one and check the git status.
My change is only the test addition in `addTask.test.ts`. The other modified files are part of the broader task (PR image download feature) that was already in progress. Let me verify my specific diff.
The implementation is complete. My change to `src/__tests__/addTask.test.ts` adds a test verifying attachment propagation through the `addTask --pr` path. The mock for `downloadPrImages` was already present in the working tree from the broader feature work; my contribution is the new test at the bottom.

**Self-scan:** The added test uses only existing helpers (`createMockPrReview`, `loadTasks`, `readOrderContent`) and already-imported modules (`fs`, `path`, `tmpdir`). No new imports, no unused code, no dependency direction changes. No issues found.

**Quality gates (all pass):**
- `npm run build` — success
- `npm run lint` — success
- `npm test` — 86 files / 849 tests passed (fast unit gate)
- `npm test -- src/__tests__/addTask.test.ts` — 18 tests passed (covering test file, whole file)
- `HOME=/tmp/takt-bench-v3-home npm run test:it` — 129 files / 1796 tests passed
- `npm run test:e2e:mock` — 16 passed / 1 skipped (48 passed, 13 skipped)

The fix plan's single unit (U1: `addTask --pr` 経路の添付伝播テスト追加) is complete. The test verifies: (1) attachments flow through `saveTaskFile`, (2) the image is copied to `.takt/tasks/<slug>/attachments/image-1.png`, and (3) `order.md` contains `[Image #1]` and `## 添付画像`. No production code was changed, preserving the existing wiring and pipeline path as required by the plan's boundary.