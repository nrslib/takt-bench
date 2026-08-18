## coding-review
Review 結果を報告します。

### 変更契約の確認
PR コメント内の画像を抽出・ダウンロードし、`TaskAttachment` として保存して `order.md` に参照を追記する機能を実装しています。

- **抽出**: `src/infra/git/imageExtraction.ts` で Markdown および HTML 形式の画像 URL を抽出。
- **保存**: `src/infra/github/imageDownload.ts` で `gh api` を用いて取得し、マジックバイト検証とサイズ制限（10MB）を適用。
- **統合**: `src/features/tasks/add/index.ts` (addTask) および `src/features/pipeline/steps.ts` (runWorkflow) に統合し、添付ファイルとして管理。

### 指摘事項

#### [new] `downloadPrImages` における `prReview` オブジェクトの直接書き換えによる副作用
- **場所**: `src/infra/github/imageDownload.ts:93-103` および `128-130`
- **重大度**: Medium
- **根拠**: `downloadPrImages` 関数内で、引数として受け取った `prReview` (PrReviewData) の `body`, `comments`, `reviews` の各プロパティを直接書き換えている。
- **違反している要件**: 副作用の最小化およびデータの不変性。
- **影響**: `downloadPrImages` を呼び出した後、元の `prReview` オブジェクトが破壊されており、呼び出し元で元の本文を必要とする場合に不整合が発生する。
- **修正案**: `prReview` をディープコピーするか、書き換え後の新しいオブジェクトを生成して返却するように変更してください。

#### [new] `downloadPrImages` での例外処理不足による処理中断
- **場所**: `src/infra/github/imageDownload.ts:113`, `116`
- **重大度**: Medium
- **根拠**: 画像の形式不正またはサイズ超過時に `throw new Error` している。
- **違反している要件**: 堅牢なエラー処理。
- **影響**: 1 つの画像が不正なだけで、PR 全体のタスク作成やパイプライン実行が完全に停止する。一部の画像が取得できなくても、取得できた分だけで処理を続行し、エラーはログに出力してスキップすべきである。
- **修正案**: `throw` ではなく `console.error` 等で記録し、その画像のみを `attachments` から除外して続行する構造に変更してください。

#### [new] `downloadPrImages` における一時ディレクトリの管理不備
- **場所**: `src/infra/github/imageDownload.ts:90`
- **重大度**: Low
- **根拠**: `.takt/tmp/pr-images` という固定パスを使用しており、並列実行時に競合する可能性がある。
- **影響**: 複数のタスクを同時に `add --pr` した場合、一時ファイルが上書きされるリスクがある。
- **修正案**: `os.tmpdir()` を使用するか、実行ごとにユニークなサブディレクトリを生成してください。

### 回帰確認
- `src/__tests__/imageDownload.test.ts`, `src/__tests__/imageExtraction.test.ts` により、抽出ロジックと基本ダウンロードフローは検証済み。
- `src/__tests__/addTask.test.ts`, `src/__tests__/pipelineExecution.test.ts` により、機能統合経路の動作は検証済み。

以上の 3 点の修正を推奨します。

---

## ai-antipattern-review
レビュー結果を報告します。

AI特有のアンチパターン（幻覚API、過剰エンジニアリング、配線漏れ、不適切な仮定）を中心に検証しましたが、実装はシンプルかつ堅実であり、重大な問題は検出されませんでした。

### 評価
- **実在性確認**: `gh` CLI を利用した画像ダウンロード実装 (`src/infra/github/imageDownload.ts:62`) および Git 操作の伝播は、既存の TAKT インフラ設計に適合しており、幻覚 API の利用は見られません。
- **到達性・配線確認**: `addTask` から `downloadPrImages` への接続、および `executePipeline` から `runWorkflow` への `attachments` 伝播 (`src/features/pipeline/steps.ts:362-372`) は正しく配線されており、機能が死蔵している箇所はありません。
- **コンテキスト適合**: `sanitizeTerminalText` による出力のサニタイズ (`src/features/pipeline/execute.ts:78`) や、Worktree 経由の Git 操作 (`src/features/pipeline/steps.ts:437-444`) など、プロジェクト固有の安全策が適切に適用されています。
- **最小差分**: 画像抽出・置換ロジック (`src/infra/git/imageExtraction.ts`) は汎用的な正規表現に基づいたシンプルな実装となっており、不要な抽象化レイヤーは導入されていません。

### 指摘事項
検出された issue はありません。

**判定: APPROVE**

---

## testing-review
レビュー結果を報告します。

### テスト品質レビュー報告

#### 1. 評価サマリー
PRコメント内の画像ダウンロードおよびアタッチメント化機能の実装に対し、ユニットテストおよび統合テストを確認しました。
主要な成功パス、フォーマット検証、サイズ制限、外部URL除外などの境界条件が `src/__tests__/imageDownload.test.ts` で適切にカバーされており、品質基準を満たしています。

#### 2. 詳細評価

**A. `src/infra/github/imageDownload.ts` の検証 (Unit)**
- **構造**: `isGitHubAttachmentUrl` と `downloadPrImages` の責務が明確に分離されており、テストコードもそれに準じて構成されています。
- **カバレッジ**:
    - **正常系**: PNG等の主要フォーマットのダウンロードとプレースホルダ置換が検証済み。
    - **拒否系**: 
        - サポート外フォーマットのmagic bytesによる拒否 (`Unsupported image format`) $\rightarrow$ 検証済み。
        - サイズ上限（10MB）超過による拒否 (`Image exceeds size limit`) $\rightarrow$ 検証済み。
        - GitHub外部URLの無視（ダウンロードせずスキップ） $\rightarrow$ 検証済み。
    - **境界値**: 
        - `isGitHubAttachmentUrl` で user-attachments および org/repo assets の両パターンを検証済み。
- **独立性**: `createTempRoot` による一時ディレクトリ利用により、テスト間の干渉が防止されています。

**B. 統合経路の検証 (Integration)**
- **`addTask` 経路**: `src/__tests__/addTask.test.ts` にて、画像が正しく `attachments/` に配置され、`order.md` にプレースホルダが追記されるフローが検証されています。
- **`pipeline` 経路**: `src/__tests__/pipelineExecution.test.ts` にて、パイプライン実行時に画像ダウンロードが走り、`taskSpec` が生成されてタスク実行に渡される経路が検証されています。

#### 3. 指摘事項
指摘事項はありません。

**判定: APPROVE**