# コーディングレビュー

## 結果: REJECT

## サマリー
PRコメントからの画像ダウンロードおよびタスク添付機能が実装されていますが、`downloadPrImages` における引数オブジェクトの直接書き換え（破壊的変更）、不適切な例外処理による処理中断、および一時ディレクトリの固定パス利用という 3 点の重大な実装上の問題が確認されました。

## 契約入口チェック

| 入口・経路 | 元要件 | 実装根拠 | テスト根拠 | 判定 | 例外・未確認の根拠 |
|-----------|--------|----------|------------|------|-------------------|
| `takt add --pr` | 画像URL検出・保存・order.md追記 | `src/features/tasks/add/index.ts:199` | `src/__tests__/addTask.test.ts:387` | ✅ | なし |
| `pipeline --pr` | 同等に画像を参照可能にする | `src/features/pipeline/steps.ts:225` | `src/__tests__/pipelineExecution.test.ts:1550` | ✅ | なし |
| 画像抽出 | Markdown/HTML形式のURL抽出 | `src/infra/git/imageExtraction.ts:21` | `src/__tests__/imageExtraction.test.ts:8` | ✅ | なし |
| 画像保存 | `gh api`経由取得、形式・サイズ検証 | `src/infra/github/imageDownload.ts:62` | `src/__tests__/imageDownload.test.ts:70` | ✅ | なし |

## 非finding化した懸念
なし

## 問題系列の完了走査

| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|----------|----------------------|--------------------------|--------------|------------------|----------------------|---------------------------------------------------|----------------------------|------------|------|
| image-download-safety | `downloadPrImages` | 外部入力(画像)による処理中断の防止とデータ不変性の保持 | 安全な画像取得フローの構築 | `downloadPrImages` 内部処理 | `src/infra/github/imageDownload.ts:84` | `src/features/tasks/add/index.ts:199` | `throw new Error` による中断 | `src/__tests__/imageDownload.test.ts` | なし | CODE-NEW-1, 2, 3 |

## 今回の指摘（new）
| # | finding_id | family_tag | 重大度 | 場所 | 問題 | 影響 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|------------|------------|--------|------|------|------|---------------------|------------------------------|--------|
| 1 | CODE-NEW-src-infra-github-imageDownload-L93 | image-download-safety | Medium | `src/infra/github/imageDownload.ts:93` | 引数 `prReview` のプロパティを直接書き換えている | 呼び出し元で保持している元の `prReview` データが破壊され、不整合が発生する | 該当なし | 該当なし | オブジェクトをコピーし、書き換え後の新しいオブジェクトを返却する |
| 2 | CODE-NEW-src-infra-github-imageDownload-L113 | image-download-safety | Medium | `src/infra/github/imageDownload.ts:113` | 画像形式不正やサイズ超過時に `throw` している | 1つの不正な画像があるだけで、PR全体のタスク作成やパイプライン実行が完全に停止する | 該当なし | 該当なし | `throw` せずエラーをログ出力し、該当画像のみスキップして続行する |
| 3 | CODE-NEW-src-infra-github-imageDownload-L90 | image-download-safety | Low | `src/infra/github/imageDownload.ts:90` | 一時ディレクトリに固定パス `.takt/tmp/pr-images` を使用している | 並列実行時に一時ファイルが競合・上書きされるリスクがある | 該当なし | 該当なし | `os.tmpdir()` やユニークなサブディレクトリを利用する |

## 継続指摘（persists）
なし

## 解消済み（resolved）
なし

## 裁定済みの対象外指摘
なし

## 再開指摘（reopened）
なし

## 検証証跡
- 差分確認: `git diff` により `src/infra/github/imageDownload.ts` および統合箇所のロジックを確認。
- ビルド: 未確認（レビューステップのため）。
- テスト: `src/__tests__/imageDownload.test.ts` 等のテストコードを確認し、正常系および特定のエラー系のみがカバーされており、堅牢性（一部失敗時の続行）が検証されていないことを確認。