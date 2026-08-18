# アーキテクチャレビュー

## 結果: REJECT

## サマリー
PRコメントからの画像ダウンロードロジックが `src/features/tasks/add/index.ts` と `src/features/pipeline/steps.ts` の2箇所に重複して実装されており、DRY原則および設計の一貫性に違反しています。

## 確認した観点
- [x] 構造・設計
- [x] コード品質
- [x] 変更スコープ
- [x] テストカバレッジ
- [x] デッドコード
- [x] 呼び出しチェーン検証

## 問題系列の完了走査

| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|----------|----------------------|--------------------------|--------------|------------------|----------------------|---------------------------------------------------|----------------------------|------------|------|
| image-download-logic | TaskAttachment 管理責任 | 画像のダウンロード、一時保存、TaskAttachmentへの変換フローが統一されていること | GitHubアセットの取得方式や保存先の変更に伴う修正を1箇所で完結させるため | `addTask` 経由, `executePipeline` 経由 | `src/infra/github/image-downloader.ts` | `src/features/tasks/add/index.ts`, `src/features/pipeline/steps.ts` | 各所での try-catch による個別のエラーハンドリング | `src/__tests__/pr-image-attachments.test.ts` | なし | finding-1 |

## 今回の指摘（new）
| # | finding_id | family_tag | スコープ | 場所 | 問題 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|------------|------------|---------|------|------|---------------------|------------------------------|--------|
| 1 | ARCH-NEW-DRY-IMAGE-DL | image-download-logic | スコープ内 | `src/features/pipeline/steps.ts:228-251`, `src/features/tasks/add/index.ts:201-232` | 画像ダウンロードから `TaskAttachment` 生成までのロジックが重複実装されており、一時ファイルパスの生成などの詳細がハードコードで散在している。 | 該当なし | 該当なし | 画像の抽出・ダウンロード・変換フローを `src/features/tasks/attachments.ts` 等の共通所有者に集約し、各エントリーポイントから呼び出す構造に変更する。 |

## 継続指摘（persists）
なし

## 解消済み（resolved）
なし

## 裁定済みの対象外指摘
なし

## 再開指摘（reopened）
なし

## 検証証跡
- ビルド: 未確認（編集禁止ステップのため）
- Lint: 未確認（編集禁止ステップのため）
- テスト: `src/__tests__/pr-image-attachments.test.ts` の存在を確認したが、重複実装箇所の両方を網羅的に検証できているかは未確認
- 動作確認: 未確認（編集禁止ステップのため）