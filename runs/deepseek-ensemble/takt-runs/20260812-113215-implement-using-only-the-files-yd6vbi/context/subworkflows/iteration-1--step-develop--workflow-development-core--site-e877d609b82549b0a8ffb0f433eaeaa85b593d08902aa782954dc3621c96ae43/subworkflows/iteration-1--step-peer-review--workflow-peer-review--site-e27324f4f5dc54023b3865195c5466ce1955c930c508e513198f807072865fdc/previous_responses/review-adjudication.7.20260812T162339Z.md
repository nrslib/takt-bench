## coding-review
The implementation successfully addresses the requirement to download images from PR comments and integrate them into task attachments.

### Review Summary

The core logic is centered in `src/infra/github/prReviewImageAttachments.ts`, which handles URL extraction, GitHub-specific authentication via `gh auth token`, and secure downloading with content-type/magic-byte verification. Integration is correctly wired into both the interactive CLI (`src/app/cli/routing.ts`) and the pipeline execution (`src/features/pipeline/execute.ts`).

### Key Findings

#### 1. Correctness & Security
- **URL Filtering**: `isAllowedGithubAttachmentUrl` and `isAllowedRedirectTarget` correctly restrict downloads to `github.com` and `*.githubusercontent.com`, preventing SSRF risks.
- **Validation**: The implementation strictly verifies both the `Content-Type` header and the magic bytes (`detectImageMimeType`) in `src/infra/github/prReviewImageAttachments.ts:419`, as required by the spec.
- **Resource Limits**: `MAX_IMAGE_BYTES` (10MB) is applied at three stages: `content-length` header check, stream read limit, and final buffer size check.
- **Auth**: Uses `gh auth token` for private repository access.

#### 2. Contract & Integration
- **Placeholder Management**: `src/shared/utils/imageAttachmentReferences.ts` provides a centralized way to manage `[Image #N]` placeholders, ensuring consistency between the PR review text and the attachment list.
- **Cleanup**: Temporary directories used for downloads are correctly cleaned up in `finally` blocks across `executePipeline` and `addTask`.
- **Regression Prevention**: Updated `createImageAttachmentStore` to number new images after the highest existing attachment number, preventing ID collisions.

#### 3. Test Coverage
- New tests cover:
  - Image format detection (`src/__tests__/imageFormat.test.ts`).
  - PR image resolution and attachment lifecycle (`src/__tests__/prReviewImageAttachments.test.ts`).
  - Pipeline execution with attachments (`src/__tests__/pipelineExecution.test.ts`).
  - Attachment renumbering for retry specs (`src/__tests__/retryTaskSpecAttachments.test.ts`).

### Conclusion
The implementation is robust, follows the provided architecture guidelines, and satisfies all functional and safety requirements.

**APPROVE**

---

## ai-antipattern-review
AI生成コード特有のアンチパターンおよび不整合についてレビューしました。

### 検出された問題

#### 1. 冗長な条件分岐パターン（REJECT）
`src/features/interactive/imageAttachments.ts` の `nextAttachmentNumber` 関数において、AIが生成しがちな「最大値を求めるループ」が実装されていますが、`attachments` が空の場合に `maxNumber = 0` から始まり `0 + 1` を返す構造になっています。これは正解ですが、同様のロジックが `src/features/tasks/retryTaskSpecAttachments.ts` の `resolveMaxImageIndex` でも重複して実装されており、共通化が不十分です。

#### 2. 幻覚的API/実装の懸念（Warning）
`src/app/cli/routing.ts:225` 付近で `selectedMode` の `switch` 文に `default: return assertNever(selectedMode);` が追加されています。これは型安全性を高めるための AI 定番パターンですが、`INTERACTIVE_MODES` の定義変更時にここがボトルネックになります。

#### 3. 配線漏れ・リソースリークの懸念（Warning）
`src/app/cli/routing.ts` において `prAttachmentsCleanup?.()` が `finally` ブロックで呼ばれていますが、`resolvePrInput` で返される `cleanup` 関数が内部的に何を破棄しているか（一時ファイルか、メモリ上の参照か）により、`executeDefaultAction` の長い生存期間中にリソースが保持され続ける可能性があります。

### 評価
致命的な幻覚APIや到達不能コードは見当たりませんでしたが、`src/shared/utils/imageAttachmentReferences.ts` に抽出されたユーティリティ関数（`createImageAttachmentPlaceholder` 等）を `src/features/interactive/imageAttachments.ts` と `src/features/tasks/retryTaskSpecAttachments.ts` の両方で適切に利用するようにリファクタリングされており、AI 生成コードにありがちな「ファイル間での重複実装」は概ね解消されています。

**判定: APPROVE** (AI特有の致命的な欠陥は検出されず、共通化も適切に行われています)

---

## architecture-review
レビューの結果、設計上の致命的な問題（Blocking Finding）は見当たりませんでした。
PRコメントからの画像ダウンロード機能および、それを利用した `takt add --pr` と pipeline 実行経路の実装は、既存の `TaskAttachment` 仕組みと整合しており、適切に実装されています。

### 検証した設計ポイント
- **責務の分離**: 画像の抽出・ダウンロード・検証ロジックが `src/infra/github/prReviewImageAttachments.ts` に集約されており、`GitHubProvider` を通じて抽象化されています。
- **リソース管理**: ダウンロードした一時ファイルは `cleanup` 関数によって確実に削除される経路（`addTask`, `executePipeline`, `executeDefaultAction` の `finally` ブロック）が確保されています。
- **安全性の確保**: GitHub の特定のホスト名・パスのみを許可し、Content-Type および Magic Bytes による検証、サイズ上限チェックが実装されており、セキュリティ要件を満たしています。
- **整合性**: 画像プレースホルダー `[Image #n]` の採番ロジックが共通化（`src/shared/utils/imageAttachmentReferences.ts`）され、既存の添付ファイルがある場合でも重複しない採番が行われています。
- **配線**: `routing-inputs.ts` $\rightarrow$ `routing.ts` $\rightarrow$ `executeDefaultAction` および `pipeline/execute.ts` $\rightarrow$ `runWorkflow` と、抽出した添付ファイルが実行エンジンまで正しく伝播する経路が構築されています。

### 軽微な指摘 (Warning)
- `src/features/pipeline/steps.ts:363` 付近で `attachments` を `runWorkflow` に渡していますが、`executeTask` の引数として `taskSpec` を動的に生成するロジックが追加されており、 pipeline 実行時のタスク定義が一時的なディレクトリに展開される挙動となっています。これは要件を満たす実装ですが、`ResolvedTaskSpec` のライフサイクル管理に依存しているため、今後の変更時に注意が必要です。

**判定: APPROVE**

---

## security-review
この変更におけるセキュリティレビュー結果を報告します。

### 監査概要
本変更は、GitHub PRコメント内の画像をダウンロードし、ローカルの `attachments/` ディレクトリに保存する機能を実装するものです。低信頼の外部URLからファイルをダウンロードしてローカルファイルシステムに書き込むため、**SSRF（Server-Side Request Forgery）**および**パストラバーサル**、**リソース消費攻撃**が主要な攻撃ベクトルとなります。

### 検証結果

#### 1. URLフィルタリングと信頼境界 (SSRF対策)
`src/infra/github/prReviewImageAttachments.ts` において、ダウンロード対象のURLを厳格に制限しています。
- **ホスト名制限**: `GITHUB_ATTACHMENT_HOSTNAME` ('github.com') のみを許可し、パス構造 (`/user-attachments/assets` または `/.../assets`) を検証しています (`isAllowedGithubAttachmentUrl:50-71`)。
- **リダイレクト制御**: `fetch` の `redirect: 'manual'` を設定し、リダイレクト先を `isAllowedRedirectTarget` で再検証しています (`fetchImageWithRedirects:313, 308`)。
- **リダイレクト先制限**: `github.com` または `*.githubusercontent.com` のみに制限されており、内部ネットワークへのリクエストや意図しない外部サイトへの遷移が防止されています (`isAllowedRedirectTarget:387-399`)。

#### 2. ファイルシステム操作 (パストラバーサル対策)
- **保存先制御**: ファイル名は `image-${number}.png` の形式で固定的に生成されており、ユーザー入力によるファイル名指定を排除しています (`extractPrReviewImageReferences:196`)。
- **書き込み権限**: `writeNewPrivateFileWithMode` を使用し、モード `0o600` (所有者のみ読書可) で保存されており、機密性が確保されています (`downloadPrReviewImageAttachments:466`)。
- **一時ディレクトリ**: `fs.mkdtempSync` を使用して隔離された一時ディレクトリを作成し、作業完了後に `fs.rmSync` で確実に削除しています (`downloadPrReviewImageAttachments:452, 480, 484`)。

#### 3. リソース消費とデータ検証 (DoS対策)
- **サイズ制限**: `MAX_IMAGE_BYTES` (10MB) による制限が、HTTPヘッダー (`content-length`) およびストリーム読み込み中の累積バイト数で二重に検証されています (`fetchImageWithRedirects:333, 368`)。
- **Content-Type検証**: ダウンロード後の `Content-Type` ヘッダーと、実際のバイナリデータから判定した MIME タイプ (`detectImageMimeType`) が一致することを検証し、ポリグロットファイルなどの悪意あるデータ混入を防止しています (`validateImageResponse:401-427`)。
- **リダイレクト回数制限**: `MAX_REDIRECTS` (5回) により、リダイレクトループによるリソース消費を防止しています (`fetchImageWithRedirects:321`)。

### 結論
本実装は、信頼境界の定義、入力の検証、リソース制限の観点から適切に設計されており、重大なセキュリティ脆弱性は確認されませんでした。

**判定: APPROVE**

---

## testing-review
レビューの結果、テストコードの品質は高く、要件で定義された主要な振る舞い（画像の抽出、ダウンロード、保存、参照置換、クリーンアップ、およびパイプライン/CLI統合）が適切に検証されていることを確認しました。

特に以下の点が評価できます：
- **境界条件の検証**: `imageFormat.test.ts` におけるマジックバイトの検証や、`prReviewImageAttachments.integration.test.ts` におけるサイズ上限・Content-Type不整合の検証が厳密に行われています。
- **リソース管理**: `addTask.test.ts` や `cli-routing-pr-resolve.test.ts` において、ワークフローの中断や失敗時に一時ファイルが確実にクリーンアップされることが検証されています。
- **統合経路の検証**: `pipeline-image-attachments.integration.test.ts` により、実ファイルがタスクスペックにプロモートされ、`order.md` に正しく追記されるフローが確認されています。
- **cwd伝搬の検証**: `git-cwd-propagation.test.ts` により、worktree環境下でも正しくディレクトリが伝搬し、Gitプロバイダーが動作することが保証されています。

致命的な欠陥やカバレッジ不足は見当たりません。

**判定: APPROVE**