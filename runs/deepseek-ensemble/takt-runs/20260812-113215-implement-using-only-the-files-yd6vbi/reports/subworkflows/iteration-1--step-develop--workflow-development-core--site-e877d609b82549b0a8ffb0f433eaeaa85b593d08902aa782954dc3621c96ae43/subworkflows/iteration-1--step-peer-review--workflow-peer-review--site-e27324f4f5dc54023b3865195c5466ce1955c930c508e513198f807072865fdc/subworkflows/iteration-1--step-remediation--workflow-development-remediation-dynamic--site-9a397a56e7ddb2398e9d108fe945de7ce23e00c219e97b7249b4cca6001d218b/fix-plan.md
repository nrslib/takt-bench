# 修正計画

## 結果: 修正計画確定 / タスク全体の再計画が必要

## 指摘カバレッジ
| finding ID / 出典 | 修正権限の根拠 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 分類 | 受入条件・修正境界 |
|-------------------|----------------|------|----------------------|-----------------------------|------|----------------------|
| `AI-NEW-routing-L283` | `remediation_regression` | `src/app/cli/routing.ts:283` | `F-INTERACTIVE-RESULT-TOTALITY` | `result!` による非null assertion $\rightarrow$ 型安全性の放棄 $\rightarrow$ モード追加時の handler 漏れをコンパイル時に検出できない | 構造 | 非nullの選択モードは assertion なしで必ず `InteractiveModeResult` を生成する。result 生成から dispatch までの接続のみを修正。 |
| `FU-PRIMG-TERMINAL-EXIT-TEST` | `direct_acceptance_criterion_violation` | `src/__tests__/cli-routing-pr-resolve.test.ts:367-387` | `F-PR-IMAGE-LIFECYCLE` | cleanup 呼び出しの検証不足 $\rightarrow$ 偽陽性の可能性 $\rightarrow$ exit 直前の明示的な cleanup 実行を決定的に観測できていない | 局所 | PR head branch 欠落時に cleanup が exit より前に呼ばれることをテストで観測する。証拠補完のみを対象とする。 |

## 欠陥 family の最終状態
| 修正単位 | 契約の正本 | 完了対象の全不変条件 | 変更後の責務・正本 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|----------|------------|----------------------|--------------------|--------------------|--------------------------|----------------|
| `F-INTERACTIVE-RESULT-TOTALITY` | `INTERACTIVE_MODES` (closed union) | 全ての `InteractiveMode` は対応する handler を持ち、必ず `InteractiveModeResult` を生成する | 変更なし（型定義の整合性回復） | `selectInteractiveMode` $\rightarrow$ `switch` $\rightarrow$ `dispatchConversationAction` | `SCN-F-INTERACTIVE-RESULT-TOTALITY-P1` / `N1` | なし |
| `F-PR-IMAGE-LIFECYCLE` | PR 添付ファイルライフサイクル管理 | `process.exit(1)` を伴う異常終了時も、生成された添付ファイルの cleanup が確実に実行される | 変更なし（検証証拠の追加） | `resolvePrInput` $\rightarrow$ `prAttachmentsCleanup` $\rightarrow$ `process.exit(1)` | `SCN-F-PR-IMAGE-LIFECYCLE-P1` / `N1` | なし |

## 要求シナリオ（条件付き）

対象外 — 該当する修正単位なし

## 実施順序
| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|------|----------|------|--------|----------|----------------|
| 1 | `F-PR-IMAGE-LIFECYCLE` | 局所修正 | なし | `src/__tests__/cli-routing-pr-resolve.test.ts` | `prAttachmentsCleanup` モックが `process.exit` 前に呼ばれたことを assert し、テストがパスすること |
| 2 | `F-INTERACTIVE-RESULT-TOTALITY` | 局所修正 | なし | `src/app/cli/routing.ts` | `result!` が排除され、全モード経路で型が確定していることの静的確認 |

## 制約適合性
| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 | 品質ゲート |
|----------|--------------|--------------------------|-----------------------------|----------|--------------|
| `F-PR-IMAGE-LIFECYCLE` | 裁定受入条件 | `vi.fn()` による cleanup モックの呼び出し検証。既存の throw-based exit シミュレーションを利用しつつ、呼び出し順序を検証。 | `npm test src/__tests__/cli-routing-pr-resolve.test.ts` | 実装済みの cleanup 呼び出しを決定的に観測し、受入条件を充足する。 | `npm test` |
| `F-INTERACTIVE-RESULT-TOTALITY` | コーディングポリシー (Fail Fast) | `switch` 文の構造を整理し、型推論で `InteractiveModeResult` を確定させる。`default` case での runtime error 等による exhaustive check を導入。 | TypeScript コンパイラによる型チェック | non-null assertion を排除し、コンパイル時の型安全性を回復させる。 | `npm run build` |

## 再計画事項
- なし