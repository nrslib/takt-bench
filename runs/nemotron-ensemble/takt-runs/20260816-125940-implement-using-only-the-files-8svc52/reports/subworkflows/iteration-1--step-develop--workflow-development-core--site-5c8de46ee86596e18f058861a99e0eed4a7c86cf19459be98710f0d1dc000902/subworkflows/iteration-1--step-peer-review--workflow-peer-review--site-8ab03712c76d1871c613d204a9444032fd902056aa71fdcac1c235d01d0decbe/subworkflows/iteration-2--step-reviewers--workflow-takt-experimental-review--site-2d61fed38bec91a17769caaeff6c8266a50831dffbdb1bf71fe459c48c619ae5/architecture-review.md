# アーキテクチャレビュー

## 結果: REJECT

## サマリー
パブリック API の公開範囲違反、類似責務を持つ関数の重複実装、およびエラー通知経路の欠如という構造的な問題を確認しました。

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
| attachment-persistence | `src/features/tasks/attachments.ts` | 添付ファイルの一時保存からタスクディレクトリへの配置までが一貫して行われる | 添付ファイルの保存・配置ロジックの変更 | `promoteTaskAttachments`, `saveImageAttachments` | `downloadImageAsAttachment` | `prepareTaskSpecDirectory` | `downloadImageAsAttachment` の失敗時のサイレント無視 | なし | なし | finding-1, 2, 3 |

## 今回の指摘（new）
| # | finding_id | family_tag | スコープ | 場所 | 問題 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|------------|------------|---------|------|------|---------------------|------------------------------|--------|
| 1 | ARCH-NEW-001 | design-violation | スコープ内 | `src/features/tasks/attachments.ts:133` | インフラ詳細操作である `promoteTaskAttachments` がパブリック API としてエクスポートされている | 該当なし | 該当なし | `export` を削除し内部関数にする |
| 2 | ARCH-NEW-002 | design-violation | スコープ内 | `src/features/tasks/attachments.ts:133, 349` | `promoteTaskAttachments` と `saveImageAttachments` に「ファイルをコピーして配置する」という同一の責務が重複して実装されている | 該当なし | 該当なし | コピー処理を共通のプライベート関数に集約する |
| 3 | ARCH-NEW-003 | error-handling | スコープ内 | `src/features/tasks/attachments.ts:29` | 画像ダウンロード失敗時に `null` を返して呼び出し側で `filter` するのみであり、ユーザーへの通知経路が存在しない | 該当なし | 該当なし | 失敗した画像がある場合に、CLI層で警告またはエラーを表示する仕組みを導入する |

## 継続指摘（persists）
なし

## 解消済み（resolved）
なし

## 裁定済みの対象外指摘
なし

## 再開指摘（reopened）
なし

## 検証証跡
- ビルド: 未確認
- Lint: 未確認
- テスト: 未確認
- 動作確認: 実コード読解による静的解析を実施。`attachments.ts` の関数定義と、`steps.ts` および `add/index.ts` からの呼び出しチェーンを確認。