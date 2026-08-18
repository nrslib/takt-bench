# アーキテクチャレビュー

## 結果: REJECT

## サマリー
PRコメントからの画像ダウンロード機能の実装において、インフラ層の分離や境界での解決は適切に行われていますが、一時ファイルのライフサイクル管理に重大な欠陥があり、リソースリークが発生します。

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
| リソースライフサイクル | `src/infra/github/imageDownload.ts` | 生成した一時ファイルは処理完了後に確実に解放される | 画像ダウンロードに伴う一時保存領域の管理 | `downloadPrImages` -> `.takt/tmp/pr-images` | `fs.writeFileSync` | `prepareTaskSpecDirectory` | 強制終了・プロセス中断時の解放漏れ | `imageDownload.test.ts` | なし | ARCH-001 |
| 画像抽出・置換契約 | `src/infra/git/imageExtraction.ts` | Markdown/HTMLの画像参照が正しく抽出・置換される | PRコメント内の画像をTask添付ファイルへ変換するため | `extractImageUrls`, `replaceImageReferences` | 正規表現による抽出 | `downloadPrImages` | コードブロック内の除外 | `imageExtraction.test.ts` | なし | 問題なし |
| 添付ファイル伝播経路 | `src/features/pipeline/steps.ts` | 解決済み添付ファイルがWorkflow実行環境まで正しく伝播する | Pipeline実行時の画像添付対応 | `resolveTaskContent` -> `runWorkflow` | `downloadPrImages` | `prepareTaskSpecDirectory` | 添付ファイル空時の挙動 | `pipelineExecution.test.ts` | なし | 問題なし |

## 今回の指摘（new）
| # | finding_id | family_tag | スコープ | 場所 | 問題 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|------------|------------|---------|------|------|---------------------|------------------------------|--------|
| 1 | ARCH-001 | resource-lifecycle | スコープ内 | `src/infra/github/imageDownload.ts:106` | `.takt/tmp/pr-images` に保存された一時ファイルおよび `src/features/pipeline/steps.ts` で作成される一時ディレクトリのクリーンアップ戦略が不足しており、強制終了時や正常終了後にリソースが蓄積される。 | 該当なし | 該当なし | 1. 保存先を実行IDごとのサブディレクトリにし、pipeline/addTask の終端（finally）で一括削除する。 2. 一時ファイルの寿命を管理する仕組みを導入する。 |

## 継続指摘（persists）
（なし）

## 解消済み（resolved）
（なし）

## 裁定済みの対象外指摘
（なし）

## 再開指摘（reopened）
（なし）

## 検証証跡
- ビルド: 未確認（ソースコード読解のみ）
- Lint: 未確認（ソースコード読解のみ）
- テスト: `imageDownload.test.ts`, `imageExtraction.test.ts`, `addTask.test.ts`, `pipelineExecution.test.ts` の実装を確認。機能検証はカバーされているが、リソースリークの検証は含まれていない。
- 動作確認: 未確認（ソースコード読解のみ）