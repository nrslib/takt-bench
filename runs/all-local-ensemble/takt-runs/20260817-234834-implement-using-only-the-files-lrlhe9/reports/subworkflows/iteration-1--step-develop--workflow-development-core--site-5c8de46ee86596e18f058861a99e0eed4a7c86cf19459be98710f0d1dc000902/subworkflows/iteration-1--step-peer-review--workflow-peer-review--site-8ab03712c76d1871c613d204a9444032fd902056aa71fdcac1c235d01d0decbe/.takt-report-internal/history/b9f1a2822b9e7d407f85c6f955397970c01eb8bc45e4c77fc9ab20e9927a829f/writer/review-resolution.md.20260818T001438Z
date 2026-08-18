# レビュー指摘裁定

## 結果: 修正対象あり

## 裁定サマリー
対象レポート: peer-review ワークフローの `initial-reviewers` が提出した5件（coding-review / architecture-review / security-review / testing-review / ai-antipattern-review）。うち finding を提出したのは testing-review の1件（TEST-001）。修正対象 family 数: 1（`attachment-propagation`）。非修正対象数: 0。裁定根拠は実コード・実テスト・実装証跡の突合に基づく。TEST-001 は `takt add --pr` 経路（一次入口）での添付伝播が単体テスト未カバーである点で `order.md` の品質要件「新規ロジックには単体テストを追加する」への直接違反と判定し `actionable` とした。機能自体は `src/features/tasks/add/index.ts` の配線により成立しており、配線の作り直しではなくテスト追加が最小修正となる。

## 要件の判定根拠
| 対象 | 状態 | 根拠 |
|------|------|------|
| PR コメント内の画像 URL 検出（PR-IMG-1） | 充足 | `src/infra/git/imageExtraction.ts:31` の `extractImageUrls`、`src/infra/github/imageDownload.ts:105` の全本文走査。実装レポートに `imageExtraction.test.ts` 11件成功と記録 |
| 画像ダウンロード（PR-IMG-2） | 充足 | `src/infra/github/imageDownload.ts:62` の `downloadImage`（`gh api` 経由）。実装レポートに `imageDownload.test.ts` 9件成功と記録 |
| attachments 保存（PR-IMG-3） | 充足 | `downloadPrImages` が `StoredImageAttachment[]` を返し、`src/features/tasks/attachments.ts:88` の `promoteTaskAttachments` が `attachments/` へコピー。pipeline 経路は `pipelineExecution.test.ts:1554` で検証 |
| order.md 追記（PR-IMG-4） | 充足 | `src/features/tasks/attachments.ts:35` の `buildTaskOrderContent` が既存形式で追記。実装レポートに既存 `imageAttachmentReferences.test.ts` 成功と記録 |
| 本文の画像参照置換（PR-IMG-5） | 充足 | `src/infra/git/imageExtraction.ts:57` の `replaceImageReferences`、`src/infra/github/imageDownload.ts:128-130` で全本文に適用。実装レポートに 11件成功と記録 |
| pipeline `--pr` 経路の画像参照（PR-IMG-6） | 充足 | `src/features/pipeline/steps.ts:228` で `downloadPrImages` 呼び出し、`steps.ts:360-372` で attachment 付き taskSpec を組み立て。`pipelineExecution.test.ts:1554` で `executeTask` への taskSpec 伝播を検証 |
| 形式検証（PR-IMG-7） | 充足 | `src/infra/github/imageDownload.ts:38-60` の `detectImageFormat` が PNG/JPEG/GIF/WebP を magic bytes 判定。実装レポートに9件成功と記録 |
| Content-Type 検証（PR-IMG-8） | 未確認 | 実装レポートに「Content-Type ヘッダ検証は未実装」と記録。ただし reviewer が finding 化しておらず、裁定対象外の観察として留保 |
| サイズ上限（PR-IMG-9） | 充足 | `src/infra/github/imageDownload.ts:18,115-117` の `MAX_IMAGE_BYTES`（10MB）超過拒否。実装レポートにテスト成功と記録 |
| `gh api` 経由の取得（PR-IMG-10） | 充足 | `src/infra/github/imageDownload.ts:62-68` の `execFileSync('gh', ['api', url])`。`imageDownload.test.ts` でモック確認 |
| 外部 URL の無制限取得防止（PR-IMG-11） | 充足 | `src/infra/github/imageDownload.ts:34-36` の `isGitHubAttachmentUrl` が GitHub attachment URL のみ許可。`imageDownload.test.ts` で外部 URL・非 https URL 拒否を確認 |
| `takt add --pr` 経路の添付伝播テスト（TEST-001） | 未充足 | `src/__tests__/addTask.test.ts:9` の `mockDownloadPrImages` が常に `attachments: []` を返し、非空 attachments の保存・配置伝播を検証するテストが存在しない。機能配線（`add/index.ts:199,214-218`）は成立済みだが、`order.md` の「新規ロジックには単体テストを追加する」を満たしていない |

## 再発台帳の引き継ぎ
引き継ぎ元: 先行 remediation なし（Report Directory 直下に `subworkflows/iteration-N--step-remediation--*` の `fix-verification.md` が0件。`review-resolution.md` も未生成のため台帳は白紙で開始）

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|----------|-----------|------------------|----------|------------------|------------------|----------|----------|------------------------|-------------------------|--------------------|------------|--------------|
| なし（白紙開始） | — | — | — | — | — | — | — | — | — | — | — | 完全 |

## 修正対象 family
| family | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | finding ID / 出典 | 修正権限の根拠 | 根拠 | 問題 → 根本原因 | 追加した経路 | 関係する契約経路 | 受入条件 | 修正境界 |
|--------|----------|----------------------|--------------------------|-------------------|----------------|------|-------------------|--------------|--------------------|----------|----------|
| `attachment-propagation` | `src/features/tasks/add/index.ts` の `addTask --pr` 経路（`downloadPrImages` の戻りを `saveTaskFile` へ渡す配線） | `takt add --pr <number>` 実行時に抽出した画像が attachments として保存・配置され、`order.md` に `[Image #N]` 参照と `## 添付画像` が追記される | PR コメント内の画像をタスク添付ファイルとして扱う一連の機能（抽出→検証→保存→参照）が同じ変更理由で変わるため | TEST-001 / `testing-review.md` | 受入条件の直接違反（`direct_acceptance_criterion_violation`） | `src/__tests__/addTask.test.ts:9` のモックが常に空 attachments を返す。`add/index.ts:199,214-218` は非空 attachments を `saveTaskFile` → `prepareTaskSpecDirectory`（`attachments.ts:266`）→ `buildTaskOrderContent`＋`promoteTaskAttachments`（`attachments.ts:88`）へ配線済み | 一次入口 `takt add --pr` の添付伝播が単体テスト未カバー。機能は配線済みだが、モックが空を返すため伝播の観測可能な検証が欠落 | なし | 定義・生成: `downloadPrImages`（`imageDownload.ts:84`）→ 永続化・配置: `saveTaskFile`（`add/index.ts:214`）→ `prepareTaskSpecDirectory` → `promoteTaskAttachments`（`attachments.ts:88`）→ 出力: `buildTaskOrderContent` による `order.md` 追記（`attachments.ts:35`）。pipeline 経路は `steps.ts:228,360-372` | `addTask.test.ts` に、`downloadPrImages` が非空 attachments（実在の一時画像ファイル）を返すケースを追加し、(1) `saveTaskFile` へ attachments が渡ること、(2) `.takt/tasks/<slug>/attachments/` へコピーされること、(3) `order.md` に `[Image #1]` 参照と `## 添付画像` が追記されることを検証する | 配線の作り直し・新規外部契約の追加・pipeline 経路（既に `pipelineExecution.test.ts:1554` で検証済み）への再変更は不要。`addTask.test.ts` へのテスト追加のみ |

## 指摘ごとの裁定
| finding ID / 出典 | 技術的妥当性 | 裁定 | 対象 family | 同じ原因で変更される理由 | 合流根拠 | authorization basis | 初回に含まれなかった理由 | 根拠 |
|-------------------|----------------|------|-------------|--------------------------|----------|---------------------|--------------------------|------|
| TEST-001 / `testing-review.md` | 確認済み | actionable | `attachment-propagation` | 一次入口 `takt add --pr` の添付伝播を同じ不変条件（保存・配置・order.md 追記）で検証するため | 同一不変条件・同一担当箇所を共有する唯一の指摘のため新規 family として採用 | 受入条件の直接違反 | 該当なし（initial レビュー） | `src/__tests__/addTask.test.ts:9` のモックが常に `attachments: []` を返すことを確認。`add/index.ts:199,214-218` の配線は成立しており機能欠陥ではなくテスト欠落。`order.md` 品質要件「新規ロジックには単体テストを追加する」への直接違反 |

## 未解決の前提
- Content-Type ヘッダ検証（実装レポートの `PR-IMG-8`）が未実装であることは観測済みだが、reviewer の finding として提出されていないため裁定対象外とした。これは本ステップの探索権限外の観察であり、修正対象には含めない。
- coding-review の「ベースと HEAD が同一で差分なし」という観察は、変更が未コミット（working tree のみ）であるため。実差分は `git diff 91d9d4315d7b` で確認でき、変更対象11ファイルのうち7ファイルがステージ外変更、4ファイルが未追跡（`imageDownload.test.ts` / `imageExtraction.test.ts` / `imageExtraction.ts` / `imageDownload.ts`）。これはスコープの観察であり finding ではない。