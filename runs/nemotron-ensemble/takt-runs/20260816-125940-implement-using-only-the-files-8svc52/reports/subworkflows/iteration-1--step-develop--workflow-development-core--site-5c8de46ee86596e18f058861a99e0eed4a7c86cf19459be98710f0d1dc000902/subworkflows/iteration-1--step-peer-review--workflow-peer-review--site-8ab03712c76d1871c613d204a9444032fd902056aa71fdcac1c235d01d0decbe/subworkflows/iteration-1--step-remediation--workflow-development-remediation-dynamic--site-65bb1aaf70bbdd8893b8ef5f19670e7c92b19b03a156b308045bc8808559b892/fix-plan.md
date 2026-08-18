# 修正計画

## 結果: 修正計画確定

## 指摘カバレッジ
| finding ID / 出典 | 修正権限の根拠 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 原因を確認した根拠 / 確認して否定した別の原因 | 分類 | 受入条件・修正境界 |
|-------------------|----------------|------|----------------------|-----------------------------|-------------------------------|------|----------------------|
| AI-NEW-infra-gitlab-L11, CODE-NEW-gitlab-pr-L240, CODE-NEW-image-downloader-L19 | 受入条件の直接違反 | `src/infra/gitlab/pr.ts:240` (保存呼出なし), `src/infra/github/image-downloader.ts:19` (GitHub限定URLチェック) | `gitlab-support` | GitLab MR の画像抽出後、保存処理が呼ばれず、URLバリデーションが GitHub 専用であるため保存できない $\rightarrow$ プロバイダー間の機能不整合 $\rightarrow$ 保存基盤の GitHub 依存 | 実コードでのバリデーション定義と GitLab 側のフロー欠落を確認済み | 構造 | GitLab URL を許容し、MR 抽出後に保存フローが実行されること。`src/infra/gitlab/pr.ts` および `src/infra/github/image-downloader.ts` の修正。 |
| AI-NEW-feature-tmp-L234, CODE-NEW-pipeline-steps-L236 | 受入条件の直接違反 | `src/features/pipeline/steps.ts:236` (固定パス `/tmp/image-n.png`) | `image-lifecycle` | 固定パス使用により並行実行時の衝突および永続的なリークが発生する $\rightarrow$ 一時ファイル管理の不備 $\rightarrow$ ファイル名の非一意性と削除処理の欠落 | 実コードでの固定パス使用を確認済み | 構造 | `os.tmpdir()` によるユニークパス使用と `finally` による確実な削除。`src/features/pipeline/steps.ts` の修正。 |
| ARCH-NEW-DRY-IMAGE-DL | 構造・設計違反 (DRY) | `src/features/pipeline/steps.ts` と `src/features/tasks/add/index.ts` の重複実装 | 同一のダウンロード・保存ロジックが複数箇所にハードコードされている $\rightarrow$ 保守性の低下 $\rightarrow$ 共通ロジックの所有責任の不在 | 両ファイルでほぼ同一の `validateAndDownloadImage` $\rightarrow$ `fs.writeFileSync` フローを確認 | 構造 | 重複ロジックが `src/features/tasks/attachments.ts` 等の共通所有者に集約されていること。共通関数抽出と各箇所のリファクタリング。 |
| AI-NEW-feature-sync-L317 | 受入条件の直接違反 | `src/features/tasks/attachments.ts:317` 等の同期 API 使用 | 10MB のファイル操作を同期的に行うことで Node.js のメインスレッドを停止させる $\rightarrow$ I/O ブロッキング $\rightarrow$ 非同期 I/O API の未採用 | `fs.writeFileSync`, `fs.copyFileSync` の使用を確認済み | 構造 | `fs.promises` 等の非同期 API に置換され、ブロッキングが解消されていること。`src/features/tasks/attachments.ts` の修正。 |
| AI-NEW-feature-error-L240 | 受入条件の直接違反 | `src/features/pipeline/steps.ts:240` (`null` フィルタリング) | ダウンロード失敗時に `null` で無視し詳細を破棄しているため、原因特定が不可能 $\rightarrow$ 観測性の欠如 $\rightarrow$ エラーハンドリングの不備 | `catch` ブロックでの `return null` と `filter` による除去を確認済み | 局所 | 失敗時に適切なエラー通知またはログ出力が行われること。`src/features/pipeline/steps.ts` のエラーハンドリング強化。 |

## 不変条件台帳
引き継ぎ元: 先行 remediation なし

### 引き継ぎ元からの行
(なし)

### 新規・現在の計画行
| 修正単位 | family ID | 不変条件の名前 | 観測可能な不変条件 | 担当箇所 | 分類 | 別経路での再発が確認済みか | 強制点 |
|----------|-----------|------------------|----------------------|----------|------|------------------------------|--------|
| `image-download-logic` | `image-download-logic` | 画像のダウンロードから `TaskAttachment` 生成までのフローが統一されていること | ダウンロード・保存・オブジェクト生成の全工程が単一の共通関数を経由していること | `src/features/tasks/attachments.ts` | 構造 | 未確認 | `src/features/tasks/attachments.ts` に `downloadImageAsAttachment` 等の共通関数を定義し、全入口からこの関数のみを呼び出す。 |
| `gitlab-support` | `gitlab-support` | GitLab MR の画像も整合的に抽出・保存されること | GitLab の画像 URL が正しくバリデーションされ、保存処理が完結すること | `src/infra/gitlab/pr.ts` | 構造 | 未確認 | バリデーションをプロバイダー非依存に拡張し、GitLab プロバイダーから共通保存関数を呼び出す。 |
| `image-lifecycle` | `image-lifecycle` | 一時ファイルは一意に生成され、処理後に確実に消去されること | 並行実行時にファイル名が衝突せず、処理完了後に `/tmp` から削除されること | `src/features/pipeline/steps.ts` | 構造 | 未確認 | `os.tmpdir()` と UUID 等を用いた一意なパス生成および `finally` ブロックでの `fs.unlink` 実装。 |
| `image-io-performance` | `image-io-performance` | 大容量ファイルの I/O がイベントループをブロッキングしないこと | ファイル I/O 時にメインスレッドが停止せず、非同期に処理されること | `src/features/tasks/attachments.ts` | 構造 | 未確認 | `fs.promises` API への完全な移行（`writeFileSync` $\rightarrow$ `writeFile` 等）。 |
| `image-download-observability` | `image-download-observability` | 画像ダウンロード失敗時に、原因を特定可能なエラーまたは警告がユーザーに通知されること | 失敗した画像がある場合に、その URL と理由がユーザーに通知されること | `src/features/pipeline/steps.ts` | 局所 | 未確認 | 不要: 既存の担当箇所で直接修正。`null` 返却を廃し、UI 通知関数を呼び出す。 |

## 欠陥 family の最終状態
| 修正単位 | 守る契約 | 完了対象の全不変条件 | 変更後の責務と参照元 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|----------|------------|----------------------|--------------------|--------------------|--------------------------|----------------|
| `image-download-logic` | 共通ロジックの集約 (DRY) | ダウンロード $\rightarrow$ 保存 $\rightarrow$ `TaskAttachment` 生成のフローが共通化されていること | `src/features/tasks/attachments.ts` (共通関数提供) | `addTask` / `resolveTaskContent` $\rightarrow$ `downloadImageAsAttachment` $\rightarrow$ terminal | 正常な画像URLでの成功、非画像URLでの拒否 | `src/features/pipeline/steps.ts` および `src/features/tasks/add/index.ts` 内の重複実装を削除 |
| `gitlab-support` | プロバイダー機能整合性 | GitLab MR の画像が正しく抽出・保存されること | `src/infra/gitlab/pr.ts` (保存フロー呼び出し) | `fetchMrReviewComments` $\rightarrow$ `downloadImageAsAttachment` $\rightarrow$ 保存 | GitLab ドメインの有効な画像URLでの成功 | なし |
| `image-lifecycle` | リソース管理規約 | 一時ファイルが衝突せず、確実に消去されること | `src/features/tasks/attachments.ts` (ユニークパス管理) | `downloadImageAsAttachment` $\rightarrow$ ユニークパス作成 $\rightarrow$ `promoteTaskAttachments` $\rightarrow$ `unlink` | 並行実行時の衝突回避、例外発生時の削除成功 | `/tmp/image-n.png` の固定パス指定箇所を削除 |
| `image-io-performance` | パフォーマンス要件 | I/O がメインスレッドをブロッキングしないこと | `src/features/tasks/attachments.ts` (非同期 I/O) | `saveImageAttachments` $\rightarrow$ `fs.promises.copyFile` $\rightarrow$ terminal | 10MB の大容量ファイル保存時の非ブロッキング | `fs.writeFileSync` / `fs.copyFileSync` などの同期 API 呼び出しを削除 |
| `image-download-observability` | 運用監視要件 | 失敗原因が適切に通知されること | `src/features/pipeline/steps.ts` (エラー通知) | `resolveTaskContent` $\rightarrow$ `catch` $\rightarrow$ `ui.warn` $\rightarrow$ terminal | ネットワークエラー時の詳細通知、404 エラー時の通知 | `null` を返してフィルタリングする処理を削除 |

## 要求シナリオ（条件付き）

Scenario: [SCN-image-lifecycle-P1] ユニークな一時ファイル名の生成と削除
  Given 複数の画像ダウンロードが同時に開始される状況
  When 画像を保存する
  Then 各画像が `os.tmpdir()` 内に異なるランダムなファイル名で保存され、コピー後にすべて削除される

Scenario: [SCN-image-lifecycle-N1] 例外発生時の確実な削除
  Given 画像の保存中にディスクフル等の I/O エラーが発生する状況
  When 画像を保存する
  Then `finally` ブロックにより、作成途中のユニーク一時ファイルが確実に削除される

## 入力・状態・経路の確認表
| 修正単位 | 軸の正本・根拠 | 具体的な入力・状態 | 入口・経路 | 実装上の制約 | consumer / terminal | 期待結果 | 反証方法・テスト ID |
|----------|----------------|--------------------|------------|----------------|---------------------|----------|-----------------------|
| `gitlab-support` | `src/infra/github/image-downloader.ts:19` | GitLab 画像 URL (`https://gitlab.com/...`) | 現行: `fetchMrReviewComments` $\rightarrow$ (保存なし) $\rightarrow$ imagesリスト / 修正後: `fetchMrReviewComments` $\rightarrow$ `downloadImageAsAttachment` $\rightarrow$ 保存 | `validateAndDownloadImage` の `startsWith` チェックが GitHub 限定である | 保存されたファイルシステム | 保存成功 | GitLab URL を渡し、`/tmp` またはタスクディレクトリに保存されるか確認 |
| `image-lifecycle` | リソース管理規約 | 並行実行 (2つ以上のプロセス/スレッド) | 現行: `resolveTaskContent` $\rightarrow$ `/tmp/image-1.png` $\rightarrow$ 衝突 / 修正後: `downloadImageAsAttachment` $\rightarrow$ `os.tmpdir()` + UUID $\rightarrow$ 成功 | 固定文字列 `/tmp/image-n.png` の使用 | `/tmp` ディレクトリの内容 | ファイル名の衝突が発生せず、処理後にファイル数が 0 に戻ること | 2つの画像を同時に保存し、ファイル名が異なること、および完了後に `/tmp` に残っていないことを確認 |
| `image-io-performance` | パフォーマンス要件 | 大容量ファイル (10MB) | 現行: `saveImageAttachments` $\rightarrow$ `fs.copyFileSync` (同期) $\rightarrow$ ブロック / 修正後: `saveImageAttachments` $\rightarrow$ `await fs.promises.copyFile` (非同期) $\rightarrow$ 非ブロック | `fs` モジュールの同期メソッドの使用 | イベントループのラグ | 実行中に他の非同期タスクが処理され続けること | 重い I/O 中に `setInterval` 等のタイマーが正確に動作し続けるか確認 |
| `image-download-observability` | 運用監視要件 | 不正な URL (404 / タイムアウト) | 現行: `resolveTaskContent` $\rightarrow$ `catch` $\rightarrow$ `return null` $\rightarrow$ 無視 / 修正後: `resolveTaskContent` $\rightarrow$ `catch` $\rightarrow$ `ui.warn` $\rightarrow$ 通知 | `null` によるエラー情報の破棄 | 標準出力 / UI ログ | 「Failed to download image [URL]: [Reason]」の形式で警告が表示されること | 不正な URL を指定し、ログに原因が出力され、`null` で静かに消えないことを確認 |

## 実施順序
| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|------|----------|------|--------|----------|----------------|
| 1 | `image-download-logic` | 境界変更 | なし | `src/features/tasks/attachments.ts` | `downloadImageAsAttachment` 関数が実装され、非同期 I/O を使用していること |
| 2 | `image-lifecycle` | 局所修正 | 1 | `src/features/tasks/attachments.ts` | ユニークパス生成と `finally` での削除が実装されていること |
| 3 | `image-io-performance` | 局所修正 | 1 | `src/features/tasks/attachments.ts` | `saveImageAttachments` 内の全 `fs` 呼び出しが `fs.promises` に置換されていること |
| 4 | `gitlab-support` | 境界変更 | 1 | `src/infra/github/image-downloader.ts`, `src/infra/gitlab/pr.ts` | GitLab URL がバリデーションを通過し、共通関数経由で保存されること |
| 5 | `image-download-observability` | 局所修正 | 1 | `src/features/pipeline/steps.ts` | 共通関数の `catch` 時、または呼び出し側で `ui.warn` が適切に実行されること |

## 制約適合性
| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 |
|----------|--------------|--------------------------|-----------------------------|----------|
| `image-download-logic` | DRY 原則 | 共通関数を `attachments.ts` に配置し、全入口から利用。個別のリファクタリング案より責任所在が明確なため採用。 | `addTask` と `resolveTaskContent` のコード照合 | 同一ロジックを単一箇所に集約 |
| `image-lifecycle` | リソース管理規約 | `os.tmpdir()` + UUID。固定パス案は衝突するため却下。 | `/tmp` 内のファイル名の一意性と削除確認 | 衝突の排除とリークの防止 |
| `image-io-performance` | パフォーマンス要件 | `fs.promises` API への移行。同期 API はメインスレッドを止めるため却下。 | I/O 実行中のイベントループ応答性確認 | Node.js 非同期 I/O ベストプラクティスの適用 |
| `gitlab-support` | 機能整合性 | `validateAndDownloadImage` の URL チェックを汎用化。GitHub 内部実装への直接依存を排除。 | GitLab MR 画像の保存成功確認 | プロバイダー非依存の保存基盤の構築 |
| `image-download-observability` | 運用監視要件 | `null` フィルタリングを廃止し、UI 通知を導入。 | エラー時のログ出力内容の確認 | 原因特定に必要な情報の保持と通知 |

## 再計画事項
- なし