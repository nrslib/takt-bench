# レビュー指摘裁定

## 結果: 修正対象あり

## 裁定サマリー

対象は最新 reviewers 配下の `architecture-review.md`、`coding-review.md`、`security-review.md`、`testing-review.md`、`ai-antipattern-review.md`。提出 finding は `ai-antipattern-review.md` の4件で、1件を修正対象、3件を非修正対象とした。

修正対象は2 family。`result!` により interactive mode の網羅性を型検査から隠した remediation regression と、既に採用済みのPR画像 lifecycle familyにおける terminal exit 回帰テストの証拠欠落である。pipeline と `add --pr` のcleanup漏れ主張は現行の `try/finally` と直接テストに反証され、routing-inputs の条件付き展開は意味のあるoptional property制御であるため除外した。

## 修正対象 family

| family | finding ID / 出典 | 修正権限の根拠 | 根拠 | 問題 → 根本原因 | 関係する契約経路 | 受入条件 | 修正境界 |
|--------|-------------------|----------------|------|-------------------|--------------------|----------|----------|
| `F-INTERACTIVE-RESULT-TOTALITY` | `AI-NEW-routing-L283` / 最新 `ai-antipattern-review.md` | 今回差分の退行 | `src/app/cli/routing.ts:152,221-283`、`src/core/models/interactive-mode.ts:13-16`、`src/features/interactive/modeSelection.ts:20-48` | 現行5モードでは各switch分岐がresultを設定するため現在のTypeErrorは再現しない。しかし remediation 前のdefinite-assignment保証が `InteractiveModeResult \| undefined` と `result!` に置換され、モード追加時の未処理分岐を型検査で検出できなくなった → cleanup境界拡張時に制御フロー上の全域性を非null assertionで迂回した | 定義: `INTERACTIVE_MODES` / 選択: `selectInteractiveMode` / 生成: assistant、grill-me、passthrough、quiet、persona各runner / consumer: `dispatchConversationAction` / terminal: execute、save_task、create_issue、cancel | 非nullの選択モードはassertionや未検証castなしで必ず `InteractiveModeResult` を生成する。新モード追加時のhandler漏れをコンパイル時または明示的なexhaustive checkで検出できる。既存5モードとcancel・dispatchの挙動を維持する | result生成からdispatchまでの型安全な接続だけを最小変更する。新しいfallback、黙示的早期return、新モード追加、routing全体の再設計は除外する |
| `F-PR-IMAGE-LIFECYCLE` | `FU-PRIMG-TERMINAL-EXIT-TEST` / 裁定時follow-up | 採用済み family の閉鎖、受入条件への直接違反 | `review-resolution.md` の lifecycle 受入条件、`fix-report.md` の `OBL-3-TERMINAL-EXIT`、`fix-verification.md` のterminal exit完了主張、`src/app/cli/routing.ts:319-327`、`src/__tests__/cli-routing-pr-resolve.test.ts:367-387` | exit前cleanupの実装は存在するが、完了証拠とされたテストはexit・エラー表示・保存未実行しか検証せず、PR attachment cleanupを設定・観測していない → 実 `process.exit` がfinallyを迂回する反例に対し、完了報告とテストの証明能力が一致していない | 生成: `resolvePrInput` / 所有: `prAttachmentsCleanup` / consumer: interactive `save_task` / failure: PR head branch欠落 / terminal: cleanup後の `process.exit(1)` | head branch欠落時にPR attachment cleanupがexitより前に呼ばれることを決定的テストで観測する。`process.exit` をthrowへ置換したことでouter finallyが動いただけの偽陽性を排除する。既存exit code、エラー文、cleanup冪等性を維持する | terminal-exit回帰テストの証拠補完だけを対象とする。cleanup設計の再変更、全 `process.exit` の抽象化、他CLI終了経路、画像処理方式は除外する |

## 指摘ごとの裁定

| finding ID / 出典 | 技術的妥当性 | 裁定 | 対象 family | authorization basis | 初回に含まれなかった理由 | 根拠 |
|-------------------|----------------|------|-------------|---------------------|--------------------------|------|
| `AI-NEW-routing-L283` / 最新 `ai-antipattern-review.md` | 限定的に確認済み。現在のTypeError主張は反証済みだが、型安全性の退行は確認済み | `actionable` | `F-INTERACTIVE-RESULT-TOTALITY` | `remediation_regression` | 該当なし | `InteractiveMode` は現行5値の閉じたunionで、switchは全値を処理するため現在の `result === undefined` 経路はない。一方、`src/app/cli/routing.ts:283` の `result!` は将来のunion追加時にもhandler漏れを隠し、今回のcleanup remediation以前にあったdefinite-assignment保証を失わせている |
| `AI-NEW-pipeline-L94` / 最新 `ai-antipattern-review.md` | 反証済み | `no_issue_after_verification` | なし | なし | 該当なし | `src/features/pipeline/execute.ts:43-96` ではtaskContent取得後の全return・throwが同じfinallyを通り、`attachmentCleanup` が実行される。`pipelineExecution.test.ts` はworkflowの既知失敗と例外でcleanup 1回を直接検証している |
| `AI-NEW-addTask-L243` / 最新 `ai-antipattern-review.md` | 反証済み | `no_issue_after_verification` | なし | なし | 該当なし | `src/features/tasks/add/index.ts:235-245` で `saveTaskFile` はtry内、`resolved.cleanup()` はfinally内にある。`addTask.test.ts` の保存rejectケースは例外伝播とcleanup 1回を直接検証している |
| `AI-NEW-routing-inputs-L68` / 最新 `ai-antipattern-review.md` | 反証済み | `no_issue_after_verification` | なし | なし | 該当なし | 指摘箇所はresolver呼出しの有無を選ぶ必要な分岐である。返却時の条件付き展開も空配列時にoptional `attachments` property自体を省略する意味を持つ。破損シナリオ、型安全性違反、同じ契約知識の重複は示されていない |
| `FU-PRIMG-TERMINAL-EXIT-TEST` / 裁定時follow-up | 確認済み | `actionable` | `F-PR-IMAGE-LIFECYCLE` | `direct_acceptance_criterion_violation` | remediation の `fix-report.md` と `fix-verification.md` がterminal exit回帰テストを完了済みと報告し、最新reviewersもその前提を採用したため | `cli-routing-pr-resolve.test.ts:367-387` はcleanup mockを設定せず、cleanupがexitより前に呼ばれたことをassertしていない。採用済みfamilyの受入条件に対する証拠が未閉鎖である |

## 未解決の前提

- なし。要求・計画・指摘間に、現行前提のまま修正対象を確定できない競合はない。タスク全体の再計画は不要。