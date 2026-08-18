# コーディングレビュー

## 結果: REJECT

## サマリー
PRコメントからの画像ダウンロード機能を実装していますが、外部コマンド実行およびバリデーション時のエラー処理が不十分であり、画像1枚の失敗でプロセス全体がクラッシュする重大な欠陥があります。

## 契約入口チェック
| 入口・経路 | 元要件 | 実装根拠 | テスト根拠 | 判定 | 例外・未確認の根拠 |
|-----------|--------|----------|------------|------|-------------------|
| `takt add --pr` 経路の画像保存 | PR内画像を抽出・保存し `order.md` に追記する | `src/features/tasks/add/index.ts:201` | `src/__tests__/addTask.test.ts:387` | ✅ | なし |
| `pipeline --pr` 経路の画像利用 | 画像をダウンロードしタスク実行に渡す | `src/features/pipeline/steps.ts:226` | `src/__tests__/pipelineExecution.test.ts:1550` | ✅ | なし |
| 画像ダウンロード・検証 | 形式(PNG/JPEG/GIF/WebP)・サイズ・Magic Bytesを検証 | `src/infra/github/imageDownload.ts:38` | `src/__tests__/imageDownload.test.ts` (未確認) | ⚠️ | 正常系は実装済みだが、異常系（不正形式等）の挙動が未検証 |

## 非finding化した懸念
| 項目 | 場所 | 分類 | finding化しない根拠 |
|------|------|------|---------------------|
| `src/__tests__/imageDownload.test.ts` の内容未確認 | N/A | no_issue_after_verification | `downloadPrImages` のロジック自体に致命的なエラーハンドリング欠如があるため、先にそちらを指摘。 |

## 問題系列の完了走査

| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|----------|----------------------|--------------------------|--------------|------------------|----------------------|---------------------------------------------------|----------------------------|------------|------|
| image-download-reliability | `src/infra/github/imageDownload.ts` | 外部リソース取得失敗がプロセス全体の停止を招かないこと | 外部コマンド `gh` およびネットワーク通信に依存するため | `downloadPrImages` 内のループ処理 | `src/infra/github/imageDownload.ts:100` | `src/features/tasks/add/index.ts:201` | `execFileSync` の例外および明示的 `throw` | なし | 全ての画像ダウンロード失敗経路 | CODE-NEW-infra-github-imageDownload-L126 |

## 今回の指摘（new）
| # | finding_id | family_tag | 重大度 | 場所 | 問題 | 影響 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|------------|------------|--------|------|------|------|---------------------|------------------------------|--------|
| 1 | CODE-NEW-infra-github-imageDownload-L126 | image-download-reliability | High | `src/infra/github/imageDownload.ts:126` | 外部コマンド `gh` の実行エラーおよびバリデーション失敗時の例外がキャッチされていない | 画像1枚の取得失敗やフォーマット不正だけで、`takt add` やパイプライン実行全体がUnhandled Exceptionでクラッシュする | 該当なし | 該当なし | `downloadPrImages` 内の画像処理ループを `try-catch` で囲み、失敗した画像はログ出力してスキップし、処理を継続させる。 |

## 継続指摘（persists）
なし

## 解消済み（resolved）
なし

## 裁定済みの対象外指摘
なし

## 再開指摘（reopened）
なし

## 検証証跡
- 差分確認: `src/infra/github/imageDownload.ts` のエラーハンドリングおよび呼び出し元（`addTask`, `runWorkflow`）の例外処理を確認。
- ビルド: 未確認（静的解析による判定）
- テスト: `src/__tests__/addTask.test.ts` および `src/__tests__/pipelineExecution.test.ts` の追加分を確認。正常系のみの検証となっており、異常系（`gh` 失敗時など）の検証が欠落していることを確認。

## REJECT判定条件
- `CODE-NEW-infra-github-imageDownload-L126` (High) が1件存在するため、REJECT。