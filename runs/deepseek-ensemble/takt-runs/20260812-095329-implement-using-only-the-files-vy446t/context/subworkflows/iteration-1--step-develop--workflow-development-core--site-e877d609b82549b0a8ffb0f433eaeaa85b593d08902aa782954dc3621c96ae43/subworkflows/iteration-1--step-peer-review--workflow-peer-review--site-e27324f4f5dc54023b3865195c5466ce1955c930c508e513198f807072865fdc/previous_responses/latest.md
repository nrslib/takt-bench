## coding-review
The implementation of the PR comment image download feature has been reviewed.

### Review Summary
The core logic for extracting image URLs from PR reviews, downloading them with GitHub authentication, and integrating them into the `takt add --pr` and pipeline flows is correctly implemented. Security constraints (URL validation, Content-Type verification, size limits) are enforced.

### Findings

#### 1. Potential Memory Issue with Large Image Buffers (Warning)
In `src/infra/github/prReviewImageAttachments.ts:306-314`, the `readResponseBody` function converts the response to a `Buffer`. While `MAX_IMAGE_BYTES` (10MB) is enforced in `validateImageResponse`, the body is read into memory *before* the size is fully validated against the buffer length in some paths. For 10MB this is acceptable, but if `MAX_IMAGE_BYTES` were significantly increased, this could lead to memory pressure.

#### 2. Implementation Verification against Requirements
- **URL Extraction**: Supports both Markdown `![]()` and HTML `<img>` tags.
- **GitHub Auth**: Uses `gh auth token` to fetch private repository assets.
- **Validation**: Checks magic bytes (via `detectImageMimeType`) and `Content-Type`.
- **Integration**: 
    - `takt add --pr`: Correctly calls `resolvePrReviewImageAttachments` and passes attachments to `saveTaskFile`.
    - Pipeline (`--pr`): `resolveTaskContent` in `src/features/pipeline/steps.ts` correctly resolves images and passes them to `runWorkflow` $\rightarrow$ `prepareTaskSpecDirectory`.
- **Cleanup**: Temporary files are cleaned up via the `cleanup` callback in both CLI and pipeline paths.

### Conclusion
The implementation adheres to the specification and follows the project's architectural patterns. No blocking issues were found.

**APPROVE**

---

## ai-antipattern-review
レビューの結果、AI生成コードに特有のアンチパターン（配線漏れ、冗長な分岐、不適切なリソース管理）がいくつか検出されました。

### Finding 1: `executeDefaultAction` における `confirmedResult` の強制的な非 null アサーション
- **Location**: `src/app/cli/routing.ts:283`
- **Authorization Basis**: `direct_acceptance_criterion_violation` (安全性/堅牢性の欠如)
- **Reason Absent**: AIが `result` の成功経路のみを想定し、エラー経路での `null` 可能性を無視して `!` で解決した。
- **証拠**: `routing.ts:283` で `const confirmedResult = result!;` としており、直前の `switch (selectedMode)` 内で `result` に値が代入されない経路（例: `passthroughMode` が `undefined` を返す可能性や将来的なモード追加時）があるにもかかわらず、強制的に非 null としている。
- **影響**: `result` が `undefined` の場合にランタイムエラー（TypeError）が発生し、`finally` ブロックでのクリーンアップ処理まで到達せずにプロセスが異常終了する可能性がある。

### Finding 2: `executePipeline` における `taskContent.attachmentCleanup` の呼び出しタイミング
- **Location**: `src/features/pipeline/execute.ts:94`
- **Authorization Basis**: `direct_acceptance_criterion_violation` (リソースリーク)
- **Reason Absent**: AIが `finally` でのクリーンアップを実装したが、`runPipeline` の内部で `return` する経路が複数あり、それらが `runPipeline` の `finally` ではなく `executePipeline` の `finally`（存在しない）または `runPipeline` の `finally` に依存している。
- **証拠**: `execute.ts:94` で `taskContent.attachmentCleanup?.()` を呼んでいるが、`runPipeline` の `try` ブロック内で `return { exitCode: ..., result: ... }` を多用している。`finally` は実行されるが、`runPipeline` の外側で `taskContent` を保持してクリーンアップする構造になっていない。
- **影響**: `resolveTaskContent` で生成された一時ファイル等のリソースが、エラー発生時に適切に解放されない可能性がある。

### Finding 3: `addTask` における `resolved.cleanup()` の呼び出し漏れ
- **Location**: `src/features/tasks/add/index.ts:243`
- **Authorization Basis**: `direct_acceptance_criterion_violation` (リソースリーク)
- **Reason Absent**: AIが一部の早期リターンパスでクリーンアップを忘れた。
- **証拠**: `addTask` の `prNumber` 処理パスにおいて、`resolved.cleanup()` が `try...finally` で囲まれておらず、`saveTaskFile` の呼び出し後にのみ呼ばれている。しかし、その前の `determineWorkflow` で `null` が返った際（`224行目`）などは明示的に呼んでいるが、`saveTaskFile` 実行中に例外が発生した場合、`finally` がないためクリーンアップされない。
- **影響**: PR画像などの一時ファイルがディスクに残存する。

### Finding 4: 冗長な条件分岐パターン（AI特有の冗長性）
- **Location**: `src/app/cli/routing-inputs.ts:68-71`
- **Authorization Basis**: `direct_acceptance_criterion_violation` (AI Antipattern: 冗長な条件分岐)
- **Reason Absent**: AIが三項演算子やデフォルト値で簡潔に書ける箇所を、冗長な `if` 文とオブジェクト展開で実装した。
- **証拠**: `routing-inputs.ts:68` 付近で `resolved.attachments.length > 0` の場合にのみプロパティを追加する処理があるが、これは `attachments: resolved.attachments` として渡し、消費側で空配列を許容するか、単純な三項演算子で記述可能。
- **影響**: コードの可読性低下と冗長なロジックの導入。

### 判定
**REJECT**
リソースのクリーンアップ漏れ（Finding 2, 3）および不安定な非 null アサーション（Finding 1）がブロッキングな問題として検出されました。

---

## architecture-review
レビュー結果を報告します。

### 概要
PRコメント内の画像をダウンロードしてtask attachmentsに配置する機能の実装をレビューしました。

### 判定
**APPROVE**

### 確認事項
1.  **設計と構造**:
    - `src/infra/github/prReviewImageAttachments.ts` に画像抽出・ダウンロード・検証ロジックを分離して実装しており、責務が明確です。
    - `GitHubProvider` を通じて `resolvePrReviewImageAttachments` を公開しており、インフラ層の詳細は適切に隠蔽されています。
2.  **安全性と制約**:
    - `isAllowedGithubAttachmentUrl` および `isAllowedRedirectTarget` により、GitHubドメイン外へのリクエストを制限しており、SSRF対策がなされています。
    - `MAX_IMAGE_BYTES` によるサイズ制限と、`detectImageMimeType` によるマジックバイト検証が実装されており、不正なファイル形式の混入を防止しています。
    - `gh auth token` を利用した認証済み取得経路が確保されています。
3.  **配線と統合**:
    - `addTask` (`src/features/tasks/add/index.ts`) において、`resolvePrReviewImageAttachments` の結果を `saveTaskFile` に渡し、正しくアタッチメントとして保存される経路が構築されています。
    - `executePipeline` (`src/features/pipeline/execute.ts`) において、`taskContent.attachments` が `runWorkflow` に渡され、また `finally` ブロックで `attachmentCleanup()` が呼ばれるようになっており、一時ファイルのリークが防止されています。
4.  **契約の一貫性**:
    - Markdownの画像記法およびHTMLの `<img>` タグの両方に対応しており、要求仕様を満たしています。
    - コードフェンスやインラインコード内の画像URLを無視する `splitNonCodeSegments` が実装されており、誤検知が抑制されています。

### 根拠
- `src/infra/github/prReviewImageAttachments.ts`: 抽出・検証・ダウンロードの実装を確認。
- `src/infra/github/GitHubProvider.ts`: プロバイダー経由の公開を確認。
- `src/features/tasks/add/index.ts:198-246`: `addTask` での解決と保存経路を確認。
- `src/features/pipeline/execute.ts:60, 95`: パイプライン実行時のアタッチメント伝播とクリーンアップを確認。
- `src/shared/utils/imageFormat.ts`: MIMEタイプ判定と拡張子マッピングの実装を確認。

---

## security-review
この実装におけるセキュリティ監査結果を報告します。

### 1. 信頼境界と入力検証
GitHub PRコメントから抽出したURLをダウンロードする機能において、以下の防御策が実装されており、信頼境界の破壊は認められません。

- **URL ホワイトリスト検証 (`isAllowedGithubAttachmentUrl`)**:
  - プロトコルを `https:` に限定。
  - ホスト名を `github.com` に限定。
  - パスを `/user-attachments/assets` または `/.../assets` に限定し、任意の外部URLへのリクエストを防止しています。
- **リダイレクト制御 (`fetchImageWithRedirects`)**:
  - `redirect: 'manual'` を設定し、リダイレクト先を `isAllowedRedirectTarget` で検証しています。
  - リダイレクト先は `github.com` または `*.githubusercontent.com` に限定されており、SSRF（Server-Side Request Forgery）のリスクを最小化しています。
  - 最大リダイレクト回数を 5 回に制限 (`MAX_REDIRECTS`) し、無限ループを防止しています。

### 2. リソース保護とDoS対策
- **ファイルサイズ制限 (`validateImageResponse`)**:
  - `Content-Length` ヘッダーによる事前チェックおよび、実際のボディサイズ (`response.body.length`) による事後チェックの両方で `MAX_IMAGE_BYTES` (10MB) を検証しています。
- **Content-Type とマジックバイトの二重検証**:
  - HTTP `Content-Type` ヘッダーの検証に加え、`detectImageMimeType` によるバイナリレベルのマジックバイト検証を行い、Content-Type 偽装を防止しています。

### 3. ファイルシステム操作の安全性
- **ディレクトリ権限 (`createTempDownloadDir`)**:
  - 一時ディレクトリを `0o700` で作成し、他ユーザーからのアクセスを制限しています。
- **ファイル書き込み権限 (`writeNewPrivateFileWithMode`)**:
  - ダウンロードしたファイルを `0o600` (所有者のみ読み書き可能) で保存しています。
- **パストラバーサル防止**:
  - 保存ファイル名を `image-${number}.png` の形式で固定して生成しており、ユーザー入力（URLなど）を直接ファイル名に使用していないため、パストラバーサルの脆弱性は存在しません。

### 結論
本実装は、低信頼入力であるURLおよび外部バイナリデータを扱うにあたり、厳格なホワイトリスト検証、サイズ制限、形式検証、および適切な権限管理を導入しており、セキュリティ上の重大な脆弱性は認められません。

**判定: APPROVE**

---

## testing-review
このステップでは、PRコメント内の画像をダウンロードしてタスク添付ファイルに配置する機能の**テスト品質**をレビューします。

### 1. テストスコープの突合
`order.md` の要件に基づき、以下の検証が実装されていることを確認しました。

- **抽出ロジック** (`prReviewImageAttachments.test.ts`): Markdown/HTML形式のURL抽出、コードブロック除外、GitHub限定URLのフィルタリング、重複排除、プレースホルダー番号の整合性が検証済み。
- **ダウンロード・検証** (`prReviewImageAttachments.integration.test.ts`): Content-Type検証、マジックバイト検証、サイズ上限（10MiB）、認証トークンの利用、失敗時のクリーンアップが検証済み。
- **ファイルシステム・権限** (`imageAttachments.test.ts`, `prReviewImageAttachments.integration.test.ts`): セッション別ディレクトリ、ファイルのパーミッション（0600/0700）が検証済み。
- **CLI・ルーティング統合** (`cli-routing-pr-resolve.test.ts`, `addTask.test.ts`): `--pr` オプションによる画像解決からインタラクティブモードへの伝播、および `addTask` 時の `attachments/` への配置と `order.md` への追記が検証済み。
- **パイプライン実行** (`pipelineExecution.test.ts`): パイプライン経路でのPRコンテキスト解決が検証済み。

### 2. 品質評価

#### 構造と命名
- 全てのテストが `describe` / `it` で振る舞いを明示しており、`Given-When-Then` の構造が明確です。
- 命名規約（`should ... when ...`）に従っており、意図が読み取りやすいです。

#### カバレッジと境界値
- **正常系**: 各経路で画像が正しく保存・参照されることが確認されています。
- **失敗系**: 
    - ネットワークエラー、認証失敗、不正なContent-Type、マジックバイト不一致、サイズ超過などの失敗経路が網羅的にテストされています。
    - `addTask` 時のワークフロー選択キャンセル時や保存失敗時のクリーンアップも検証されています。
- **境界値**:
    - 画像サイズの上限（10MiB + 1バイト）での拒否が検証済みです。
    - 既存のプレースホルダー（`[Image #1]`）がある場合の番号繰り上げが検証済みです。

#### 独立性と再現性
- `tmpdir()` や `mkdtempSync` を使用し、テストごとに独立した一時ディレクトリを作成・削除しており、副作用が隔離されています。
- 外部APIへの依存は `deps` インターフェースを通じてモック化されており、決定論的なテストとなっています。

### 3. 判定
提示された要件およびテストポリシーに照らし、必要な振る舞い（抽出・検証・保存・クリーンアップ・統合）が適切なレイヤー（Unit/IT）で十分に検証されており、重大な欠陥やカバレッジ不足は認められません。

**判定: APPROVE**