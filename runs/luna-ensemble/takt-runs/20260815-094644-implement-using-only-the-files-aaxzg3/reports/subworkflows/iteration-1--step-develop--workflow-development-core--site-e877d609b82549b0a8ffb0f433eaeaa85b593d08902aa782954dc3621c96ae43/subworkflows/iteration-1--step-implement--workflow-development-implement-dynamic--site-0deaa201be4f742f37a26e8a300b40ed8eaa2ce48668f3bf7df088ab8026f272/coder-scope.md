# 変更スコープ宣言

## タスク

GitHub PR内の画像を検出・検証・ダウンロードし、`add --pr`、通常の`--pr`、pipelineでtask attachmentとして扱えるようにする。

## 変更予定

| 種別 | ファイル |
|------|---------|
| 作成 | `src/infra/github/pr-images.ts` |
| 作成 | `src/__tests__/github-pr-images.test.ts` |
| 変更 | `src/infra/git/types.ts` |
| 変更 | `src/infra/github/pr.ts` |
| 変更 | `src/features/tasks/add/index.ts` |
| 変更 | `src/app/cli/routing-inputs.ts` |
| 変更 | `src/app/cli/routing.ts` |
| 変更 | `src/features/pipeline/steps.ts` |
| 変更 | `src/features/pipeline/execute.ts` |
| 変更 | `src/features/interactive/imageAttachments.ts` |
| 変更 | 関連するPR取得・add・routing・pipeline・添付テスト |

## 推定規模

Medium

## 影響範囲

- GitHub PR画像の抽出、URL許可、認証済みダウンロード、形式・サイズ検証
- task attachment保存と`order.md`生成
- 通常の`--pr` interactive seed
- pipeline `--pr`のtask specおよびworkflow実行
- 添付画像placeholderの採番と一時ファイル後処理