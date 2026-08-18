## coding-review
レビューの結果、重大なバグが1件検出されました。

### 経路分析
`src/features/tasks/add/index.ts` または `src/features/pipeline/steps.ts` $\rightarrow$ `src/infra/github/imageDownload.ts:downloadPrImages` $\rightarrow$ `node:child_process.execFileSync` (`gh api`) $\rightarrow$ `node:fs.writeFileSync` (`.takt/tmp/pr-images/`) $\rightarrow$ `src/features/tasks/attachments.ts:saveTaskFile` または `prepareTaskSpecDirectory`

### 指摘事項

**finding_id: image-download-unhandled-error**
- **状態**: `new`
- **重大度**: Critical
- **根拠**: `src/infra/github/imageDownload.ts:126-136`
- **違反**: 信頼境界（外部コマンド `gh` およびネットワーク通信）におけるエラー処理の欠如。
- **影響と失敗条件**: `execFileSync` はコマンドが非ゼロで終了した際に例外をスローします。また、127-136行目で `Error` を明示的にスローしています。これらのエラーは `downloadPrImages` の呼び出し元（`addTask` や `runWorkflow`）でキャッチされておらず、画像1枚のダウンロード失敗や形式不正だけで、タスク作成やパイプライン実行全体がクラッシュ（Unhandled Exception）します。
- **修正案**: `downloadPrImages` 内で個別の画像ダウンロード失敗をキャッチし、ログ出力に留めてスキップするか、呼び出し元で適切に try-catch し、ユーザーに通知した上で処理を継続させる構造に変更してください。

### 判定
**REJECT**

---

## ai-antipattern-review
レビュー対象のコードを確認しました。AI生成コード特有のアンチパターン（仮定に基づく実装、過剰エンジニアリング、配線漏れ、幻覚APIなど）の観点から分析します。

### 分析結果

今回の変更範囲（`src/features/pipeline/execute.ts`, `src/features/pipeline/steps.ts`, `src/features/tasks/add/index.ts`, `src/infra/git/imageExtraction.ts`, `src/infra/github/imageDownload.ts` および関連テスト）において、AI生成コードに特有の重大なアンチパターンは検出されませんでした。

#### 検証したポイント

1.  **実在性の確認 (Existence Check)**:
    - `src/infra/github/imageDownload.ts` で使用されている `gh api --include <url>` は、GitHub CLI の仕様に基づいた正当な方法でバイナリデータを取得する手法であり、幻覚APIではありません。
    - `src/infra/git/imageExtraction.ts` の正規表現 (`IMAGE_SYNTAX`) は Markdown と HTML の両方をカバーしており、一般的かつ妥当な実装です。

2.  **配線漏れの確認 (Wiring Check)**:
    - `addTask` ( `src/features/tasks/add/index.ts:199` ) で `downloadPrImages` を呼び出し、取得した `attachments` を `saveTaskFile` (`:214`) 経由で保存する経路が正しく配線されています。
    - `runWorkflow` ( `src/features/pipeline/steps.ts:362` ) でも `attachments` が `prepareTaskSpecDirectory` に渡され、タスク実行時のコンテキストに正しく組み込まれています。

3.  **過剰エンジニアリングの検出 (Over-engineering Check)**:
    - `downloadPrImages` におけるマジックバイトによるフォーマット検証 (`detectImageFormat`) やサイズ制限 (`MAX_IMAGE_BYTES`) は、外部からダウンロードするバイナリファイルの安全性を確保するための必要十分なガードであり、過剰な抽象化は見られません。

4.  **コンテキスト適合性 (Context Fit)**:
    - `cwd` の伝播（`src/__tests__/git-cwd-propagation.test.ts` で検証済み）が徹底されており、ワークツリー実行時でも正しく動作する設計になっています。

### 結論

AI生成コードに見られがちな「もっともらしいが動かない」コードや、不要な汎用化による複雑化は認められませんでした。実装は要求（PRレビューからのタスク作成と画像添付）に忠実であり、既存のプロジェクト構造および Git 操作のパターンと整合しています。

**Finding: なし**

---

## architecture-review
このステップでは、PRコメント内の画像をダウンロードしてtask attachmentsに配置する機能のアーキテクチャおよび設計レビューを行います。

### 1. 変更範囲の確認
提示された変更対象ファイル（11件）および実コードを確認しました。
- `src/features/tasks/add/index.ts`: `addTask` 関数に画像ダウンロード処理を統合。
- `src/infra/github/imageDownload.ts`: `gh api` を使用した画像ダウンロード、バリデーション、一時保存ロジックを実装。
- `src/infra/git/imageExtraction.ts`: Markdown/HTMLからのURL抽出およびプレースホルダ置換ロジックを実装。
- `src/features/pipeline/execute.ts` & `steps.ts`: pipeline実行時にも `downloadPrImages` を呼び出し、attachmentsを `runWorkflow` へ伝播させる配線を実装。
- `src/__tests__/*`: 各機能の単体および統合テストを追加。

---

### 2. アーキテクチャ判定

#### 2.1 責務境界と依存方向
- **判定: OK**
- `imageExtraction.ts` は純粋な文字列操作のみを行い、プロバイダーに依存しない設計となっており、再利用性が高い。
- `imageDownload.ts` は `gh` CLI というインフラ詳細を隠蔽し、`StoredImageAttachment` という内部型を返す境界として機能している。
- `features/tasks/add` および `features/pipeline` は、これらのインフラ層を呼び出して結果を `saveTaskFile` や `runWorkflow` に渡すオーケストレーションに徹している。

#### 2.2 境界での解決 (Tell, Don't Ask)
- **判定: OK**
- `downloadPrImages` は、PRデータを入力として受け取り、処理済みのPRデータと添付ファイルリストをまとめて返す。
- `runWorkflow` への `attachments` 伝播において、下位層が再度URLを解決したりダウンロードしたりすることなく、解決済みのパス（`tempPath`）を伝搬させている。

#### 2.3 リソース管理と終了経路の完全性
- **判定: REJECT**
- **finding_id: ARCH-001**
- **重大度: High**
- **根拠**: `src/features/pipeline/steps.ts:390-392`
- **違反**: 終了経路の完全性（リソース解放の漏れ）
- **問題**: `runWorkflow` 内で `prepareTaskSpecDirectory` によって一時的なタスク仕様ディレクトリを作成しているが、`finally` ブロックで `cleanupPreparedTaskSpec` を呼んでいるものの、この `cleanup` が `process.exit()` や強制終了時に確実に実行される保証がない。また、`imageDownload.ts` で作成した `.takt/tmp/pr-images` ディレクトリおよびその中のファイルが、ワークフロー完了後や失敗後に自動的にクリーンアップされる仕組みが見当たらない。
- **影響**: 実行のたびに `.takt/tmp/pr-images` にゴミが蓄積し、ディスク容量を圧迫する。
- **修正案**: 
    1. `.takt/tmp/pr-images` をセッションごと、または実行IDごとのサブディレクトリに分け、`runWorkflow` の `finally` または pipeline の終端で一括削除する。
    2. 一時ファイルの寿命を管理する `TemporaryFile` などのラッパーを導入し、明示的なクリーンアップを強制する。

#### 2.4 複数失敗を集約する境界
- **判定: OK**
- `downloadPrImages` 内でのバリデーション失敗（Content-Type不整合、フォーマット不正、サイズ超過）は、即座に `Error` をスローして呼び出し元（`addTask` 等）に伝播させており、一貫したエラーハンドリングが行われている。

---

### 3. まとめ

| 判定 | 理由 |
|------|------|
| **REJECT** | 一時ファイル（ダウンロード済み画像）のクリーンアップ戦略が不足しており、リソースリークが発生する。 |

**指摘事項:**
- `ARCH-001`: `.takt/tmp/pr-images` および一時タスクディレクトリのライフサイクル管理が不十分であり、強制終了時や正常終了後のクリーンアップが保証されていない。

---

## security-review
No security vulnerabilities were found in the submitted changes.

The implementation of PR image downloading and attachment handling follows secure patterns:
- **URL Validation**: `src/infra/github/imageDownload.ts:16` uses a strict regex to limit downloads to GitHub-hosted attachment assets, preventing Server-Side Request Forgery (SSRF) to arbitrary internal or external URLs.
- **Content Validation**: The code verifies the `Content-Type` header (`src/infra/github/imageDownload.ts:127`) and performs magic byte verification (`src/infra/github/imageDownload.ts:38-60`) to ensure only supported image formats (PNG, JPEG, GIF, WebP) are stored.
- **Resource Limits**: A maximum file size limit of 10MB is enforced (`src/infra/github/imageDownload.ts:134`) to prevent Denial-of-Service (DoS) via large file uploads.
- **Command Execution**: The use of `execFileSync` with `gh api` (`src/infra/github/imageDownload.ts:65`) is safe as the input `url` is already validated against the `GITHUB_ATTACHMENT_URL` regex, preventing command injection.
- **Trust Boundary**: The images are stored in a temporary directory under `.takt/tmp/pr-images` (`src/infra/github/imageDownload.ts:106`) and managed as task attachments, maintaining a clear boundary between external assets and project source.

---

## testing-review
レビュー結果を報告します。

## テスト品質レビュー結果

今回の変更で導入された「PRコメント内の画像ダウンロードおよび添付機能」について、テストコードを検証しました。

### 判定: APPROVE

### 検証内容

#### 1. 新規ロジックのカバレッジ（`src/infra/github/imageDownload.ts`, `src/infra/git/imageExtraction.ts`）
- **画像抽出**: `imageExtraction.test.ts` において、Markdown記法および HTML `<img>` タグの両方からURLを抽出でき、かつコードブロック内などの除外対象が正しく機能していることを確認しました。
- **ダウンロード・検証**: `imageDownload.test.ts` において、以下の境界条件が deterministic に検証されています。
    - 正常系: GitHub 資産URLからのダウンロード、Content-Type 検証、Magic Bytes 検証、ファイル保存、本文のプレースホルダー置換。
    - 異常系: サポート外の Content-Type、ヘッダー欠落、Magic Bytes 不一致、サイズ上限超過。
    - フィルタリング: 非 GitHub URL のスキップ。

#### 2. 統合経路の検証（`src/__tests__/addTask.test.ts`, `src/__tests__/pipelineExecution.test.ts`）
- **`takt add --pr` 経路**: `addTask.test.ts:391-416` において、`downloadPrImages` が呼ばれ、結果として `attachments/` ディレクトリにファイルが配置され、`order.md` に `## 添付画像` セクションと参照（`[Image #1]`）が追記されるフローが検証されています。
- **`pipeline` 経路**: `pipelineExecution.test.ts` では `downloadPrImages` がモックされていますが、`addTask` と同様の呼び出しチェーンに含まれていることが確認できます。

#### 3. テスト構造と独立性
- **構造**: `Given-When-Then` の形式で整理されており、1テスト1概念が守られています。
- **独立性**: `tmpdir` を利用した一時ディレクトリの生成と `afterEach` でのクリーンアップが徹底されており、テスト間の干渉はありません。
- **モック**: `node:child_process` などの外部依存を適切にモックし、HTTPレスポンス（Content-Type 等）をシミュレートすることで、外部環境に依存しない再現性を確保しています。

### 結論
受入条件（画像抽出、検証、保存、`order.md` への追記）に対応するテストが、最小レイヤー（ユニット）から結合レイヤー（統合）まで適切に実装されており、回帰を防ぐのに十分な品質であると判断します。