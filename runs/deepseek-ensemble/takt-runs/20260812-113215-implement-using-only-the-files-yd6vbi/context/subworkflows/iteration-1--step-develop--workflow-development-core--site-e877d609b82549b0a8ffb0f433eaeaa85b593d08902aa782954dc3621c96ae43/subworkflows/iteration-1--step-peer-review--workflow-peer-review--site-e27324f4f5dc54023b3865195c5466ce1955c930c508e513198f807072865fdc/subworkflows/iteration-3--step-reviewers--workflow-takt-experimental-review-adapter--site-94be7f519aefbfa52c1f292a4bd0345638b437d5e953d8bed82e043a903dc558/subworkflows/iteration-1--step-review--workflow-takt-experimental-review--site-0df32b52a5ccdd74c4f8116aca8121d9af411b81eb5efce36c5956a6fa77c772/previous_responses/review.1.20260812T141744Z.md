## coding-review
The implementation of downloading images from PR comments is complete and correctly integrated across the CLI, pipeline, and task-creation flows.

### Review Summary

1.  **Core Logic (`src/infra/github/prReviewImageAttachments.ts`)**:
    - Correctly implements image URL extraction from Markdown and HTML.
    - Implements security boundaries: restricts URLs to `github.com` and `*.githubusercontent.com` for redirects.
    - Validates images via Content-Type and magic bytes using `detectImageMimeType`.
    - Enforces a 10MB size limit (`MAX_IMAGE_BYTES`).
    - Correctly handles GitHub authentication via `gh auth token` to fetch private attachments.
    - Implements proper temporary directory management with a `cleanup` callback.
    - Correctly handles image placeholder numbering, avoiding collisions with existing `[Image #N]` patterns in the text.

2.  **Integration**:
    - **`addTask`**: Now resolves images and passes them to `saveTaskFile`, which uses `prepareTaskSpecDirectory` to place files in `.takt/tasks/<slug>/attachments/`.
    - **`executePipeline`**: Now resolves image attachments via `resolveTaskContent` and passes them to `runWorkflow`, which correctly prepares the task spec directory and cleans up temporary files after execution.
    - **`resolvePrInput`**: Correctly integrates the image resolution logic for interactive mode.
    - **`GitHubProvider`**: Properly exposes the `resolvePrReviewImageAttachments` method.

3.  **Reliability**:
    - Added comprehensive tests including unit tests for image format detection (`src/__tests__/imageFormat.test.ts`) and integration tests for PR image attachments (`src/__tests__/prReviewImageAttachments.integration.test.ts`).
    - Error handling for network failures, invalid formats, and size limits is robust.

### Findings
No blocking findings. The implementation adheres to the requirements and safety constraints.

**APPROVE**

---

## ai-antipattern-review
AI特有の問題（幻覚API、不整合な仮定、過剰エンジニアリングなど）に焦点を当ててレビューしました。

### Finding 1: `nextAttachmentNumber` の正規表現による脆弱な番号管理
- **Authorization Basis**: `direct_acceptance_criterion_violation` (AI Antipattern: 不確実な仮定に基づく実装)
- **Reason Absent**: 既存の `attachments.length + 1` という単純な実装を「AIが良かれと思って」改善したが、エッジケース（番号の飛びやフォーマット変更）への耐性が不十分。
- **Path**: `src/features/interactive/imageAttachments.ts:34-46`
- **Evidence**: 
  `attachment.placeholder.match(/^\[Image #(\d+)\]$/)` を使用して最大番号を特定している。もし `placeholder` のフォーマットが将来的に変更された場合、あるいは AI が生成した別の形式のプレースホルダーが混入した場合、静かに `maxNumber = 0` となり、番号が `1` からリセットされ、ファイル名が衝突する可能性がある。
- **修正案**: プレースホルダーという「表示用文字列」から番号を逆算するのではなく、`StoredImageAttachment` 型に `index` フィールドを持たせるか、保存時のシーケンスを厳密に管理すべき。

### Finding 2: `resolvePrInput` におけるフォールバック実装の重複
- **Authorization Basis**: `direct_acceptance_criterion_violation` (AI Antipattern: 重複実装)
- **Reason Absent**: 異なるコンテキスト（CLI routing と Pipeline execute）で同様の「プロバイダーがメソッドを持っていない場合のフォールバック」を個別に実装している。
- **Path**: 
  - `src/app/cli/routing-inputs.ts:67-69`
  - `src/features/pipeline/steps.ts:226-228`
- **Evidence**: 
  両箇所で `provider.resolvePrReviewImageAttachments ? await ... : { prReview, attachments: [], cleanup: () => undefined }` という同一の三項演算子によるフォールバックを実装している。
- **修正案**: `GitProvider` のデフォルト実装を定義するか、`infra/git/index.ts` 等に共通のラッパー関数を配置し、プロバイダーの能力有無に関わらず一貫したインターフェースを提供すべき。

### Finding 3: `addTask` における不完全なクリーンアップ経路
- **Authorization Basis**: `remediation_regression` (AI Antipattern: リソースリーク)
- **Reason Absent**: 正常系と一部の異常系に `cleanup()` を追加したが、予期せぬ例外（`saveTaskFile` 内での throw など）が発生した際の保護が不十分。
- **Path**: `src/features/tasks/add/index.ts:199-240`
- **Evidence**: 
  `try...catch` で `determineWorkflow` 等を囲っているが、`saveTaskFile` を呼び出すブロック (`232-236`) は `try` ブロック外または不十分な保護下にある。`saveTaskFile` が失敗した場合、`resolved.cleanup()` が呼ばれず、一時ファイルが残る。
- **修正案**: `resolved` を取得した直後に `try...finally` ブロックを開始し、`finally` で必ず `resolved.cleanup()` を実行する構造に変更すべき。

---

## architecture-review
レビュー結果を報告します。

### 構造・設計レビュー

本実装は、PRコメント内の画像を自動的にダウンロードし、TAKTの添付ファイル仕組みに統合する機能を適切に実装しています。

#### 1. レイヤー設計と依存方向
- **インフラ層の分離**: `src/infra/github/prReviewImageAttachments.ts` にGitHub固有の画像抽出・ダウンロードロジックを閉じ込め、`GitHubProvider` を通じて提供する構成となっており、依存方向は適切です。
- **共通化の適用**: 画像形式の判定 (`detectImageMimeType`) や拡張子決定 (`extensionForImageMimeType`) を `src/shared/utils/imageFormat.ts` に抽出し、インタラクティブモードの画像ペースト機能と共通化されており、契約の一貫性が保たれています。

#### 2. リソース管理と安全性
- **一時ファイルのライフサイクル**: `resolvePrReviewImageAttachments` が返す `cleanup` 関数を、`routing.ts` (インタラクティブモード) および `execute.ts` (パイプラインモード) の `finally` ブロックで確実に呼び出しており、一時ディレクトリのリークが防止されています。
- **セキュリティ境界**: 
  - `isAllowedGithubAttachmentUrl` および `isAllowedRedirectTarget` により、ダウンロード対象を `github.com` および `*.githubusercontent.com` に限定しており、SSRFのリスクが適切に制御されています。
  - ファイル権限を `0o600` (PRIVATE_FILE_MODE) に設定し、機密性の高い添付ファイルを保護しています。
- **リソース制限**: `MAX_IMAGE_BYTES` によるサイズ上限チェックが、Content-Length ヘッダーおよびストリーム読み込み時の両方で実装されており、DoS攻撃への耐性があります。

#### 3. 整合性とエッジケース
- **プレースホルダーの重複回避**: `collectExistingPlaceholderNumbers` により、PR本文に既に `[Image #N]` 形式の記述がある場合にそれを考慮して採番するロジックが実装されており、既存のドキュメント構造を破壊しません。
- **画像採番の共通化**: `src/features/interactive/imageAttachments.ts` において、既存の添付ファイルがある場合にその最大値から採番を再開する `nextAttachmentNumber` への修正が行われており、PRから引き継いだ画像とユーザーが後からペーストした画像が衝突しない設計になっています。

### 判定
**APPROVE**

設計上の問題はなく、要件を満たす堅牢な実装であると判断します。

---

## security-review
今回の変更におけるセキュリティレビュー結果を報告します。

### 概要
PRコメント内の画像をダウンロードしてタスク添付ファイルとして保存する機能が実装されました。外部からのデータ取得を伴うため、SSRF、リダイレクト攻撃、リソース消費攻撃、およびファイル操作の安全性に重点を置いて監査しました。

### 検証結果

#### 1. 低信頼入力の制御 (SSRF/URL検証)
- **URL制限**: `isAllowedGithubAttachmentUrl` (`src/infra/github/prReviewImageAttachments.ts:45`) により、ホスト名が `github.com` であること、およびパスが `/user-attachments/assets` または `/org/repo/assets` 形式であることのみを許可しており、任意の外部URLへのリクエスト（SSRF）は適切に防止されています。
- **プロトコル制限**: `https:` のみが許可されており、`file://` や `gopher://` 等の危険なプロトコルは排除されています。

#### 2. リダイレクト制御
- **リダイレクト先検証**: `fetchImageWithRedirects` 内で `redirect: 'manual'` を指定し、各リダイレクト先を `isAllowedRedirectTarget` (`src/infra/github/prReviewImageAttachments.ts:383`) で個別に検証しています。
- **許可先**: `github.com` および `*.githubusercontent.com` のみに制限されており、信頼境界外へのリダイレクトによる情報漏洩や攻撃は防止されています。
- **回数制限**: `MAX_REDIRECTS = 5` (`src/infra/github/prReviewImageAttachments.ts:43`) により、リダイレクトループによるリソース消費（DoS）が防止されています。

#### 3. リソース消費とデータ検証
- **サイズ制限**: `MAX_IMAGE_BYTES` (10MB) が3段階で検証されています。
  1. `content-length` ヘッダーの事前チェック (`src/infra/github/prReviewImageAttachments.ts:328`)
  2. ストリーム読み込み中の蓄積サイズチェック (`src/infra/github/prReviewImageAttachments.ts:364`)
  3. 最終的な Buffer サイズチェック (`src/infra/github/prReviewImageAttachments.ts:411`)
- **コンテンツ検証**: `validateImageResponse` (`src/infra/github/prReviewImageAttachments.ts:397`) において、`Content-Type` ヘッダーの検証に加え、`detectImageMimeType` (`src/shared/utils/imageFormat.ts:5`) によるマジックバイトの検証が行われており、偽装されたファイル形式の混入が防止されています。

#### 4. ファイル操作の安全性
- **書き込み権限**: `writeNewPrivateFileWithMode` を使用し、ファイルモードを `0o600` (`src/infra/github/prReviewImageAttachments.ts:14`) に設定して保存しており、他のユーザーからの読み取りを制限しています。
- **一時ディレクトリ**: `os.tmpdir()` 下に `takt` サブディレクトリを作成し、さらに `takt-pr-images` ディレクトリを `0o700` で作成しており、隔離された環境で処理が行われています。
- **パストラバーサル**: ファイル名は `image-N.extension` という固定形式で生成されており、入力されたURLやファイル名からパスを構築していないため、パストラバーサルの脆弱性は存在しません。

### 結論
本実装は、GitHub限定のURLフィルタリング、厳格なリダイレクト検証、多層的なサイズ制限、およびマジックバイトによる形式検証を組み合わせており、セキュリティ的に堅牢であると判断します。

**判定: APPROVE**

---

## testing-review
レビュー結果を報告します。

## テスト品質レビュー概要

PRコメントからの画像ダウンロード機能の実装に伴うテストスイートをレビューしました。全体として、新規ロジック（画像抽出、ダウンロード、フォーマット検証、アタッチメント管理）に対して網羅的なテストが実装されており、品質基準を満たしています。

### 評価ポイント

1.  **新規ロジックのカバレッジ**:
    - `src/shared/utils/imageFormat.ts` のマジックバイトによるMIMEタイプ判定が、各形式（PNG, JPEG, GIF, WebP）および不正データに対して厳密に検証されています。
    - `src/infra/github/prReviewImageAttachments.ts` において、MarkdownおよびHTML形式の画像URL抽出、重複排除、コードブロック内の除外などのエッジケースがユニットテストで詳細に検証されています。
    - ダウンロード処理において、Content-Type検証、サイズ上限（10MiB）のチェック、ストリーム読み込み中のサイズ超過による中断などがインテグレーションテストで担保されています。

2.  **状態整合性とクリーンアップ**:
    - 一時ディレクトリの作成、権限設定（`0o600` 等）、およびエラー発生時や処理完了後のクリーンアップ（`cleanup()`）が適切に検証されています。特に、途中で失敗した際のファイル削除が確認されており、リソースリークへの配慮が見られます。

3.  **統合経路の検証**:
    - `addTask` (CLI入口) $\rightarrow$ `resolvePrReviewImageAttachments` $\rightarrow$ `TaskAttachment` 保存 という一連のフローがテストされており、最終的に `order.md` に正しい形式で追記され、ファイルが配置されることが確認されています。
    - Pipeline実行経路 (`runWorkflow`) においても、アタッチメントが正しくプロモートされ、実行後にクリーンアップされることが検証されています。

4.  **構造と命名**:
    - テストは概ね Given-When-Then 形式で構造化されており、テスト名から検証内容が明確に読み取れます。

### 懸念事項（Warningレベル）

- **モック依存度**: `executePipeline` のテスト (`src/__tests__/pipelineExecution.test.ts`) は多くの内部関数をモックしており、結合テストとしての強度は限定的です。ただし、個別のユニット/ITテストで詳細な振る舞いが担保されているため、許容範囲と判断します。

### 結論
ブロッキングな問題は見当たりません。受入条件に基づいた検証が十分に行われています。

**APPROVE**