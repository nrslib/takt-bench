# v2 結果（repo 検証 judge による確定値・2026-07-08 再採点）

- 題材: S2 = タスク管理サービス層（テスト60固定）、S1 = イベントソーシング在庫管理（テスト51固定）
- ワークフロー: backend-for-local-llm / backend-cqrs-for-local-llm
- 編成: baseline = 判定 codex・ワーカー ローカル（無圧縮 resume）、codex = 全役割 codex、refresh = ワーカー毎ステップ新セッション
- 採点: repo 検証 judge ×3（旧 diff-only の数字は廃止。各アーカイブに judge-repo-verified-s*.json）

## S2（タスク管理）

| 編成 | overall ×3 | robustness ×3 |
|------|-----------|---------------|
| codex 天井 | **8, 8, 8** | 7, 7, 8 |
| baseline r1 | 7, 7, 6 | 7, 6, 5 |
| baseline r2 | 6, 7, 7 | 6, 7, 6 |
| baseline r3 | 対立エスカレーション（実在の契約違反、正しい停止） | — |
| refresh r1 | 5, 5, 5 | 5, 5, 6 |

## S1（イベントソーシング）

| 編成 | overall ×3 | robustness ×3 |
|------|-----------|---------------|
| codex 天井 | 7, 8, 7 | 6, 7, 7 |
| baseline r1 | 7, 8, 6 | 6, 7, 5 |
| baseline r2 | 7, 6, 6 | 6, 5, 5 |
| baseline r3 | 7, 7, 6 | 5, 5, 5 |

## 読み

- 難しい題材（S1）ではローカル編成は天井と同水準（中心7 vs 7）。簡単な題材（S2）では天井が8に伸び、約1点差が開く
- refresh は完走しても品質5（3回一致）— 記憶全損は収束だけでなく品質も壊す
- robustness は全編成の弱点だが、codex 天井が常に1点程度上
