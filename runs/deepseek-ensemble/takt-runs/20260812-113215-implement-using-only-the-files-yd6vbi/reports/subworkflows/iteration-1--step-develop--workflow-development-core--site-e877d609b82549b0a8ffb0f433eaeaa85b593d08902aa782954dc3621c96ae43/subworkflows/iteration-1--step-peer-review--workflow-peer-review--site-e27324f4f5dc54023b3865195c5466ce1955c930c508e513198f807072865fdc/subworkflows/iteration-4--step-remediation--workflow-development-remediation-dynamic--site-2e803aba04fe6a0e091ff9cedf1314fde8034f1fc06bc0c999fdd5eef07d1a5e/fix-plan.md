# 修正計画

## 結果: 修正計画確定 / タスク全体の再計画が必要

## 指摘カバレッジ
| finding ID / 出典 | 修正権限の根拠 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 分類 | 受入条件・修正境界 |
|-------------------|----------------|------|----------------------|-----------------------------|------|----------------------|
| `AI-NEW-src-app-cli-routing-inputs-L67` / `ai-antipattern-review.md` | `remediation_regression` | `src/app/cli/routing-inputs.ts:67-69` | `PRIMG-CAPABILITY-NORMALIZATION` | optional capability判定とidentity fallbackがconsumerで重複 → 共通所有者の不在 → 意味知識の重複 | 構造 | 判定とfallback生成の一元化。3 consumerの移行。 |
| `ADJ-FOLLOWUP-src-features-tasks-add-L198` / 裁定時比較 | `accepted_family_unvisited_consumer` | `src/features/tasks/add/index.ts:198-200` | `PRIMG-CAPABILITY-NORMALIZATION` | 上記と同じ | 構造 | 同上 |

## 欠陥 family の最終状態
| 修正単位 | 契約の正本 | 完了対象の全不変条件 | 変更後の責務・正本 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|----------|------------|----------------------|--------------------|--------------------|--------------------------|----------------|
| `PRIMG-CAPABILITY-NORMALIZATION` | `GitProvider` インターフェース | プロバイダーの capability に応じて resolver または identity fallback (`attachments: [], cleanup: no-op`) を一貫して返すこと | `src/infra/git/index.ts` に共通解決関数を配置し、判定と fallback 生成の正本とする | `GitProvider` 定義 → `resolvePrImages` (共通関数) → `routing-inputs.ts`, `steps.ts`, `add/index.ts` (consumer) | [SCN-PRIMG-CAPABILITY-NORMALIZATION-P1], [SCN-PRIMG-CAPABILITY-NORMALIZATION-N1] | `routing-inputs.ts`, `steps.ts`, `add/index.ts` 内の重複判定ロジック |

## 要求シナリオ（条件付き）

Scenario: [SCN-PRIMG-CAPABILITY-NORMALIZATION-P1] 対応プロバイダーではresolverが実行される
  Given `GitProvider.resolvePrReviewImageAttachments` が定義されているプロバイダー
  When `resolvePrImages` を呼び出す
  Then 定義済みの resolver が実行され、その結果（画像リストとcleanup関数）が返される

Scenario: [SCN-PRIMG-CAPABILITY-NORMALIZATION-N1] 非対応プロバイダーではidentity fallbackが返される
  Given `GitProvider.resolvePrReviewImageAttachments` が undefined のプロバイダー
  When `resolvePrImages` を呼び出す
  Then エラーにならず、`attachments: []` および `cleanup: () => undefined` が返される

## 実施順序
| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|------|----------|------|--------|----------|----------------|
| 1 | `PRIMG-CAPABILITY-NORMALIZATION` | 境界変更 | なし | `src/infra/git/index.ts` | 共通関数 `resolvePrImages` の実装。対応/非対応プロバイダーの両方で期待通りに動作すること。 |
| 2 | `PRIMG-CAPABILITY-NORMALIZATION` | 利用側移行 | 1 | `src/app/cli/routing-inputs.ts`, `src/features/pipeline/steps.ts`, `src/features/tasks/add/index.ts` | 重複していた三項演算子ロジックが `resolvePrImages` 呼び出しに置換されていること。 |
| 3 | `PRIMG-CAPABILITY-NORMALIZATION` | 削除 | 2 | 上記3ファイル | 旧の fallback 生成コードが完全に削除されていること。 |

## 制約適合性
| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 | 品質ゲート |
|----------|--------------|--------------------------|-----------------------------|----------|--------------|
| `PRIMG-CAPABILITY-NORMALIZATION` | コーディングポリシー (DRY) | `infra/git` モジュールに共通関数を導入し、判定ロジックをカプセル化する。個別の consumer で判定を続ける案は DRY 違反のため却下。 | `GitProvider` の Mock を用いたユニットテスト。resolver の呼び出し回数と返り値の型を確認。 | 同一契約の共通所有者を定義し、重複を排除しているため DRY に適合。 | `npm test` |

## 再計画事項
- なし