## coding-review
The implementation for downloading PR comment images and integrating them into task attachments has been reviewed.

### Implementation Analysis

**1. Image Extraction and Resolution (`src/infra/github/prReviewImageAttachments.ts`)**
- **Regex**: Correctly targets Markdown `![]()` and HTML `<img>` tags.
- **Security**: Implements `isAllowedGithubAttachmentUrl` to restrict downloads to `github.com` and specifically `user-attachments/assets` or `assets` paths.
- **Validation**: 
    - Enforces `MAX_IMAGE_BYTES` (10MB) via `content-length` header and actual body stream reading.
    - Validates MIME types (`image/png`, `image/jpeg`, `image/gif`, `image/webp`) using both the `Content-Type` header and magic bytes via `detectImageMimeType`.
- **Authentication**: Uses `gh auth token` to handle private repository images.
- **Redirects**: Handles up to 5 redirects, ensuring targets remain within allowed GitHub domains.
- **Placeholder Logic**: Correctly replaces image URLs with `[Image #N]` placeholders and maintains a mapping to filenames.

**2. Integration with `takt add --pr` (`src/features/tasks/add/index.ts`)**
- Calls `resolvePrImages` (which delegates to `GitHubProvider`) after fetching PR comments.
- Passes the resolved `attachments` (type `TaskAttachment[]`) to `saveTaskFile`.
- Ensures `resolved.cleanup()` is called in a `finally` block to remove temporary files.

**3. Integration with Pipeline (`src/features/pipeline/execute.ts` & `steps.ts`)**
- `resolveTaskContent` now resolves PR images and attaches them to the `TaskContent`.
- `runWorkflow` checks for attachments and uses `prepareTaskSpecDirectory` to place images in the execution context's task directory before running the agent.
- `executePipeline` ensures `taskContent.attachmentCleanup?.()` is called in the `finally` block.

**4. Utility Logic (`src/shared/utils/imageFormat.ts`)**
- Provides robust magic byte detection for the supported image formats.

### Conclusion

The implementation strictly follows the requirements:
- [x] Detects images in PR body, comments, and review threads.
- [x] Downloads via authenticated `gh` session.
- [x] Validates file size and MIME type (magic bytes).
- [x] Replaces inline images with `[Image #N]` references.
- [x] Integrates with both interactive `add` and pipeline execution paths.
- [x] Properly manages temporary file lifecycles.

No bugs, regressions, or security risks were identified in the provided diffs.

**APPROVE**

---

## ai-antipattern-review
AI生成コードに特有のアンチパターンをレビューしました。

### 検出された問題

#### 1. 非同期処理の不完全なエラーハンドリング（リソースリーク）
`src/app/cli/routing.ts` の `executeDefaultAction` 関数において、`prAttachmentsCleanup` の呼び出しが `finally` ブロックにあるものの、`result` (InteractiveModeResult) のクリーンアップと `prAttachmentsCleanup` の呼び出し順序、およびエラー発生時の挙動に懸念があります。

- **箇所**: `src/app/cli/routing.ts:336-343`
- **詳細**: `finally` ブロックで `cleanupInteractiveResultAttachments(result)` と `prAttachmentsCleanup?.()` が呼ばれています。しかし、`save_task` の `prBranch === undefined` 時の早期リターンパス (`src/app/cli/routing.ts:316-321`) では、`result` のクリーンアップと `prAttachmentsCleanup` を手動で呼んでいますが、その直後に `process.exit(1)` を実行しています。
- **AIアンチパターン**: AIはしばしば「正常系」と「異常系」でクリーンアップ処理を重複して記述し、一部のパスで漏れが生じたり、`process.exit` によって `finally` ブロックが実行されない（Node.jsの仕様）ことを見落とします。
- **影響**: `process.exit(1)` が呼ばれた際、`finally` ブロックは実行されず、一時ファイルが残存します。

#### 2. 境界条件の不整合（プレースホルダー番号の計算）
`src/features/interactive/imageAttachments.ts` で導入された `nextAttachmentNumber` の実装に不整合があります。

- **箇所**: `src/features/interactive/imageAttachments.ts:34-45`
- **詳細**: 既存の `attachments` から最大番号を探して `+1` していますが、`initialAttachments` が提供された場合の挙動について、テスト `src/__tests__/imageAttachments.test.ts:147-166` では正常に動作することを確認しています。しかし、`src/infra/github/prReviewImageAttachments.ts:106-112` の `nextImageNumber` と実装方針が微妙に異なります（一方は `Set` での空隙埋めをせず単純に最大値+1、もう一方は `while` ループで空いている最小番号を探す）。
- **AIアンチパターン**: 類似した機能（画像番号の採番）を異なるファイルで別々に実装し、一貫性のないロジック（最大値+1 vs 最小空き番号）を混在させる。
- **影響**: ユーザー体験における番号振りの不整合。

### 判定
- **Blocking**: No
- **Critical**: No

`process.exit` による `finally` 回避は、一時ファイルの残存という軽微な副作用に留まるため Blocking としませんが、一貫したリソース管理のために修正を推奨します。

---

## architecture-review
## アーキテクチャレビュー報告

### 概要
PR コメント内の画像をダウンロードし、`TaskAttachment` として保存・参照させる機能の実装をレビューしました。
全体として、`GitProvider` への能力追加による抽象化と、`pipeline` および `interactive` 経路への配線が適切に行われており、構造的な問題は見当たりませんでした。

### 検証結果

#### 1. レイヤー設計と依存方向
- **Provider 抽象化**: `GitProvider` インターフェースに `resolvePrReviewImageAttachments` を追加し、`GitHubProvider` で具体的に実装する構成となっており、インフラ層の差異が適切に隠蔽されています (`src/infra/git/types.ts`, `src/infra/github/GitHubProvider.ts`)。
- **依存方向**: `src/app/cli/routing.ts` $\rightarrow$ `src/infra/git/index.ts` $\rightarrow$ `src/infra/github/prReviewImageAttachments.ts` の方向で一貫しており、逆方向の依存はありません。

#### 2. 契約の一貫性と配線
- **pipeline 経路**: `executePipeline` $\rightarrow$ `runWorkflow` $\rightarrow$ `executeTask` への配線が完了しており、一時的な task spec ディレクトリの作成から実行後のクリーンアップまでが `finally` ブロックで保証されています (`src/features/pipeline/execute.ts`, `src/features/pipeline/steps.ts`)。
- **interactive 経路**: `resolvePrInput` で取得した attachments が `interactiveSeed` を経由して `dispatchConversationAction` の各アクション（`execute`, `save_task`）に伝播しており、ユーザー操作に応じた保存・利用経路が確保されています (`src/app/cli/routing.ts`)。
- **addTask 経路**: `addTask` 内で `resolvePrImages` を呼び出し、結果を `saveTaskFile` に渡す実装となっており、要件を満たしています (`src/features/tasks/add/index.ts`)。

#### 3. 状態整合性と安全性
- **リソース管理**: 画像ダウンロード時に使用する一時ディレクトリのクリーンアップ関数 (`cleanup`) が、呼び出し元の `finally` ブロックで確実に実行される設計になっています。
- **バリデーション**: `src/infra/github/prReviewImageAttachments.ts` において、Content-Type の検証、Magic Bytes による形式チェック、サイズ上限 (`MAX_IMAGE_BYTES`) の検証が多層的に行われており、安全性が確保されています。
- **GitHub 認証**: `gh auth token` を利用した認証済み取得を優先する実装となっており、プライベートリポジトリの画像取得に対応しています。

#### 4. 境界での解決
- **解決済み値の伝播**: `resolvePrImages` という境界関数で「画像抽出 $\rightarrow$ ダウンロード $\rightarrow$ プレースホルダ置換」を完結させ、以降の処理には解決済みの `attachments` と `prReview` (置換済み) を渡す構成となっており、重複した解決ロジックが存在しません。

### 判定
**APPROVE**

ブロッキングとなる設計上の欠陥は見つかりませんでした。要件通りに画像 attachment のライフサイクルが管理されており、既存のアーキテクチャ方針に準拠しています。

---

## security-review
今回の変更におけるセキュリティレビューの結果を報告します。

### 概要
本変更は、GitHub PRのレビューコメントに含まれる画像を一時的にダウンロードし、TAKTのタスク添付ファイルとして扱う機能の実装です。低信頼な外部URLからのデータ取得とローカルファイル書き込みを伴うため、ここを重点的に監査しました。

### 監査結果

#### 1. 信頼境界と入力検証
- **URLフィルタリング**: `isAllowedGithubAttachmentUrl` および `isAllowedRedirectTarget` により、ダウンロード対象を `github.com` および `*.githubusercontent.com` の特定のパス（`user-attachments/assets` 等）に厳格に限定しており、SSRFのリスクは適切に制御されています。
- **リダイレクト制御**: `fetchImageWithRedirects` 内で `redirect: 'manual'` を指定し、リダイレクト先を都度 `isAllowedRedirectTarget` で検証しています。また、`MAX_REDIRECTS = 5` による無限ループ防止策も実装されており、安全です。

#### 2. リソース消費とDoS対策
- **サイズ制限**: `MAX_IMAGE_BYTES` による制限が、HTTPヘッダー（`content-length`）およびストリーム読み込み時の累積バイト数、最終的なBufferサイズの3段階で検証されており、メモリ枯渇攻撃に対する防御が十分です。
- **コンテンツ検証**: `validateImageResponse` において、宣言された `Content-Type` と実際のバイナリから検出した MIME タイプの一致を確認しており、ポリグロットファイル等による予期せぬ挙動を防止しています。

#### 3. ローカルファイル操作
- **書き込み権限**: `ensurePrivateDirectory` および `writeNewPrivateFileWithMode` (mode `0o600`) を使用し、一時ファイルが他のユーザーから読み書きできない状態で保存されることが保証されています。
- **パスtraversal**: `downloadPrReviewImageAttachments` では、ファイル名を `image-${number}.${extension}` という固定形式で生成しており、ユーザー入力によるパス操作の余地はありません。
- **クリーンアップ**: `cleanup` 関数により、一時ディレクトリが再帰的に削除される仕組みが導入されており、ファイルシステムの汚染が防止されています。

#### 4. 認証情報の取り扱い
- **トークン管理**: `gh auth token` から取得したトークンをリクエストヘッダーにのみ使用し、ログやエラー出力に露出させる経路は確認されませんでした。

### 判定
**APPROVE**

信頼境界の設計、外部入力の検証、リソース制限、およびファイル権限管理において、防御的な実装がなされており、重大な脆弱性は認められませんでした。

---

## testing-review
レビュー結果を報告します。

### テスト品質レビュー報告

#### 1. 網羅性確認
PRコメント内の画像をダウンロードして添付ファイルに配置する機能について、以下の観点からテストを確認しました。

- **抽出ロジック (`prReviewImageAttachments.test.ts`)**:
  - Markdown記法 `![]()` および HTML `<img src="...">` の抽出を検証済み。
  - コードブロック内、インラインコード、HTMLコメント内の除外を検証済み。
  - GitHub Asset URL (`/assets/`) の正誤判定を検証済み。
  - 重複URLのデデュープおよび既存プレースホルダーとの衝突回避を検証済み。
- **ダウンロード・検証ロジック (`prReviewImageAttachments.integration.test.ts`)**:
  - Content-Type 検証、マジックバイト検証、サイズ上限（10MiB）の検証を網羅。
  - ストリーミング読み込み時のサイズ制限およびキャンセル処理を検証済み。
  - 認証トークンの付与を検証済み。
  - 失敗時の後片付け（tempディレクトリ削除）を検証済み。
- **統合・配線 (`addTask.test.ts`, `cli-routing-pr-resolve.test.ts`, `pipeline-image-attachments.integration.test.ts`)**:
  - `takt add --pr` 経由での抽出 $\rightarrow$ 保存 $\rightarrow$ `order.md` への追記フローを検証済み。
  - インタラクティブモードへの添付ファイル受け渡しと、キャンセル時のクリーンアップを検証済み。
  - Pipeline 実行時の添付ファイル昇格（promoted path）とクリーンアップを検証済み。
  - `cwd` の正しく伝搬していることを検証済み (`git-cwd-propagation.test.ts`)。

#### 2. ポリシー準拠確認
- **構造**: `Given-When-Then` パターンが概ね適用されており、1テスト1概念が維持されています。
- **独立性**: `tmpdir` や `mkdtempSync` を使用し、テスト間でファイルシステムが干渉しない設計になっています。
- **振る舞い保証**: 単なる設定値の確認ではなく、実際のファイル作成、内容の整合性、削除といった観測可能な振る舞いを assert しています。
- **否定契約**: 許可されないURL（外部URL、非HTTPS、非Assetパス）が抽出されないことを個別に検証しています。

#### 3. Finding
特になし。

### 判定
**APPROVE**