Now let me examine the report directory and the fix-verification history for the invariant ledger.
Now let me examine the current imageDownload implementation details and its tests, plus check how `gh api` can return headers.
Let me check the gh CLI docs for how to obtain headers, and examine the modified test files for context.
I have gathered all the necessary evidence. Let me verify a couple more implementation details before finalizing the plan.
I have gathered all the necessary evidence. Let me verify one more detail about the existing test contract that will be affected.
I have gathered all necessary evidence. Now let me produce the fix plan.

## 修正計画

### 裁定の要約

**結果: REJECT**。修正対象は `image-content-type-validation` family（FG-IMG-1 / FG-IMG-001）。

- **受入条件**: ダウンロードした画像の HTTP Content-Type ヘッダが supported 形式（PNG/JPEG/GIF/WebP）に一致する場合のみ許可し、不一致・欠落を拒否する
- **修正境界**: `src/infra/github/imageDownload.ts` 内の `downloadImage` / `downloadPrImages` のみ。外部契約・他経路（`add/index.ts`、`steps.ts`、`execute.ts`、`imageExtraction.ts`、`attachments.ts`）の変更なし
- **権限根拠**: order.md:36「Content-Type と magic bytes を検証する」の直接違反
- **修正単位**: U1（1 単位のみ、独立した局所問題）

### 根本原因と責務の分析

**現行経路（確認済み）:**
```
addTask(cwd, task, { prNumber }) [add/index.ts:164]
  → provider.fetchPrReviewComments [index.ts:186]
  → downloadPrImages(prReview, cwd) [index.ts:199]
    → downloadImage(url, cwd) [imageDownload.ts:62]  ← execFileSync('gh', ['api', url])
    → detectImageFormat(data) [imageDownload.ts:38]  ← magic bytes のみ
    → 保存・placeholder 置換 [imageDownload.ts:118-130]
  → saveTaskFile [index.ts:214]
```
pipeline 経路: `resolveTaskContent` [steps.ts:228] → `downloadPrImages` → `runWorkflow` へ attachments 伝播 [steps.ts:362, execute.ts:59]。両経路とも同一の `downloadPrImages` を共有するため、同一不変条件。

**根本原因:** order.md:36 は「Content-Type と magic bytes を検証する」と要求するが、`downloadImage` は `gh api` を `encoding: null` で生バッファとして受け、Content-Type ヘッダを取得・検証していない。`detectImageFormat`（magic bytes）のみで形式判定している。**Content-Type ヘッダ検証が未接続**（検証境界の欠落）。

**確認して否定した別の原因:** 形式検証自体の欠落ではない（magic bytes は実装済み）。`gh api` の呼び方の問題ではない（private repo 取得は既に成立）。配線問題ではない（`downloadPrImages` は両経路で正しく呼ばれている）。

### 修正単位 U1: Content-Type ヘッダ検証の追加

**不変条件名:** `image-content-type-validation`（新規 family）
**担当箇所:** `src/infra/github/imageDownload.ts` の `downloadPrImages`（Content-Type 検証を追加すべき検証境界）
**観測可能な不変条件:** ダウンロードした画像の HTTP Content-Type ヘッダが supported 形式（`image/png`, `image/jpeg`, `image/gif`, `image/webp`）のいずれかに一致する場合のみ受理し、不一致・欠落は拒否（throw）する

**実装方法:**
1. `downloadImage` を `gh api --include <url>`（gh の `-i/--include` フラグでヘッダを出力に含める）へ変更し、戻り値を `{ data: Buffer, contentType: string | undefined }` にする。`encoding: null` の Buffer のまま受け、`\r\n\r\n`（ヘッダとボディの区切り）で分割して、前半のヘッダテキストから `content-type` をパースする（`paginated-api.ts:11-33` のヘッダパース方式を参照。ただし binary ボディのため string ではなく Buffer 上で分割する）。
2. `downloadPrImages` で、Content-Type が supported 形式以外（または欠落）の場合 `throw new Error(...)` する。magic bytes 検証（`detectImageFormat`）は維持する。両方通った場合のみ保存する（order.md:36 の「両方を検証」要件）。
3. `downloadImage` は非公開関数のまま維持（public API のエクスポート増加なし）。

**検証方法（テスト）:**
- `src/__tests__/imageDownload.test.ts` の既存テストは純バッファを mock 返却しているため、`--include` 形式（`HTTP/2 200 OK\ncontent-type: image/png\n\n<bytes>`）へ更新が必要（契約変更に伴うテスト契約の更新）。
- 追加テスト: Content-Type が supported（`image/png`）で magic bytes も一致 → 受理。Content-Type 不一致（`text/html` 等）で magic bytes 一致 → 拒否。Content-Type 欠落 → 拒否。magic bytes 不一致 + Content-Type 不一致 → 拒否（既存の unsupported format テストと整合）。

**受入条件の確認:** Content-Type ヘッダが supported 形式に一致しない画像を拒否できる。代表敵対反例: `Content-Type: text/html` を付けた PNG バイト、Content-Type ヘッダなしの PNG バイト、が拒否されること。

**修正境界:** `imageDownload.ts` のみ。`add/index.ts`、`steps.ts`、`execute.ts`、`imageExtraction.ts`、`attachments.ts` は変更しない（配線は既に成立）。

### 不変条件台帳

**引き継ぎ元:** `review-resolution.md`（同一 iteration-2 remediation ディレクトリ内に先行 fix-verification がないため review-resolution を使用）

**引き継ぎ元からの行（無変更転記）:**
| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回検証回数 | 前回検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 incomplete | 別経路での再発確認済み | 強制点候補 | 記録の完全性 |
|---------|-----------|----------------|----------|--------------|--------------|----------|----------|------------------------|------------------|------------------------|------------|--------------|
| U1(前): addTask --pr 経路の添付伝播テスト追加 | `attachment-propagation` | `addTask --pr` 経路の添付伝播 | `add/index.ts` の `addTask --pr` 経路 | 1（初回） | なし | なし | なし | 維持（判定できない（初回）） | 0 | 未確認 | 該当なし | 完全 |

**新規・現在の計画行:**
| 修正単位 | family ID | 不変条件の名前 | 観測可能な不変条件 | 担当箇所 | 分類 | 別経路での再発確認済み | 強制点 |
|---------|-----------|----------------|----------------------|----------|------|------------------------|--------|
| U1: Content-Type ヘッダ検証の追加 | `image-content-type-validation` | 画像ダウンロード時の Content-Type 検証 | ダウンロード画像の Content-Type が supported 形式に一致する場合のみ受理し、不一致・欠落を拒否する | `imageDownload.ts` の `downloadPrImages`（Content-Type 検証境界） | 局所 | 未確認 | 不要（初回検証・単一検証境界のため。同一不変条件が別経路で2回以上壊れた場合に強制点化） |

（`attachment-propagation` 行は引き継ぎ元の全13項目を無変更で維持。今回 `image-content-type-validation` は `incomplete` でないため検証回数・経路・累積回数を更新せず、初期値のまま新規行として追加する。）

### 実施順序
| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|------|----------|------|--------|----------|----------------|
| 1 | U1 | 局所修正（本番コード + テスト更新） | なし | `src/infra/github/imageDownload.ts`、`src/__tests__/imageDownload.test.ts` | Content-Type 不一致・欠落で throw するテストが成功し、supported Content-Type で受理される。`npm test -- src/__tests__/imageDownload.test.ts` の成功。build / lint は fix ステップの品質ゲートで確認 |

### 要求シナリオ
**成立側:** `Content-Type: image/png` + PNG magic bytes の画像 → 受理され `image-1.png` として保存される
**拒否側（識別力）:** `Content-Type: text/html` + PNG magic bytes → 拒否（magic bytes だけでは受理しない）。Content-Type ヘッダなし + PNG magic bytes → 拒否

### 再計画事項
- なし。修正計画は確定。本修正は order.md:36 の明示要件充足のため、修正権限の範囲内で完結する。