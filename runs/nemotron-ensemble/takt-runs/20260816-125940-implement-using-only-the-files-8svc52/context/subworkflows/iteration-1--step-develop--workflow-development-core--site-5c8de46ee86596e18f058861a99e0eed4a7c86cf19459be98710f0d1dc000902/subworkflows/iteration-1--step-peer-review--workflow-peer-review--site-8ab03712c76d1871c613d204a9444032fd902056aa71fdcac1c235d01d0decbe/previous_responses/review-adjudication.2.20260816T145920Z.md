## coding-review
レビュー結果を報告します。

### 変更契約の特定
PRレビューからのタスク作成時およびパイプライン実行時に、PR内の画像を自動的にダウンロードし、タスクの添付ファイル（`TaskAttachment`）として保存・管理する機能を実装しています。

- **producer**: `src/infra/github/pr.ts` および `src/infra/gitlab/pr.ts` が PR/MR のボディおよびコメントから画像 URL を抽出。
- **transform**: `src/features/tasks/attachments.ts` の `downloadImageAsAttachment` が URL を一時ファイルとしてダウンロード。
- **persist**: `src/features/tasks/attachments.ts` の `saveImageAttachments` がタスクディレクトリにファイルをコピーし、`order.md` に添付画像セクションを追記。
- **consumer**: タスク実行コンテキストでこれらの添付ファイルが参照可能になる。

### Findings

#### 1. 添付ファイルの保存処理（`saveImageAttachments`）がどこからも呼ばれていない
- **場所**: `src/features/tasks/attachments.ts:349`
- **影響**: `addTask`（`src/features/tasks/add/index.ts`）や `resolveTaskContent`（`src/features/pipeline/steps.ts`）で画像をダウンロードして `attachments` 配列を作成していますが、それを実際にファイルシステムに保存し `order.md` を更新する `saveImageAttachments` が一度も呼び出されていません。
- **結果**: 画像は一時ディレクトリにダウンロードされるだけで、タスクディレクトリに保存されず、`order.md` にも記載されません。実質的に機能していません。
- **修正方針**: `saveTaskFile` または `prepareTaskSpecDirectory` の後続処理として `saveImageAttachments` を呼び出す必要があります。

#### 2. `saveTaskFile` の引数拡張による不整合
- **場所**: `src/features/tasks/add/index.ts:41`
- **影響**: `saveTaskFile` の `options` に `attachments` を追加していますが、この関数が内部で呼んでいる `saveEnqueuedTaskFile`（`src/infra/task/enqueuedTaskFile.js` ※未読だがシグネチャから推測）に `attachments` を渡す経路がありません。
- **詳細**: `saveTaskFile` 内で `attachmentPrepareTaskSpec` を作成していますが、これは `saveEnqueuedTaskFile` の第4引数 `prepareTaskSpec` として渡されるだけです。`prepareTaskSpecDirectory` は `order.md` を作成しますが、添付ファイルの保存処理（`saveImageAttachments`）は含んでいません。

#### 3. パイプライン実行時の添付ファイル消失
- **場所**: `src/features/pipeline/steps.ts:216`
- **影響**: `resolveTaskContent` で画像をダウンロードし `TaskContent` に含めていますが、この `TaskContent` を受け取った後の `runWorkflow` や `executeTask` までの経路で、添付ファイルを永続化（保存）する処理が存在しません。
- **結果**: パイプライン実行時に PR 画像を読み込もうとしても、ファイルが存在しないため参照に失敗します。

### 判定
**REJECT**

画像のダウンロード処理は実装されていますが、それをタスクの永続的ストレージ（タスクディレクトリ）に保存し、`order.md` に反映させる「保存フェーズ」の呼び出しが完全に欠落しています。

---

## ai-antipattern-review
変更対象ファイルのレビュー結果を報告します。

### AI Antipattern Review

AI生成コード特有のパターンおよび設計上の問題を確認しました。

#### 1. 冗長な条件分岐パターン (REJECT)
`src/features/pipeline/steps.ts:359-365` において、`agentOverrides` を構築する際、各オプションが `undefined` かどうかを個別にチェックしてスプレッド演算子で展開していますが、これは三項演算子や Map 等でより簡潔に記述可能です。AI が生成しがちな「丁寧すぎるが冗長な」分岐パターンに該当します。

- **Location**: `src/features/pipeline/steps.ts:359-365`
- **Finding ID**: `ai-redundant-branch-overrides`
- **Reason**: オプションの有無によるオブジェクト構築が冗長。

#### 2. 外部変数キャプチャの濫用 (REJECT)
`src/features/tasks/add/index.ts:124-134` の `saveInteractiveTask` 実装において、`saveTaskFromInteractive` の結果を `created` という変数に代入して返していますが、この構造自体は問題ありません。しかし、`createIssueAndEnqueueTask` に渡すコールバックの中で、外部の状態を操作して結果を返すのではなく、直接戻り値として制御できる設計にするべきです。現状は `async` 関数として正しく実装されていますが、`saveTaskFromInteractive` 内で `promptWorktreeSettings` などの副作用を伴う対話的処理をラップしており、テスト時にモックしにくい構造になっています。

- **Location**: `src/features/tasks/add/index.ts:124-134`
- **Finding ID**: `ai-callback-capture-like`
- **Reason**: 実行制御と対話的入力を密結合させたコールバック実装。

#### 3. 幻覚API/実装の不整合 (Warning)
`src/infra/github/image-downloader.ts:27-31` および `47-51` で `gh api` を使用してバイナリ（画像）をダウンロードしていますが、`gh api` の出力が常に期待される `Buffer` 形式で返されるか、また認証が必要な URL に対して `gh api` が適切にヘッダーを処理してバイナリを返せるかは、環境に依存します。AI は `gh` CLI の汎用的な利用を想定して実装しますが、実際には `curl` や専用の `download` コマンドの方が確実な場合があります。

- **Location**: `src/infra/github/image-downloader.ts:47-51`
- **Finding ID**: `ai-gh-api-binary-assumption`
- **Reason**: `gh api` によるバイナリ取得の信頼性に対する仮定。

### 判定
**REJECT** (Finding ID: `ai-redundant-branch-overrides`, `ai-callback-capture-like`)

---

## architecture-review
今回の変更は、PRコメント内の画像をダウンロードし、タスクの添付ファイルとして保存する機能の実装です。アーキテクチャおよび設計の観点からレビューします。

### 構造・設計の評価

#### 1. レイヤー設計と責務の分離
- **インフラ層の適切さ**: `src/infra/github/image-downloader.ts` および `image-extraction.ts` で GitHub/GitLab 固有の URL 判定や `gh` CLI を用いたダウンロードを実装しており、インフラ詳細が適切に分離されています。
- **機能層のオーケストレーション**: `src/features/tasks/attachments.ts` が一時ファイル管理から永続化（`promoteTaskAttachments`）までのライフサイクルを管理しており、責務が明確です。
- **パイプラインへの統合**: `src/features/pipeline/steps.ts` の `resolveTaskContent` で画像抽出・ダウンロードを行い、`TaskContent` に含めて伝播させる構成となっており、データフローがシンプルです。

#### 2. 境界での解決と正規化
- **Raw入力の正規化**: `extractImageUrls` で Markdown/HTML から URL を抽出し、`validateAndDownloadImage` で Content-Type やサイズを検証してから Buffer として取得しています。これにより、不正なファイルや巨大なファイルの混入を境界で防いでいます。
- **参照の正規化**: `normalizeTaskAttachmentReferences` により、一時パスをプロジェクト相対パス（`attachments/image-1.png`）に置換しており、環境に依存しない `order.md` を生成できています。

#### 3. リソース管理（終了経路の完全性）
- **一時ファイルのクリーンアップ**: `downloadImageAsAttachment` 内で `try-catch` を用い、ダウンロード失敗時に `unlink` を行う実装になっています。
- **懸念点**: 正常にダウンロードされた一時ファイルは `promoteTaskAttachments` でコピーされますが、その後の一時ファイル削除（cleanup）が `src/features/tasks/add/index.ts` や `src/features/pipeline/steps.ts` の呼び出し側で明示的に行われているか確認が必要です。現状、`cleanupPreparedTaskSpec` という関数は定義されていますが、`addTask` や `runPipeline` のフロー内で適切に呼ばれている形跡が見当たりません。

### 指摘事項

#### 1. 一時ファイルのライフサイクル管理（設計漏れ）
- **問題**: `downloadImageAsAttachment` で `tmpdir()` に生成したファイルが、タスク保存後に削除される経路が不明確です。
- **影響**: 実行のたびに OS の一時ディレクトリに画像ファイルが蓄積されます。
- **修正案**: `saveTaskFile` または `runWorkflow` の `finally` ブロックなどで、使用済みの `TaskAttachment` (tempPath) を一括削除する処理を追加してください。

#### 2. 重複コードの検出（DRY違反）
- **問題**: `src/features/tasks/add/index.ts:200-214` と `src/features/pipeline/steps.ts:227-235` で、`prReview.images` から `downloadImageAsAttachment` を呼び出してフィルタリングするほぼ同一のロジックが記述されています。
- **影響**: 修正が必要になった際に 2 箇所への変更が必要になり、不整合の原因となります。
- **修正案**: `src/features/tasks/attachments.ts` 等に `async function downloadAttachments(urls: string[]): Promise<TaskAttachment[]>` のような共通関数を抽出し、両方から呼び出すようにしてください。

### 判定
**条件付き承認（修正推奨）**
機能的な実装は適切で、レイヤー設計も守られていますが、リソースクリーンアップの漏れとロジックの重複があるため、上記の修正を推奨します。

---

## security-review
今回の変更は、GitHub/GitLabのPR/MRから画像URLを抽出し、それらをローカルにダウンロードしてタスクの添付ファイルとして保存する機能の追加です。

### 1. 信頼境界と入力の特定
- **入力**: PR/MRの本文およびコメントに含まれる画像URL（ユーザー制御）。
- **解釈処理**: `extractImageUrls` による正規表現でのURL抽出、および `validateAndDownloadImage` によるダウンロード。
- **保存先**: ローカルのテンポラリディレクトリ (`tmpdir()`) およびタスクディレクトリ (`attachments/` フォルダ)。

### 2. セキュリティ検証

#### A. SSRF (Server-Side Request Forgery) / 任意ファイル読み取り
- **制御**: `validateAndDownloadImage` (`src/infra/github/image-downloader.ts:20`) で、URLが `GITHUB_ATTACHMENT_URL_PREFIX` または `GITLAB_ATTACHMENT_URL_PREFIX` で始まることを厳格にチェックしています。
- **判定**: 許可されたドメイン（github.com, gitlab.com のアセットパス）以外へのリクエストは拒否されるため、SSRFのリスクは低いです。

#### B. OSコマンドインジェクション
- **制御**: `execFileSync` を使用しており、引数は配列形式で渡されています (`src/infra/github/image-downloader.ts:27, 47`)。
- **判定**: シェルを介さず直接実行されるため、URLに特殊文字が含まれていてもコマンドインジェクションは発生しません。

#### C. パストラバーサル / 任意ファイル書き込み
- **制御**: 
    - ファイル名は `randomUUID()` を用いて生成されており、ユーザー制御の文字列は含まれていません (`src/features/tasks/attachments.ts:36`)。
    - 保存先は `path.join(tempDir, fileName)` または `path.join(taskDir, 'attachments', fileName)` で固定されており、ディレクトリを遡る操作は不可能です。
- **判定**: 任意ファイル書き込みのリスクはありません。

#### D. リソース枯渇 (DoS)
- **制御**: `MAX_IMAGE_SIZE_BYTES = 10MB` (`src/infra/github/image-downloader.ts:9`) によるサイズ制限が実装されています。
- **判定**: 1ファイルあたりのサイズ制限があり、メモリおよびディスクの急激な消費を抑制しています。

### 3. 結論
信頼境界における入力検証（URL接頭辞チェック）と、出力先の制御（UUIDによるファイル名生成）が適切に行われており、重大な脆弱性は認められません。

**APPROVE**

---

## testing-review
今回の変更で導入された主要な新機能「PRコメントからの画像ダウンロードと添付」に対し、**単体テストが全く実装されていない**ことを確認しました。

### カバレッジ不足の指摘

以下の重要ロジックに対するテストが欠落しており、具体的で観測可能な失敗経路が検証されていません。

1.  **画像URL抽出 (`src/infra/github/image-extraction.ts`)**:
    - Markdown記法 `![alt](url)` および HTML `<img>` タグの抽出ロジックが未検証です。
    - 誤検知（例：単なるリンク `[text](url)`）や、複雑な HTML 属性を含むタグの抽出失敗などの経路が未確認です。

2.  **画像バリデーションとダウンロード (`src/infra/github/image-downloader.ts`)**:
    - `GITHUB_ATTACHMENT_URL_PREFIX` / `GITLAB_ATTACHMENT_URL_PREFIX` による URL フィルタリングの境界値テストがありません。
    - `SUPPORTED_IMAGE_TYPES` (PNG/JPEG/GIF/WebP) 以外の形式が正しく拒否されるか、また `MAX_IMAGE_SIZE_BYTES` (10MB) を超えるファイルが拒否されるかの検証がありません。
    - `gh api` 実行失敗時のエラーハンドリングが未検証です。

3.  **添付ファイル管理 (`src/features/tasks/attachments.ts`)**:
    - `downloadImageAsAttachment`: 一時ファイルの作成、UUID によるファイル名衝突回避、エラー時のクリーンアップ処理が未検証です。
    - `saveImageAttachments`: `attachments/` ディレクトリの作成、`order.md` への「## 添付画像」セクションの追記、および本文内参照の正規化ロジックが未検証です。

### 結論
実装されたロジックの多くが「正しく動作するはず」という推測に基づいており、特にセキュリティ制約（URL 制限、サイズ制限、形式検証）に関する振る舞いが決定論的に保証されていません。これらの機能に対する単体テストの追加を強く推奨します。