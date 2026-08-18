# 修正計画

## 結果: 修正計画確定

## 指摘カバレッジ
| finding ID / 出典 | 修正権限の根拠 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 分類 | 受入条件・修正境界 |
|-------------------|----------------|------|----------------------|-----------------------------|------|----------------------|
| `F-PR-IMAGE-LIFECYCLE` (`AI-NEW-infra-github-L309` / `ai-antipattern-review.md` new #1 等) | `remediation_regression` | `src/infra/github/prReviewImageAttachments.ts:390-413` 等 | `F-PR-IMAGE-LIFECYCLE` | 一時画像ディレクトリ生成後の例外/キャンセル経路でcleanupが呼ばれない → `try-finally` による保証境界の不足 → ライフサイクル管理の退行 | 構造 | 成功・失敗・キャンセル・例外すべてで削除されること。周辺リファクタリングは除外。 |

## 欠陥 family の最終状態
| 修正単位 | 契約の正本 | 完了対象の全不変条件 | 変更後の責務・正本 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|----------|------------|----------------------|--------------------|--------------------|--------------------------|----------------|
| `F-PR-IMAGE-LIFECYCLE` | PRレビュー画像の一時保存仕様 | 生成された一時ディレクトリは、処理の成否に関わらず必ず削除されること | 変更なし | 生成: `downloadPrReviewImageAttachments` / Consumer: `executePipeline`, `executeDefaultAction`, `addTask` | 正常終了 / token取得失敗 / workflow実行例外 / 対話キャンセル | なし |

## 要求シナリオ（条件付き）

対象外 — 該当する修正単位なし

## 実施順序
| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|------|----------|------|--------|----------|----------------|
| 1 | `F-PR-IMAGE-LIFECYCLE` | 局所修正 | なし | `src/infra/github/prReviewImageAttachments.ts` | `getToken` 失敗時にディレクトリが削除されること |
| 2 | `F-PR-IMAGE-LIFECYCLE` | 局所修正 | 1 | `src/features/pipeline/execute.ts` | `runWorkflow` 例外時に `attachmentCleanup` が実行されること |
| 3 | `F-PR-IMAGE-LIFECYCLE` | 局所修正 | 1 | `src/app/cli/routing.ts` | ワークフロー/モード選択キャンセル時に `prAttachmentsCleanup` が実行されること |
| 4 | `F-PR-IMAGE-LIFECYCLE` | 局所修正 | 1 | `src/features/tasks/add/index.ts` | ワークフロー選択キャンセルおよび `saveTaskFile` 失敗時に `cleanup` が実行されること |

## 制約適合性
| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 | 品質ゲート |
|----------|--------------|--------------------------|-----------------------------|----------|--------------|
| `F-PR-IMAGE-LIFECYCLE` | コーディングポリシー (Fail Fast) | `try-finally` による cleanup の集約。個別の return 前に呼ぶ方式は漏れが発生しやすいため不採用。 | 各経路で意図的に例外/nullを発生させ、`fs.existsSync` でディレクトリ消失を確認するテスト | ライフサイクルの不変条件を構造的に保証し、退行を解消する | `npm test` (新規追加する退行確認テスト) |

## 再計画事項
- なし