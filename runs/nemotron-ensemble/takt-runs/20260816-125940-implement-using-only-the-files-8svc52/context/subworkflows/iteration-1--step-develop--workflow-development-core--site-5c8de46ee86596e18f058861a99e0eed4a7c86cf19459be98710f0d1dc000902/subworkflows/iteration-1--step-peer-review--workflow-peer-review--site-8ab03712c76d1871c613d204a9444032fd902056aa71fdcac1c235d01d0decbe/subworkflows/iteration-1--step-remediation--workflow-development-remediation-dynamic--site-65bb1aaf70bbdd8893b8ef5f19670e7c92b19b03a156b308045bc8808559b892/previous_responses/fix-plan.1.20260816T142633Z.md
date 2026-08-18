## 修正計画レポート

### 1. 修正対象と受入条件の対応付け

| family ID | 不変条件の名前 | 担当箇所 | 指摘 ID / 出典 | 受入条件 | 修正境界 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `gitlab-support` | GitLab MR の画像も整合的に抽出・保存されること | `src/infra/gitlab/pr.ts` | AI-NEW-infra-gitlab-L11, CODE-NEW-gitlab-pr-L240, CODE-NEW-image-downloader-L19 | GitLab URL を許容し、MR 抽出後に保存フローが正しく実行されること | `src/infra/gitlab/pr.ts` の保存呼出実装、`src/infra/github/image-downloader.ts` の URL バリデーション汎用化 |
| `image-lifecycle` | 一時ファイルは一意に生成され、処理後に確実に消去されること | `src/features/pipeline/steps.ts` | AI-NEW-feature-tmp-L234, CODE-NEW-pipeline-steps-L236 | `os.tmpdir()` 等によるユニークパスの使用と、`finally` 等による確実な削除が実装されていること | `src/features/pipeline/steps.ts` の一時ファイル生成・削除ロジック |
| `image-download-logic` | 画像のダウンロードから `TaskAttachment` 生成までのフローが統一されていること | TaskAttachment 管理責任 | ARCH-NEW-DRY-IMAGE-DL | 重複ロジックが `src/features/tasks/attachments.ts` 等の共通所有者に集約されていること | `src/features/tasks/attachments.ts` への共通関数抽出、`src/features/pipeline/steps.ts` および `src/features/tasks/add/index.ts` のリファクタリング |
| `image-io-performance` | 大容量ファイルの I/O がイベントループをブロッキングしないこと | `src/features/tasks/attachments.ts` | AI-NEW-feature-sync-L317 | `fs.promises` 等の非同期 API に置換され、ブロッキングが解消されていること | `src/features/tasks/attachments.ts` の I/O 処理非同期化 |
| `image-download-observability` | 画像ダウンロード失敗時に、原因を特定可能なエラーまたは警告がユーザーに通知されること | `src/features/pipeline/steps.ts` | AI-NEW-feature-error-L240 | 失敗時に `null` で無視せず、適切なエラー種別に応じた通知またはログ出力が行われること | `src/features/pipeline/steps.ts` のエラーハンドリング強化 |

---

### 2. 構造分析と修正計画

#### family: `image-download-logic` (構造問題)
- **根本原因**: 画像のダウンロード、一時保存、`TaskAttachment` オブジェクト生成という同一のビジネスロジックが、`addTask` (CLI) と `resolveTaskContent` (Pipeline) の 2 箇所にハードコードされており、変更が分散している。
- **強制点**: `src/features/tasks/attachments.ts` にダウンロードから `TaskAttachment` 生成までを完結させる単一の責任関数（例: `downloadImageAsAttachment`）を定義し、全入口からこの関数のみを経由させる。
- **経路分析**:
    - **現行 (Pipeline)**: `resolveTaskContent` $\rightarrow$ `validateAndDownloadImage` $\rightarrow$ `fs.writeFileSync` $\rightarrow$ `TaskAttachment` 生成
    - **現行 (Add)**: `addTask` $\rightarrow$ `validateAndDownloadImage` $\rightarrow$ `fs.writeFileSync` $\rightarrow$ `TaskAttachment` 生成
    - **修正後**: 入口 $\rightarrow$ `attachments.ts:downloadImageAsAttachment` $\rightarrow$ `validateAndDownloadImage` $\rightarrow$ ユニークパス保存 $\rightarrow$ `TaskAttachment` 生成

#### family: `gitlab-support` (構造問題)
- **根本原因**: `validateAndDownloadImage` が GitHub の URL プレフィックスにハードコードされており、GitLab プロバイダーで抽出した URL がバリデーションで拒否される。また、GitLab 側で抽出後の保存処理が未実装である。
- **強制点**: `image-downloader.ts` のバリデーションをプロバイダー非依存（または複数プロバイダー対応）に拡張し、`src/infra/gitlab/pr.ts` から共通の保存フローを呼び出す。
- **経路分析**:
    - **現行**: `fetchMrReviewComments` $\rightarrow$ `extractImageUrls` $\rightarrow$ (保存処理なし) $\rightarrow$ `images` リスト返却
    - **修正後**: `fetchMrReviewComments` $\rightarrow$ `extractImageUrls` $\rightarrow$ `attachments.ts:downloadImageAsAttachment` (汎用バリデータ経由) $\rightarrow$ 保存

#### family: `image-lifecycle` (構造問題)
- **根本原因**: `/tmp/image-n.png` という固定パスを使用しており、並行実行時のファイル衝突および処理後の削除漏れによるリソースリークが発生する。
- **強制点**: `node:os.tmpdir()` と `node:crypto.randomUUID()` 等を用いて一意なパスを生成し、`try...finally` ブロックで確実に `fs.unlink` を実行する。
- **経路分析**:
    - **現行**: `resolveTaskContent` $\rightarrow$ `/tmp/image-n.png` 書き込み $\rightarrow$ `promoteTaskAttachments` (コピー) $\rightarrow$ (削除なし)
    - **修正後**: `downloadImageAsAttachment` $\rightarrow$ ユニークパス書き込み $\rightarrow$ `promoteTaskAttachments` (コピー) $\rightarrow$ `finally` でユニークパス削除

#### family: `image-io-performance` (構造問題)
- **根本原因**: `fs.writeFileSync` や `fs.copyFileSync` 等の同期 API を使用しており、最大 10MB のファイル操作中に Node.js のメインスレッドがブロッキングされる。
- **強制点**: `fs.promises` API ( `writeFile`, `copyFile` ) への完全な移行。
- **経路分析**:
    - **現行**: `saveImageAttachments` $\rightarrow$ `fs.copyFileSync` / `fs.writeFileSync` (同期)
    - **修正後**: `saveImageAttachments` $\rightarrow$ `await fs.promises.copyFile` / `await fs.promises.writeFile` (非同期)

#### family: `image-download-observability` (局所問題)
- **根本原因**: ダウンロード失敗時に `catch` ブロックで `null` を返し `filter` で除去しているため、ユーザーに失敗した画像があることとその理由が伝わらない。
- **強制点**: `null` 返却を禁止し、エラー情報を保持した結果を返すか、適切な UI 通知関数 (`error`, `warn`) を呼び出す。
- **経路分析**:
    - **現行**: `resolveTaskContent` $\rightarrow$ `catch` $\rightarrow$ `console.warn` $\rightarrow$ `return null` $\rightarrow$ `filter`
    - **修正後**: `resolveTaskContent` $\rightarrow$ `catch` $\rightarrow$ `ui.warn` (詳細付き) $\rightarrow$ 失敗リストの管理または明示的なスキップ通知

---

### 3. 実施順序と完了条件

1. **`image-download-logic` & `image-lifecycle` & `image-io-performance`**:
    - `src/features/tasks/attachments.ts` に非同期の共通ダウンロード・保存関数を実装。ユニークパス生成と `fs.promises` を採用。
    - **完了条件**: `addTask` と `resolveTaskContent` の両方でこの共通関数が使われ、`/tmp` に固定ファイルが作成されないこと。
2. **`gitlab-support`**:
    - `src/infra/github/image-downloader.ts` のバリデーションを汎用化。
    - `src/infra/gitlab/pr.ts` から共通関数を呼び出し、保存まで完結させる。
    - **完了条件**: GitLab の MR 画像 URL がバリデーションを通過し、正常に保存されること。
3. **`image-download-observability`**:
    - 共通関数および呼び出し側のエラーハンドリングを修正し、UI 通知を適切に行う。
    - **完了条件**: 意図的に不正な URL を渡した際、`null` で消えず、原因がコンソール/UI に出力されること。

### 4. 再発台帳の引き継ぎ

先行 remediation なし。本計画で定義した全 family を初回検証として扱う。