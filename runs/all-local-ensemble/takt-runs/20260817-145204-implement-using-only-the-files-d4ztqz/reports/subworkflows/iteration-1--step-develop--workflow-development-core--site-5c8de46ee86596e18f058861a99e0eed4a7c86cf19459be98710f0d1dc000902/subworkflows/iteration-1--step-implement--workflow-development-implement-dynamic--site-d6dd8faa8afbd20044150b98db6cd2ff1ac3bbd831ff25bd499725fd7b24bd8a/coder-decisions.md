# 決定ログ

## 1. 画像ダウンロードの実装位置を `src/infra/github/imageDownload.ts` に置く
- **背景**: PR 画像の取得は GitHub 固有の `gh api` 経由で行うため、provider 固有の `src/infra/github/` に配置するのが既存構造に合致する。
- **検討した選択肢**: `src/infra/git/` に置く / `src/features/pipeline/` に置く / `src/infra/github/` に置く
- **理由**: 画像 URL 抽出・置換は provider 非依存のため `src/infra/git/imageExtraction.ts` に分離し、`gh api` によるダウンロード・検証は GitHub 固有の `src/infra/github/imageDownload.ts` に置いた。既存の `pr.ts` と同じ層に配置することで依存方向を保つ。

## 2. ダウンロード画像の一時保存先を `.takt/tmp/pr-images/` にする
- **背景**: `TaskAttachment.tempPath` は `promoteTaskAttachments` で実ファイル検証されるため、実在する一時ファイルが必要。
- **検討した選択肢**: OS の tmpdir / プロジェクト内 `.takt/tmp/pr-images/`
- **理由**: プロジェクト内に置くことで、worktree 実行時にも同じ cwd から参照でき、クリーンアップも `cleanupPreparedTaskSpec` と整合する。

## 3. pipeline の `--pr` 経路で taskSpec を組み立てる
- **背景**: pipeline は `executeTask` を直接呼ぶため、attachment 付き task spec を渡すには `prepareTaskSpecDirectory` → `resolveTaskSpecForExecution` の組み立てが必要。
- **検討した選択肢**: `runWorkflow` 内で組み立てる / `resolveTaskContent` で組み立てる
- **理由**: `runWorkflow` は `execCwd` と `projectCwd` の両方を持つため、run パス解決に必要な情報が揃っている。attachment が無い場合は従来どおり taskSpec なしで実行する。