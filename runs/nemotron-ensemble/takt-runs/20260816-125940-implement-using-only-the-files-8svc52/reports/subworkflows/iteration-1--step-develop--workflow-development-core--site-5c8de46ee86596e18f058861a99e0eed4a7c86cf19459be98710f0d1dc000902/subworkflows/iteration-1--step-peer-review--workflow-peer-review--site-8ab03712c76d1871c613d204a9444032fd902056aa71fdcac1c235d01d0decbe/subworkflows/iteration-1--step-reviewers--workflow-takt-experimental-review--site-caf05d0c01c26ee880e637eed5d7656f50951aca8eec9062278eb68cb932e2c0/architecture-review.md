# アーキテクチャレビュー

## 結果: IMPROVE

## サマリー
PRコメントからの画像ダウンロードおよび添付ファイル保存機能は、インフラ層の分離や境界での検証が適切に実装されています。一方で、一時ファイルのクリーンアップ漏れおよび、ダウンロードロジックの重複が検出されました。


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
| image-download-lifecycle | `src/features/tasks/attachments.ts` | ダウンロードした一時ファイルは処理後に削除されること | 一時ファイルによるディスク消費の防止 | `addTask` / `runPipeline` | `downloadImageAsAttachment` | `promoteTaskAttachments` | 正常終了後のクリーンアップ経路 | なし | なし | finding 1 |
| image-download-logic-dedup | `src/features/tasks/attachments.ts` | 同一のダウンロード・フィルタリングロジックは一箇所に集約されていること | 保守性の向上と不整合の防止 | `addTask` / `runPipeline` | `downloadImageAsAttachment` | `resolveTaskContent` / `addTask` | なし | なし | なし | finding 2 |


## 今回の指摘（new）
| # | finding_id | family_tag | スコープ | 場所 | 問題 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|------------|------------|---------|------|------|---------------------|------------------------------|--------|
| 1 | ARCH-NEW-attachments-L34 | resource-leak | スコープ内 | `src/features/tasks/attachments.ts:34` | `downloadImageAsAttachment` で生成した一時ファイルが、正常系および一部の失敗系において削除される経路が不足している。 | direct_acceptance_criterion_violation | 該当なし | `saveTaskFile` または `runWorkflow` の `finally` ブロックで、使用した `TaskAttachment` の `tempPath` を一括削除する処理を追加する。 |
| 2 | ARCH-NEW-logic-dup | dry-violation | スコープ内 | `src/features/pipeline/steps.ts:228` / `src/features/tasks/add/index.ts:203` | PRレビューデータから画像をダウンロードしフィルタリングするロジックが重複して実装されている。 | direct_acceptance_criterion_violation | 該当なし | `src/features/tasks/attachments.ts` に `downloadAttachments(urls: string[]): Promise<TaskAttachment[]>` のような共通関数を抽出し、集約する。 |

## 継続指摘（persists）
なし

## 解消済み（resolved）
なし

## 裁定済みの対象外指摘
なし

## 再開指摘（reopened）
なし

## 検証証跡
- ビルド: 未確認（ソース読み取りのみ）
- Lint: 未確認（ソース読み取りのみ）
- テスト: 未確認（ソース読み取りのみ）
- 動作確認: 未確認（ソース読み取りのみ）