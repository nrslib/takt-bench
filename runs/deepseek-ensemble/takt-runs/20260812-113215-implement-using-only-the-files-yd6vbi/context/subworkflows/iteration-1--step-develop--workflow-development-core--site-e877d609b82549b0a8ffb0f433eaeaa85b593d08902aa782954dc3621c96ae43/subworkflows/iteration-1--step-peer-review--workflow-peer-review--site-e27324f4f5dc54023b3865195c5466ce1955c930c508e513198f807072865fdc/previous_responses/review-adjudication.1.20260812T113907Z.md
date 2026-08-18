問題を、最新レビューレポートの各 finding を現在のコード・要求・契約へ照合し、重複を family 単位に統合して修正対象を確定する作業と整理しました。まず指定された Policy／Knowledge を全文確認し、その後に task、最新レポート、必要な差分と実コードを読み取ります。編集・テスト再実行は行いません。
Policy／Knowledge と最新 reviewer 群を読了しました。提出 finding は AI antipattern reviewer の4件です。既存の裁定履歴には同じ4件に加えて lifecycle の follow-up が記録されていますが、これを結論として流用せず、現行コードと remediation 証跡を再照合します。
現行コードの照合では、pipeline と `add --pr` の2件は `finally` により主張が反証されました。`routing-inputs` の条件付き展開も、空配列時に optional property 自体を省略する契約差があるため冗長ではありません。一方、`routing.ts` の `result!` は変更前の definite-assignment 検査を失わせたことが差分で確認でき、型安全性の remediation regression として残ります。あわせて、既存 lifecycle family の terminal-exit テストが cleanup を観測していない点を、同 family の完了証拠に限定して確認しています。
# レビュー指摘裁定

## 結果: 修正対象あり

提出4件を裁定し、2つの actionable family を確定しました。再計画は不要です。

## 修正対象 family

| family | finding | 権限根拠 | 不変条件・受入条件 | 修正境界 |
|---|---|---|---|---|
| `F-INTERACTIVE-RESULT-TOTALITY` | `AI-NEW-routing-L283` | `remediation_regression` | 非nullの `InteractiveMode` は assertion/cast なしで必ず `InteractiveModeResult` を生成し、モード追加時の handler 漏れを型検査または exhaustive check で検出できること | result生成から dispatch まで。`if (!result) return` による黙示的終了、新モード追加、routing 全体の再設計は除外 |
| `F-PR-IMAGE-LIFECYCLE` | `FU-PRIMG-TERMINAL-EXIT-TEST` | `direct_acceptance_criterion_violation` | PR head branch 欠落時、attachment cleanup が `process.exit(1)` より前に実行されることをテストで直接観測すること。exit mock が throw して `finally` を動かしただけの偽陽性を許さない | terminal-exit 回帰テストの補完のみ。cleanup 実装の再設計、他のCLI終了経路は除外 |

`AI-NEW-routing-L283` の現在の TypeError は、5値の閉じた union と全分岐を持つ switch により再現しません。しかし差分では、変更前の `let result: InteractiveModeResult` が `InteractiveModeResult | undefined` と `result!` に置換され、未処理モードを検出する型安全性が失われています。

follow-up の理由は、remediation 証跡が terminal-exit テストによる cleanup 検証を完了済みと報告した一方、[cli-routing-pr-resolve.test.ts](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/__tests__/cli-routing-pr-resolve.test.ts:367) が exit・エラー・保存未実行だけを検証し、cleanup の実行順を観測していなかったためです。

## 指摘ごとの裁定

| finding ID | disposition | 対象 family | 根拠 |
|---|---|---|---|
| `AI-NEW-routing-L283` | `actionable` | `F-INTERACTIVE-RESULT-TOTALITY` | 現在の undefined 経路は反証されたが、`result!` による型安全性の退行は確認済み |
| `AI-NEW-pipeline-L94` | `no_issue_after_verification` | なし | [execute.ts](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/features/pipeline/execute.ts:43) の全早期 return・throw は同じ `finally` を通る |
| `AI-NEW-addTask-L243` | `no_issue_after_verification` | なし | [index.ts](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/features/tasks/add/index.ts:235) で保存処理が `try`、cleanup が `finally` にある |
| `AI-NEW-routing-inputs-L68` | `no_issue_after_verification` | なし | 空配列時に optional `attachments` property 自体を省略する条件付き展開であり、意味のある契約差 |
| `FU-PRIMG-TERMINAL-EXIT-TEST` | `actionable` | `F-PR-IMAGE-LIFECYCLE` | 実装には exit 前 cleanup があるが、完了証拠とされたテストがその順序を検証していない |

未解決の前提・環境未確認事項はありません。次工程には上記2 family のみを修正対象として渡します。