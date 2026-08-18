I'll start by reading the policy, knowledge, and task files to understand the requirements.
Let me continue reading the policy and examine the relevant source files.
Now let me examine the attachments, image download/extraction, and the relevant reports in the Report Directory.
The remediation report directory is empty, confirming "先行 remediation なし". Let me examine the pipeline test for attachment propagation and the enqueueService to understand the verification contract.
Let me check the peer-review reports and the pipeline steps for the `--pr` path.
Let me check the peer-review subworkflow directory for the actual review reports and confirm the test coverage gap.
Let me read the review-resolution.md to get the exact ledger state and the full adjudication context.
Let me check the pipeline test structure and confirm the addTask test mock setup works with the actual flow.
I have all the evidence I need. Let me verify one detail about how the ledger carry-forward applies here (no prior fix-verification in the same remediation directory).
I now have all the evidence needed. Let me compile the fix plan.

## 修正計画（fix-plan）

### 1. 修正対象の列挙と受入条件

裁定で `actionable` とされた修正対象は **1件（family: `attachment-propagation`、finding: TEST-001）** のみ。Content-Type 検証（PR-IMG-8）は裁定対象外の観察として修正対象に含めない。配線の作り直し・pipeline 経路への再変更も修正境界外。

**修正単位 U1: `addTask.test.ts` に `takt add --pr` 一次入口の添付伝播テストを追加**

| family | `attachment-propagation` |
|---|---|
| 不変条件の名前 | `addTask --pr` 経路の添付伝播（保存・配置・order.md 追記） |
| 担当箇所 | `src/features/tasks/add/index.ts` の `addTask --pr` 経路（`downloadPrImages` 戻りを `saveTaskFile` へ渡す配線） |
| 受入条件 | `downloadPrImages` が非空 attachments（実在の一時画像ファイル）を返すケースで、(1) `saveTaskFile` へ attachments が渡る、(2) `.takt/tasks/<slug>/attachments/` へ画像がコピーされる、(3) `order.md` に `[Image #1]` 参照と `## 添付画像` が追記されることを検証する |
| 修正境界 | `src/__tests__/addTask.test.ts` へのテスト追加のみ。本番コード・pipeline 経路は変更しない |

### 2. 経路分析（現行 / 修正後）

**現行（一次入口）:**
`addTask(cwd, task, { prNumber })` (`add/index.ts:164`) → `provider.fetchPrReviewComments` (line 186) → `downloadPrImages(prReview, cwd)` (`add/index.ts:199`) → `saveTaskFile(cwd, taskContent, { ..., attachments })` (`add/index.ts:214`) → `saveTaskFile` (`add/index.ts:40`) が attachments 非空時に `attachmentPrepareTaskSpec` を生成 → `prepareTaskSpecDirectory` (`attachments.ts:266`) → `buildTaskOrderContent`（`## 添付画像` と `[Image #N]` 行を order.md へ追記、`attachments.ts:35`）＋ `promoteTaskAttachments`（`.takt/tasks/<slug>/attachments/` へコピー、`attachments.ts:88`）→ `saveEnqueuedTaskFile` が order.md / tasks.yaml を書込（`enqueuedTaskFile.ts:41`）。

問題箇所: `addTask.test.ts:9` の `mockDownloadPrImages` が常に `attachments: []` を返すため、`add/index.ts:218` の `attachments.length > 0` 分岐が踏まれず、一次入口での添付伝播の観測可能な検証が欠落している。

**修正後:**
`mockDownloadPrImages.mockReturnValueOnce({ prReview, attachments: [実在の一時画像] })` で非空ケースを注入し、実経路（`addTask` → `saveTaskFile` → `prepareTaskSpecDirectory` → `promoteTaskAttachments`）を通過させ、ファイルシステム成果物（attachments ディレクトリ、order.md 内容）を assertion する。

**分類:**
- `addTask.test.ts` へのテスト追加のみが「変更」。本番コードは全て「検証のみ」（変更しない）。

### 3. 不変条件台帳の引き継ぎ

**引き継ぎ元の確認:**
- 同一 remediation ディレクトリ内に先行 `fix-verification.md` が存在しない（`ls` で空を確認）ため、現在の `review-resolution.md` を引き継ぎ元とする。review-resolution.md は「先行 remediation なし（白紙開始）」と明示。台帳は白紙状態。

**継承行（全13項目を無変更で転記）:** 白紙（該当行なし）。

**新規行（不変条件 `attachment-propagation`、初回の検証として開始）:**

| 項目 | 値 |
|---|---|
| 修正単位 | U1 |
| family ID | `attachment-propagation` |
| 不変条件の名前 | `addTask --pr` 経路の添付伝播 |
| 担当箇所 | `src/features/tasks/add/index.ts` の `addTask --pr` 経路 |
| 今回の検証回数 | 1 |
| 前回の検証回数 | 0 |
| 前回経路 | なし |
| 今回経路 | `addTask --pr`（一次入口）→ `downloadPrImages` → `saveTaskFile` → `prepareTaskSpecDirectory` → `buildTaskOrderContent`＋`promoteTaskAttachments` → `order.md` / `attachments/` |
| 同一不変条件・再発判定 | 判定できない（初回） |
| 累積 `incomplete` 回数 | 0 |
| 別経路での再発が確認済みか | 未確認 |
| 強制点候補 | `addTask.test.ts` の単体テストで保存・配置・order.md 追記を一つの観測点で検証 |
| 記録の完全性 | 完全 |

### 4. 修正方法の詳細（U1）

`src/__tests__/addTask.test.ts` に非空 attachments ケースのテストを1件追加する。

- `mockDownloadPrImages` が `{ prReview, attachments: [attachment] }` を返すように `mockReturnValueOnce` で設定。`attachment` は `{ placeholder: '[Image #1]', tempPath: <実在の一時 .png ファイル>, fileName: 'image-1.png' }`。一時ファイルは `fs.mkdtempSync` で作成したディレクトリに実在する regular file として用意（`validateStoredImageAttachment` / `assertRegularImageAttachmentFile` は拡張子・regular file のみを要求し、magic bytes は要求しないため、任意内容の `.png` ファイルで可。実装契約と一致させるため `image-1.png` を用いる）。
- 実行後、(2) `readOrderContent` で取得した task_dir 配下の `.takt/tasks/<slug>/attachments/image-1.png` が実在すること、(3) `order.md` に `[Image #1]` と `## 添付画像` が含まれることを `expect(...).toContain(...)` で検証する。これにより (1) `saveTaskFile` への attachments 伝播を間接的に観測する（配線が欠落すれば (2)(3) が失敗する）。
- 既存テストの `readOrderContent` / `loadTasks` ヘルパーを再利用する。

**反証方法:** `add/index.ts:218` の `attachments.length > 0` 分岐や `attachments.ts` の `promoteTaskAttachments` / `buildTaskOrderContent` が壊れた場合、assertion (2) または (3) が失敗する。

### 5. 依存順と完了条件

- 修正単位は U1 のみ。依存なし。
- **完了条件（外部から観測可能）:** `npm test` に追加したテストが成功し、`npm run build`、`npm run lint` が成功する。ただし品質ゲートの実行・証跡は fix ステップの責務（本ステップでは計画のみ）。
- **環境要因による後続確認:** なし（本テストは local filesystem + モックで完結する unit テストであり、外部環境に依存しない）。

### 6. 除外事項（再採用しない）

- Content-Type ヘッダ検証（PR-IMG-8）は裁定対象外。探索権限外の観察として修正対象に含めない。
- pipeline 経路は既に `pipelineExecution.test.ts:1554` で検証済みであり、今回の修正境界外。再変更しない。
- 配線の作り直し・新規外部契約の追加は修正境界外。

**不変条件台帳の継承行は無変更で維持**（白紙）。「先行 remediation なし」は不変条件行にせず、区別したまま fix-report まで転記する。