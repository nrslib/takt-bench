# レビュアー監査レポート

監査日時: 2026-07-04T03:43:09.967Z / 監査人: codex gpt-5.5 + 機械検証

| combo | reviewer | 引用実在率 | 捏造引用 | テンプレ丸写し | 罠検出 | スコープ外指摘 | 思考漏れ | 総合点 |
|-------|----------|-----------|---------|---------------|--------|---------------|---------|--------|
| qwen-coder_gemma-reviewer | {"provider":"opencode","model":"ollama-cloud/gemma4:31b"} | 236/236 | 0 | 0 | 0捕捉/1残存 | 0 | なし | 6 |

## qwen-coder_gemma-reviewer (r1)

**総評**: 主要な projection 予約管理、initialState 不変性、CommandHandler 状態汚染は最終的に検出・解消確認できている。一方で version 二重管理というカタログ罠を見落としており、最終 APPROVE は監査基準では甘い。捏造・スコープ外要求・思考漏れは確認できない。

**判定整合性**: 最終ラウンドは複数系統で APPROVE だが、最終コードには T3（EventStore version の二重管理）が残っているため、最終 APPROVE は完全には整合しない。

| 罠 | 最終コードに残存 | レビューで指摘 | 備考 |
|-----|-----------------|---------------|------|
| T1 | ✅ なし | ✅ | 最終コードの StockProjection は productId ごとの reservations に reservationId→quantity を保持し、StockShipped で対象予約数量だけ onHand/reserved を減らしているため残存していない。全ラウンド中では supervisor-validation が projection の予約数量管理不備を指摘しており、最終版で resolved として扱っている。 |
| T2 | ✅ なし | — | available は getStock/lowStock/decide 内で onHand - reserved 合計から都度導出されており、状態として保持されていない。明示的な finding としては指摘されていない。 |
| T3 | ❌ 残存 | — | InMemoryEventStore は events 配列とは別に version を store 内へ保持しており、append 時にも current.version を参照している。イベント配列長から導出できる値を二重管理しているため T3 は残存。レビュー群は version 要件充足として扱っており、二重管理リスクは指摘していない。 |
| T4 | ✅ なし | — | domain.ts は types のみに依存し、CommandHandler は EventStore ポート型に依存している。依存方向違反は見当たらない。 |
| T5 | ✅ なし | — | domain/event-store/command-handler/projection/index に分割されており、index.ts への単一ファイル詰め込みではない。 |
| T6 | ✅ なし | ✅ | initialState は index.ts で一箇所定義され、deepFreeze された値として公開されている。過去ラウンドで shallow freeze / deepFreeze が指摘・確認されている。 |
| T7 | ✅ なし | ✅ | evolve は throw せず、入力 state を直接変更していない。architect-review が初期ラウンドで evolve の直接変更を指摘し、その後 resolved としている。 |
| T8 | ✅ なし | — | レビュー本文に tests/ や src/types.ts の変更要求は見当たらない。むしろ変更なしを確認している。 |
