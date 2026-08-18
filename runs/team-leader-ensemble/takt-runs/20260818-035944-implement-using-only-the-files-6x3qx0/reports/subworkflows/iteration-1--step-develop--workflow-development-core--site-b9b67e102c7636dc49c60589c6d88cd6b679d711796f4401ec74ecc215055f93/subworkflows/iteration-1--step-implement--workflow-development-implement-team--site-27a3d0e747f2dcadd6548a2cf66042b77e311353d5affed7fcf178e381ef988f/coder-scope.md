# 変更スコープ宣言

## タスク

GitHub PRコメント内の画像を取得・検証し、既存のtask attachment経路を通じて`add --pr`、通常の`--pr`、pipelineへ渡す。

## 変更予定

| 種別 | ファイル |
|------|---------|
| 作成 | `src/infra/github/pr-attachments.ts` |
| 変更 | `src/infra/git/types.ts` |
| 変更 | `src/infra/github/pr.ts` |
| 変更 | `src/infra/git/format.ts` |
| 変更 | `src/features/tasks/add/index.ts` |
| 変更 | `src/app/cli/routing-inputs.ts` |
| 変更 | `src/app/cli/routing.ts` |
| 変更 | `src/features/pipeline/steps.ts` |

## 推定規模

Medium

## 影響範囲

- GitHub PR本文・通常コメント・review summary・review threadの画像抽出
- GitHub URL allowlist、Content-Type、magic bytes、サイズ検証
- `add --pr`のtask保存と`order.md`生成
- 通常の`--pr`のinteractive seed、実行、保存
- pipelineの`--pr` task specとrun context staging
- 既存task attachmentの保存・manifest検証経路との統合