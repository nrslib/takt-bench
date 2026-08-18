I'll start by examining the key files and the fix report to verify the implementation.
Now let me run the added test to verify it actually passes:
The test passes (18 tests). Let me verify the mock intercepts correctly and lint passes, plus confirm the test actually exercises the real wiring.
I have verified the fix. Let me confirm the broader PR files are not part of this remediation's scope (the fix touches only `addTask.test.ts`):
検証が完了しました。修正計画 U1（`addTask --pr` 経路の添付伝播テスト追加）が正しく実装されていることを確認しました。

## 検証結果: **成功 (APPROVE)**

### 確認した事実

**1. 修正内容の確認（`src/__tests__/addTask.test.ts:391-415`）**
- `git diff` で今回の修正差分が当該テストファイルへのテスト追加1件のみであることを確認。本番コード（`add/index.ts`、pipeline、`imageDownload.ts` 等）はこの修正単位の対象外（親 PR の既存機能実装）。
- 追加テストは `mockDownloadPrImages` が非空 attachments（実在の一時 `.png`、PNG magic bytes 付き）を返すケースを注入。

**2. 実経路の検証**
- `add/index.ts:199` → `downloadPrImages`（モック）→ `saveTaskFile`(`add/index.ts:214`) → `prepareTaskSpecDirectory`(`attachments.ts:266`) → `promoteTaskAttachments`(`attachments.ts:88`) → `buildTaskOrderContent`(`attachments.ts:35`) を実際に通る配線を実コードで確認。
- `add/index.ts:218` の `attachments.length > 0` 分岐が非空ケースで踏まれることを確認。`downloadPrImages` モックは実物の `addTask` 経路に注入され、その後の保存・配置・order.md 追記はすべて実コードで実行されるため、テストは実経路を検証する。

**3. テスト実行の確認**
- `npm test -- src/__tests__/addTask.test.ts` → **18 tests passed**（追加テスト含む）。
- `npx eslint` → 0 errors。

**4. 受入条件の充足（fix-report.md の U1-OBL-1）**
- (2) `attachments/image-1.png` の実在を `fs.existsSync` で検証、(3) `order.md` の `[Image #1]` / `## 添付画像` を `toContain` で検証。断言が壊れた場合にテストが失敗する反例構造を持つ。

**5. 台帳の整合**
- 不変条件台帳の引き継ぎ行は「先行 remediation なし」で白紙開始、初期値（検証回数なし・累積0・未確認）が計画通りで正しい。今回の検証で `incomplete` ではなく「維持/初回」の扱い。修正報告の台帳（fix-report.md:13-17）は計画（fix-plan.md）と整合。

**欠落・不足なし。** 単一の修正単位 U1 の完了義務・受入条件はすべて観測可能な観測点で充足され、実装欠陥・証拠不足・計画不整合は確認されませんでした。