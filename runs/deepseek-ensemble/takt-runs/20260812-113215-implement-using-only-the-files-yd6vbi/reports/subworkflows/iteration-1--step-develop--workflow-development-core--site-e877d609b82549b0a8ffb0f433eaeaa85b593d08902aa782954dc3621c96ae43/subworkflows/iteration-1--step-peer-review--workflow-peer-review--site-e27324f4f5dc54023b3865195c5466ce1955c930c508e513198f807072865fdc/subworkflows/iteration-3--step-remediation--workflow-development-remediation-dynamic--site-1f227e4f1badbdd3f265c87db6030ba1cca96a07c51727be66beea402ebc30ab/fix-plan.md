# 修正計画

## 結果: 修正計画確定

## 指摘カバレッジ
| finding ID / 出典 | 修正権限の根拠 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 分類 | 受入条件・修正境界 |
|-------------------|----------------|------|----------------------|-----------------------------|------|----------------------|
| `FINAL-NEW-PRIMG-PROTECTED-SEGMENT-REWRITE` | `direct_acceptance_criterion_violation` | `src/infra/github/prReviewImageAttachments.ts:134-160` | `PROTECTED-REWRITE` | 非コード領域からURLを抽出するが、置換を本文全体に適用している $\rightarrow$ 保護領域（コードフェンス等）内の同一URLも置換される | 局所 | 通常本文のみ置換され、保護領域は完全に維持される。境界: `buildReplacedPrReview` |
| `FINAL-NEW-PRIMG-E2E-EVIDENCE` | `direct_acceptance_criterion_violation` | iteration 2 remediationの品質ゲート表 | `E2E-EVIDENCE` | Remediation後の成果物で E2E mock 成功を確認できない $\rightarrow$ 必須ゲートの再実行証跡がない | 環境要因により実証できない (実行のみ) | `npm run test:e2e:mock` が完了し、成功結果が記録される。境界: テスト実行と証跡記録のみ |

## 欠陥 family の最終状態
| 修正単位 | 契約の正本 | 完了対象の全不変条件 | 変更後の責務・正本 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|----------|------------|----------------------|--------------------|--------------------|--------------------------|----------------|
| `PROTECTED-REWRITE` | `extractPrReviewImageReferences` の受入条件 | 保護領域（コードフェンス、インラインコード、HTMLコメント）内の文字列は、いかなる置換からも保護される | 局所修正のため変更なし | 本文 $\rightarrow$ `splitNonCodeSegments` $\rightarrow$ 非コード領域のみ置換 $\rightarrow$ 再構成 $\rightarrow$ 出力 | `SCN-PROTECTED-REWRITE-P1`, `SCN-PROTECTED-REWRITE-N1` | なし |
| `E2E-EVIDENCE` | 品質ゲート定義 | 現行成果物における E2E mock 全ケース成功 | 局所修正のため変更なし | CLI $\rightarrow$ `add --pr` / 直接 `--pr` / pipeline `--pr` $\rightarrow$ E2E mock gate | 全テストケース成功 | なし |

## 要求シナリオ（条件付き）

Scenario: [SCN-PROTECTED-REWRITE-P1] 非コード領域の同一URLのみが置換される
  Given 通常本文に `![img](URL_A)` があり、同時にコードフェンス内に `![img](URL_A)` がある入力
  When `extractPrReviewImageReferences` を実行
  Then 通常本文は `[Image #1]` に置換され、コードフェンス内は `![img](URL_A)` のまま維持される

Scenario: [SCN-PROTECTED-REWRITE-N1] 保護領域のみにあるURLは置換されない
  Given インラインコード内またはHTMLコメント内にのみ `![img](URL_A)` がある入力
  When `extractPrReviewImageReferences` を実行
  Then 置換は行われず、元の文字列が完全に維持される

## 実施順序
| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|------|----------|------|--------|----------|----------------|
| 1 | `PROTECTED-REWRITE` | 局所修正 | なし | `src/infra/github/prReviewImageAttachments.ts` | `src/__tests__/prReviewImageAttachments.test.ts` への混在入力テスト追加と合格 |
| 2 | `E2E-EVIDENCE` | 後続確認 | `PROTECTED-REWRITE` | なし | `npm run test:e2e:mock` の成功ログの記録 |

## 制約適合性
| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 | 品質ゲート |
|----------|--------------|--------------------------|-----------------------------|----------|--------------|
| `PROTECTED-REWRITE` | `splitNonCodeSegments` の定義 | 本文全体への `replace` を廃止し、`splitNonCodeSegments` で得たセグメントのうち非コード領域のみに置換を適用して結合する方式を採用 | 混在入力（通常本文＋保護領域）に対する単体テスト | 抽出ロジックと置換ロジックで同一のセグメンテーション基準を共有するため | `npm test` |
| `E2E-EVIDENCE` | 品質ゲート定義 | 既存の E2E mock gate をそのまま実行する | `npm run test:e2e:mock` の標準出力 | 現行の全機能パスを網羅する既存テストスイートであるため | `npm run test:e2e:mock` |

## 再計画事項
- なし