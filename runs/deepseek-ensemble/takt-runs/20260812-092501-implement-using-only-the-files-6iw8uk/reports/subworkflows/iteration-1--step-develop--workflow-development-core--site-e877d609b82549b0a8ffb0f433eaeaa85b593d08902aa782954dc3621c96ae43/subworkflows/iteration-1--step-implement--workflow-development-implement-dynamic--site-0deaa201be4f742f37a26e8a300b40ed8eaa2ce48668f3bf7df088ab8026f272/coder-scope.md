# 変更スコープ宣言

## タスク
PR コメント内の画像をダウンロードして task attachments に配置する機能を実装する。

## 変更予定
| 種別 | ファイル |
|------|---------|
| 作成 | `src/shared/utils/imageFormat.ts` |
| 作成 | `src/infra/github/prReviewImageAttachments.ts` |
| 変更 | `src/infra/git/types.ts`（任意 capability 追加） |
| 変更 | `src/infra/github/GitHubProvider.ts` |
| 変更 | `src/features/interactive/imageAttachments.ts`（共通拡張子関数・採番） |
| 変更 | `src/features/interactive/inlineImagePaste.ts`（上限定数共通化） |
| 変更 | `src/features/tasks/add/index.ts` |
| 変更 | `src/app/cli/routing-inputs.ts` |
| 変更 | `src/app/cli/routing.ts` |
| 変更 | `src/features/pipeline/steps.ts` |
| 変更 | `src/features/pipeline/execute.ts` |
| 作成 | `src/__tests__/imageFormat.test.ts` |
| 作成 | `src/__tests__/prReviewImageAttachments.test.ts` |
| 作成 | `src/__tests__/prReviewImageAttachments.integration.test.ts` |
| 変更 | `src/__tests__/imageAttachments.test.ts` |
| 変更 | `src/__tests__/github-provider.test.ts` |
| 変更 | `src/__tests__/addTask.test.ts` |
| 変更 | `src/__tests__/cli-routing-pr-resolve.test.ts` |
| 変更 | `src/__tests__/pipelineExecution.test.ts` |
| 変更 | `src/__tests__/git-cwd-propagation.test.ts` |

## 推定規模
Large

## 影響範囲
- GitHub PR 入力の 3 入口（`add --pr`、直接 `--pr`、pipeline `--pr`）
- 対話モードの画像貼り付けと採番
- Git provider 契約（任意 capability）