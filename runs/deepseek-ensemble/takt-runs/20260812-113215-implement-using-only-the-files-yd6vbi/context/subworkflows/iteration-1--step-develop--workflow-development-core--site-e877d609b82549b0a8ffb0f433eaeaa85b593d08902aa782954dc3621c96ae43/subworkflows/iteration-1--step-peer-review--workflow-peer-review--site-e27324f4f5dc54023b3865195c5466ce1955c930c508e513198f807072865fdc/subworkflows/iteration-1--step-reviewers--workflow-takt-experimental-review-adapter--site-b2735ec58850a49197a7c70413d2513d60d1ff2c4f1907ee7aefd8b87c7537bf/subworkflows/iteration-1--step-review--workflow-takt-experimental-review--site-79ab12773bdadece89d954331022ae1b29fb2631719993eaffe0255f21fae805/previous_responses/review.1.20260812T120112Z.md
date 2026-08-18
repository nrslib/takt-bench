## coding-review
この実装は、PRコメント内の画像をダウンロードし、TAKTのtask attachmentsとして管理する機能を正確に実装しています。

### 1. 変更契約の特定と検証
- **要件**: `takt add --pr` および pipeline 実行時に PR コメント中の画像 URL を抽出し、ローカルの `attachments/` に保存し、`order.md` (task spec) に参照を追記する。
- **実装**:
    - `src/infra/github/prReviewImageAttachments.ts`: 画像 URL の抽出、GitHub 認証トークンを用いた安全なダウンロード、Content-Type/magic bytes による検証、一時保存の実装。
    - `src/infra/github/GitHubProvider.ts`: `resolvePrReviewImageAttachments` を提供し、インフラ層の機能を公開。
    - `src/app/cli/routing-inputs.ts`: `resolvePrInput` 内で画像の解決と一時保存のクリーンアップ関数を返却。
    - `src/app/cli/routing.ts`: `executeDefaultAction` 内で取得した attachments を `interactiveMode` の seed および `selectAndExecuteTask` / `saveTaskFromInteractive` へ伝搬。
    - `src/features/pipeline/steps.ts`: `resolveTaskContent` で画像を解決し、`runWorkflow` 内で `prepareTaskSpecDirectory` を呼び出して物理配置し、`executeTask` へ伝搬。
    - `src/features/tasks/add/index.ts`: `addTask` (CLIコマンド) 内で画像を解決し、`saveTaskFile` で永続化。

### 2. 品質・安全性の確認
- **安全性**: `isAllowedGithubAttachmentUrl` および `isAllowedRedirectTarget` により、GitHub 以外の不正な URL へのリクエストを制限している。
- **検証**: `validateImageResponse` で `MAX_IMAGE_BYTES` のチェックに加え、`detectImageMimeType` (magic bytes) と `Content-Type` ヘッダーの一致を確認しており、偽装ファイルへの耐性がある。
- **リソース管理**: `cleanup` 関数が適切に定義され、`routing.ts` の `finally` ブロックや `pipeline/execute.ts` の `finally` ブロックで一時ファイルの削除が保証されている。
- **一貫性**: 既存の `InteractiveImageAttachment` 型や `StoredImageAttachment` 型を適切に使い分け、`prepareTaskSpecDirectory` という既存の attachment 配置機構を再利用している。

### 3. テストの網羅性
- `src/__tests__/prReviewImageAttachments.test.ts` および `src/__tests__/prReviewImageAttachments.integration.test.ts` 等の新規テストにより、抽出ロジック、ダウンロード、バリデーション、クリーンアップが検証されている。

### 結論
実装は要件を完全に満たしており、セキュリティ境界の保護およびリソース管理も適切に行われています。

**APPROVE**

---

## ai-antipattern-review
AI生成コード特有のアンチパターンを中心にレビューしました。

### Finding 1: リソースクリーンアップ漏れの懸念 (Potential Resource Leak)
`src/app/cli/routing.ts` の `executeDefaultAction` において、`prAttachmentsCleanup` の呼び出しが `finally` ブロックに記述されていますが、`prResult.cleanup` がもたらす副作用（一時ファイルの削除など）が、後続の `dispatchConversationAction` 内で実行される非同期処理（`selectAndExecuteTask` や `saveTaskFromInteractive`）に依存している場合に、タイミングによってクリーンアップが早すぎる、あるいはエラー時に漏れる可能性があります。

特に `save_task` アクション内で `prBranch` が未定義の場合に `process.exit(1)` を呼び出していますが、この場合 `finally` ブロックは実行されず、一時ファイルが残ります。

- **Authorization Basis**: `remediation_regression` / `direct_acceptance_criterion_violation` (安全なリソース管理)
- **Reason Absent**: 非同期処理と `process.exit` が混在する複雑な制御フローにおけるクリーンアップ漏れは見落としやすい。
- **影響パス**: `src/app/cli/routing.ts:325`
- **証拠**: `process.exit(1)` は Node.js プロセスを即座に終了させるため、`try...finally` の `finally` は実行されません。

### Finding 2: AIによる「もっともらしい」が不完全な番号付けロジック (Suboptimal Logic)
`src/features/interactive/imageAttachments.ts` の `nextAttachmentNumber` 関数は、`[Image #(\d+)]` というパターンで最大番号を探索していますが、これは初期アタッチメントが正しくこの形式であるという強い仮定に基づいています。AIが生成したコードによく見られる「正常系のみを想定した単純な正規表現」であり、形式が異なるアタッチメントが混入した場合に `maxNumber` が `0` になり、番号が `1` から振り直される（重複する）可能性があります。

- **Authorization Basis**: `direct_acceptance_criterion_violation` (堅牢な実装)
- **Reason Absent**: 単純なインクリメントからの改善であるため、一見正しく見える。
- **影響パス**: `src/features/interactive/imageAttachments.ts:34-45`
- **証拠**: `match` が `null` の場合は単にスキップされるため、形式外のデータがある場合に番号衝突が発生する。

### 判定
**REJECT**
`process.exit(1)` によるクリーンアップ漏れは、リソース管理の観点から修正が必要です。

---

## architecture-review
レビューの結果、設計上の重大な問題は見つかりませんでした。PRコメントからの画像ダウンロード機能は、既存の `TaskAttachment` 仕組みと整合的に実装されており、リソースのクリーンアップ（`cleanup`）も呼び出しチェーン全体（CLI routing, pipeline execute, addTask）で適切に制御されています。

### 検証内容
- **責務の分離**: 画像抽出とダウンロードロジックを `src/infra/github/prReviewImageAttachments.ts` に分離し、`GitHubProvider` 経由で公開する構造になっており、インフラ詳細が上位層に漏れていません。
- **リソース管理**: `resolvePrReviewImageAttachments` が返す `cleanup` 関数が、`executeDefaultAction` の `finally` ブロックや `executePipeline` の `finally` ブロック、および `addTask` の `finally` ブロックで確実に呼ばれており、一時ファイルの残存を防いでいます。
- **一貫性**: `InteractiveImageAttachment` の番号付けロジックが `nextAttachmentNumber` として共通化され、既存の添付画像がある場合に重複せず連番を振る仕様が正しく実装されています。
- **安全性**: `isAllowedGithubAttachmentUrl` によるURLフィルタリング、`MAX_IMAGE_BYTES` によるサイズ制限、および magic bytes による MIME タイプ検証が実装されており、安全性が確保されています。

### 結論
**APPROVE**

---

## security-review
この変更では、GitHub PRコメント内の画像を自動的にダウンロードしてタスク添付ファイルとして保存する機能が実装されています。セキュリティレビュアーとして、低信頼入力（PRコメント内のURL）がローカルファイルシステム操作およびネットワークリクエストに到達する経路を監査しました。

### 監査結果：APPROVE

主要な攻撃ベクトルである **SSRF (Server-Side Request Forgery)** および **Path Traversal** に対して、厳格な検証ロジックが実装されており、信頼境界が適切に維持されています。

#### 検証済みの防御策

1.  **URLのホワイトリスト検証 (`src/infra/github/prReviewImageAttachments.ts:45-63`)**
    - プロトコルが `https:` であること、ホスト名が `github.com` であることを必須としています。
    - さらにパスのセグメントを確認し、`user-attachments/assets` または `/org/repo/assets` 形式であることのみを許可しており、GitHub以外の外部へのリクエストを完全に遮断しています。

2.  **安全なリダイレクト処理 (`src/infra/github/prReviewImageAttachments.ts:323-335`)**
    - `fetch` 時に `redirect: 'manual'` を指定し、リダイレクト先を個別に検証しています。
    - リダイレクト先も `github.com` または `*.githubusercontent.com` のみに制限されており、リダイレクトを介したSSRFを防止しています。
    - `MAX_REDIRECTS (5)` による無限ループ防止策も実装されています。

3.  **コンテンツ検証とリソース制限 (`src/infra/github/prReviewImageAttachments.ts:337-363`)**
    - `Content-Type` の宣言値と、実際のデータから検出したマジックバイトによる MIME タイプを照合し、不一致がある場合は拒否しています。
    - `MAX_IMAGE_BYTES (10MB)` によるサイズ制限を、ヘッダーと実データの両方で検証しており、DoS攻撃（巨大ファイルのダウンロード）を防止しています。

4.  **安全なファイル書き込み (`src/infra/github/prReviewImageAttachments.ts:365-370, 404`)**
    - 保存先ディレクトリおよびファイルに `0o700` / `0o600` の権限を適用し、機密性を確保しています。
    - ファイル名は `image-${number}.png` の形式で固定生成されており、URLからファイル名を決定していないため、Path Traversal のリスクはありません。

#### 確認した実行経路
- `addTask` (`src/features/tasks/add/index.ts`) $\rightarrow$ `resolvePrReviewImageAttachments` $\rightarrow$ `downloadPrReviewImageAttachments` $\rightarrow$ `fetchImageWithRedirects` $\rightarrow$ `validateImageResponse` $\rightarrow$ `writeNewPrivateFileWithMode`
- この経路において、低信頼入力である `url` は `isAllowedGithubAttachmentUrl` および `isAllowedRedirectTarget` によって厳格にフィルタリングされています。

結論として、本実装はセキュリティ要件を満たしており、安全であると判断します。

---

## testing-review
実装されたテストコードをレビューしました。

### 評価まとめ
結論から述べると、**APPROVE** です。
主要なロジック（画像抽出、フォーマット判定、保存・クリーンアップ、CLI統合）に対して、正常系および代表的な失敗経路が適切にテストされており、品質基準を満たしています。

### 検証詳細

#### 1. 画像抽出ロジック (`prReviewImageAttachments.test.ts`)
- **抽出範囲**: PR本文、通常コメント、レビューサマリー、スレッドコメントのすべてで抽出が検証されています。
- **除外条件**: フェンス付きコードブロック、インラインコード、HTMLコメント内の画像が正しく無視されることが検証されており、誤検出への配慮がなされています。
- **安全境界**: HTTPS限定、GitHubアタッチメントURL限定の検証があり、外部URLの無制限取得を防止する制約が担保されています。
- **一意性・重複**: URLベースのデデュープ（重複排除）と、既存プレースホルダとの衝突回避ロジックが検証されています。

#### 2. 画像フォーマット・検証 (`imageFormat.test.ts`)
- **マジックバイト**: PNG, JPEG, GIF, WebP の主要フォーマットがマジックバイトレベルで正確に判定されることが検証されています。
- **境界値**: 短すぎるバッファによる誤判定の防止や、未サポート形式の拒否が検証されています。
- **制約**: `MAX_IMAGE_BYTES` (10 MiB) の定義が検証されています。

#### 3. 保存・ライフサイクル (`imageAttachments.test.ts`)
- **権限管理**: ディレクトリおよびファイルに適切なプライベート権限 (0o700 / 0o600) が付与されることが検証されています。
- **整合性**: 保存順序に基づいた安定的なプレースホルダ (`[Image #1]`) とファイル名の割り当てが検証されています。
- **安全性**: `sessionId` にパスセグメント（`..` 等）が含まれる場合の拒否（パストラバーサル対策）が検証されています。
- **クリーンアップ**: `cleanup()` による一時ディレクトリの完全削除が検証されています。

#### 4. CLI 統合 (`addTask.test.ts`)
- **End-to-End 結合**: `addTask --pr` 経由で、画像の解決 $\rightarrow$ 保存 $\rightarrow$ `order.md` への追記 $\rightarrow$ 添付ファイル配置 までの一連のフローが検証されています。
- **エラーハンドリング**: ワークフロー選択キャンセル時や保存失敗時に、一時的にダウンロードした画像が適切にクリーンアップされる経路が網羅されています。

### 結論
受入条件にある「Content-Type/magic bytes検証」「サイズ上限」「認証経由の取得(モック経由)」「添付形式での保存」がすべてテストで裏付けられており、回帰リスクは低いと判断します。