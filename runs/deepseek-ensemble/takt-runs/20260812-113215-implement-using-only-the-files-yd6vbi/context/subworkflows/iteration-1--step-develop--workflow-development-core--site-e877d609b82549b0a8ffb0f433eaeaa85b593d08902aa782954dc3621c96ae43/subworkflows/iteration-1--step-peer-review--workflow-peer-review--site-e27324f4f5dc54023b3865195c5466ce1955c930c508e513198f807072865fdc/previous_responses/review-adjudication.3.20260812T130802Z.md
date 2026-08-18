## coding-review
The implementation of the PR image download feature is complete and adheres to the requirements.

### Review Summary

- **Functional Correctness**: The logic for extracting image URLs from PR bodies and comments, downloading them using `gh auth token`, validating MIME types/magic bytes, and managing temporary storage is correctly implemented in `src/infra/github/prReviewImageAttachments.ts`.
- **Integration**: The feature is properly integrated into:
    - `takt add --pr`: Now resolves image attachments and includes them in the saved task spec (`src/features/tasks/add/index.ts`).
    - Interactive mode: PR images are passed to the seed and cleaned up upon cancellation or exit (`src/app/cli/routing.ts`).
    - Pipeline execution: Images are correctly handled and attached to the execution context (`src/features/pipeline/execute.ts` and `src/features/pipeline/steps.ts`).
- **Safety & Constraints**:
    - **URL Validation**: Only `github.com` attachment URLs are allowed (`isAllowedGithubAttachmentUrl`).
    - **Size Limits**: `MAX_IMAGE_BYTES` (10MB) is enforced during download and body reading.
    - **Security**: Temporary files are written with `0o600` mode.
    - **Resource Management**: `cleanup` functions are consistently called in `finally` blocks across all entry points.
- **Refactoring**: The image extension logic was successfully unified into `src/shared/utils/imageFormat.ts`, removing duplication in `imageAttachments.ts`.

### Verification of Requirements
- [x] Detect image URLs in PR body/comments: **Implemented** (`extractPrReviewImageReferences`)
- [x] Download via `gh` authentication: **Implemented** (`getGhAuthToken`)
- [x] Validate Content-Type and magic bytes: **Implemented** (`validateImageResponse` + `detectImageMimeType`)
- [x] Save to `.takt/tasks/<slug>/attachments/`: **Implemented** via `saveTaskFile` integration.
- [x] Pipeline `--pr` support: **Implemented** (`runWorkflow` updates).
- [x]- Image reference replacement (`[Image #1]`): **Implemented** (`buildReplacedPrReview`).

**Verdict: APPROVE**

---

## ai-antipattern-review
このステップでは、提供された変更対象ファイル（21件）を読み込み、AI生成コード特有のアンチパターン（幻覚API、過剰エンジニアリング、配線漏れ、不適切な仮定など）がないかレビューしました。

### レビュー結果：APPROVE

変更されたコードベースを確認しましたが、AI特有の重大な欠陥は見つかりませんでした。

#### 検証したポイント：
1.  **配線の一貫性**: 
    - `resolvePrInput` $\rightarrow$ `routing.ts` $\rightarrow$ `interactiveMode` / `selectAndExecuteTask` / `saveTaskFromInteractive` への `attachments` の伝播経路を確認しました。
    - `src/app/cli/routing.ts:220` で `interactiveSeed` に `prAttachments` が正しく組み込まれており、下流へ伝播しています。
    - `src/app/cli/routing.ts:313` および `src/app/cli/routing.ts:322` で `selectOptions.attachments` に正しくセットされています。
2.  **リソース管理（Cleanup）**:
    - `src/infra/github/prReviewImageAttachments.ts` で作成された一時ディレクトリが、`cleanup` 関数を通じて適切に削除される構造になっていることを確認しました。
    - `src/app/cli/routing.ts:354` の `finally` ブロックで `prAttachmentsCleanup?.()` が呼ばれており、メモリ/ディスクリークが防止されています。
3.  **実在性の検証**:
    - `GitHubProvider.ts` および `prReviewImageAttachments.ts` で使用されている `gh` CLI の操作や `fetch` API の利用方法に、幻覚と思われる API コールは見当たりませんでした。
4.  **境界防御**:
    - `src/infra/github/prReviewImageAttachments.ts` において、`isAllowedGithubAttachmentUrl` による URL 検証や、`MAX_IMAGE_BYTES` によるサイズ制限、MIME タイプのマジックバイト検証が実装されており、安全なダウンロード処理が行われています。

#### 結論：
実装は既存のプロジェクトパターンに適合しており、要求された「PRレビュー画像アタッチメントの解決と伝播」という機能が、不要な過剰実装を伴わずに最小限かつ安全な差分で実現されています。

---

## architecture-review
The architecture and design review for the PR image attachment feature is complete.

### Architectural Evaluation

The implementation follows a clean separation of concerns:
1.  **Infrastructure Layer (`src/infra/github/prReviewImageAttachments.ts`)**: Handles the low-level details of GitHub attachment URL validation, authenticated downloading via `gh auth token`, MIME type verification (using magic bytes), and temporary storage.
2.  **Provider Abstraction (`src/infra/github/GitHubProvider.ts`)**: Exposes the image resolution capability through the `GitProvider` interface, ensuring the core logic remains agnostic of the specific GitHub SDK/CLI details.
3.  **Feature Integration**:
    *   `addTask` (`src/features/tasks/add/index.ts`): Correctly integrates the resolution flow when `--pr` is used, ensuring that attachments are passed to the task specification and temporary files are cleaned up via a `finally` block.
    *   `executePipeline` (`src/features/pipeline/execute.ts` & `src/features/pipeline/steps.ts`): Properly implements the "fetch $\rightarrow$ resolve $\rightarrow$ execute" chain. It ensures that `attachmentCleanup` is called in a `finally` block at the pipeline level, preventing temp file leaks.
    *   **Interactive Mode (`src/app/cli/routing.ts`)**: Integrates PR attachments into the interactive seed, allowing AI agents to "see" the images during the conversation, and ensures cleanup of both seed and result attachments.

### Design Principles Compliance
- **Layering**: Dependencies flow correctly from `cli` $\rightarrow$ `features` $\rightarrow$ `infra` $\rightarrow$ `shared`.
- **Safety**: The use of `writeNewPrivateFileWithMode` (mode `0o600`) and `ensurePrivateDirectory` ensures that sensitive images are not world-readable.
- **Robustness**: The `fetchImageWithRedirects` implementation prevents SSRF by strictly validating redirect targets against the GitHub hostname.
- **Memory/Storage Efficiency**: Explicit `MAX_IMAGE_BYTES` checks are performed both on the `content-length` header and during the streaming read of the response body.

### Conclusion
The implementation is architecturally sound, respects the established boundaries of the TAKT engine, and correctly manages the lifecycle of temporary assets.

**Result: APPROVE**

---

## security-review
この変更におけるセキュリティレビュー結果を報告します。

### 1. 信頼境界と入力検証
PRコメント内の画像URLを抽出してダウンロードする機能が導入されました。以下の対策が実装されており、適切に制御されています。

- **URLのホワイトリスト制限**: `isAllowedGithubAttachmentUrl` (src/infra/github/prReviewImageAttachments.ts:45) により、`https` プロトコルかつ `github.com` の特定のパス (`user-attachments/assets` または `/assets` を含む) のみを許可しており、外部への恣意的なリクエスト（SSRF）を防止しています。
- **リダイレクトの制御**: `fetchImageWithRedirects` (src/infra/github/prReviewImageAttachments.ts:267) でリダイレクトを `manual` に設定し、リダイレクト先を `isAllowedRedirectTarget` (src/infra/github/prReviewImageAttachments.ts:354) で検証しています。リダイレクト先は `github.com` または `*.githubusercontent.com` に限定されており、安全な境界内に留まっています。
- **リダイレクト回数制限**: `MAX_REDIRECTS = 5` (src/infra/github/prReviewImageAttachments.ts:43) により、リダイレクトループによるリソース枯渇を防止しています。

### 2. リソース保護（DoS対策）
- **サイズ制限**: `MAX_IMAGE_BYTES` (10MB) (src/shared/utils/imageFormat.ts:3) が定義されており、`content-length` ヘッダーの検証 (src/infra/github/prReviewImageAttachments.ts:299) および、ストリーム読み取り時の累積サイズ検証 (src/infra/github/prReviewImageAttachments.ts:335) の両方で厳格にチェックされています。これにより、巨大なファイルのダウンロードによるメモリ/ディスク枯渇を防止しています。

### 3. ファイル操作の安全性
- **権限管理**: ダウンロードした一時ファイルは `writeNewPrivateFileWithMode` を使用して `0o600` (所有者のみ読み書き可能) で保存されており、マルチユーザー環境での機密性が確保されています。
- **ディレクトリの隔離**: `createTempDownloadDir` (src/infra/github/prReviewImageAttachments.ts:396) により `0o700` の専用ディレクトリが作成され、適切に隔離されています。
- **パストラバーサル防止**: ファイル名は `image-${number}.png` の形式で内部的に生成されており (src/infra/github/prReviewImageAttachments.ts:185)、外部からの入力（URLやファイル名）をそのままパスとして利用していないため、パストラバーサルのリスクはありません。

### 4. コンテンツ検証
- **MIMEタイプ検証**: `validateImageResponse` (src/infra/github/prReviewImageAttachments.ts:368) において、サーバーが返す `Content-Type` ヘッダーの検証に加え、`detectImageMimeType` (src/shared/utils/imageFormat.ts:5) によるマジックバイトの検証を行い、両者が一致することを要求しています。これにより、拡張子を偽装した悪意あるファイルの混入を防止しています。

### 結論
本実装は、入力URLの制限、リダイレクトの検証、サイズ制限、およびバイナリレベルの形式検証を組み合わせており、GitHubアタッチメントのダウンロードに伴うセキュリティリスクに対して十分に防御的な設計となっています。

**判定: APPROVE**

---

## testing-review
レビュー結果を報告します。

### 概要
PRコメントからの画像ダウンロードおよびTask Attachment化機能について、テストコードを確認しました。
主要なロジック（抽出、検証、ダウンロード、配線、クリーンアップ）が適切にテストされており、品質要件を満たしていると判断します。

### 検証詳細

#### 1. 画像参照の抽出 (`PRIMG-EXTRACT`)
`src/__tests__/prReviewImageAttachments.test.ts` において、以下のケースが網羅的に検証されています。
- **正常系**: PR本文、Conversationコメント、Review Summary/Threadからの抽出（Markdown記法およびHTML `img` 記法）。
- **除外系**: コードフェンス内、インラインコード内、HTMLコメント内の画像記法は無視されること。
- **制限系**: 非HTTPS URLおよびGitHubアセット形式ではないURLの拒否。
- **識別子**: 重複URLの集約、既存プレースホルダー `[Image #N]` との衝突回避。
- **不変性**: 元の `PrReviewData` が変更されないこと。

#### 2. 画像の検証と取得 (`PRIMG-VALIDATE`)
`src/__tests__/prReviewImageAttachments.integration.test.ts` において、外部I/Oをモック化した状態で詳細に検証されています。
- **正当性**: 有効なPNGの保存、ファイル権限（`0o600`）の確認。
- **拒否経路**: 不適切な `Content-Type`、Magic bytes不一致、サイズ上限（10MiB）超過の拒否。
- **ストリーム処理**: ストリーム読み込み時のサイズ上限判定および、上限超過時の即時キャンセル（ReadableStreamの `cancel` 呼び出し）の検証。
- **認証**: `Authorization: Bearer gh-token` ヘッダーの付与。
- **クリーンアップ**: トークン取得失敗時および一部の画像取得失敗時に、一時ディレクトリ全体が削除されること。

#### 3. `takt add --pr` への配線 (`PRIMG-ADD`)
`src/__tests__/addTask.test.ts` において、以下の統合的な挙動が検証されています。
- **保存経路**: 解決された `attachments` が `saveTaskFile` を経由して `attachments/` ディレクトリに保存され、`order.md` に添付節が生成されること。
- **エッジケース**: コメントが空であっても、本文に画像があればタスクとして保存されること（要件23の達成）。
- **ライフサイクル**: ワークフロー選択キャンセルや保存失敗時に `cleanup()` が呼ばれ、一時ファイルが解放されること。

### 判定
**APPROVE**

テストカバレッジは十分であり、特にセキュリティ上の境界（URL検証、サイズ制限、認証情報漏洩防止、一時ファイルの権限と解放）に対する検証が徹底されています。