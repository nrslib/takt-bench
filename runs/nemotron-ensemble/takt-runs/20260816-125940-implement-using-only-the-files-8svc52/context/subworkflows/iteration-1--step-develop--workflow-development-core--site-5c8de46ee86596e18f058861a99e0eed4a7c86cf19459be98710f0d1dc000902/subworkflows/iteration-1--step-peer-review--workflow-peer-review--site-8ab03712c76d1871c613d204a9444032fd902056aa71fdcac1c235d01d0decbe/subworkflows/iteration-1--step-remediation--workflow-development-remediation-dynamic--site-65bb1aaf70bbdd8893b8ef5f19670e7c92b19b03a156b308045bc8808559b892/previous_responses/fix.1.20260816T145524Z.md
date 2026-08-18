## 作業結果
- 修正完了
## 変更内容と受入条件
- `image-download-logic`: `src/features/tasks/attachments.ts` に `downloadImageAsAttachment` 関数を実装し、非同期 I/O を使用していること
- `image-lifecycle`: `src/features/tasks/attachments.ts` でユニークパス生成 (`os.tmpdir()` + UUID) と `finally` での削除を実装していること
- `image-io-performance`: `src/features/tasks/attachments.ts` の `saveImageAttachments` 内の全 `fs` 呼び出しが `fs.promises` に置換されていること
- `gitlab-support`: `src/infra/github/image-downloader.ts` の URL バリデーションを GitHub と GitLab の両方に拡張し、`src/infra/gitlab/pr.ts` で画像抽出後に `downloadImageAsAttachment` を呼び出すフローを実装していること
- `image-download-observability`: `src/features/pipeline/steps.ts` のエラーハンドリングを強化し、ダウンロード失敗時に `console.warn` で詳細を出力するように変更していること
## 検証結果と証拠
- `npm run build`: ビルドが成功
- `npm run lint`: lint がパス
- `npm test`: ユニットテストがパス (85テストファイル、886テスト)
- `HOME=/tmp/takt-bench-v3-home npm run test:it`: インテグレーションテストがパス (128テストファイル、1785テスト)
- `npm run test:e2e:mock`: モックE2Eテストがパス (12テストファイル、45テストパス、2スキップ)
- 変更対象ファイルの具体的な証拠:
  - `src/features/tasks/attachments.ts`: `downloadImageAsAttachment` 関数の追加、`saveImageAttachments` の非同期化
  - `src/features/pipeline/steps.ts`: 画像ダウンロードロジックを `downloadImageAsAttachment` に置換
  - `src/features/tasks/add/index.ts`: 画像ダウンロードロジックを `downloadImageAsAttachment` に置換
  - `src/infra/github/image-downloader.ts`: GitLab URL のサポート追加
  - `src/infra/gitlab/pr.ts`: 画像抽出後に共通ダウンロード関数を呼び出すフロー