最新のレビューレポートおよび既存の裁定履歴を照合し、修正対象を確定します。

## 再発台帳の引き継ぎ
引き継ぎ元: `/Users/nrs/work/git/takt-worktrees/20260816T1259-pr-komento-no-wodaunroodoshite-63afbc7c5a3af08c/.takt/runs/20260816-125940-implement-using-only-the-files-8svc52/reports/subworkflows/iteration-1--step-develop--workflow-development-core--site-5c8de46ee86596e18f058861a99e0eed4a7c86cf19459be98710f0d1dc000902/subworkflows/iteration-1--step-peer-review--workflow-peer-review--site-8ab03712c76d1871c613d204a9444032fd902056aa71fdcac1c235d01d0decbe/subworkflows/iteration-1--step-remediation--workflow-development-remediation-dynamic--site-65bb1aaf70bbdd8893b8ef5f19670e7c92b19b03a156b308045bc8808559b892/fix-verification.md`

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|----------|-----------|------------------|---------------------|----------------------------|------------------------------|----------|----------|------------------------|-------------------------|-----------|------------|--------------|
| `image-download-logic` | `image-download-logic` | 画像のダウンロードから `TaskAttachment` 生成までのフローが統一されていること | `src/features/tasks/attachments.ts` | 0 | なし | なし | 共通関数経由でのダウンロード→保存→TaskAttachment生成フロー | 判定できない（初回） | 0 | 未確認 | `src/features/tasks/attachments.ts` に `downloadImageAsAttachment` 等の共通関数を定義し、全入口からこの関数のみを呼び出す。 | 完全 |
| `gitlab-support` | `gitlab-support` | GitLab MR の画像も整合的に抽出・保存されること | `src/infra/gitlab/pr.ts` | 0 | なし | なし | `fetchMrReviewComments` $\rightarrow$ `downloadImageAsAttachment` $\rightarrow$ 保存 フロー | 判定できない（初回） | 0 | 未確認 | バリデーションをプロバイダー非依存に拡張し、GitLab プロバイダーから共通保存関数を呼び出す。 | 完全 |
| `image-lifecycle` | `image-lifecycle` | 一時ファイルは一意に生成され、処理後に確実に消去されること | `src/features/pipeline/steps.ts` | 0 | なし | なし | ユニークパス作成→`promoteTaskAttachments`→`unlink` フロー | 判定できない（初回） | 0 | 未確認 | `os.tmpdir()` と UUID 等を用いた一意なパス生成および `finally` ブロックでの `fs.unlink` 実装。 | 完全 |
| `image-io-performance` | `image-io-performance` | 大容量ファイルの I/O がイベントループをブロッキングしないこと | `src/features/tasks/attachments.ts` | 0 | なし | なし | `fs.promises.copyFile` $\rightarrow$ terminal フロー | 判定できない（初回） | 0 | 未確認 | `fs.promises` API への完全な移行（`writeFileSync` $\rightarrow$ `writeFile` 等）。 | 完全 |
| `image-download-observability` | `image-download-observability` | 画像ダウンロード失敗時に、原因を特定可能なエラーまたは警告がユーザーに通知されること | `src/features/pipeline/steps.ts` | 0 | なし | なし | `resolveTaskContent` $\rightarrow$ `catch` $\rightarrow$ `ui.warn` $\rightarrow$ terminal フロー | 判定できない（初回） | 0 | 未確認 | 不要: 既存の担当箇所で直接修正。`null` 返却を廃し、UI 通知関数を呼び出す。 | 完全 |

## 修正対象 family
| family | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | finding ID / 出典 | 修正権限の根拠 | 根拠 | 問題 → 根本原因 | 受入条件 | 修正境界 |
|--------|----------|----------------------|--------------------------|-------------------|----------------|------|-------------------|----------|----------|
| `image-attachment-persistence` | `src/features/tasks/attachments.ts` | ダウンロードされた画像はタスクディレクトリに保存され、`order.md` に記載されること | 画像の自動収集機能の実装 | CODE-NEW-attachments-save | 受入条件の直接違反 | `saveImageAttachments` が定義されているが呼び出し箇所がない | 機能未完：ダウンロード後に保存・追記処理が実行されないため | `takt add --pr` 等の実行時に、画像が `.takt/tasks/<slug>/attachments/` に保存され `order.md` に追記されること | `saveImageAttachments` の呼び出し経路の追加。保存ロジック自体の変更は除外。 |
| `pr-image-attachment-test` | `src/infra/github/image-downloader.ts` 等 | 新規導入ロジック（抽出・検証・保存）が単体テストで担保されていること | 品質要件（単体テスト追加）の充足 | TEST-NEW-01 | 受入条件の直接違反 | `src/__tests__/` に新規機能のテストが存在しない | テスト欠落：セキュリティ制約や境界値が未検証であるため | `extractImageUrls`, `validateAndDownloadImage`, `saveImageAttachments` に対する単体テストが実装され、成功すること | 新規機能に関連する単体テストの作成。既存テストの修正は除外。 |

## 指摘ごとの裁定
| finding ID / 出典 | 技術的妥当性 | 裁定 | 対象 family | 根拠 |
|-------------------|----------------|------|-------------|------|
| ai-redundant-branch-overrides | 確認済み | `out_of_scope` | - | 単なるコーディングスタイルの改善であり、不変条件の違反ではないため |
| ai-callback-capture-like | 確認済み | `out_of_scope` | - | テスト容易性の向上提案であり、現状の受入条件を直接的に阻害していないため |
| ARCH-NEW-attachments-L34 | 確認済み | `duplicate` | `image-lifecycle` | 既に `image-lifecycle` family で一時ファイルの削除漏れとして裁定済み |
| ARCH-NEW-logic-dup | 確認済み | `duplicate` | `image-download-logic` | 既に `image-download-logic` family で重複実装として裁定済み |
| CODE-NEW-attachments-save | 確認済み | `actionable` | `image-attachment-persistence` | 機能未完であり、受入条件（保存と order.md 追記）に直接違反しているため |
| TEST-NEW-01 | 確認済み | `actionable` | `pr-image-attachment-test` | 品質要件で明示された単体テストが完全に欠落しているため |

## 結論
修正対象あり（`image-attachment-persistence`, `pr-image-attachment-test`）