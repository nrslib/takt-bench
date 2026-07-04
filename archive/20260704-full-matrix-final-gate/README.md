# 2026-07-04: 全 combo 一斉ベンチ（codex 最終ゲート + 最新 facet 世代）

同一条件（facet: 再走査証跡 #951 + T6 knowledge/family 集約 #953、final-gate タグ routing #954、
codex gpt-5.5 ゲート・judge・audit、題材: イベントソーシング在庫管理51テスト）での5 combo 比較。

| combo | 結果 | 時間 | ステップ | ゲート回数 | judge | rev_grade | 捏造引用 |
|---|---|---|---|---|---|---|---|
| codex-all | COMPLETE | 16分 | 6 | 1回で通過 | 8 | 6 | 0 |
| qwen-coder (review=codex) | COMPLETE | 43分 | 16 | 1回で通過 | 7 | 5 | 0 |
| qwen-coder_gemma-reviewer ※ | COMPLETE | 52分 | 18 | 3回（2差し戻し） | 6 | 6 | 0 |
| qwen-coder_qwen-coder-reviewer | **DNF**（ループモニターが非生産判定） | 35分 | 14 | 3回 | (7) | 4 | 1 |
| qwen-coder_qwen-instruct-reviewer | COMPLETE | 53分 | 18 | 3回（2差し戻し） | 7 | 3 | 0 |

※ gemma 行は同日午前の完走走行（archive/20260704-qwen-coder_gemma-reviewer_codex-final-gate-r1）。
  マトリクス一斉走行時は ollama-cloud のストリーム切断（socket closed）で 3/3 失敗。
  本アーカイブの qwen-coder_gemma-reviewer/ は最後の失敗走行（10周・部分コード judge 6）のログ。

## 所見

- codex-all の16分・ゲート1発通過が天井。レビュアーをローカル化すると周回とゲート差し戻しが増える
- coder-next 自己レビューは唯一の DNF（同じ指摘の繰り返しを codex ループモニターが停止）。
  コードスコア自体は 7 だが「収束させる」というレビュアーの職務を果たせない
- 397b はレビュー完走するが reviewer_grade 3 は全 combo 最低（審査の中身が薄い）
- gemma は reviewer_grade 6 で codex レビュアー(6)と並ぶ最高値。ただし当日の ollama-cloud
  不安定で成功率 1/4 — 信頼性はクラウド事業者依存（ローカル化の動機）
- 捏造引用はほぼ全滅（coder-next レビュアーの1件のみ）— facet 世代の効果
- 共通 coder + codex ゲートにより最終コード品質は 6-8 に収束。差が出るのは
  「収束できるか・何周かかるか・審査の中身・信頼性」
