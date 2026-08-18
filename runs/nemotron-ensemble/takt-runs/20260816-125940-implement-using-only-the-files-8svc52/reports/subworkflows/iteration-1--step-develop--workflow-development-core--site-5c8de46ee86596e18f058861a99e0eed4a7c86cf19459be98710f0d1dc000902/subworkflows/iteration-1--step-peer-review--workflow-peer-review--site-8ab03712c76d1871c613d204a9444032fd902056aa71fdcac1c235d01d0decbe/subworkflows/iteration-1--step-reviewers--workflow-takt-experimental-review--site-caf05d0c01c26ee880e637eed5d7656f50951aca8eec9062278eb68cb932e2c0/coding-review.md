# コーディングレビュー

## 結果: REJECT

## サマリー
PR/MR から画像をダウンロードし添付ファイルとして管理する機能を実装していますが、ダウンロードしたファイルをタスクディレクトリに保存し `order.md` に反映させる処理（`saveImageAttachments`）がどこからも呼び出されておらず、機能が完結していません。

## 契約入口チェック

| 入口・経路 | 元要件 | 実装根拠 | テスト根拠 | 判定 | 例外・未確認の根拠 |
|-----------|--------|----------|------------|------|-------------------|
| `addTask` (PRオプション) | PR画像取得・保存 | `src/features/tasks/add/index.ts:200` | 未確認 | ❌ | ダウンロードは行うが保存処理が未呼び出し |
| `resolveTaskContent` (Pipeline) | PR画像取得・保存 | `src/features/pipeline/steps.ts:227` | 未確認 | ❌ | ダウンロードは行うが保存処理が未呼び出し |

## 非finding化した懸念
なし

## 問題系列の完了走査

| family_tag / 変更契約 | 担当箇所 | 観測可能な不変条件 | 同じ原因で変更される理由 | 追加した経路 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・fallback・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|----------|----------------------|--------------------------|--------------|------------------|----------------------|---------------------------------------------------|----------------------------|------------|------|
| image-attachment-persistence | `src/features/tasks/attachments.ts` | ダウンロードされた画像はタスクディレクトリに保存され、`order.md` に記載されること | 画像の自動収集機能の実装 | `addTask` / `resolveTaskContent` | `src/infra/github/pr.ts:432` | `src/features/tasks/attachments.ts:349` | なし | なし | 保存処理の呼び出し元 | CODE-NEW-attachments-save |

## 今回の指摘（new）
| # | finding_id | family_tag | 重大度 | 場所 | 問題 | 影響 | Authorization basis | 初回に含まれなかった理由 | 修正案 |
|---|------------|------------|--------|------|------|------|---------------------|------------------------------|--------|
| 1 | CODE-NEW-attachments-save | image-attachment-persistence | High | `src/features/tasks/attachments.ts:349` | `saveImageAttachments` がどこからも呼び出されていない | 画像が一時ディレクトリに留まり、タスクディレクトリに保存されず `order.md` にも記載されないため、機能が動作しない | direct_acceptance_criterion_violation | N/A | `saveTaskFile` 内部またはその呼び出し元で、`attachments` が存在する場合に `saveImageAttachments` を実行するように修正する |

## 継続指摘（persists）
なし

## 解消済み（resolved）
なし

## 裁定済みの対象外指摘
なし

## 再開指摘（reopened）
なし

## 検証証跡
- 差分確認: `src/features/tasks/attachments.ts` の `saveImageAttachments` 定義を確認し、プロジェクト全域で grep を実行したが、定義場所以外に呼び出し箇所がないことを確認した。
- ビルド: 未確認
- テスト: 未確認

## 再走査証跡（2回目以降のレビューで必須）
なし