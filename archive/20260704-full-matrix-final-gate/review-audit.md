# レビュアー監査レポート

監査日時: 2026-07-04T11:33:34.163Z / 監査人: codex gpt-5.5 + 機械検証

| combo | reviewer | 引用実在率 | 捏造引用 | テンプレ丸写し | 罠検出 | スコープ外指摘 | 思考漏れ | 総合点 |
|-------|----------|-----------|---------|---------------|--------|---------------|---------|--------|
| codex-all | {"provider":"codex","model":"gpt-5.5"} | 508/508 | 0 | 0 | 0捕捉/1残存 | 0 | なし | 6 |
| qwen-coder | {"provider":"codex","model":"gpt-5.5"} | 543/543 | 0 | 0 | 0捕捉/2残存 | 0 | なし | 5 |
| qwen-coder_gemma-reviewer | {"provider":"opencode","model":"ollama-cloud/gemma4:31b"} | 47/47 | 0 | 0 | 0捕捉/2残存 | 0 | なし | 4 |
| qwen-coder_qwen-coder-reviewer | {"provider":"opencode","model":"ollama-cloud/qwen3-coder-next"} | 198/199 | 1 | 0 | 1捕捉/3残存 | 0 | なし | 4 |
| qwen-coder_qwen-instruct-reviewer | {"provider":"opencode","model":"ollama-cloud/qwen3.5:397b"} | 258/258 | 0 | 0 | 0捕捉/3残存 | 0 | あり | 3 |

## codex-all (r1)

**総評**: 捏造引用、スコープ外修正要求、思考漏れは見当たらず、T5/T6 は適切に検出・解消追跡できている。一方で、最終コードに残る T2 を全レビューが見落として APPROVE しており、罠検出力は中程度にとどまる。

**判定整合性**: 最終ラウンドの APPROVE は完全には整合しない。T2（Projection が `available` を状態として保持する二重管理）が最終コードに残っているため、本来は少なくともこの点を指摘すべきだった。

| 罠 | 最終コードに残存 | レビューで指摘 | 備考 |
|-----|-----------------|---------------|------|
| T1 | ✅ なし | — | 最終コードの domain/projection は reservationId ごとに数量を保持し、StockShipped で対象予約だけを減算・削除している。全引当合計減算や全引当クリアはない。レポート群では欠陥としての指摘は見当たらない。 |
| T2 | ❌ 残存 | — | 最終コードの StockProjection は `stocks: Map<string, StockLevel>` に `available` を保持し、`updateStock()` で `available: onHand - reserved` を再計算して保存している。導出値を状態として持つため、カタログ上の二重管理が残存。レビュー群はこれを問題化せず、むしろ要件充足として扱っている。 |
| T3 | ✅ なし | — | InMemoryEventStore は別 version カウンタを持たず、`events.length` を version として返し、append でも `current.length` を expectedVersion と比較している。レビュー群で欠陥としての指摘はない。 |
| T4 | ✅ なし | — | domain は types のみに依存し、CommandHandler は EventStore ポート型に依存している。具象 store 依存や projection 依存はない。レビュー群で欠陥としての指摘はない。 |
| T5 | ✅ なし | ✅ | 最終コードは domain/event-store/command-handler/projection/index に分割済み。初回 architect-review が `ARCH-NEW-src-index-L50` として index.ts への責務集中を指摘している。 |
| T6 | ✅ なし | ✅ | 最終コードの公開 `initialState` は state 本体と `reservations` が freeze され、replay は `createInitialState()` の新規オブジェクトを使う。初回 architect-review と ai-antipattern-review が mutable initialState を指摘している。 |
| T7 | ✅ なし | — | 最終コードの `evolve` は既知 DomainEvent 各 variant を非破壊に適用し、throw していない。欠陥としての指摘は見当たらない。 |
| T8 | ✅ なし | — | レビュー群に tests/ や src/types.ts の修正要求は見当たらない。変更禁止対象は差分なしとして扱われている。 |

## qwen-coder (r1)

**総評**: レビュアーは初期状態の可変公開、責務分割、依存方向、ShipStock の予約数量追跡などは確認できている。一方で、既知罠のうち T3 と T7 を見落とし、低リスクな DRY 指摘に比べて本質的な状態管理・進化関数の堅牢性を取り逃がしているため、最終承認の品質は中程度以下。

**判定整合性**: 最終ラウンドの APPROVE は、T3 の version 二重管理と T7 の未知イベント握りつぶしが残っている点と整合しない。主要な既知罠が未検出のまま承認されている。

| 罠 | 最終コードに残存 | レビューで指摘 | 備考 |
|-----|-----------------|---------------|------|
| T1 | ✅ なし | ✅ | 最終コードは domain/projection とも reservationId ごとの数量を保持し、StockShipped で対象予約だけ減算している。複数引当時に全引当を減算・クリアする欠陥はない。レポートでも StockShipped の予約数量追跡は複数回確認されている。 |
| T2 | ✅ なし | — | available は StockProjection.getStock で onHand - reserved として導出され、状態としては保持されていない。ただし、レビューレポートは T2 を明示的な罠としては指摘していない。 |
| T3 | ❌ 残存 | — | InMemoryEventStore が events 配列とは別に version を保存している。version はイベント数から導出可能なため二重管理が残存しているが、どのレビューも指摘していない。 |
| T4 | ✅ なし | ✅ | domain は store/projection に依存せず、CommandHandler も EventStore ポートに依存している。依存方向は複数レビューで確認済み。 |
| T5 | ✅ なし | ✅ | 実装は domain/event-store/command-handler/projection に分割され、index.ts モノリスではない。アーキテクチャレビューで責務分割として確認されている。 |
| T6 | ✅ なし | ✅ | initialState は Object.freeze され、reservations も freeze されている。初期ラウンドで可変公開として指摘され、最終的に resolved 扱いになっている。 |
| T7 | ❌ 残存 | — | evolve は引数を直接変更せず throw もしないが、switch に default/exhaustive guard がなく、未知イベントを渡すと黙って複製 state を返す。設計判断の説明もなく、レポート群では未指摘。 |
| T8 | ✅ なし | ✅ | tests/ と src/types.ts への修正要求は見当たらない。複数レビューが変更禁止対象に差分なしと確認している。 |

## qwen-coder_gemma-reviewer (r1)

**総評**: レビュアー群はミューテーション、initialState 可変性、モノリス化は検出できているが、派生値 `available` と store `version` の二重管理を見逃した。さらに最終 architect-review は古い `src/index.ts` 前提の誤指摘を残しており、最終判定の規律が弱い。

**判定整合性**: 最終コードには T2 と T3 が残っているため、総合判定は REJECT が妥当。ただし final の architect-review は REJECT ではあるものの理由が最終コードと不整合で、AI/coding の APPROVE は未解決罠を見逃している。

| 罠 | 最終コードに残存 | レビューで指摘 | 備考 |
|-----|-----------------|---------------|------|
| T1 | ✅ なし | — | 最終コードの `StockProjection` は reservationId ごとの数量を `reservations` に保持し、`StockShipped` で該当予約分だけ減算している。レビューはこの罠自体を明示指摘していない。 |
| T2 | ❌ 残存 | — | `StockProjection` が `StockLevel.available` を内部状態として保持し、各イベントで更新している。`available` は `onHand - reserved` の導出値なので二重管理が残存。レビューはミューテーションだけを指摘し、この設計リスクは見逃している。 |
| T3 | ❌ 残存 | — | `InMemoryEventStore` がイベント配列とは別に `versions` を保持している。version は配列長から導出できるため二重管理が残存。全レビューで未指摘。 |
| T4 | ✅ なし | — | ドメインは store/projection に依存しておらず、`CommandHandler` も `EventStore` 型に依存しているため依存方向違反は見当たらない。問題としての指摘もない。 |
| T5 | ✅ なし | ✅ | 最終コードは `domain.ts`, `store.ts`, `handler.ts`, `projection.ts` に分割済み。過去ラウンドで `ARCH-NEW-index-split` として繰り返し指摘されている。 |
| T6 | ✅ なし | ✅ | `initialState` は `domain.ts` の一箇所で定義され、トップレベルと空 `reservations` が freeze されている。過去ラウンドで freeze/可変性問題として指摘済み。 |
| T7 | ✅ なし | ✅ | 最終 `evolve` は引数を直接変更せず、既知イベントで throw しない。過去ラウンドで非 null 確定演算子による throw リスクや直接変更が指摘されている。 |
| T8 | ✅ なし | — | レビュー本文に `tests/` や `src/types.ts` の修正要求は見当たらない。変更禁止対象への修正要求という罠は発生していない。 |

**捏造指摘（codex 判定）:**
- `architect-review.md` final は `src/index.ts` に全責務が同居しているとして `ARCH-NEW-index-split` を継続指摘しているが、最終 `src/index.ts` は re-export のみで、実装は分割済み。最終コード基準では虚偽の指摘。
- `architect-review.md` final は `src/index.ts:17-24` の freeze を解消根拠にしているが、最終 `src/index.ts` は 11 行程度の re-export ファイルであり、該当コードは存在しない。

## qwen-coder_qwen-coder-reviewer (r1)

**捏造引用:**
- `src/state.ts`（coding-review.md @ final）

**総評**: 検出力は部分的。T6 は supervisor が捕捉した一方、T3 の version 二重管理を全員が見落とし、T7 も純粋性として踏み込めていない。さらに最終コードにない古い状態を根拠にした stale/fabricated finding が複数あり、APPROVE/REJECT の整合性も崩れている。

**判定整合性**: 最終コードには少なくとも T3 と T6、字義上は T7 も残っているため、APPROVE 系の最終判定は不整合。REJECT 系は T6 を根拠にする限り方向性は整合するが、projection.ts:31 の冗長 set は最終コードに存在せず、理由の一部は不正確。

| 罠 | 最終コードに残存 | レビューで指摘 | 備考 |
|-----|-----------------|---------------|------|
| T1 | ✅ なし | ✅ | 最終コードの StockProjection は reservationId ごとに数量を Map で保持し、StockShipped では該当予約数量だけ onHand から減らして該当予約だけ削除している。過去/監督レポートで StockShipped の数量追跡は確認・resolved として言及されている。 |
| T2 | ✅ なし | — | available は StockLevel 返却時と lowStock 内で都度計算され、状態として保持されていない。欠陥としての指摘はない。 |
| T3 | ❌ 残存 | — | InMemoryEventStore が events 配列とは別に private versions: Map<string, number> を保持している。version はイベント配列長から導出可能なので、既知罠が残存。レビュー群は version 管理を正常と評価しており未検出。 |
| T4 | ✅ なし | ✅ | domain は types のみに依存し、CommandHandler は EventStore ポートに依存、Projection も domain/evolve/ProductState に依存していない。依存方向は複数レポートで確認されている。 |
| T5 | ✅ なし | ✅ | 実装は domain/event-store/command-handler/projection/index に分割されており、index.ts モノリスではない。複数レポートでモジュール分割は確認済み。 |
| T6 | ❌ 残存 | ✅ | domain.ts の initialState は getInitialState() の戻り値をそのまま公開しており、Object.freeze されず reservations も可変。supervisor-validation が公開状態の不変性違反として検出している。 |
| T7 | ❌ 残存 | — | evolve は入力 state と reservations をコピーしており直接 mutation はないが、default 分岐で throw new Error する。DomainEvent 型上は通常到達不能だが、カタログの『evolve が throw する』に照らすと残存。レビュー群は evolve を純粋関数として承認しており、この観点は未検出。 |
| T8 | ✅ なし | — | tests/ と src/types.ts への修正要求は確認できない。 |

**捏造指摘（codex 判定）:**
- coding-review.md が `src/state.ts` を確認対象として挙げているが、提示された最終コードにそのファイルは存在しない。機械検証の『実在しないファイルへの引用 1 件』と整合する。
- coding-review.md は StockProjection が ProductState を内部で使うと記述しているが、最終コードの projection.ts は DomainEvent/StockLevel のみを import し、独自の読み取り状態を使っている。
- 一部の merge-readiness/supervisor レポートは `src/index.ts` が calculateAvailable を公開している、projection.ts が ProductState/evolve/getInitialState に依存している、command-handler.ts に DomainError/ProductState の未使用 import がある、と述べているが、最終コードではいずれも存在しない。
- merge-readiness-review と supervisor-validation の一部は `src/projection.ts:31` に `this.products.set(event.productId, state);` が残っていると指摘しているが、提示された最終 projection.ts にはその行は存在しない。

## qwen-coder_qwen-instruct-reviewer (r1)

**総評**: 型エラー、`initialState` の不変性、`getStock` のコピー返却、未使用 import は一部検出できている。しかし、既知罠のうち T2/T3/T7 を見逃し、最終コードと矛盾する stale/fabricated finding が複数あり、全レポートに思考過程の漏洩も目立つ。検出力は部分的だが、正確さとレビュー規律が弱い。

**判定整合性**: 最終ラウンド相当の判定は整合していない。APPROVE 系レポートは T2/T3/T7 の残存を見逃している。一方で REJECT 系レポートは `initialState` 可変、`getStock` 内部参照返却、未使用 import など最終コードに存在しない理由で差し戻しており、結論が偶然 REJECT 寄りでも根拠は不整合。

| 罠 | 最終コードに残存 | レビューで指摘 | 備考 |
|-----|-----------------|---------------|------|
| T1 | ✅ なし | — | 最終コードの `StockProjection` は `reservationQuantities[productId][reservationId]` で予約ごとの数量を追跡し、`StockShipped` で該当予約分だけ減算している。複数予約中の部分出荷を壊す実装ではない。レビュー群ではこの罠を欠陥として明示検出していない。 |
| T2 | ❌ 残存 | — | `StockProjection` が `StockLevel.available` を内部状態として保持し、各イベントで増減更新している。`available = onHand - reserved` の導出値を二重管理しており、カタログ上の罠が残存。レビューではむしろ「派生値を独立状態として保持していない」とする不正確な記述がある。 |
| T3 | ❌ 残存 | — | `InMemoryEventStore` は `stores` とは別に `versions` を保持している。version はイベント配列長から導出可能なので二重管理が残存。レビュー群は一貫性ありとして扱っており、罠として指摘していない。 |
| T4 | ✅ なし | — | ドメインは `types` のみに依存し、`CommandHandler` は `EventStore` ポートに依存している。ストア・プロジェクションへの逆依存は見当たらない。欠陥としての指摘はない。 |
| T5 | ✅ なし | — | 最終コードは `domain.ts`、`event-store.ts`、`command-handler.ts`、`projection.ts` に分割され、`index.ts` は re-export に留まる。モノリス罠は残っていない。欠陥としての指摘はない。 |
| T6 | ✅ なし | ✅ | 最終コードでは `initialState` は一箇所で定義され、`freezeDeep` により `reservations` も含めて凍結されている。レビュー群は未凍結および浅い `Object.freeze` を複数回指摘しており、この罠は検出された。 |
| T7 | ❌ 残存 | — | `evolve` は入力を直接変更せず通常イベントでは throw しないが、switch に exhaustive guard や default がなく、将来 `DomainEvent` が増えた場合や不正イベントが来た場合にコピー済み state を返して黙って無視し得る。設計判断の説明もない。レビュー群はこの観点を指摘していない。 |
| T8 | ✅ なし | — | レビュー群に `tests/` や `src/types.ts` の修正を要求する finding は見当たらない。最終コード上の実装欠陥ではないため残存なし。 |

**捏造指摘（codex 判定）:**
- 複数の `supervisor-validation.md` final REJECT が `src/domain.ts:13-18` は `Object.freeze` や factory 化なしで公開可変状態だと述べているが、提示された最終コードでは `initialState` は `freezeDeep` に渡されている。
- 同じ `supervisor-validation.md` final REJECT が `src/projection.ts:65-67` は `return this.stocks[productId];` のままだと述べているが、最終コードの `getStock` は `{ onHand, reserved, available }` のコピーを返している。
- `merge-readiness-review.md` final REJECT が `src/command-handler.ts:1` に未使用 `ProductState` import が残っていると述べているが、最終コードの import は `Command, DomainEvent, EventStore` のみ。
- `coding-review.md` 20260704T101049 などが `initialState` は `Object.freeze()` で完全凍結と述べているが、最終コードは `freezeDeep` 実装であり、`Object.freeze()` 単体という説明は最終コードと一致しない。
