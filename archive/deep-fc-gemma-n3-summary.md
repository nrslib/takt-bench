# deep+FC gemma 基準系 n=3 サマリー（2026-07-05〜06）

combo: qwen-coder_gemma-reviewer-fc（coder=qwen3-coder-next / レビュアー=gemma4:31b ×4 / manager・final-gate=codex）
takt: 0.49.0（#973 時点で凍結、3走同一条件）

| run | 結末 | 歩数 | 時間 | judge overall | 台帳 |
|-----|------|------|------|---------------|------|
| 1 | 人間エスカレーション（conflict 規則による ABORT） | 17/20 | 73m16s | 5 | 11 resolved / 1 open(high) |
| 2 | max_steps 上限 | 20/20 | 110m15s | 5 | 10 resolved / 3 open(med/low) |
| 3 | COMPLETE（final-gate 通過） | 8/20 | 25m33s | 7 | 5 resolved / 0 open |

- COMPLETE 率 1/3。judge 平均 5.7（codex-all 基準 = 8、16分、COMPLETE）
- 分散の源は coder の「一段ひねった状態設計」（投影の予約ID個別管理）を引けるか。引けた run 3 は 8歩で通過し design 8
- 引けなかった run 1/2 でも偽りの COMPLETE はゼロ: 台帳が open を保持し続け、エスカレーションまたは上限で停止（品質floor の保証）
- run 1 では偽の解消確認をクロスレビューの conflict が阻止。manager(codex) は3走で計 conflict 裁定を継続実施
