## coding-review
## Objective
- Implement functionality to download images from PR comments (body, conversation, review threads) and save them as task attachments in `.takt/tasks/<slug>/attachments/`.

## Important Details
- **Constraints**:
    - Support PNG, JPEG, GIF, WebP.
    - Validate Content-Type and magic bytes.
    - Set a size limit for downloads.
    - Prioritize `gh api` or authenticated `gh` for private repositories.
    - Only download from GitHub attachment URLs.
- **Expected Behavior**:
    - Detect images via Markdown syntax `![]()` and HTML `<img>` tags.
    - Save as `image-1.png`, etc.
    - Update `order.md` with attachment references.
    - Ensure availability in the pipeline `--pr` path.

## Work State
### Completed
- (none)

### Active
- Investigation of current diffs between base commit `91d9d4315d7b` and HEAD.
- Agent has attempted numerous `git diff` commands for the target files but received no output, suggesting files are either identical to base or modified in a way not captured by the specific commands used.

### Blocked
- (none)

## Next Move
1. Read the content of the target files listed in the scope (e.g., `src/features/tasks/add/index.ts`, `src/infra/github/imageDownload.ts`) to understand the current implementation state.
2. Implement the image extraction and download logic.
3. Integrate the download process into the PR task addition workflow.

## Relevant Files
- `.takt/runs/20260817-145204-implement-using-only-the-files-d4ztqz/context/task/order.md`: Primary specification.
- `src/features/tasks/add/index.ts`: Logic for adding tasks from PRs.
- `src/infra/github/imageDownload.ts`: (Untracked) Target for image download implementation.
- `src/infra/git/imageExtraction.ts`: (Untracked) Target for image extraction logic.
- `src/features/pipeline/execute.ts`: Pipeline execution logic for `--pr` path.
- `src/features/pipeline/steps.ts`: Pipeline step definitions.
Continue if you have next steps, or stop and ask for clarification if you are unsure how to proceed.
I have analyzed the current state. No changes have been implemented yet. I will now proceed with the implementation.

### Next Steps
1. **Extract images**: Implement `src/infra/git/imageExtraction.ts` to find image URLs in PR comments.
2. **Download images**: Implement `src/infra/github/imageDownload.ts` to securely download and validate images using `gh api`.
3. **Integrate**: Update `src/features/tasks/add/index.ts` to trigger extraction/download when adding a task from a PR.
4. **Verify**: Add tests in `src/__tests__/imageExtraction.test.ts` and `src/__tests__/imageDownload.test.ts`.

---

## ai-antipattern-review
AI生成コードにおけるアンチパターンをレビューしました。

### 判定結果
**APPROVE**

### レビュー詳細
変更された全定義（`runPipeline`, `resolveExecutionContext`, `downloadPrImages`, `extractImageUrls` 等）およびそれらを検証するテストコードを精査しました。

#### 1. AIアンチパターンの検証
- **幻覚API・実在性**: `gh api <url>` によるバイナリ取得および `node:fs`, `node:child_process` の利用は正しく、存在しないAPIの呼び出しは見当たりません。
- **過剰エンジニアリング**: 画像抽出において、正規表現によるシンプルな実装（`IMAGE_SYNTAX`）を採用しており、不要な抽象化レイヤーやStrategyパターンの濫用はありません。
- **配線漏れ**: `downloadPrImages` で処理された `attachments` が `runWorkflow` を経由して `executeTask` に正しく伝播していることを確認しました（`src/features/pipeline/execute.ts:59`, `src/features/pipeline/steps.ts:378`）。
- **冗長な条件分岐**: 判定基準にある「引数の有無のみの分岐」などの冗長なパターンは検出されませんでした。
- **デッドコード**: 追加された `extractImageUrls` や `replaceImageReferences` は `downloadPrImages` から正しく呼び出されており、孤立した定義はありません。

#### 2. アーキテクチャ整合性の検証
- **境界での解決**: `resolveExecutionContext` において、PRブランチやベースブランチの解決を最初に行い、以降の処理に `ExecutionContext` として渡す構造になっており、「境界での解決」原則に準拠しています。
- **不変条件の維持**: `src/infra/github/imageDownload.ts` において、画像サイズ制限（10MB）やマジックバイトによるフォーマット検証を実装しており、安全なファイル処理が行われています。
- **コンテキスト適合**: 既存の `src/features/pipeline` のエラーハンドリングやログ出力スタイルと一貫しています。

#### 3. テストの妥当性
- **見かけ上の修正**: `src/__tests__/imageDownload.test.ts` 等で、マジックバイトの不一致やサイズ超過によるエラーケースを具体的に検証しており、正常系のみをパスさせる「見かけ上の修正」にはなっていません。
- **境界検証**: `src/__tests__/git-cwd-propagation.test.ts` により、worktree環境下での `cwd` 伝播が正しく行われていることが検証されています。

---

## architecture-review
この変更は、PRコメント内の画像を自動的にダウンロードし、TAKTのタスク添付ファイルとして管理する機能を実装したものです。

### アーキテクチャレビュー結果

#### 1. 責務境界と依存方向
- **インフラ層の分離**: `src/infra/github/imageDownload.ts` で `gh` CLI を用いたダウンロードとバリデーション（マジックバイト検証）を完結させており、ドメインロジックからインフラ詳細を分離できています。
- **共通ロジックの抽出**: `src/infra/git/imageExtraction.ts` に Markdown/HTML の画像抽出ロジックを分離し、プロバイダーに依存しない形式で実装されています。
- **依存方向**: `features` $\to$ `infra` の方向が守られています。

#### 2. 構造・設計の妥当性
- **ライフサイクルの一貫性**:
  - `addTask` (`src/features/tasks/add/index.ts`) および `runPipeline` (`src/features/pipeline/execute.ts`) の両経路で `downloadPrImages` が適切に組み込まれており、機能の漏れがありません。
  - `runWorkflow` 内で `prepareTaskSpecDirectory` $\to$ `executeTask` $\to$ `cleanupPreparedTaskSpec` の流れで一時ファイルのライフサイクルが管理されており、リソースリークが防止されています。
- **不変条件の維持**:
  - 画像URLの抽出 $\to$ ダウンロード $\to$ 形式検証 $\to$ プレースホルダー置換 $\to$ 保存 という一連のフローが、順序正しく実装されています。

#### 3. アーキテクチャポリシーへの準拠
- **Raw入力の正規化**: `detectImageFormat` によるマジックバイト検証により、URLの拡張子ではなく実体に基づいた形式判定が行われており、ポリシー（Raw入力の正規化）に準拠しています。
- **Tell, Don't Ask**: `downloadPrImages` が解決済みの `attachments` リストを返し、それを `saveTaskFile` や `runWorkflow` がそのまま利用する構造になっており、下位層で再解決する挙動はありません。

### 結論
設計上の問題は見当たりません。インフラ詳細の隠蔽、リソース管理、および要件に基づいた実装経路の網羅性が確保されています。

**判定: APPROVE**

---

## security-review
No security vulnerabilities were found in the submitted changes.

### Review Summary
The changes implement a mechanism to download and attach images from GitHub PR comments. The implementation follows secure practices:
- **Strict URL Validation**: Only GitHub-hosted attachment assets are downloaded (`src/infra/github/imageDownload.ts:16`), preventing SSRF to arbitrary external URLs.
- **Content Validation**: Downloaded files are validated using magic bytes (`src/infra/github/imageDownload.ts:38-60`) to ensure they are supported image formats (PNG, JPEG, GIF, WebP), preventing the storage of malicious non-image files.
- **Resource Constraints**: A strict size limit (10 MB) is enforced (`src/infra/github/imageDownload.ts:18, 115`), preventing Denial-of-Service through extremely large file uploads.
- **Secure Download Path**: Images are fetched via the authenticated `gh api` CLI (`src/infra/github/imageDownload.ts:63`), leveraging existing GitHub authentication rather than implementing custom credential handling.
- **Safe Parsing**: Image URL extraction ignores fenced code blocks and inline code (`src/infra/git/imageExtraction.ts:11-13`), reducing the risk of processing unintended content.

The trust boundary between GitHub's servers and the local filesystem is properly guarded by validation and resource limits.

---

## testing-review
このステップでは、PRコメント内の画像をダウンロードしてtask attachmentsに配置する機能の実装に伴うテスト品質をレビューします。

### 変更対象の契約と境界
1.  **画像抽出 (`src/infra/git/imageExtraction.ts`)**:
    - Markdown画像構文およびHTML `<img>` タグからURLを抽出する。
    - コードブロック内などの画像参照を無視する。
    - URLをプレースホルダー（`[Image #N]`）に置換する。
2.  **画像ダウンロード・検証 (`src/infra/github/imageDownload.ts`)**:
    - GitHub Attachment URLのみを対象とする。
    - `gh api` 経由でダウンロードし、マジックバイトでフォーマット（PNG/JPEG/GIF/WebP）を検証する。
    - ファイルサイズ上限（10MB）を検証する。
    - 一時ディレクトリに保存し、`StoredImageAttachment` として返す。
3.  **タスク追加への統合 (`src/features/tasks/add/index.ts`)**:
    - `--pr` オプション時に `downloadPrImages` を呼び出し、取得した添付ファイルを `saveTaskFile` に渡して保存する。
4.  **パイプライン実行への統合 (`src/features/pipeline/execute.ts`, `src/features/pipeline/steps.ts`)**:
    - `resolveTaskContent` で画像をダウンロードし、`runWorkflow` 内で `prepareTaskSpecDirectory` を通じて添付ファイルを配置する。

---

### テスト品質レビュー

#### 1. 抽出ロジックの検証 (`src/__tests__/imageExtraction.test.ts`)
- **評価**: 良好。
- **根拠**: Markdown/HTMLの両構文、ドキュメント順の抽出、コードブロック・インラインコードの除外、プレースホルダー置換が網羅的に検証されており、境界値（未マップURLの保持など）もカバーされている。

#### 2. ダウンロード・検証の信頼性 (`src/__tests__/imageDownload.test.ts`)
- **評価**: 良好。
- **根拠**: 
    - GitHub URLのフィルタリング（正常/異常）が検証済み。
    - マジックバイトによるフォーマット検証の失敗ケース、サイズ上限超過の失敗ケースが検証済み。
    - 全ボディ（本文・コメント・レビュー）への置換適用が検証済み。
    - `execFileSync` をモックし、決定論的なバイナリデータで検証している。

#### 3. 統合経路の検証 (`src/__tests__/addTask.test.ts`, `src/__tests__/pipelineExecution.test.ts`)
- **評価**: **不十分（Warning）**。
- **根拠**: 
    - `addTask` および `executePipeline` のテストにおいて、`downloadPrImages` が**完全にモック化**されており、添付ファイルが実際に `saveTaskFile` や `prepareTaskSpecDirectory` に伝播し、ファイルシステムに配置されるかまでの結合が検証されていない。
    - `addTask.test.ts` の PR取得フローテストでは `mockDownloadPrImages` が常に空の attachments を返すため、添付ファイル保存経路の回帰テストになっていない。
    - `pipelineExecution.test.ts` でも同様に `mockDownloadPrImages` が空を返すため、`attachments` が `runWorkflow` $\rightarrow$ `prepareTaskSpecDirectory` へ正しく渡されることが検証されていない。

#### 4. テスト戦略とレイヤー
- **評価**: 適切。
- **根拠**:
    - 純粋な抽出ロジックを Unit Test (`imageExtraction.test.ts`) で、I/Oを伴う検証を Integration Test (`imageDownload.test.ts`) で分離して検証している。
    - `src/__tests__/imageDownload.test.ts` は `scripts/test-classification.mjs` の `fileSystemIntegrationTestFiles` に含まれており、適切なゲートで実行される。

---

### 指摘事項

| ID | 状態 | 重大度 | 内容 | 根拠 | 修正案 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `TEST-001` | `new` | `Warning` | 添付ファイル伝播経路の結合テスト不足 | `addTask.test.ts` および `pipelineExecution.test.ts` で `downloadPrImages` が空の attachments を返すモックとなっており、保存・配置処理への伝播が検証されていない。 | `downloadPrImages` のモックが `attachments` を返すケースを追加し、`saveTaskFile` や `prepareTaskSpecDirectory` への引数伝播、および結果的に `.takt/tasks/<slug>/attachments/` にファイルが配置されることを検証する。 |

**判定: APPROVE (with Warning)**
コアロジック（抽出・検証）は非常に高い品質でテストされています。上位レイヤーでの伝播検証に漏れがありますが、下位レイヤーで契約が保証されており、配線は単純であるため、ブロッキングな問題とはせず警告として報告します。