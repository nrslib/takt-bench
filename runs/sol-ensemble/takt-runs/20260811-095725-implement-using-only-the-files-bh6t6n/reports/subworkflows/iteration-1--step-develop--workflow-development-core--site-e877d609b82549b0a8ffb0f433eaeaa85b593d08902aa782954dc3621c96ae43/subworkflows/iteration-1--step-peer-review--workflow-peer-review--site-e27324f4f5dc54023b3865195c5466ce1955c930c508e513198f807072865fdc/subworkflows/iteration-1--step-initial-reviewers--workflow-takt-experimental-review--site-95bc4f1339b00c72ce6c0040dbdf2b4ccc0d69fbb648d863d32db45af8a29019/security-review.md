# セキュリティレビュー

## 結果: REJECT

## 重大度: Medium

## チェック結果

| カテゴリ | 結果 | 備考 |
|---------|------|------|
| インジェクション | ✅ | シェル文字列連結なし。URL・保存名も制限済み |
| 認証・認可 | ✅ | GitHub attachment URL のみ認証付き取得 |
| データ保護 | ✅ | トークンをエラーへ露出しない処理を確認 |
| 外部取得・資源制御 | ❌ | 画像の総件数・累積容量が無制限 |
| 依存関係 | ✅ | 依存関係の変更なし |

## 問題系列の完了走査

| family_tag / 変更契約 | 不変条件・根本原因 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|-------------------|------------------|----------------------|------------------------------------------|----------------------------|------------|------|
| `pr-image-resource-exhaustion` | 低信頼なPR入力による外部取得を、件数と累積容量の両方で制限する | `prReviewAttachments.ts:21-67`、`prImageDownload.ts:50-143` | `imageAttachmentStore.ts:78-92`、`attachments.ts:88-106,266-295` | `addTask`、対話 `--pr`、pipeline `--pr`、失敗時cleanupを確認 | `github-pr-image-download.test.ts`、`prReviewAttachments.test.ts`。総量超過テストはなし | 実GitHubを使った大量取得は未実施 | SEC-001 |

## 今回の指摘（new）

| # | finding_id | family_tag | 重大度 | 種類 | 場所 | 問題 | 修正案 |
|---|------------|------------|--------|------|------|------|--------|
| 1 | SEC-001 | pr-image-resource-exhaustion | Medium | ローカルDoS | `src/features/tasks/prReviewAttachments.ts:42-67` | PR本文・コメントを制御できる攻撃者が多数の一意なGitHub attachment URLを記載すると、各10 MiBまでの画像が件数・累積容量の上限なく取得される。pipelineでは一時保存、task spec、run contextへ複製され、帯域・メモリ・ディスクを枯渇させられる | 一意URLの最大件数を取得前に検査し、PR全体の累積容量上限を設ける。残容量を`downloadPrImage`へ渡し、Content-Lengthとストリーム読込の双方で強制する。件数・累積容量の境界値、超過、cleanupをテストする |

## 継続指摘（persists）

なし。

## 解消済み（resolved）

なし。

## 再開指摘（reopened）

なし。

## 検証証跡

- ビルド: `npm run build` は未確認。対象テスト実行時の型契約コンパイルは成功
- テスト: 変更対象5ファイルを実行し、5ファイル・121テスト成功
- 動作確認: URL制限、Content-Type/magic bytes、単一ファイル10 MiB上限、cleanupを確認。総件数・累積容量の拒否経路は存在しないことを実コードで確認

## 警告（非ブロッキング）

- なし