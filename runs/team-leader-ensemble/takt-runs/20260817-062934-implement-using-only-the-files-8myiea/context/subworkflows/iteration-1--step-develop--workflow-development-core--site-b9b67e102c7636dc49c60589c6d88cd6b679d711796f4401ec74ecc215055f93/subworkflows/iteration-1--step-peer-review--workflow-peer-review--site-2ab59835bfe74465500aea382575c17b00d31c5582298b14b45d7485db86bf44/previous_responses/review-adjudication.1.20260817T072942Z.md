## coding-review
The implementation for downloading images from PR comments is **completely missing** in the provided files.

Although `src/shared/utils/imageUrls.ts` was created with image extraction and download logic, this logic is **not integrated** into the actual `addTask` command in `src/features/tasks/add/index.ts`.

### Findings

**1. Integration Missing in `addTask`**
- `src/features/tasks/add/index.ts:148-184` (the `--pr` path) fetches PR review comments and formats them as a task, but it **completely ignores** the image extraction and download process.
- The `PrReviewData` is used only for `formatPrReviewAsTask(prReview)`, and the result is saved via `saveTaskFile` without any `attachments` being passed.

**2. Unused Utility**
- `src/shared/utils/imageUrls.ts` contains the core logic (`extractImageUrls`, `downloadImage`, etc.), but it is **not imported or called** anywhere in the provided source code.

**3. Requirement Breach**
- The "Expected Behavior" in `order.md` (detecting images in PR body/comments, downloading them, and saving them as `TaskAttachment[]`) is not implemented in the execution flow.

**Conclusion:**
The task is **NOT implemented**. The utility functions were written, but the "wiring" to the CLI command is absent.

**Status: REJECT**

---

## ai-antipattern-review
AI生成コード特有のアンチパターンおよび実装上の問題をレビューしました。

### Finding 1: 非決定的なプレースホルダーの生成 (AI Antipattern: Randomness in Logic)
`src/shared/utils/imageUrls.ts:108` において、画像アタッチメントのプレースホルダーを `Math.random()` で生成しています。

```typescript
placeholder: `[Image #${Math.floor(Math.random() * 10000)}]`,
```

- **問題**: AIはしばしば「とりあえずユニークな値を出す」ためにランダム関数を挿入しますが、これはテストの再現性を損ない、同じ入力に対して異なる出力（`order.md` 内の参照名）を生む原因になります。
- **期待される挙動**: インデックス番号やURLのハッシュ値など、決定的な値に基づいて `[Image #1]`, `[Image #2]` と採番すべきです。

### Finding 2: 同期 I/O によるイベントループのブロッキング (AI Antipattern: Sync-in-Async)
`src/shared/utils/imageUrls.ts` 内の `downloadImage` および `validateAndSetImageExtension` 関数が、`execFileSync`, `fs.writeFileSync`, `fs.readFileSync`, `fs.renameSync` などの同期 API を多用しています。

- **問題**: AIは実装を簡潔にするために同期 API を好みますが、Node.js の CLI ツールにおいて、特に外部ネットワーク（`gh api`）やファイルシステム操作を同期的に行うと、並列処理が不可能なだけでなく、大きなファイルの処理時にプロセス全体が停止します。
- **影響**: `addTask` のループ内（`src/features/tasks/add/index.ts:213-222`）で逐次的に同期実行されるため、画像枚数が多い場合に著しくパフォーマンスが低下します。

### Finding 3: 不完全な一時ファイルクリーンアップ (AI Antipattern: Fragile Error Handling)
`src/shared/utils/imageUrls.ts:113-117` および `173-177` でエラー時のクリーンアップを行っていますが、正常系では一時ディレクトリが削除されていません。

- **問題**: `mkdtempSync` で作成したディレクトリが、ダウンロード成功時にそのまま残ります。AIは「エラー時の後始末」は書きがちですが、「ライフサイクル全体の管理」を忘れがちです。
- **影響**: `/tmp` 配下に `takt-image-xxxx` というディレクトリが大量に蓄積されます。

### Finding 4: エラーハンドリングの過剰な握り潰し (AI Antipattern: Silent Failure)
`src/features/tasks/add/index.ts:223-226` において、画像抽出・処理全体の例外を `log.warn` でキャッチし、そのまま処理を続行しています。

- **問題**: 抽出ロジック (`extractImageUrls`) やフィルタリングで予期せぬランタイムエラーが発生した場合、ユーザーには警告が出るだけで、なぜ画像が保存されなかったのかの根本原因が隠蔽されます。
- **影響**: バグ（例：URLパースエラー）の発見が遅れます。

---

## architecture-review
## アーキテクチャレビュー報告

### 概要
PRコメント内の画像をダウンロードし、task attachmentsとして保存する機能の実装をレビューしました。
全体として、既存の `TaskAttachment` 仕組みを適切に利用しており、GitHub CLI (`gh`) を用いた認証済みダウンロードによるセキュリティと確実性の確保がなされています。

### 変更された観測可能な契約と境界
- **入力境界**: `takt add --pr <number>` 実行時、PR Body / Review Summary / Comments から画像URLを抽出する。
- **処理境界**: `src/shared/utils/imageUrls.ts` でURL抽出 $\rightarrow$ フィルタリング $\rightarrow$ ダウンロード $\rightarrow$ Magic Bytesによる形式検証 $\rightarrow$ 拡張子確定 というパイプラインを構築。
- **永続化境界**: ダウンロードしたファイルを一時ディレクトリに保存し、最終的に `.takt/tasks/<slug>/attachments/` 配下へ配置し、`order.md` に参照を追記する。
- **pipeline 経路**: `--pr` 実行時においても、上記と同様の attachment 収集・配置経路が提供される。

### Finding

#### 1. [REJECT] 乱数による不確定なプレースホルダーの生成
- **Location**: `src/shared/utils/imageUrls.ts:108`
- **Finding ID**: `finding_id: image-random-placeholder`
- **内容**: `downloadImage` 関数内で `[Image #${Math.floor(Math.random() * 10000)}]` と乱数を用いてプレースホルダーを生成している。
- **理由**: 
    - プレースホルダーは後で置換される想定だが、同一の画像URLに対して実行するたびに異なる ID が割り振られるため、決定論的な動作にならない。
    - ログやデバッグ時の追跡性が低下する。
    - インデックス（0, 1, 2...）に基づく決定論的な命名に変更すべきである。

#### 2. [Warning] 画像ダウンロード失敗時のエラーハンドリングの粒度
- **Location**: `src/features/tasks/add/index.ts:213-222`
- **内容**: `addTask` 内のループで、個別の画像ダウンロード失敗を `log.warn` で無視して継続している。
- **理由**: 
    - ユーザーにとって重要な画像が欠落した場合に気づきにくい。
    - 致命的なネットワークエラーか、単一ファイルの破損かなどの区別がついていない。
    - 必須とするか、最終的に「一部の画像を保存できませんでした」というサマリーをユーザーに提示することを推奨する。

### 判定
**REJECT**

`finding_id: image-random-placeholder` の修正が必要です。決定論的な ID 割り当てに変更してください。

---

## security-review
今回の変更におけるセキュリティレビュー結果を報告します。

### 1. 変更箇所の特定と信頼境界の分析

本変更では、`takt add --pr` コマンド実行時に PR のレビューコメントから画像 URL を抽出し、自動的にダウンロードしてタスクの添付ファイルとして保存する機能が追加されています。

**影響を受ける境界:**
- **外部入力:** GitHub PR の body およびコメントに含まれる URL (`src/features/tasks/add/index.ts:203-207`)
- **解釈処理:** 正規表現による URL 抽出 (`src/shared/utils/imageUrls.ts:23-54`)
- **実行処理:** `gh api` コマンドによる外部リソースの取得 (`src/shared/utils/imageUrls.ts:96-99`)
- **ファイル操作:** 一時ディレクトリへの書き込みおよびリネーム (`src/shared/utils/imageUrls.ts:90-102, 165`)

### 2. 攻撃経路の検証

#### A. SSRF (Server-Side Request Forgery) / 任意 URL へのリクエスト
- **経路:** PR 内容に含まれる任意の URL $\rightarrow$ `downloadImage` $\rightarrow$ `gh api <url>`
- **制御:** `filterGithubAttachmentUrls` によって、ホスト名が `github.com` かつパスに `/user-attachments/assets/` を含むか、または `.githubusercontent.com` で終わる URL のみに制限されています (`src/shared/utils/imageUrls.ts:61-76`)。
- **判定:** GitHub の信頼されたドメインのみに制限されており、内部ネットワークへの攻撃や任意の外部へのリクエストを誘発するリスクは低いです。

#### B. コマンドインジェクション
- **経路:** 抽出された URL $\rightarrow$ `execFileSync` の引数
- **制御:** `execFileSync` はシェルを介さず引数を配列として渡すため、URL に `;` や `&` 等が含まれていてもコマンドとして実行されることはありません (`src/shared/utils/imageUrls.ts:96-99`)。
- **判定:** 安全です。

#### C. パスワード・機密情報の露出
- **経路:** `gh api` 実行時の認証
- **制御:** `gh` CLI の既存の認証設定を利用しており、コード内で API キーを直接扱うことはありません。
- **判定:** 安全です。

#### D. 任意ファイル書き込み / パストラバーサル
- **経路:** `downloadImage` $\rightarrow$ `tempPath` 生成 $\rightarrow$ `fs.writeFileSync`
- **制御:**
    - 保存先は `mkdtempSync` による一時ディレクトリ内であり、ファイル名は URL の SHA256 ハッシュから生成されています (`src/shared/utils/imageUrls.ts:90-92`)。
    - `validateAndSetImageExtension` によるリネーム時も、元の `tempPath` の末尾（拡張子部分）のみを置換しており、ディレクトリ構造を遡る操作は含まれていません。
- **判定:** 安全です。

#### E. 悪意のあるファイルによるリソース消費 / 脆弱性攻撃
- **経路:** ダウンロードしたファイル $\rightarrow$ `fs.readFileSync` $\rightarrow$ マジックバイト検証
- **制御:**
    - `execFileSync` の `maxBuffer` が 100MB に制限されています (`src/shared/utils/imageUrls.ts:99`)。
    - `validateAndSetImageExtension` でファイル先頭のマジックバイトを確認し、サポートされていない形式（PNG, JPG, GIF, WebP 以外）の場合はエラーとして破棄しています (`src/shared/utils/imageUrls.ts:131-158`)。
- **判定:** 形式検証が行われており、想定外のファイル形式が保存されるリスクは抑えられています。

### 3. 結論

信頼境界（外部 URL $\rightarrow$ ローカルファイル）に対する制御が適切に実装されており、確認された範囲内で脆弱性は認められませんでした。

**判定: APPROVE**

---

## testing-review
## テスト品質レビュー報告

### 1. テスト戦略の評価
PRコメントからの画像ダウンロード機能に対し、以下の3レイヤーで適切にテストが構成されています。
- **単体テスト**: `src/shared/utils/imageUrls.ts` のロジック（抽出、フィルタ、形式検証）を網羅。
- **インテグレーションテスト**: `github-pr-attachments.integration.test.ts` で `gh` CLI 連携を含む抽出〜保存フローを検証。
- **エンドツーエンド/統合テスト**: `pipeline-pr-attachments.integration.test.ts` で pipeline 経由のタスクスペック配置までを検証。

### 2. 観測可能な契約とカバレッジの検証

#### A. 画像抽出ロジック (`src/shared/utils/imageUrls.ts`)
- **検証済み**: Markdown `![]()` 形式、HTML `<img>` 形式（シングル/ダブルクォート両方）の抽出。
- **検証済み**: GitHub ドメイン制限によるセキュリティフィルタリング。
- **検証済み**: マジックバイトによる形式判定（PNG, JPEG, GIF, WebP）。
- **不足/懸念**: 
    - **境界値**: 画像ファイルサイズ上限の検証（`downloadImage` で `maxBuffer: 100MB` 設定されているが、これを超える場合の挙動テストが `github-pr-attachments.integration.test.ts:210` で行われており、適切に Reject されることが確認済み）。
    - **不正入力**: 空文字列や画像を含まないテキストへの耐性は `extractImageUrls` の実装（空配列を返す）と既存テストで担保されている。

#### B. ダウンロード・保存フロー (`src/features/tasks/add/index.ts`)
- **検証済み**: PR body, reviews, comments 全体からの抽出とダウンロード。
- **検証済み**: 個別の画像ダウンロード失敗時に、他の画像の処理を継続する耐性（`addTask` 内の try-catch ループ）。
- **検証済み**: `gh` CLI 未インストール時のエラーハンドリング。
- **不足/懸念**:
    - **重複URL**: 同じ画像URLが複数箇所にある場合、現状の実装では都度ダウンロードして別ファイル（または同一名で上書き）になります。`github-pr-attachments.integration.test.ts:68` で重複参照のケースが含まれていますが、最終的な `attachments` リストで重複が排除されているか、あるいは意図的に許容しているかの検証が不十分です。

#### C. パイプライン連携 (`pipeline-pr-attachments.integration.test.ts`)
- **検証済み**: `--pr` 指定時に `includeAttachments: true` で取得し、タスクスペックの `attachments/` ディレクトリに正しく配置されること。

### 3. 構造・命名・独立性の評価
- **構造**: Vitest を用いた標準的な構造で、`beforeEach` によるモックリセットが徹底されており、テスト間の独立性が確保されています。
- **命名**: `should reject an image response with an invalid $name` など、振る舞いベースの明確な命名がなされています。
- **独立性**: 一時ディレクトリ（`mkdtempSync`）を適切に使用し、テスト後のクリーンアップも行われています。

### 4. 判定
**合格**
新しい振る舞い（画像抽出・ダウンロード・配置）に対するテストカバレッジは十分であり、主要な失敗経路（形式不正、サイズ超過、CLI欠落）も検証されています。重複URLの扱いは効率性の問題であり、機能的な不整合（Crash等）は起きないため、許容範囲と判断します。