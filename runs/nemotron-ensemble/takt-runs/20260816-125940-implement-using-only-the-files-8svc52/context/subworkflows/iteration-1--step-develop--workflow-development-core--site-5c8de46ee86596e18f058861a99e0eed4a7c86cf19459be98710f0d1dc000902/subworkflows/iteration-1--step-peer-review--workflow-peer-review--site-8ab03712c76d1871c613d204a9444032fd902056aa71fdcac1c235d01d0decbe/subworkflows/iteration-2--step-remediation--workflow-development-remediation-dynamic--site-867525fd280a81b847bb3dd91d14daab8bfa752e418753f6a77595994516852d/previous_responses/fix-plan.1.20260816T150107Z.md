## 実装計画レポート

### 1. 修正対象の整理

レビュー裁定に基づき、以下の2つの family を修正対象とします。

| family ID | 担当箇所 | 不変条件 | 指摘 ID / 出典 | 受入条件 |
| :--- | :--- | :--- | :--- | :--- |
| `image-attachment-persistence` | `src/features/tasks/attachments.ts` | ダウンロードされた画像はタスクディレクトリに保存され、`order.md` に記載されること | `CODE-NEW-attachments-save` | `takt add --pr` 等の実行時に、画像が `.takt/tasks/<slug>/attachments/` に保存され `order.md` に追記されること |
| `pr-image-attachment-test` | `src/infra/github/image-downloader.ts` 等 | 新規導入ロジック（抽出・検証・保存）が単体テストで担保されていること | `TEST-NEW-01` | `extractImageUrls`, `validateAndDownloadImage`, `saveImageAttachments` に対する単体テストが実装され、成功すること |

---

### 2. 根本原因と構造分析

#### `image-attachment-persistence`
- **現状**: `src/features/tasks/attachments.ts` に `saveImageAttachments` 関数が実装されているが、これを呼び出す経路が存在しない。
- **根本原因**: 機能未完。画像ダウンロードからタスク保存までのフローにおいて、永続化（ファイル保存と `order.md` 追記）を担う関数が配線されていない。
- **影響経路**:
    - `takt add --pr` $\rightarrow$ `addTask` $\rightarrow$ `saveTaskFile` $\rightarrow$ `saveEnqueuedTaskFile` $\rightarrow$ `prepareTaskSpecDirectory` $\rightarrow$ `promoteTaskAttachments`
    - 現在の `promoteTaskAttachments` はファイルをコピーするが、`order.md` への追記を行わない。`saveImageAttachments` はその両方を担う設計になっている。

#### `pr-image-attachment-test`
- **現状**: `src/__tests__/` 配下に画像抽出・ダウンロード・保存ロジックを検証するテストが存在しない。
- **根本原因**: テスト欠落。品質要件で定められた単体テストが実装されていない。

---

### 3. 修正計画

#### Family 1: `image-attachment-persistence`
- **不変条件**: ダウンロードされた画像はタスクディレクトリに保存され、`order.md` に記載されること
- **担当箇所**: `src/features/tasks/attachments.ts`
- **強制点**: `prepareTaskSpecDirectory` 内で `promoteTaskAttachments` の代わりに（または併せて）`saveImageAttachments` を呼び出し、ファイル保存と `order.md` 更新を一貫して行う。
- **実在経路**:
    - **現行**: `addTask` (`src/features/tasks/add/index.ts:230`) $\rightarrow$ `saveTaskFile` $\rightarrow$ `saveEnqueuedTaskFile` $\rightarrow$ `prepareTaskSpecDirectory` (`src/features/tasks/attachments.ts:311`) $\rightarrow$ `promoteTaskAttachments` (`src/features/tasks/attachments.ts:324`) $\rightarrow$ ファイルコピーのみ (order.mdは不変)
    - **修正後**: `addTask` $\rightarrow$ `saveTaskFile` $\rightarrow$ `saveEnqueuedTaskFile` $\rightarrow$ `prepareTaskSpecDirectory` $\rightarrow$ `saveImageAttachments` $\rightarrow$ ファイルコピー + `order.md` 追記
- **変更点**:
    - `src/features/tasks/attachments.ts`: `prepareTaskSpecDirectory` の `beforeWrite` コールバック内で `saveImageAttachments` を呼び出すように変更。
    - 注意: `saveImageAttachments` は `async` であるため、`beforeWrite` の型定義および呼び出し側の `await` 処理を確認し、必要に応じて `enqueueService.ts` 等の呼び出し元を修正する。

#### Family 2: `pr-image-attachment-test`
- **不変条件**: 新規導入ロジック（抽出・検証・保存）が単体テストで担保されていること
- **担当箇所**: `src/infra/github/image-downloader.ts`, `src/features/tasks/attachments.ts`
- **実在経路**:
    - `extractImageUrls` (GitHub/GitLab) $\rightarrow$ Unit Test
    - `validateAndDownloadImage` $\rightarrow$ Unit Test
    - `saveImageAttachments` $\rightarrow$ Unit Test
- **変更点**:
    - `src/__tests__/infra/github/image-downloader.test.ts` (新規作成): `validateAndDownloadImage` の正常系・異常系（URL不正、サイズ超過、型不正）をテスト。
    - `src/__tests__/features/tasks/attachments.test.ts` (新規作成): `saveImageAttachments` によるファイル保存と `order.md` の内容変更をテスト。

---

### 4. 実施順序と完了条件

1. **`image-attachment-persistence` の修正**
    - `saveImageAttachments` の配線を完了させ、`takt add --pr` で画像が保存され `order.md` が更新されることを確認する。
2. **`pr-image-attachment-test` の実装**
    - 上記ロジックを担保する単体テストを実装し、すべてパスすることを確認する。

**完了証拠**:
- `takt add --pr` 実行後、`.takt/tasks/<slug>/attachments/` にファイルが存在し、`.takt/tasks/<slug>/.takt/order.md` に `## 添付画像` セクションが存在すること。
- 新設した単体テストが `npm test` で成功すること。