# v3 結果: Issue #792（PR画像→attachments）を TAKT 本体（89k行）に実装

- 題材: TAKT リポジトリ main @ 34bbab58 + 発注書 `task-i792.md`
- ワークフロー: takt-default-for-local-llm（max_steps 200）
- 採点: **repo 検証 judge**（公式。README「品質採点」参照）。旧 diff-only judge の数字は参考値として各アーカイブの `judge.json` に残るが公表には使わない

## 完走走行のスコア（repo 検証 judge）

| 走 | ステップ | overall | correctness | design | readability | robustness | test_quality |
|----|---------|---------|-------------|--------|-------------|------------|--------------|
| codex 単独 | 12 | **6** | 6 | 6 | 7 | 5 | 6 |
| compact-r1 | 17 | **5** | 7 | 6 | 8 | 5 | 6 |
| compact-r2 | 9 | **6** | 7 | 7 | 8 | 5 | 7 |
| compact-r3 | 19 | **6** | 7 | 7 | 8 | 7 | 6 |

主な検証済み指摘（詳細は各アーカイブの `judge-repo-verified.json`）:

- codex: 画像1枚の失敗でタスク作成全体が失敗 / `gh` CLI 慣例から外れた素の fetch / PNG magic bytes が4バイトのみ
- compact-r1: pipeline 実行後に staged attachments を削除する退行 + その退行を固定する追加テスト / fetch body reader 未解放
- compact-r2: 例外時の temp dir 残留 / 一時ファイルの mode 未指定 / 1画像の失敗が全体を殺す
- compact-r3: 素の `takt --pr` 経路で画像解決が未配線 + それを検出するテスト不在

## 非完走の記録

- compact 試行群: サイクル予算120の誤殺×3（→takt#1001、予算600で解消）、editエラー予算25発火、reviewers並列二重エラー、opencode生成中toolcallエラー（41ステップ397分）
- continue-r2: 判定エージェントの裁定停止（非生産的、10ステップ97分）
- continue-r1 / continue-r3: 測定中

## 読み

全走が robustness（5/5/5/7）に沈み、readability は全走 8。書く力より守りの観点が編成に不足。
突破欠陥は5クラス（劣化動作 / ライフサイクル / 要求配線漏れ / テスト主客転倒 / 慣例逸脱）に分類され、
v3.2 編成強化パッケージ（契約・ライフサイクル + ロバストネスの専任レビューエージェント2体 + final-gate 要求トレース + semantics/archの手順強化）で対策し再測定する。
