## 実装サマリー

PRコメント内の画像をダウンロードしてタスクの添付ファイルに配置する機能を実装しました。以下の変更を行いました：

### 新規作成ファイル
1. `src/infra/github/image-extraction.ts` - MarkdownとHTMLから画像URLを抽出するユーティリティ
2. `src/infra/github/image-downloader.ts` - GitHub添付ファイルURLから画像を検証・ダウンロードするユーティリティ

### 変更ファイル
1. `src/infra/git/types.ts` - `PrReviewData`インターフェースに`images: string[]`フィールドを追加
2. `src/infra/github/pr.ts` - `fetchPrReviewComments`関数を更新し、画像URLを抽出して`images`フィールドに設定
3. `src/infra/gitlab/pr.ts` - 同様に画像抽出機能を追加
4. `src/features/tasks/attachments.ts` - `saveImageAttachments`関数を追加し、画像をタスクディレクトリに保存して`order.md`を更新
5. `src/features/tasks/add/index.ts` - `takt add --pr`コマンドを更新し、画像をダウンロードしてタスク添付ファイルとして保存
6. `src/features/pipeline/steps.ts` - `resolveTaskContent`関数を更新し、PR取得時に画像をダウンロードしてタスクコンテキストに追加
7. `src/features/pipeline/execute.ts` - 非同期関数呼び出しに対応するための調整
8. `src/__tests__/pr-image-attachments.test.ts` - 新しい機能の単体テストを追加

### 主な機能
- `takt add --pr <number>` および `takt --pr <number>` でPR本文・通常コメント・review threadコメント内の画像URLを検出
- 対応画像（PNG/JPEG/GIF/WebP）をローカルにダウンロード
- `.takt/tasks/<slug>/attachments/` に `image-1.png` などとして保存
- `order.md` に既存の添付ファイル形式で追記
- GitHubのprivate repository画像にも対応（認証済み`gh`経由の取得を優先）
- 外部URLの無制限取得を防止（GitHub attachment URLから始まるもののみ許可）
- Content-Typeとファイルサイズの検証（10MB制限）

### 品質保証
- `npm run build` が成功
- `npm run lint` が通過
- 新規ロジックには単体テストを追加し、`npm test` が成功
- 既存の機能への影響を最小限に抑え、後方互換性を維持

この実装により、PRコメント内の画像がタスクの添付ファイルとして適切に扱われ、ワークフロー実行時に画像を参照できるようになります。