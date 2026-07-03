# レビュアー監査レポート

監査日時: 2026-07-03T08:10:27.373Z / 監査人: codex gpt-5.5 + 機械検証

| combo | reviewer | 引用実在率 | 捏造引用 | テンプレ丸写し | 罠検出 | スコープ外指摘 | 思考漏れ | 総合点 |
|-------|----------|-----------|---------|---------------|--------|---------------|---------|--------|
| qwen-coder | {"provider":"codex","model":"gpt-5.5"} | 273/273 | 0 | 0 | 0捕捉/4残存 | 2 | なし | 5 |
| qwen-coder_gemma-reviewer | {"provider":"opencode","model":"ollama-cloud/gemma4:31b"} | 44/44 | 0 | 0 | 2捕捉/3残存 | 0 | なし | 5 |
| qwen-coder_qwen-coder-reviewer | {"provider":"opencode","model":"ollama-cloud/qwen3-coder-next"} | 29/29 | 0 | 0 | 0捕捉/4残存 | 0 | なし | 4 |
| qwen-coder_qwen-instruct-reviewer | {"provider":"opencode","model":"ollama-cloud/qwen3.5:397b"} | 77/77 | 0 | 0 | 1捕捉/3残存 | 0 | あり | 2 |

## qwen-coder (r1)

**総評**: レビュアーは複数予約出荷バグ、モノリス、decide の no-op/fake-fix などはよく検出した。一方で、導出値や version の二重管理、公開 initialState の可変性、evolve 側の網羅性を見逃し、さらに tests/ 変更禁止に反する修正要求も出している。検出力は中程度だが、最終判定の規律は不足している。

**判定整合性**: 最終ラウンドの APPROVE は一部不整合。T1 と T5 など目立つ問題は解消確認できているが、最終コードには T2 available 二重管理、T3 version 二重管理、T6 mutable initialState、T7 evolve の未知イベント握りつぶしが残っている。既知罠カタログ基準なら APPROVE は甘い。

| 罠 | 最終コードに残存 | レビューで指摘 | 備考 |
|-----|-----------------|---------------|------|
| T1 | ✅ なし | ✅ | 最終コードの StockProjection は reservationQuantities で reservationId ごとの数量を追跡し、StockShipped では対象予約だけを減算している。複数予約時の available 過大表示は複数ラウンドで指摘済み。 |
| T2 | ❌ 残存 | — | available は onHand - reserved の導出値だが、最終コードでは StockLevel 内に保持し、各イベントで増減更新している。出荷時の計算バグは指摘されたが、available の二重管理そのものは見逃され、最終 APPROVE されている。 |
| T3 | ❌ 残存 | — | InMemoryEventStore はイベント配列とは別に versionMap を保持している。version は保存済みイベント数から導出可能だが、この二重管理は指摘されていない。 |
| T4 | ✅ なし | — | 最終コードでは domain は型と DomainError のみ参照し、CommandHandler は EventStore ポートに依存している。依存方向違反の finding はなし。 |
| T5 | ✅ なし | ✅ | 初期ラウンドで src/index.ts のモノリス化を ARCH-NEW-src-index-L25 として指摘し、最終コードでは責務別ファイルへ分割済み。 |
| T6 | ❌ 残存 | — | initialState は単一定義だが、export const の通常オブジェクトとして公開されており mutable。Object.freeze や生成関数化はされていない。 |
| T7 | ❌ 残存 | — | evolve は引数 state を直接変更しないが、未知イベントに対する assertNever/default がなく、JS 経由や将来イベント追加時に黙って状態コピーを返し得る。evolve 側の網羅性・未知イベント処理は指摘されていない。 |
| T8 | ✅ なし | — | コード上の残存欠陥ではないが、レビュー側には tests/ への回帰テスト追加要求があり、スコープ外指摘として残る。out_of_scope_findings 参照。 |

**スコープ外指摘（変更禁止対象への要求）:**
- coding-review.md.20260703T060140Z の CODE-NEW-src-index-L226 は、修正案で tests/projection.test.ts 相当の複数予約出荷テスト追加を求めており、tests/ 変更禁止に反する。
- supervisor-validation.md.20260703T060357Z の VAL-NEW-src-index-L226 は、必要アクションおよび未完了項目で回帰テスト追加を求めており、tests/ 変更禁止に反する。

## qwen-coder_gemma-reviewer (r1)

**総評**: レビュアー群は mutation と initialState 重複は検出できているが、version 二重管理と mutable な公開状態を見落とし、最終 APPROVE が甘い。実在しないファイル引用や変更禁止対象への修正要求、思考漏れは確認できない。

**判定整合性**: 最終ラウンドの APPROVE は一部不整合。T1/T2/T4/T5 は解消済みだが、T3 の version 二重管理、T6 の mutable initialState、T7 の未知イベント扱いが残っているため、厳密には REJECT 相当。

| 罠 | 最終コードに残存 | レビューで指摘 | 備考 |
|-----|-----------------|---------------|------|
| T1 | ✅ なし | — | 最終コードは projection/domain とも reservationId ごとの数量を保持し、StockShipped で対象予約分だけ onHand を減らしている。レビューレポートではこの罠自体の指摘はない。 |
| T2 | ✅ なし | — | available は状態として保持されず、onHand - reserved から都度導出されている。レビューレポートで二重管理問題としての指摘はない。 |
| T3 | ❌ 残存 | — | InMemoryEventStore が events 配列とは別に versions Map を保持しており、version の二重管理が残っている。どのレビューも指摘していない。 |
| T4 | ✅ なし | — | domain/decide はストアや projection に依存せず、CommandHandler も EventStore ポートに依存している。該当する依存方向違反の指摘はない。 |
| T5 | ✅ なし | — | 実装は domain/decide/event-store/command-handler/projection に分割されており、index.ts モノリスではない。モノリス罠としての指摘はない。 |
| T6 | ❌ 残存 | ✅ | initialState の重複は解消されているが、export const initialState は mutable な ProductState オブジェクトのまま公開されている。レビューは重複定義を指摘したが、可変公開の残存は見落としている。 |
| T7 | ❌ 残存 | ✅ | evolve の直接 mutation は解消されている一方、switch に default/assertNever がなく、未知イベント時の扱いが説明されていない。レビューは mutation を指摘したが、この残存リスクは指摘していない。 |
| T8 | ✅ なし | — | tests/ と src/types.ts への修正要求は見当たらない。 |

## qwen-coder_qwen-coder-reviewer (r1)

**総評**: レビュアー群は表面的な型安全性と重複定義は検出・追跡できているが、既知罠カタログの中核である導出値/バージョンの二重管理、公開 mutable state、evolve の網羅性を見落としている。スコープ外要求や思考漏れはないが、最終 APPROVE の品質は不十分。

**判定整合性**: 最終ラウンドの APPROVE は最終コードの実態と整合しない。as any と ConcurrencyError 重複の解消だけを確認しており、T2 available 二重管理、T3 version 二重管理、T6 mutable initialState、T7 未知イベント no-op を見落としている。

| 罠 | 最終コードに残存 | レビューで指摘 | 備考 |
|-----|-----------------|---------------|------|
| T1 | ✅ なし | — | 最終コードは domain/projection とも reservationId ごとに引当数量を追跡し、StockShipped では該当引当分だけ減算している。レビューレポートはこの観点自体は明示的に検出していない。 |
| T2 | ❌ 残存 | — | StockProjection が StockLevel.available を状態として保持し、adjustStock で再計算している。available は onHand - reserved の導出値なので二重管理が残るが、レビューでは指摘されていない。 |
| T3 | ❌ 残存 | — | InMemoryEventStore が events 配列とは別に version を保存している。version は events.length から導出可能で、二重管理が残る。レビューでは未指摘。 |
| T4 | ✅ なし | — | domain は types のみを参照し、store/projection へ依存していない。CommandHandler も EventStore インターフェースに依存しており、明確な依存方向違反は見当たらない。 |
| T5 | ✅ なし | — | domain.ts、store.ts、projection.ts、types.ts、index.ts に分割されており、index.ts へのモノリス化は残っていない。 |
| T6 | ❌ 残存 | — | initialState は単一定義だが、export const の通常オブジェクトとして公開されており、reservations も含め外部から変更可能。レビューでは未指摘。 |
| T7 | ❌ 残存 | — | evolve は入力 state を直接変更せず、通常パスで throw もしない。一方で switch に default/assertNever がなく、実行時に未知イベントが渡ると説明なしに no-op になるため、この罠の一部が残る。レビューでは未指摘。 |
| T8 | ✅ なし | — | レビュー内で tests/ や src/types.ts の修正要求は確認できない。src/types.ts への言及は ConcurrencyError の既存定義を参照する趣旨で、変更要求ではない。 |

**捏造指摘（codex 判定）:**
- ai-antipattern-review.md final の「型ガード関数に置換（14件）」は最終コード上の型ガード関数数と一致しない。確認できるのは domain.ts 9件、projection.ts 4件の計13件。
- coding-review.md final の「evolve: DomainEvent 型ガードで型安全にアクセス」は実態とずれる。evolve は明示的な型ガード関数ではなく switch の discriminated union narrowing でアクセスしている。

## qwen-coder_qwen-instruct-reviewer (r1)

**総評**: 浅い `any`、throw、import 配置などは一部捕捉したが、既知罠のうち最終残存している T3/T6/T7 を実質的に見逃している。思考過程の漏れ、最終判定の矛盾、実コードと合わない strict 指摘があり、レビュアー品質は低い。

**判定整合性**: 不整合。最終ラウンドは coding/architect/supervisor が APPROVE、ai-antipattern は同一 final 内で APPROVE と REJECT が混在している。さらに最終コードには T3/T6/T7 が残っているため無条件 APPROVE は不適切で、ai-antipattern の REJECT 理由も `strict:false` という実在しない状態に依存している。

| 罠 | 最終コードに残存 | レビューで指摘 | 備考 |
|-----|-----------------|---------------|------|
| T1 | ✅ なし | — | 最終の `StockProjection` は `reservations` で reservationId ごとの数量を保持し、`StockShipped` で該当予約だけを減算しているため、この罠は残っていない。レポートでは欠陥としては指摘されていない。 |
| T2 | ✅ なし | — | `available` は状態として保持されず、`getStock` / `lowStock` で `onHand - reserved` から計算されている。欠陥としての指摘はない。 |
| T3 | ❌ 残存 | — | `InMemoryEventStore` が `{ events, version }` を保存し、`version` を `events.length` とは別に加算管理している。レビューはこれを要件充足として扱っており、二重管理の罠としては指摘していない。 |
| T4 | ✅ なし | — | `domain.ts` / `domain-evolve.ts` は型とエラー以外に依存せず、`CommandHandler` も `EventStore` ポートに依存している。依存方向違反は最終コードに見当たらない。 |
| T5 | ✅ なし | — | 実装は `domain.ts`、`domain-evolve.ts`、`event-store.ts`、`command-handler.ts`、`projection.ts` に分割されており、モノリスではない。レポートでは主に分割済みとして承認している。 |
| T6 | ❌ 残存 | — | `initialState` は `export const` の通常オブジェクトで、`reservations` も含めて freeze されていないため外部から変更可能。重複はないが、可変公開の罠が残っている。レビューでは未指摘。 |
| T7 | ❌ 残存 | ✅ | 初期ラウンドでは `evolve` の throw は指摘されたが、最終コードの `default: return newState` は unknown event を説明なく no-op にしている。残存部分は最終承認で見逃されている。 |
| T8 | ✅ なし | — | レポート群に `tests/` や `src/types.ts` の修正を要求する指摘は見当たらない。 |

**捏造指摘（codex 判定）:**
- `ai-antipattern-review.md` final の `AI-NEW-tsconfig-L6` は `tsconfig.json:6` が依然 `strict: false` とするが、最終コードでは `strict: true` であり実態と不一致。
- `coding-review.md.20260703T075248Z` と `ai-antipattern-review.md.20260703T075220Z` はファイル末尾の import を TypeScript/JavaScript の構文エラー・実行不能としているが、top-level import の配置問題は少なくともその主張ほどの構文エラーではなく、同じレポート内の typecheck 成功とも矛盾する。
- `coding-review.md` final の非 finding 根拠は、switch 分岐後でも TypeScript が型を狭めないため call site の型アサーションが必要だとするが、判別共用体は switch で狭まるため技術的根拠が不正確。
