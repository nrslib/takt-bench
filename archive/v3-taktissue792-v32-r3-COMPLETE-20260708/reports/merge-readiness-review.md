# Merge Readiness Review

## 結果: APPROVE

## サマリー
PR コメント内画像を task attachments として扱う変更は、`add --pr`、interactive `--pr`、pipeline `--pr` の主要入口に配線され、保存・表示・実行時参照・cleanup まで確認できました。ledger 上の open finding はなく、マージを止める品質・保守性のブロッカーは検出していません。

## 保守前提のマージ品質チェック
| # | 観点 | 状態 | 根拠（ファイル:行 / テスト / 実行証跡） | コメント |
|---|------|------|---------------------------------------|----------|
| 1 | 要求充足 | 充足 | `src/features/tasks/prReviewImageAttachments.ts:69`, `src/features/tasks/add/index.ts:202`, `src/features/pipeline/steps.ts:153` | PR body/comments/reviews から画像を抽出し、各 `--pr` 経路へ接続済み |
| 2 | 既存契約・既存フローへの影響 | 問題なし | `src/infra/git/types.ts:114`, `src/infra/github/GitHubProvider.ts:35`, `src/infra/gitlab/GitLabProvider.ts:35` | GitProvider capability として追加され、GitHub/GitLab 実装・mock 群も更新済み |
| 3 | テスト・検証 | 十分 | `npm run build` 成功、`npm run lint` 成功、2回目の `npm test` 成功 | 1回目の `npm test` は `workflowLoader.test.ts:925` timeout、単体再実行と2回目フル実行は成功 |
| 4 | 要求外変更・スコープクリープ | 問題なし | `git diff --stat`, `src/features/tasks/prReviewImageAttachments.ts`, `src/infra/github/attachmentDownloads.ts` | 変更は PR 画像 attachment、MIME 判定、各入口配線、関連テストに収まる |
| 5 | 保守可能性・将来変更容易性 | 問題なし | `src/shared/utils/imageMime.ts:1`, `src/infra/github/attachmentDownloads.ts:194`, `src/features/tasks/prReviewImageAttachments.ts:157` | MIME 判定、GitHub 取得、PR review 変換が分離されている |
| 6 | 明白なセキュリティ・データ保護・運用リスク | 問題なし | `src/infra/github/attachmentDownloads.ts:44`, `src/infra/github/attachmentDownloads.ts:61`, `src/infra/github/attachmentDownloads.ts:197`, `src/__tests__/githubAttachmentDownloads.test.ts:103` | allowlist、redirect 検証、Content-Type/magic bytes、サイズ上限、timeout、URL sanitization を確認 |

## 横断監査証跡
| # | 変更カテゴリ | 抽出した項目 | 確認した検索語・ファイル | 判定 | コメント |
|---|--------------|--------------|--------------------------|------|----------|
| 1 | 型 / adapter | `GitProvider.isSupportedPrImageAttachmentUrl`, `downloadPrImageAttachment`, `PrImageAttachmentDownload` | `isSupportedPrImageAttachmentUrl`, `downloadPrImageAttachment` / `src/infra/git/types.ts:125`, `src/infra/github/GitHubProvider.ts:35`, `src/infra/gitlab/GitLabProvider.ts:35` | 問題なし | provider 実装・test double の更新を確認 |
| 2 | helper / 出力契約 | `[Image #n]`, `TaskAttachment[]`, `image-1.png`, `## 添付画像` | `resolvePrReviewImageAttachments`, `prepareTaskSpecDirectory`, `buildTaskOrderContent` / `src/features/tasks/prReviewImageAttachments.ts:139`, `src/features/tasks/attachments.ts:26` | 問題なし | 既存 attachment 保存契約を再利用 |
| 3 | entrypoint / 実行経路 | `add --pr`, interactive `--pr`, pipeline `--pr` | `resolvePrInput`, `resolveTaskContent`, `runWorkflow`, `cleanupAttachments` / `src/app/cli/routing-inputs.ts:60`, `src/app/cli/routing.ts:111`, `src/features/pipeline/steps.ts:180`, `src/features/pipeline/execute.ts:90` | 問題なし | 成功・失敗・cleanup 経路を確認 |
| 4 | 検証 / 安全境界 | PNG/JPEG/GIF/WebP、Content-Type、magic bytes、max bytes、redirect、timeout | `MAX_IMAGE_ATTACHMENT_BYTES`, `assertImageMimeMatchesBytes`, `buildRedirectedGitHubAttachmentRequest` / `src/shared/utils/imageMime.ts:1`, `src/infra/github/attachmentDownloads.ts:61` | 問題なし | 関連単体テストあり |

## 要求照合
| # | 要求（タスクから抽出） | 状態 | 根拠（ファイル:行） | コメント |
|---|-------------------|------|-------------------|----------|
| 1 | `takt add --pr` で PR 本文・通常コメント・review thread コメント内の画像 URL を検出 | 充足 | `src/features/tasks/prReviewImageAttachments.ts:69`, `src/__tests__/prReviewImageAttachments.test.ts:31` | body/comments/reviews を走査 |
| 2 | 対応画像をローカルにダウンロード | 充足 | `src/infra/github/attachmentDownloads.ts:194`, `src/__tests__/githubAttachmentDownloads.test.ts:70` | gh token 経由、検証後に返却 |
| 3 | `.takt/tasks/<slug>/attachments/` に `image-1.png` などとして保存 | 充足 | `src/features/tasks/attachments.ts:79`, `src/__tests__/addTask.test.ts:351` | `promoteTaskAttachments()` でコピー |
| 4 | `order.md` に既存 attachment 形式で追記 | 充足 | `src/features/tasks/attachments.ts:26`, `src/__tests__/addTask.test.ts:353` | `## 添付画像` と `attachments/image-1.png` を確認 |
| 5 | 元コメント本文内の画像参照を `[Image #1]` 形式で参照可能にする | 充足 | `src/features/tasks/prReviewImageAttachments.ts:58`, `src/__tests__/prReviewImageAttachments.test.ts:62` | Markdown/HTML img の置換を確認 |
| 6 | pipeline の `--pr` 経路でも同等に画像参照可能 | 充足 | `src/features/pipeline/steps.ts:280`, `src/__tests__/pipelineExecution.test.ts:351` | run context task spec への staging を確認 |

## 観測した指摘
| # | family_tag | カテゴリ | 重大度 | 場所 | 問題 | 修正案 |
|---|------------|---------|--------|------|------|--------|
| - | - | - | - | - | なし | - |

## 検証証跡
- ビルド: `npm run build` 成功。
- テスト: `npm run lint` 成功。`npm test` は1回目に `workflowLoader.test.ts:925` timeout、該当テスト単体は成功、2回目のフル `npm test` は成功。
- 動作確認: 実コードとテストで `add --pr` 保存、interactive seed 伝搬、pipeline staging、画像検証失敗時の fetch failure 経路、cleanup 経路を確認。