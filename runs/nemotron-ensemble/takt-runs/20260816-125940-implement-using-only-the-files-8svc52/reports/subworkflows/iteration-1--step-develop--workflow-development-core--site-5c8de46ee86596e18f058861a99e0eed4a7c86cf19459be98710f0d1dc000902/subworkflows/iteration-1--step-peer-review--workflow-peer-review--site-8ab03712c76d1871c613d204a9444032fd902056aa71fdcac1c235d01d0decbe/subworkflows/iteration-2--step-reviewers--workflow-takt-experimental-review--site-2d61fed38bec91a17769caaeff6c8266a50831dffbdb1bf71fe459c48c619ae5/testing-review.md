# テストレビュー

## 結果: REJECT

## サマリー
主要な正常系ルートは検証されていますが、要求仕様（order.md）で定義された「Content-Type検証」「サイズ上限検証」「認証付き取得の失敗経路」といった重要なガード条件に対するテストが完全に欠落しています。

## 確認した観点
| 観点 | 結果 | 備考 |
|------|------|------|
| テストカバレッジ | ❌ | 異常系・境界値テストが大幅に不足 |
| テスト構造（Given-When-Then） | ✅ | 構造は適切 |
| テスト命名 | ✅ | 意図が明確 |
| テスト独立性・再現性 | ✅ | 一時ディレクトリを使用しており独立している |
| モック・フィクスチャ | ✅ | 実ファイルを用いた検証が行われている |
| テスト戦略（ユニット/統合/E2E） | ✅ | ユニットテストとして適切に分離されている |
| 契約入力位置（body/query/path） | ✅ | URL形式の検証は実施済み |

## 問題系列の完了走査

| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|----------|----------------------|--------------------------|--------------|------------------|----------------------|---------------------------------------------------|----------------------------|------------|------|
| image-download-validation | `validateAndDownloadImage` | 許可されたURL、形式、サイズのみを保存する | 画像ダウンロード機能の安全な実装 | なし | `image-downloader.ts` | なし | Content-Type不一致 / サイズ超過 / gh APIエラー | `pr-image-attachment.test.ts` | 実際のバイナリ検証 | TEST-NEW-1, 2, 3 |
| task-attachment-storage | `saveImageAttachments` | 正しいパスに保存し、order.md の参照を正規化する | 添付ファイル管理の実装 | なし | `attachments.ts` | `order.md` | ディスクフル / 権限エラー | `pr-image-attachment.test.ts` | なし | TEST-NEW-4 |

## 今回の指摘（new）
| # | finding_id | family_tag | カテゴリ | 場所 | 問題 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|------------|------------|---------|------|------|---------------------|------------------------------|--------|
| 1 | TEST-NEW-1 | image-download-validation | カバレッジ | `src/infra/github/image-downloader.ts:36` | サポート外のContent-Type（text/plain等）が正しく拒否されるかのテストが欠落している | direct_acceptance_criterion_violation | 該当なし | `SUPPORTED_IMAGE_TYPES` に含まれないタイプを返すモックを用いて、エラーがスローされることを検証するテストを追加する |
| 2 | TEST-NEW-2 | image-download-validation | カバレッジ | `src/infra/github/image-downloader.ts:41` | `MAX_IMAGE_SIZE_BYTES` (10MB) を超えるファイルが正しく拒否されるかのテストが欠落している | direct_acceptance_criterion_violation | 該当なし | `metadata.size` が上限を超えるケースをシミュレートし、エラーがスローされることを検証するテストを追加する |
| 3 | TEST-NEW-3 | image-download-validation | カバレッジ | `src/infra/github/image-downloader.ts:27` | `gh api` の実行失敗（認証エラー、404等）時のエラーハンドリングが検証されていない | direct_acceptance_criterion_violation | 該当なし | `gh` コマンドが非ゼロの終了コードを返すケースを想定したテストを追加する |
| 4 | TEST-NEW-4 | task-attachment-storage | カバレッジ | `src/features/tasks/attachments.ts:359` | `fs.promises.mkdir` や `copyFile` が失敗した際の挙動が検証されていない | direct_acceptance_criterion_violation | 該当なし | ファイルシステムエラー（権限不足等）をシミュレートし、適切に例外が伝播または処理されることを検証するテストを追加する |

## 継続指摘（persists）
なし

## 解消済み（resolved）
なし

## 裁定済みの対象外指摘
なし

## 再開指摘（reopened）
なし

## 検証証跡
- ビルド: 未確認（本ステップの責務外）
- Lint: 未確認（本ステップの責務外）
- テスト: `src/__tests__/pr-image-attachment.test.ts` を精読し、実装コードとの突合を実施
- 動作確認: 未確認

## 未確認範囲
| 項目 | 理由 | 判定への影響 |
|------|------|--------------|
| 実際のバイナリ整合性検証 | テストコードが Buffer の内容まで検証していないため | APPROVE可（パスと存在確認で十分なため） |