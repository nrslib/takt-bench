## coding-review
The implementation of downloading and attaching images from PR comments is correctly implemented across the requested paths.

### Review Summary

**1. Requirement Alignment**
- **Image Detection**: Correctly implements regex for both Markdown `![]()` and HTML `<img>` tags (`src/infra/github/prReviewImageAttachments.ts:40-41`).
- **Secure Downloads**: 
    - Restricts URLs to `github.com` with specific paths (`user-attachments/assets` or `.../assets`) (`src/infra/github/prReviewImageAttachments.ts:45-66`).
    - Validates Content-Type, magic bytes, and file size (`MAX_IMAGE_BYTES` = 10MB) (`src/infra/github/prReviewImageAttachments.ts:397-423`).
    - Uses `gh auth token` for authenticated requests to handle private repositories (`src/infra/github/prReviewImageAttachments.ts:430-439`).
- **Task Integration**: 
    - `takt add --pr` now resolves images and passes `TaskAttachment[]` to `saveTaskFile` (`src/features/tasks/add/index.ts:198, 238`).
    - Pipeline execution path now supports attachments by using `prepareTaskSpecDirectory` and `resolveTaskSpecForExecution` before calling `executeTask` (`src/features/pipeline/steps.ts:371-381`).

**2. Technical Correctness**
- **Reliability**: Implements manual redirect handling with a limit (`MAX_REDIRECTS = 5`) and safety checks on redirect targets (`src/infra/github/prReviewImageAttachments.ts:303-322, 383-395`).
- **Memory Safety**: Uses a streaming reader for response bodies to enforce size limits before full buffering (`src/infra/github/prReviewImageAttachments.ts:354-373`).
- **Resource Management**: Temporary download directories are cleaned up in `finally` blocks or via explicit `cleanup()` callbacks (`src/infra/github/prReviewImageAttachments.ts:471-482`, `src/features/pipeline/execute.ts:95`).
- **Placeholder Logic**: Correctly handles existing `[Image #N]` placeholders to avoid number collisions (`src/infra/github/prReviewImageAttachments.ts:85-112`).

**3. Regression & Security**
- No regressions introduced in existing Git provider logic.
- File permissions for downloaded images are set to `0o600` (private), reducing exposure on shared systems (`src/infra/github/prReviewImageAttachments.ts:14`).

**Verdict**: APPROVE

---

## ai-antipattern-review
レビュー結果を報告します。

AI生成コードに特有のアンチパターンおよびアーキテクチャ違反を確認しました。

### 1. 冗長な条件分岐（AI Antipattern: Redundant Conditional Branching）
`src/app/cli/routing.ts:144-158` において、`replaceSegmentImageUrls` を同じ引数セットで2回連続して呼び出しており、内部的な処理内容（正規表現による置換）が同一であるため、冗長です。

**修正案:**
正規表現を配列で定義し、ループで処理するように統一してください。

### 2. 配線漏れと不完全なエラーハンドリング（AI Antipattern: Wiring Failure / Under-engineering）
`src/features/tasks/add/index.ts:204-218` において、`resolvePrImages` の実行後に `determineWorkflow` が失敗した場合、`resolved.cleanup()` を呼び出していますが、その後の `if (workflow === null)` ブロック内（215行目）でも同様のクリーンアップが必要です。また、`saveTaskFile` 呼び出し前のバリデーション失敗時にもリソースリークが発生します。

### 3. テストダブルによる見かけ上の修正（AI Antipattern: Superficial Fix via Test Doubles）
`src/__tests__/pipelineExecution.test.ts` の新規テストケースにおいて、`mockResolvePrReviewImageAttachments` が常に空の `attachments` または固定の値を返すように設定されており、実際の `resolvePrImages` のフォールバック挙動やクリーンアップの連鎖が正しく検証されていません。

### 4. コンテキスト不適合（Architecture: Context Mismatch）
`src/features/interactive/imageAttachments.ts:35` の `nextAttachmentNumber` 関数において、プレースホルダーの形式 `[Image #(\d+)]` をハードコードしていますが、これは `src/infra/github/prReviewImageAttachments.ts:87` と重複しており、プレースホルダーの形式という「契約」が分散しています。

**判定:** **REJECT**

---

## architecture-review
今回の変更は、PRレビュー内の画像アタッチメントを自動的にダウンロードし、タスク実行時のコンテキスト（`attachments`）として注入する機能の導入です。

### 設計レビュー結果

#### 1. レイヤー設計と依存方向
- **構造**: `infra/github/prReviewImageAttachments.ts` で低レイヤーのダウンロード・置換ロジックを実装し、`GitHubProvider` を介して `infra/git/index.ts` (resolvePrImages) $\rightarrow$ `app/cli/routing.ts` および `features/pipeline/execute.ts` へと伝播させる構成となっており、依存方向は適切です。
- **抽象化**: `GitProvider` インターフェースに `resolvePrReviewImageAttachments` をオプショナルメソッドとして追加することで、GitHub 以外のプロバイダーへの拡張性を確保しつつ、非対応時の identity fallback を `resolvePrImages` で共通化しています。

#### 2. リソース管理とライフサイクル
- **クリーンアップ**: `resolvePrReviewImageAttachments` が返す `cleanup` 関数により、一時ディレクトリの削除が保証されています。
  - `app/cli/routing.ts` では `finally` ブロックで `prAttachmentsCleanup?.()` を呼び出しており、正常・異常系ともに漏れがありません。
  - `features/pipeline/execute.ts` でも `finally` で `taskContent.attachmentCleanup?.()` を呼び出しており、パイプライン実行後のリソース解放が担保されています。
  - `features/tasks/add/index.ts` では `saveTaskFile` の `finally` で適切にクリーンアップされています。

#### 3. 安全性と堅牢性
- **URL検証**: `isAllowedGithubAttachmentUrl` および `isAllowedRedirectTarget` により、許可されたホスト名 (`github.com`, `*.githubusercontent.com`) 以外へのアクセスを制限しており、SSRF 対策がなされています。
- **リソース制限**: `MAX_IMAGE_BYTES` によるサイズチェックが、HTTP ヘッダー (`content-length`) およびストリーム読み取り時の両方で行われており、メモリ消費の爆発を防止しています。
- **整合性**: `nextAttachmentNumber` により、既存の `[Image #N]` プレースホルダーと衝突しない番号付けが行われており、ドキュメントの一貫性が維持されています。

#### 4. 修正・改善が必要な点
- **特になし**: 変更対象の 23 ファイルを確認し、配線漏れや設計上のアンチパターンは見当たりませんでした。テストコードにおいても、クリーンアップの実行確認や異常系のカバレッジが十分に確保されています。

### 結論
**APPROVE**
設計は堅牢であり、リソース管理およびセキュリティ境界が適切に定義されています。

---

## security-review
I have completed the security review of the implemented image download functionality.

### Security Analysis

The implementation focused on downloading images from GitHub PR comments, which introduces several trust boundaries. I analyzed the following areas:

1.  **SSRF & URL Validation**: 
    - `isAllowedGithubAttachmentUrl` and `isAllowedRedirectTarget` strictly limit URLs to `github.com` and `*.githubusercontent.com` via HTTPS.
    - Redirects are handled manually with a limit of 5 (`MAX_REDIRECTS`) and each target is validated before fetching, preventing SSRF.

2.  **Resource Exhaustion (DoS)**:
    - `MAX_IMAGE_BYTES` (10MB) is enforced at three stages: `content-length` header check, during stream reading in `readResponseBody`, and as a final check on the resulting buffer. This prevents memory exhaustion from maliciously large files.

3.  **Content Validation (MIME/Magic Bytes)**:
    - `validateImageResponse` ensures that the `Content-Type` header matches a supported set (PNG, JPEG, GIF, WebP).
    - Critically, it performs a "magic bytes" check via `detectImageMimeType` and verifies that the detected type matches the declared `Content-Type`, preventing polyglot attacks or masquerading files.

4.  **File System Safety**:
    - Downloads occur in a temporary directory created via `fs.mkdtempSync`.
    - `writeNewPrivateFileWithMode` is used with `0o600` permissions, ensuring downloaded content is not world-readable.
    - Filenames are generated based on internal counters (`image-1.png`), eliminating path traversal risks from remote filenames.

5.  **Authentication**:
    - The use of `gh auth token` ensures that private repository assets are accessed using the user's authorized context.

### Conclusion
The implementation follows "trust nothing, verify everything" principles. No blocking security vulnerabilities were found.

**Status: APPROVE**

---

## testing-review
PRコメント内の画像ダウンロードおよびTask Attachmentへの配置機能に関するテスト品質レビュー結果を報告します。

### 1. テストカバレッジ評価

#### 正常系
- **画像抽出**: `src/__tests__/prReviewImageAttachments.test.ts` において、Markdown記法、HTML記法、PR本文、コメント、レビューサマリー、スレッドコメントの全経路で抽出が検証されており、十分です。
- **コードブロック除外**: フェンス付きコードブロック、インラインコード、HTMLコメント内の画像を除外する境界条件が検証されており、適切です。
- **ダウンロード・保存**: `src/__tests__/prReviewImageAttachments.integration.test.ts` において、認証トークンの使用、MIMEタイプ検証、マジックバイト検証、サイズ上限（10MiB）の検証が網羅されています。
- **ライフサイクル**: 一時ファイルの作成から、Task Specへの昇格、および完了後のクリーンアップが `src/__tests__/pipeline-image-attachments.integration.test.ts` および `src/__tests__/addTask.test.ts` で検証されており、整合性が取れています。

#### 失敗系・境界系
- **セキュリティ/安全性**: 
    - `src/__tests__/imageAttachments.test.ts` で、不正な `sessionId`（`..` や絶対パス）によるディレクトリトラバーサルの防止が検証されています。
    - 保存時のファイル権限（`0o600`）が検証されており、機密性への配慮が確認できます。
- **エラーリカバリ**: 
    - `src/__tests__/addTask.test.ts` において、ワークフロー選択キャンセル時や保存失敗時の `cleanup()` 呼び出しが検証されており、リソースリークが防止されています。
    - `src/__tests__/prReviewImageAttachments.integration.test.ts` で、一部の画像ダウンロード失敗時に既にダウンロード済みのファイルを全削除するアトミックな挙動が検証されています。

### 2. 構造・命名・独立性評価
- **構造**: `Given-When-Then` 形式で記述されており、個々のテストの目的が明確です。
- **独立性**: `fs.mkdtempSync` による一時ディレクトリの分離と `afterEach` での徹底的な削除が行われており、テスト間の干渉はありません。
- **命名**: `should ... when ...` パターンが徹底されており、振る舞いが読み取れます。

### 3. 判定
**APPROVE**

新しい振る舞い（画像抽出 $\rightarrow$ ダウンロード $\rightarrow$ 保存 $\rightarrow$ 参照置換 $\rightarrow$ クリーンアップ）に対して、ユニットテストおよびインテグレーションテストが適切に配置されており、特にセキュリティ境界とリソース管理（一時ファイル）に関する検証が厳格に行われているため、品質は十分であると判断します。