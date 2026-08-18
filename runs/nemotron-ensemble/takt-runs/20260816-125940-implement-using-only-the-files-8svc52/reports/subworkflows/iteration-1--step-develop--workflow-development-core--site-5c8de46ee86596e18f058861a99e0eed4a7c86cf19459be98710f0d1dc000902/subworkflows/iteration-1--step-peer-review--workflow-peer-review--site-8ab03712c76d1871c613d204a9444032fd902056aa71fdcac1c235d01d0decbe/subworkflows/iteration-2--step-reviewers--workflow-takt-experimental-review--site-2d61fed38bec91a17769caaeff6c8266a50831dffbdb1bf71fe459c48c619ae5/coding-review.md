# コーディングレビュー

## 結果: REJECT

## サマリー
PRコメントからの画像抽出と保存機能が実装されましたが、バイナリファイルの取得に `gh api` を使用しており信頼性に欠ける点、および `order.md` の保存処理において既存の内容を完全に上書きするリスクがあるため、REJECT とします。

## 契約入口チェック
| 入口・経路 | 元要件 | 実装根拠 | テスト根拠 | 判定 | 例外・未確認の根拠 |
|-----------|--------|----------|------------|------|-------------------|
| `takt add --pr` 時の画像抽出 | PR本文・コメント・Review threadから画像URLを検出する | `src/infra/github/pr.ts:436` | `src/__tests__/pr-image-attachment.test.ts:10` | ✅ | なし |
| 画像のダウンロードと保存 | 対応画像をローカル `attachments/` に保存する | `src/features/tasks/attachments.ts:29` | `src/__tests__/pr-image-attachment.test.ts:95` | ⚠️ | `gh api` によるバイナリ取得の信頼性不足 |
| `order.md` への追記 | 既存 attachment 形式で追記し、本文内の参照を正規化する | `src/features/tasks/attachments.ts:373` | `src/__tests__/pr-image-attachment.test.ts:163` | ⚠️ | `writeFile` による完全上書きのリスク |
| pipeline 経路での参照 | pipeline 直実行時も attachment 付き task spec を使う | `src/features/pipeline/steps.ts:227` | 未確認 | ⚠️ | E2Eテストでの検証が必要 |

## 非finding化した懸念
| 項目 | 場所 | 分類 | finding化しない根拠 |
|------|------|------|---------------------|
| URLからの拡張子抽出の不完全さ | `src/features/tasks/attachments.ts:35` | no_issue_after_verification | クエリパラメータ等で失敗してもデフォルトの `.png` で保存され、表示自体は可能であるため |

## 問題系列の完了走査
| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|----------|----------------------|--------------------------|--------------|------------------|----------------------|---------------------------------------------------|----------------------------|------------|------|
| pr-image-download | `validateAndDownloadImage` | 安全かつ正確にバイナリを保存する | GitHubアセットの取得実装 | `gh api` 経由の取得 | `src/infra/github/image-downloader.ts:18` | `src/features/tasks/attachments.ts:40` | `src/features/tasks/attachments.ts:50` | `src/__tests__/pr-image-attachment.test.ts` | なし | CODE-NEW-infra-github-downloader-L27 |
| task-spec-persistence | `saveImageAttachments` | `order.md` の整合性を維持しつつ追記する | Task Spec の保存形式変更 | `writeFile` による出力 | `src/features/tasks/attachments.ts:349` | `src/features/tasks/attachments.ts:389` | なし | `src/__tests__/pr-image-attachment.test.ts:123` | なし | CODE-NEW-feat-tasks-attachments-L389 |

## 今回の指摘（new）
| # | finding_id | family_tag | 重大度 | 場所 | 問題 | 影響 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|------------|------------|--------|------|------|------|---------------------|------------------------------|--------|
| 1 | CODE-NEW-infra-github-downloader-L27 | pr-image-download | High | `src/infra/github/image-downloader.ts:27` | バイナリ取得に `gh api` を使用している | `gh api` はJSONレスポンスを想定しており、バイナリデータの完全性や取得方式として不適切である可能性がある | direct_acceptance_criterion_violation | 該当なし | `curl` や `fetch` など、リダイレクトを適切に処理しバイナリとして保存できる手段に変更する |
| 2 | CODE-NEW-feat-tasks-attachments-L389 | task-spec-persistence | Medium | `src/features/tasks/attachments.ts:389` | `order.md` を `writeFile` で完全上書きしている | `prepareEnqueuedTaskSpecDirectory` などの他処理が書き込んだ内容を消し去るリスクがある | direct_acceptance_criterion_violation | 該当なし | ファイルを追記モードで開くか、既存内容を読み込んでから結合して書き出す構成にする |
| 3 | CODE-NEW-feat-tasks-attachments-L118 | task-spec-persistence | Low | `src/features/tasks/attachments.ts:118` | 単純な文字列置換によるパス正規化 | パスの一部が偶然一致した場合に意図しない置換が発生するリスクがある | direct_acceptance_criterion_violation | 該当なし | 正規表現を用いて境界を厳密に判定して置換する |

## 検証証跡
- 差分確認: `src/infra/github/pr.ts`, `src/features/tasks/attachments.ts` 等の変更を確認済み
- ビルド: 未確認
- テスト: `src/__tests__/pr-image-attachment.test.ts` の内容を確認したが、`gh api` の実動作（バイナリの完全性）までを検証するテストは不足している