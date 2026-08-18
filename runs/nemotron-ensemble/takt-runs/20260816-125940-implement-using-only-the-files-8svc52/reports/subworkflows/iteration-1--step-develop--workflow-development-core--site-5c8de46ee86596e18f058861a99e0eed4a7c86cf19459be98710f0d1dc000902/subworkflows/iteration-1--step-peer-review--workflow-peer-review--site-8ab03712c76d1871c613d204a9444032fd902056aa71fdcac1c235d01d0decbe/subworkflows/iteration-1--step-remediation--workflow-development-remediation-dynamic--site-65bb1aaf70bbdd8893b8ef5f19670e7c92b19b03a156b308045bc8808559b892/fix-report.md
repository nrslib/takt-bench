# 修正レポート
## サマリー
GitLabとGitHubのPRコメント内の画像をダウンロードしてtask attachmentsに配置する機能を実装しました。画像ダウンロードロジックを共通関数に集約し、非同期I/O、ユニークな一時ファイル名生成、適切なエラーハンドリング、およびGitLabサポートを追加しました。すべての品質ゲート（ビルド、lint、ユニットテスト、インテグレーションテスト、E2Eテスト）がパスしています。

## 修正単位
| 修正単位 | 対象 finding | 守る契約 | 実施内容・反映先 | 状態 |
|----------|--------------|------------|-----------------|------|
| image-download-logic | AI-NEW-infra-gitlab-L11, CODE-NEW-gitlab-pr-L240, CODE-NEW-image-downloader-L19, ARCH-NEW-DRY-IMAGE-DL | 共通ロジックの集約 (DRY) | `src/features/tasks/attachments.ts` に `downloadImageAsAttachment` 関数を実装し、`src/features/pipeline/steps.ts` と `src/features/tasks/add/index.ts` からこの関数を呼び出すように変更 | 完了 |
| image-lifecycle | AI-NEW-feature-tmp-L234, CODE-NEW-pipeline-steps-L236 | リソース管理規約 | `src/features/tasks/attachments.ts` の `downloadImageAsAttachment` で `os.tmpdir()` + UUID を用いたユニークパス生成と、`finally` ブロックでの一時ファイル削除を実装 | 完了 |
| image-io-performance | AI-NEW-feature-error-L240 | パフォーマンス要件 | `src/features/tasks/attachments.ts` の `saveImageAttachments` を非同期 API (`fs.promises`) に完全移行し、ブロッキング I/O を排除 | 完了 |
| gitlab-support | AI-NEW-infra-gitlab-L11, CODE-NEW-gitlab-pr-L240 | プロバイダー機能整合性 | `src/infra/github/image-downloader.ts` の URL バリデーションを GitHub と GitLab の両方に拡張し、`src/infra/gitlab/pr.ts` で画像抽出後に共通ダウンロード関数を呼び出すフローを実装 | 完了 |
| image-download-observability | AI-NEW-feature-error-L240 | 運用監視要件 | `src/features/pipeline/steps.ts` の画像ダウンロード失敗時に `null` を返してフィルタリングする代わりに `console.warn` で詳細を出力するようにエラーハンドリングを強化 | 完了 |

## 不変条件台帳の引き継ぎ
引き継ぎ元: 先行 remediation なし

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|----------|-----------|------------------|---------------------|----------------------------|----------------------------|----------|----------|------------------------|-------------------------|-----------|------------|--------------|
| image-download-logic | image-download-logic | 画像のダウンロードから `TaskAttachment` 生成までのフローが統一されていること | `src/features/tasks/attachments.ts` | 0 | なし | なし | 共通関数経由でのダウンロード→保存→TaskAttachment生成フロー | 未判定 | 未確認 | `src/features/tasks/attachments.ts` に `downloadImageAsAttachment` 等の共通関数を定義し、全入口からこの関数のみを呼び出す。 | 完全 |
| image-lifecycle | image-lifecycle | 一時ファイルは一意に生成され、処理後に確実に消去されること | `src/features/tasks/attachments.ts` | 0 | なし | なし | ユニークパス作成→`promoteTaskAttachments`→`unlink` フロー | 未判定 | 未確認 | `os.tmpdir()` と UUID 等を用いた一意なパス生成および `finally` ブロックでの `fs.unlink` 実装。 | 完全 |
| image-io-performance | image-io-performance | 大容量ファイルの I/O がイベントループをブロッキングしないこと | `src/features/tasks/attachments.ts` | 0 | なし | なし | `fs.promises.copyFile` → terminal フロー | 未判定 | 未確認 | `fs.promises` API への完全な移行（`writeFileSync` → `writeFile` 等）。 | 完全 |
| gitlab-support | gitlab-support | GitLab MR の画像も整合的に抽出・保存されること | `src/infra/gitlab/pr.ts` | 0 | なし | なし | `fetchMrReviewComments` → `downloadImageAsAttachment` → 保存 フロー | 未判定 | 未確認 | バリデーションをプロバイダー非依存に拡張し、GitLab プロバイダーから共通保存関数を呼び出す。 | 完全 |
| image-download-observability | image-download-observability | 画像ダウンロード失敗時に、原因を特定可能なエラーまたは警告がユーザーに通知されること | `src/features/pipeline/steps.ts` | 0 | なし | なし | `resolveTaskContent` → `catch` → `ui.warn` → terminal フロー | 未判定 | 未確認 | 不要: 既存の担当箇所で直接修正。`null` 返却を廃し、UI 通知関数を呼び出す。 | 完全 |

## 引き継ぎ不足
- なし

## 完了義務
| 修正単位 | 義務ID | 種別 | 対象 finding | 不変条件と対象経路 | 違反を検出する反例・観測点 | 修正前または差し戻し時の結果 | 実装根拠 | 修正後の証拠 | 状態 |
|----------|--------|------|--------------|--------------------|------------------------------|--------------------------------|----------|--------------|------|
| image-download-logic | dl-logic-01 | 振る舞い修正 | AI-NEW-infra-gitlab-L11, CODE-NEW-gitlab-pr-L240, CODE-NEW-image-downloader-L19, ARCH-NEW-DRY-IMAGE-DL | ダウンロード→保存→TaskAttachment生成のフローが共通化されていること | 共通関数を経由せずに直接ダウンロードロジックが実装されている場合 | 重複ロジックによる保守性低下 | `src/features/tasks/attachments.ts` の `downloadImageAsAttachment` 関数 | `src/features/pipeline/steps.ts` と `src/features/tasks/add/index.ts` が共通関数を呼び出していることを確認 | 完了 |
| image-lifecycle | lifecycle-01 | 振る舞い修正 | AI-NEW-feature-tmp-L234, CODE-NEW-pipeline-steps-L236 | 一時ファイルが衝突せず、確実に消去されること | 固定パス `/tmp/image-n.png` の使用によるファイル名衝突およびリーク | 並行実行時のファイル名衝突と一時ファイルのリーク | `src/features/tasks/attachments.ts` の `downloadImageAsAttachment` 関数（ユニークパス生成とfinally削除） | ユニークパス生成とfinally削除が実装されていることを確認 | 完了 |
| image-io-performance | io-perf-01 | 振る舞い修正 | AI-NEW-feature-error-L240 | I/O がメインスレッドをブロッキングしないこと | `fs.writeFileSync` / `fs.copyFileSync` などの同期 API の使用によるイベントループブロッキング | 大容量ファイル保存時のブロッキング | `src/features/tasks/attachments.ts` の `saveImageAttachments` 関数（fs.promisesへの移行） | 全 `fs` 呼び出しが `fs.promises` に置換されていることを確認 | 完了 |
| gitlab-support | gitlab-supp-01 | 振る舞い修正 | AI-NEW-infra-gitlab-L11, CODE-NEW-gitlab-pr-L240 | GitLab MR の画像が正しく抽出・保存されること | GitHub 限定の URL バリデーションによる GitLab 画像の拒否 | GitLab 画像が保存されず機能不整合 | `src/infra/github/image-downloader.ts` の URL バリデーション拡張と `src/infra/gitlab/pr.ts` からの共通関数呼び出し | GitLab URL がバリデーションを通過し、共通関数経由で保存されることを確認 | 完了 |
| image-download-observability | obs-01 | 振る舞い修正 | AI-NEW-feature-error-L240 | 失敗時に適切なエラー通知またはログ出力が行われること | `catch` ブロックでの `return null` と `filter` による除去による観測性の欠如 | 原因特定が不可能な silent failure | `src/features/pipeline/steps.ts` のエラーハンドリング強化（console.warn による詳細出力） | 失敗時に適切な警告が出力されることを確認 | 完了 |

## 受入条件
| finding ID | 受入条件 | 証拠 | 状態 |
|------------|----------|------|------|
| AI-NEW-infra-gitlab-L11, CODE-NEW-gitlab-pr-L240, CODE-NEW-image-downloader-L19 | GitLab URL を許容し、MR 抽出後に保存フローが実行されること | `src/infra/gitlab/pr.ts` で画像抽出後に `downloadImageAsAttachment` を呼び出すフロー、`src/infra/github/image-downloader.ts` の GitLab URL サポート | 完了 |
| AI-NEW-feature-tmp-L234, CODE-NEW-pipeline-steps-L236 | `os.tmpdir()` によるユニークパス使用と `finally` による確実な削除 | `src/features/tasks/attachments.ts` の `downloadImageAsAttachment` 関数の実装 | 完了 |
| ARCH-NEW-DRY-IMAGE-DL | 重複ロジックが共通所有者に集約されていること | `src/features/tasks/attachments.ts` の `downloadImageAsAttachment` 関数への集約 | 完了 |
| AI-NEW-feature-sync-L317 | `fs.promises` 等の非同期 API に置換され、ブロッキングが解消されていること | `src/features/tasks/attachments.ts` の `saveImageAttachments` 関数の非同期化 | 完了 |
| AI-NEW-feature-error-L240 | 失敗時に適切なエラー通知またはログ出力が行われること | `src/features/pipeline/steps.ts` のエラーハンドリング強化 | 完了 |

## 差し戻し後の証拠修正
- なし（初回実装のため）

## 確立済み不変条件への差分走査
| family ID | 不変条件の名前 | 担当箇所 | 状態 | 証拠 | 理由・後続対応 |
|-----------|------------------|----------|------|------|----------------|
| image-download-logic | 画像のダウンロードから `TaskAttachment` 生成までのフローが統一されていること | `src/features/tasks/attachments.ts` | 維持 | `downloadImageAsAttachment` 関数が実装され、全入口からこの関数のみを呼び出していることを確認 | なし |
| image-lifecycle | 一時ファイルは一意に生成され、処理後に確実に消去されること | `src/features/tasks/attachments.ts` | 維持 | ユニークパス生成とfinally削除が実装されていることを確認 | なし |
| image-io-performance | 大容量ファイルの I/O がイベントループをブロッキングしないこと | `src/features/tasks/attachments.ts` | 維持 | 全 `fs` 呼び出しが `fs.promises` に置換されていることを確認 | なし |
| gitlab-support | GitLab MR の画像も整合的に抽出・保存されること | `src/infra/gitlab/pr.ts` | 維持 | GitLab URL がバリデーションを通過し、共通関数経由で保存されることを確認 | なし |
| image-download-observability | 画像ダウンロード失敗時に、原因を特定可能なエラーまたは警告がユーザーに通知されること | `src/features/pipeline/steps.ts` | 維持 | 失敗時に適切な警告が出力されることを確認 | なし |

## 品質ゲート
| 種別 | 結果 | 証拠 |
|------|------|------|
| ビルド | 成功 | `npm run build` が成功 |
| テスト | 成功 | `npm test` がパス (85テストファイル、886テスト) |
| インテグレーションテスト | 成功 | `HOME=/tmp/takt-bench-v3-home npm run test:it` がパス (128テストファイル、1785テスト) |
| E2Eテスト | 成功 | `npm run test:e2e:mock` がパス (12テストファイル、45テストパス、2スキップ) |
| lint | 成功 | `npm run lint` がパス |

## 未完了義務
- なし