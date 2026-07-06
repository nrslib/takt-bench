# Merge Readiness Review

## 結果: REJECT

## サマリー
テスト 51 件と typecheck は成功していますが、`CommandHandler` のキャッシュが外部追記後の最新イベントを decision state に反映せず、README の `load → replay → decide → append` 契約を破ります。加えて、Projection が書き込みモデルに依存しており、公開 API の要求外拡張と未使用コードも残っています。

## 保守前提のマージ品質チェック
| # | 観点 | 状態 | 根拠（ファイル:行 / テスト / 実行証跡） | コメント |
|---|------|------|---------------------------------------|----------|
| 1 | 要求充足 | 未充足 | `src/domain/command-handler.ts:15`, `src/domain/stock-projection.ts:1` | handler が stale cache を使い、projection が `ProductState` / `evolve` に依存 |
| 2 | 既存契約・既存フローへの影響 | 問題あり | `src/domain/command-handler.ts:17`, `src/domain/command-handler.ts:31` | version だけ再取得し、replay 状態は cache hit で更新されない |
| 3 | テスト・検証 | 不足 | `npm test -- --run`: 51 passed / 追加再現: `DomainError` | 既存テストは version を確認するが、外部追記後の decision state を検証していない |
| 4 | 要求外変更・スコープクリープ | 問題あり | `src/index.ts:11`, `src/services/inventory-service.ts:13` | README にない `InventoryService` / `DefaultInventoryService` を公開 |
| 5 | 保守可能性・将来変更容易性 | 問題あり | `src/services/inventory-service.ts:5`, `src/services/inventory-service.ts:20` | `--noUnusedLocals` で未使用 import / field を検出 |
| 6 | 明白なセキュリティ・データ保護・運用リスク | 問題あり | `src/domain/inventory-aggregate.ts:3`, `src/domain/inventory-aggregate.ts:7` | `initialState.reservations` が freeze されず公開状態を汚染可能 |

## 横断監査証跡
| # | 変更カテゴリ | 抽出した項目 | 確認した検索語・ファイル | 判定 | コメント |
|---|--------------|--------------|--------------------------|------|----------|
| 1 | entrypoint / 公開 API | `DefaultInventoryService`, `InventoryService`, `CommandHandler`, `StockProjection` | `DefaultInventoryService|InventoryService|export \* from './services'` / `src/index.ts:11`, `src/services/inventory-service.ts:13` | 問題あり | 要求外 API が `src/index.ts` から公開される |
| 2 | 状態遷移 / cache / EventStore | `load`, `append`, `cache`, `CommandHandler` | `load\(|append\(|cache|CommandHandler` / `src/domain/command-handler.ts:15`, `src/domain/command-handler.ts:17`, `src/domain/command-handler.ts:31` | 問題あり | `F-0004` / `F-0005` の resolved 判定は受入条件を満たさない |
| 3 | projection / 書き込みモデル依存 | `ProductState`, `initialState`, `evolve`, `StockProjection` | `StockProjection|ProductState|evolve\(|initialState` / `src/domain/stock-projection.ts:1`, `src/domain/stock-projection.ts:2`, `README.md:45` | 問題あり | README の projection 独立性に違反 |
| 4 | 公開初期状態 | `initialState`, `reservations`, `Object.freeze` | `initialState|reservations|Object.freeze` / `src/domain/inventory-aggregate.ts:3`, `src/domain/inventory-aggregate.ts:7` | 問題あり | `F-0002` の deep freeze 受入条件を満たさない |

## 要求照合
| # | 要求（タスクから抽出） | 状態 | 根拠（ファイル:行） | コメント |
|---|-------------------|------|-------------------|----------|
| 1 | `CommandHandler` は `load → replay → decide → append` のオーケストレーション | 未充足 | `src/domain/command-handler.ts:15`, `src/domain/command-handler.ts:31` | cache hit 時に replay しない |
| 2 | Projection は書き込みモデルを参照せずイベントのみから構築 | 未充足 | `src/domain/stock-projection.ts:1`, `src/domain/stock-projection.ts:14` | `ProductState` と aggregate `evolve` を使用 |
| 3 | `src/index.ts` の公開 API シグネチャ変更禁止 | 未充足 | `src/index.ts:11`, `src/services/inventory-service.ts:19` | 要求外 public export を追加 |
| 4 | tests 配下 51 件成功 | 充足 | `npm test -- --run` | 4 files / 51 tests passed |
| 5 | typecheck 成功 | 充足 | `npm run typecheck` | `tsc --noEmit` succeeded |

## 観測した指摘
| # | family_tag | カテゴリ | 重大度 | 場所 | 問題 | 修正案 |
|---|------------|---------|--------|------|------|--------|
| 1 | maintainability-readiness | 回帰 / 契約破壊 | high | `src/domain/command-handler.ts:15` | `F-0005` / `F-0004` 相当。外部追記後、cache の古い状態で `decide` するため、本来 available 7 の予約が `DomainError` になる | `handle` 内で同一 `load` 結果から replay と expectedVersion を使う。cache を残すなら version と結びつけ、不一致時は必ず再 load / replay する |
| 2 | architecture-contract | 要求未充足 | high | `src/domain/stock-projection.ts:1` | Projection が `ProductState`、`initialState`、`evolve` に依存し、書き込みモデルを参照している | Projection 専用の read model を持ち、イベント種別ごとに `onHand` / 予約数量 / `available` を更新する |
| 3 | public-state-immutability | 回帰 / 契約破壊 | high | `src/domain/inventory-aggregate.ts:3` | `F-0002` 相当。`Object.freeze` は shallow で、`initialState.reservations` は変更可能 | `reservations` も freeze する、または公開初期状態が共有汚染されない形にする |
| 4 | public-api-scope | スコープクリープ / 保守困難化 | medium | `src/index.ts:11` | README にない `InventoryService` / `DefaultInventoryService` を public API に追加している | `src/index.ts` は README の公開 API のみ export し、不要な service 公開を削除する |
| 5 | dead-code | 保守困難化 | medium | `src/services/inventory-service.ts:5` | `ProductState`、`evolve`、`initialState`、`decide`、`store` が未使用。`--noUnusedLocals` で検出 | 不要 import / field / module を削除する |

## 検証証跡
- ビルド: `npm run typecheck` を実行し、`tsc --noEmit` 成功。
- テスト: `npm test -- --run` を実行し、4 ファイル / 51 件すべて成功。
- 追加動作確認: 現在コードを一時ディレクトリへ compile して public API 経由で確認。外部 `store.append` 後に `ReserveStock(quantity: 7)` が `DomainError` となり、期待される最新 replay 状態と不一致。
- 追加不変性確認: `Object.isFrozen(initialState) === true`、`Object.isFrozen(initialState.reservations) === false`、`initialState.reservations.r1 = 5` が成立。
- 未使用コード確認: `npm exec tsc -- --noEmit --noUnusedLocals true --noUnusedParameters true` で `src/services/inventory-service.ts` の未使用 import / field を検出。

## REJECT判定条件
- マージを止めるべき観測指摘が 1 件以上あるため REJECT。