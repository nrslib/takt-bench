## 修正計画レポート

### 1. 修正対象と受入条件

| 修正単位 | 指摘ID | 原因 | 受入条件 | 修正境界 |
| :--- | :--- | :--- | :--- | :--- |
| **一時保存ディレクトリの一意化** | `PRIMG-TEMP-DIR-OWNERSHIP` | `createTempDownloadDir` が固定の `takt-pr-images` ディレクトリを使用しており、同一 `tmpRoot` 下での重複実行時に衝突し、片方の cleanup が他方を削除する。 | 同一 `tmpRoot` 下で2回 `resolvePrReviewImageAttachments` を実行し、両方の結果を保持しても、ファイル名が衝突せず、個別の cleanup が相手の領域に影響を与えないこと。 | `createTempDownloadDir` の実装変更、およびそれを検証する統合テストの追加。URL分類、認証、MIME、サイズ制限などの既存機能は変更しない。 |

### 2. 問題分類

- **構造問題**: 一時ファイルのライフサイクル管理（所有権）の不備。
- **正本**: 「画像解決結果が自身の一時領域とcleanupを所有する」という計画契約。
- **実在経路**: `resolvePrReviewImageAttachments` $\rightarrow$ `downloadPrReviewImageAttachments` $\rightarrow$ `createTempDownloadDir` $\rightarrow$ `fs.rmSync(downloadDir, ...)`。

### 3. 詳細分析と不変条件

**不変条件**:
- 1回の画像解決処理（`resolvePrReviewImageAttachments` の呼び出し）は、他から隔離された専用の一時ディレクトリを所有しなければならない。
- `cleanup()` の実行は、その処理が作成したディレクトリのみを削除し、同一 `tmpRoot` 内にある他の処理の成果物を破壊してはならない。

**現状の違反**:
- `src/infra/github/prReviewImageAttachments.ts:427`: `const downloadDir = path.join(tmpRoot, 'takt-pr-images');` と固定名になっている。
- これにより、同一 `tmpRoot` を共有する並行処理がある場合、`image-1.png` 等の名前が衝突し、`fs.rmSync` がディレクトリ全体を消すため、他方の処理のファイルまで消失する。

### 4. 修正計画

#### 修正単位: 一時保存ディレクトリの一意化
1. **実装変更**:
   - `createTempDownloadDir` を変更し、`fs.mkdtempSync` 等を用いて `takt-pr-images-XXXXXX` の形式で一意なディレクトリを生成するようにする。
   - `ensurePrivateDirectory(tmpRoot)` の呼び出しは維持し、親ディレクトリの存在を保証する。

2. **検証（統合テスト追加）**:
   - `src/__tests__/prReviewImageAttachments.integration.test.ts` に以下のシナリオを追加する。
     - **シナリオ P1 (並存)**: 同一 `tmpRoot` を指定して `resolvePrReviewImageAttachments` を2回呼び出す。両方の `attachments` が有効なパスを持ち、ファイルが存在することを確認する。
     - **シナリオ P2 (個別削除)**: 1回目の結果の `cleanup()` を呼び出した後、2回目の `attachments` のファイルが依然として存在することを確認する。
     - **シナリオ P3 (片側失敗)**: 1回目の処理が成功し、2回目の処理が（例：不正なMIMEタイプで）失敗した場合、1回目のファイルが消えていないことを確認する。

### 5. 依存順と完了条件

- **順序**: 実装 $\rightarrow$ 統合テスト追加 $\rightarrow$ 既存テスト回し。
- **完了条件**:
  - `createTempDownloadDir` が呼び出しごとに異なるパスを返すこと。
  - 追加した統合テスト（P1, P2, P3）がすべてパスすること。
  - `npm run test` および `npm run test:it` が成功すること。

### 要求シナリオの維持

| 修正単位 | 入力断片 | 期待される振る舞い |
| :--- | :--- | :--- |
| 一時保存ディレクトリの一意化 | `tmpRoot: "/tmp/takt"` | 1回目: `/tmp/takt/takt-pr-images-a1b2c3` $\rightarrow$ 2回目: `/tmp/takt/takt-pr-images-d4e5f6` となり、互いに干渉しない。 |