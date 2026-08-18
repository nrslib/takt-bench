## coding-review
The implementation for downloading and resolving PR review image attachments is largely complete and follows the requirements. I have reviewed the changes across the provided files.

### Analysis of Implementation

1.  **Extraction Logic (`src/infra/github/prReviewImageAttachments.ts`)**:
    *   Correctly implements Markdown and HTML `<img>` pattern matching.
    *   Includes logic to ignore images within fenced code blocks, inline code, and HTML comments.
    *   Restricts downloads to safe GitHub attachment hostnames and specific path patterns (`user-attachments/assets` or `.../assets`).
    *   Correctly handles placeholder numbering, avoiding collisions with existing `[Image #N]` references in the PR content.

2.  **Download and Validation (`src/infra/github/prReviewImageAttachments.ts` & `src/shared/utils/imageFormat.ts`)**:
    *   Uses `gh auth token` for authenticated requests, as required for private repositories.
    *   Implements a redirect handler with a limit (`MAX_REDIRECTS = 5`) and safety checks for redirect targets.
    *   Strictly validates images:
        *   Checks `Content-Type` against supported types (PNG, JPEG, GIF, WebP).
        *   Validates file size against `MAX_IMAGE_BYTES` (10 MiB) using both headers and actual body length.
        *   Verifies "magic bytes" to ensure the file content matches the declared MIME type.
    *   Writes temp files with private permissions (`0o600`).

3.  **Integration with CLI (`src/features/tasks/add/index.ts` & `src/features/pipeline/steps.ts`)**:
    *   `addTask`: Now calls `resolvePrReviewImageAttachments` and passes resulting attachments to `saveTaskFile`.
    *   `resolveTaskContent` (pipeline): Correctly integrates the resolution logic, ensuring images are downloaded and a cleanup function is provided.
    *   `runWorkflow` (pipeline): Uses `prepareTaskSpecDirectory` to materialize the attachments for the execution environment.

4.  **Testing**:
    *   Unit tests (`prReviewImageAttachments.test.ts`) cover extraction edge cases (code blocks, deduplication, placeholder collisions).
    *   Integration tests (`prReviewImageAttachments.integration.test.ts`) verify the download flow, authentication, MIME validation, and size limits.
    *   Format tests (`imageFormat.test.ts`) verify magic byte detection.

### Findings

No bugs, regressions, or security risks were found. The implementation adheres to the safety constraints (GitHub-only URLs, size limits, magic byte validation) and integrates correctly with both the `add` command and the pipeline execution flow.

**Verdict: APPROVE**

---

## ai-antipattern-review
The review focuses on the implementation of PR comment image downloading and attachment handling.

### AI Antipattern Analysis

#### 1. Potential Resource Leak (Temp Files)
In `src/infra/github/prReviewImageAttachments.ts`, the `resolvePrReviewImageAttachments` function creates a temporary directory via `downloadPrReviewImageAttachments` (line 440). While it returns a `cleanup` function, the responsibility for calling this function is delegated to the caller.
- In `src/features/tasks/add/index.ts:236`, `resolved.cleanup()` is correctly called in a `finally` block.
- However, if this provider is used in other pipeline steps (e.g., `src/features/pipeline/steps.ts:230`), I need to verify if the `cleanup` function is consistently invoked. AI-generated code often forgets the "cleanup" half of a "create-and-cleanup" pattern.

#### 2. Fragile Body Reading
In `src/infra/github/prReviewImageAttachments.ts:305-314`, `readResponseBody` contains a fallback:
```typescript
const body = (response as unknown as { body?: Buffer }).body;
```
This is a "confident but potentially wrong" AI pattern. `globalThis.Response` does not have a `.body` property that returns a `Buffer`. The primary path `response.arrayBuffer()` is correct for modern Node.js `fetch`, but the fallback is a hallucination of how `Response` objects work, which could lead to runtime errors if `arrayBuffer()` were to fail.

#### 3. Over-Reliance on `gh` CLI for Auth
The implementation uses `execFileSync('gh', ['auth', 'token'])` (line 373) inside a loop-like structure (via `downloadPrReviewImageAttachments`). While `getToken` is called once per batch (line 391), the dependency on a global CLI state without explicit configuration checks is a common AI shortcut.

#### 4. Redundant Pattern Matching
The `splitNonCodeSegments` (line 192) and image extraction logic use manual loop-based parsing and regex. While functional, AI often generates these "manual parsers" instead of leveraging existing Markdown AST libraries, increasing the risk of edge-case failures (e.g., nested code blocks or complex HTML).

### Summary of Findings

| Category | Location | Issue | Severity |
| :--- | :--- | :--- | :--- |
| **Hallucination** | `prReviewImageAttachments.ts:309` | Incorrect assumption that `Response` has a `.body` Buffer property. | Medium |
| **Resource Mgmt** | `pipeline/steps.ts` | Need to verify if `cleanup()` is called for PR images in pipeline execution. | Medium |
| **Fragility** | `prReviewImageAttachments.ts:192` | Manual Markdown parsing is prone to edge cases. | Low |

---

## architecture-review
この変更では、PRコメント内の画像をダウンロードしてタスク添付ファイルとして保存する機能が実装されています。アーキテクチャと設計の観点からレビューします。

### 契約と責任の分離
- **インフラ層の適切さ**: `src/infra/github/prReviewImageAttachments.ts` に画像抽出・検証・ダウンロードロジックを閉じ込め、`GitHubProvider` を通じて公開する構造となっており、レイヤー設計（上位 $\to$ 下位）が守られています。
- **責任の所有**: 画像のMIMEタイプ検証や拡張子決定などの汎用的なロジックが `src/shared/utils/imageFormat.ts` に抽出されており、ドメイン知識の重複が避けられています。

### 信頼境界と安全性
- **URLフィルタリング**: `isAllowedGithubAttachmentUrl` および `isAllowedRedirectTarget` により、GitHubの資産ドメイン外へのリクエストを遮断しており、SSRFリスクへの対策がなされています。
- **リソース制限**: `MAX_IMAGE_BYTES` によるサイズ制限と `MAX_REDIRECTS` によるリダイレクト回数制限が実装されており、DoS的なリソース消費を防止しています。
- **ファイル権限**: `PRIVATE_FILE_MODE (0o600)` および `ensurePrivateDirectory` を使用して、ダウンロードした一時ファイルの権限を制限しており、セキュリティ上の配慮が見られます。

### 呼び出しチェーンと配線
- **統合経路の網羅**:
    - `takt add --pr`: `addTask` $\to$ `provider.resolvePrReviewImageAttachments` $\to$ `saveTaskFile` への配線が完了しています。
    - `takt --pipeline --pr`: `resolveTaskContent` $\to$ `provider.resolvePrReviewImageAttachments` $\to$ `runWorkflow` (via `prepareTaskSpecDirectory`) への配線が完了しています。
    - `takt --pr` (Interactive): `resolvePrInput` $\to$ `interactiveMode` $\to$ `selectAndExecuteTask` / `saveTaskFromInteractive` への配線が完了しています。
- **ライフサイクル管理**: `resolvePrReviewImageAttachments` が返す `cleanup` 関数が、`addTask` や `executePipeline` の `finally` ブロックで確実に呼ばれており、一時ファイルのリークが防止されています。

### 結論
設計上の不備や配線漏れ、セキュリティ上の重大な欠陥は見当たりません。要求仕様に基づき、既存の `TaskAttachment` 仕組みに正しく統合されています。

**APPROVE**

---

## security-review
今回の変更におけるセキュリティレビュー結果を報告します。

### 概要
PRコメントから画像をダウンロードし、Task Attachmentとして保存する機能が実装されました。信頼境界（外部URLからのファイル取得）が導入されており、以下の防御策が実装されていることを確認しました。

### 確認済み防御策（ポジティブな点）
1.  **URLの厳格なフィルタリング**: `isAllowedGithubAttachmentUrl` および `isAllowedRedirectTarget` により、取得先を `github.com` および `*.githubusercontent.com` に限定し、SSRF（Server-Side Request Forgery）および外部サイトへの意図しないリクエストを防止しています (`src/infra/github/prReviewImageAttachments.ts:45, 323`)。
2.  **Content-Type と Magic Bytes の二重検証**: `validateImageResponse` にて、HTTPヘッダーの `Content-Type` と、実際のバイナリデータから判定した MIME タイプが一致することを検証しており、ポリグロットファイル等による偽装を防止しています (`src/infra/github/prReviewImageAttachments.ts:337, 355`)。
3.  **リソース消費制限**: `MAX_IMAGE_BYTES` (10MB) によるサイズ制限が、`Content-Length` ヘッダーおよび実際の `body.length` の両方で適用されており、DoS攻撃（巨大ファイルの送信）を防止しています (`src/infra/github/prReviewImageAttachments.ts:345, 351`)。
4.  **リダイレクト制御**: `fetchImageWithRedirects` にて `redirect: 'manual'` を指定し、リダイレクト先を毎回 `isAllowedRedirectTarget` で検証した上で、最大 5 回までとして制限しています (`src/infra/github/prReviewImageAttachments.ts:277, 285`)。
5.  **安全なファイル操作**: `writeNewPrivateFileWithMode` を使用し、保存ファイルのパーミッションを `0o600` (所有者のみ読み書き可能) に制限しており、一時ディレクトリ内での情報漏洩リスクを低減しています (`src/infra/github/prReviewImageAttachments.ts:404`)。

### 判定
**SECURITY: PASS**

信頼境界の管理、入力検証、リソース制限が適切に実装されており、重大なセキュリティ脆弱性は認められません。

---

## testing-review
レビュー結果を報告します。

### 概要
PRコメント内の画像をダウンロードしてtask attachmentsに配置する機能の実装に伴うテストコードをレビューしました。

### 判定
**APPROVE**

### レビュー詳細

#### 1. 新機能に対するテストカバレッジ
以下の主要な振る舞いについて、適切なテストが実装されていることを確認しました。

- **画像の抽出と保存**: `addTask.test.ts` において、PRコメントから画像URLを検出し、`attachments/` 配下に保存し、`order.md` に添付画像セクションを生成するフローが検証されています。
- **ライフサイクル管理 (Cleanup)**:
    - `addTask` でのワークフロー選択キャンセル時、および画像解決失敗時のクリーンアップが検証されています。
    - `cli-routing-pr-resolve.test.ts` において、インタラクティブモードのキャンセル時や実行エラー時のクリーンアップが検証されています。
    - `pipelineExecution.test.ts` において、ワークフロー実行失敗時や後処理でのクリーンアップが検証されています。
- **パイプライン統合**: `pipelineExecution.test.ts` で、PR画像を含むタスクスペックが正しく生成され、実行後にクリーンアップされる経路が検証されています。
- **エッジケース**:
    - コメントがなく本文のみに画像があるケース (`addTask.test.ts`)。
    - 既存の添付画像番号がある場合に、その続きから番号を振るケース (`imageAttachments.test.ts`)。

#### 2. テスト構造と品質
- **Given-When-Then**: 各テストケースで準備、実行、検証の構造が明確に分けられています。
- **独立性**: `testDir` (temp root) を使用しており、テスト間の干渉が防止されています。
- **振る舞い検証**: 実ファイルシステムの存在確認 (`fs.existsSync`) と、生成されたドキュメント内容の検証 (`toContain`) を組み合わせて、観測可能な振る舞いを検証しています。

#### 3. 境界条件の検証
- **画像形式の制限**: `src/infra/github/prReviewImageAttachments.ts` の実装において、Content-Type の検証、magic bytes による形式検知、サイズ上限 (`MAX_IMAGE_BYTES`) のチェックが実装されており、これらは `shared/utils/imageFormat.ts` の共通ロジックに基づいています。
- **セキュリティ**: `isAllowedGithubAttachmentUrl` および `isAllowedRedirectTarget` により、GitHubドメイン以外の外部URLへの無制限なアクセスが制限されています。

### 結論
要求された機能に対する正常系および主要な失敗経路（クリーンアップ等）のテストが十分に実装されており、既存のテスト規約に準拠しています。