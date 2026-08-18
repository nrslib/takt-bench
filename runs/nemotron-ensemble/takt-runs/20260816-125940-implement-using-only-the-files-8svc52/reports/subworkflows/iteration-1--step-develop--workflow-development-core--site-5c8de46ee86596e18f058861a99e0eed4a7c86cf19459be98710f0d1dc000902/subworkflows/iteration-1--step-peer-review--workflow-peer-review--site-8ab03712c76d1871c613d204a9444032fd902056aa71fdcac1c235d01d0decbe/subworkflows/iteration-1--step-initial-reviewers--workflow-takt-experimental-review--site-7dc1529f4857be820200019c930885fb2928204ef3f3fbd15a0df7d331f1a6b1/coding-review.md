# コーディングレビュー

## 結果: REJECT

## サマリー
PRコメントからの画像ダウンロード機能が実装されましたが、一時ファイルの管理に重大な欠陥（衝突・リーク）があり、また GitLab 環境でのダウンロード実装が完全に欠落しているため、受入不能と判定します。

## 契約入口チェック
| 入口・経路 | 元要件 | 実装根拠 | テスト根拠 | 判定 | 例外・未確認の根拠 |
|-----------|--------|----------|------------|------|-------------------|
| GitHub PR 画像抽出 | PR本文・コメントからURL抽出 | `src/infra/github/pr.ts:436` | `src/__tests__/pr-image-attachments.test.ts` | ✅ | なし |
| 画像ダウンロード | 安全な形式のダウンロード | `src/infra/github/image-downloader.ts:17` | 未確認 | ⚠️ | 境界値テスト不足 |
| ローカル保存 | `attachments/` への配置 | `src/features/tasks/attachments.ts:90` | 未確認 | ✅ | なし |
| order.md 追記 | 添付画像セクションの追加 | `src/features/tasks/attachments.ts:37` | 未確認 | ✅ | なし |
| GitLab PR 画像抽出 | GitLab MRからも抽出 | `src/infra/gitlab/pr.ts:240` | 未確認 | ❌ | 抽出のみでダウンロード未実装 |

## 非finding化した懸念
なし

## 問題系列の完了走査
| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|----------|----------------------|--------------------------|--------------|------------------|----------------------|---------------------------------------------------|----------------------------|------------|------|
| image-lifecycle | `src/features/pipeline/steps.ts` | 一時ファイルは一意であり、処理後消去される | リソースリークとファイル衝突の防止 | `/tmp` への直接保存 | `steps.ts:236` | `attachments.ts:108` | 並列実行時の衝突 | なし | 削除経路 | CODE-NEW-pipeline-steps-L236 |
| gitlab-support | `src/infra/gitlab/pr.ts` | GitLab MR の画像も保存される | プロバイダー間の機能整合性 | GitLab MR 画像抽出経路 | `pr.ts:240` | 未実装 | ダウンロード呼び出しなし | なし | 全経路 | CODE-NEW-gitlab-pr-L240 |

## 今回の指摘（new）
| # | finding_id | family_tag | 重大度 | 場所 | 問題 | 影響 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|------------|------------|--------|------|------|------|---------------------|------------------------------|--------|
| 1 | CODE-NEW-pipeline-steps-L236 | image-lifecycle | High | `src/features/pipeline/steps.ts:236` | 一時ファイルを `/tmp/image-n.png` という固定名で保存し、削除処理がない | ファイル衝突によるデータ破損および `/tmp` へのリソースリーク | direct_acceptance_criterion_violation | 初回 | `os.tmpdir()` と `randomUUID()` を使用し、`finally` ブロックで削除する |
| 2 | CODE-NEW-gitlab-pr-L240 | gitlab-support | High | `src/infra/gitlab/pr.ts:240` | 画像URLの抽出のみ行い、ダウンロードおよび保存処理を呼び出していない | GitLab 環境において画像添付機能が動作しない | direct_acceptance_criterion_violation | 初回 | GitLab 用のダウンローダーを実装し、抽出後の URL を処理に回す |
| 3 | CODE-NEW-image-downloader-L19 | image-lifecycle | Medium | `src/infra/github/image-downloader.ts:19` | URL プレフィックスチェックが GitHub 専用に固定されている | GitLab 等の他プロバイダーの URL が全て拒絶される | direct_acceptance_criterion_violation | 初回 | ダウンローダーをインターフェース化し、プロバイダーごとにバリデーションを切り替える |

## 継続指摘（persists）
なし

## 解消済み（resolved）
なし

## 裁定済みの対象外指摘
なし

## 再開指摘（reopened）
なし

## 検証証跡
- 差分確認: `src/features/pipeline/steps.ts`, `src/features/tasks/add/index.ts`, `src/infra/github/image-downloader.ts`, `src/infra/gitlab/pr.ts` 等の変更を確認。
- ビルド: 未確認
- テスト: `src/__tests__/pr-image-attachments.test.ts` の存在を確認したが、境界値（サイズ上限・型チェック）の網羅性は未確認。

## 再走査証跡（2回目以降のレビューで必須）
該当なし（初回レビュー）