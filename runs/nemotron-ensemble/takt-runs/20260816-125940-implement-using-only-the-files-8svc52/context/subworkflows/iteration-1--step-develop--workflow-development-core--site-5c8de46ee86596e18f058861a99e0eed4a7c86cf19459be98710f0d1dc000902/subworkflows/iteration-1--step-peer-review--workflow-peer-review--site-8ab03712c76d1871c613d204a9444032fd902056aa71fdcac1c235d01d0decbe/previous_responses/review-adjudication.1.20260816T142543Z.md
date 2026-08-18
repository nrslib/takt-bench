レビューレポートの指摘を裁定し、修正対象を確定します。

## 再発台帳の引き継ぎ
先行 remediation なし

## 指摘ごとの裁定

| Finding ID | Disposition | 統合先 Family | 根拠 |
| :--- | :--- | :--- | :--- |
| AI-NEW-infra-gitlab-L11 | `actionable` | `gitlab-support` | GitLabプロバイダーがGitHub内部実装に依存しており、境界違反である。 |
| AI-NEW-feature-tmp-L234 | `duplicate` | `image-lifecycle` | 固定パス `/tmp/image-n.png` の使用は `CODE-NEW-pipeline-steps-L236` と同一原因。 |
| AI-NEW-feature-sync-L317 | `actionable` | `image-io-performance` | 10MB上限のファイル操作に同期APIを使用しており、イベントループをブロックする。 |
| AI-NEW-feature-error-L240 | `actionable` | `image-download-observability` | ダウンロード失敗時に `null` でフィルタリングし、原因を破棄している。 |
| ARCH-NEW-DRY-IMAGE-DL | `actionable` | `image-download-logic` | `addTask` と `pipeline` の2箇所に重複実装されており、共通化が必要。 |
| CODE-NEW-pipeline-steps-L236 | `actionable` | `image-lifecycle` | 固定パスの使用および一時ファイルの削除処理が欠落しており、衝突・リークのリスクがある。 |
| CODE-NEW-gitlab-pr-L240 | `actionable` | `gitlab-support` | GitLab環境で画像抽出のみ行い、保存処理を呼び出していない。 |
| CODE-NEW-image-downloader-L19 | `actionable` | `gitlab-support` | URLバリデーションがGitHub専用に固定されており、GitLab等を拒絶する。 |

## 修正対象 family

### 1. `gitlab-support`
- **権限根拠**: `direct_acceptance_criterion_violation` (GitLab MR画像保存の未実装)
- **不変条件**: GitLab MR の画像も整合的に抽出・保存されること
- **契約経路**: `src/infra/gitlab/pr.ts` (抽出) $\rightarrow$ `src/infra/github/image-downloader.ts` (バリデーション) $\rightarrow$ 保存フロー
- **受入条件**:
  - `src/infra/gitlab/pr.ts` から保存フローが正しく呼び出されること
  - `src/infra/github/image-downloader.ts` のURLバリデーションがGitLab URLを許容すること
  - GitHub内部実装への直接依存 (`src/infra/github/image-extraction.ts`) が解消され、共通層から参照されること
- **修正境界**:
  - **含む**: GitLabプロバイダーの保存フロー実装、URLバリデーションの汎用化、抽出ロジックの共通化
  - **除外**: `glab` CLI 自体の挙動変更、GitHubプロバイダーの既存抽出ロジックの変更（共通化に伴う移動は含む）

### 2. `image-lifecycle`
- **権限根拠**: `direct_acceptance_criterion_violation` (リソースリーク・衝突)
- **不変条件**: 一時ファイルは一意に生成され、処理後に確実に消去されること
- **契約経路**: `src/features/pipeline/steps.ts` / `src/features/tasks/add/index.ts` $\rightarrow$ `/tmp` 保存 $\rightarrow$ `promoteTaskAttachments`
- **受入条件**:
  - 固定パス `/tmp/image-n.png` が廃止され、`os.tmpdir()` 等によるユニークパスが使用されること
  - `finally` ブロック等で一時ファイルが確実に削除されること
- **修正境界**:
  - **含む**: 一時ファイル生成・削除ロジックの修正
  - **除外**: `.takt/tasks/<slug>/attachments/` への最終保存ロジックの変更

### 3. `image-download-logic`
- **権限根拠**: 構造・設計 (DRY違反・重複実装)
- **不変条件**: 画像のダウンロードから `TaskAttachment` 生成までのフローが統一されていること
- **契約経路**: `addTask` 経路, `pipeline` 実行経路 $\rightarrow$ ダウンロード・保存ロジック
- **受入条件**:
  - `src/features/pipeline/steps.ts` と `src/features/tasks/add/index.ts` の重複ロジックが `src/features/tasks/attachments.ts` 等の共通所有者に集約されていること
- **修正境界**:
  - **含む**: 共通関数の抽出とリファクタリング
  - **除外**: ダウンロード自体の通信仕様変更

### 4. `image-io-performance`
- **権限根拠**: `direct_acceptance_criterion_violation` (パフォーマンス/ブロッキング)
- **不変条件**: 大容量ファイルのI/Oがイベントループをブロッキングしないこと
- **契約経路**: `src/features/tasks/attachments.ts` $\rightarrow$ `fs.writeFileSync` 等
- **受入条件**:
  - `fs.mkdirSync`, `fs.copyFileSync`, `fs.writeFileSync` 等の同期APIが `fs.promises` 等の非同期APIに置換されていること
- **修正境界**:
  - **含む**: I/O処理の非同期化
  - **除外**: ファイルフォーマットの変更

### 5. `image-download-observability`
- **権限根拠**: `direct_acceptance_criterion_violation` (観測性不足)
- **不変条件**: 画像ダウンロード失敗時に、原因を特定可能なエラーまたは警告がユーザーに通知されること
- **契約経路**: `src/features/pipeline/steps.ts:240` $\rightarrow$ `null` フィルタリング
- **受入条件**:
  - 失敗時に単に `null` で無視せず、適切なエラーログまたはユーザー通知が行われること
- **修正境界**:
  - **含む**: エラーハンドリングの強化
  - **除外**: リトライメカニズムの導入（要求外）

**判定**: 修正対象あり