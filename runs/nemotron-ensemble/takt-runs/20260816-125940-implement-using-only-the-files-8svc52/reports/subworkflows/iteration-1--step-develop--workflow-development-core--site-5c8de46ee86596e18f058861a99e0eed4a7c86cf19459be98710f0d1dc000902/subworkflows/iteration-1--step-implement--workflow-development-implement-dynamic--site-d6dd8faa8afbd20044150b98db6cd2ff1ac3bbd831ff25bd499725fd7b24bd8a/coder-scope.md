# 変更スコープ宣言

## タスク
PRコメント内の画像をタスクの添付ファイルとしてダウンロード・保存する機能を実装

## 変更予定
| 種別 | ファイル |
|------|---------|
| 作成 | `src/infra/github/image-extraction.ts` |
| 作成 | `src/infra/github/image-downloader.ts` |
| 変更 | `src/infra/git/types.ts` |
| 変更 | `src/infra/github/pr.ts` |
| 変更 | `src/infra/gitlab/pr.ts` |
| 変更 | `src/features/tasks/attachments.ts` |
| 変更 | `src/features/tasks/add/index.ts` |
| 変更 | `src/features/pipeline/steps.ts` |
| 変更 | `src/features/pipeline/execute.ts` |
| 作成 | `src/__tests__/pr-image-attachments.test.ts` |

## 推定規模
Medium

## 影響範囲
- PRコメントからの画像URL抽出およびダウンロード機能
- タスクディレクトリへの画像添付ファイル保存
- `takt add --pr` および `takt --pr` コマンドの画像取得サポート
- ワークフロー実行時のタスクコンテキストへの画像参照
- GitHubおよびGitLab PRサポートの拡張