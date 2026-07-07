# テスト作成レポート

## 要件-テスト対応表
| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| R01 | `src/types.ts` の公開契約を変更しない | TypeScript 型チェック | `npm run typecheck` | 既存 | 型定義ファイル自体の不変性は差分確認で扱う |
| R02 | `src/index.ts` の公開 API シグネチャを維持する | Public API import | 既存 `tests/*.test.ts` 全般 | 既存 | |
| R03 | 利用者は `src/index.ts` と `src/types.ts` だけを import して使える | Public API import | 既存 `tests/*.test.ts` 全般 | 既存 | |
| R04 | `StockProjection` はイベントから在庫の読み取りモデルを構築する | `StockProjection.apply/getStock/lowStock` | `tests/projection.test.ts`, `tests/projection-contracts.test.ts` | 既存 + 作成 | |
| R05 | `getStock(productId)` は `{ onHand, reserved, available }` を返す | `StockProjection.getStock` | `tests/projection.test.ts` | 既存 | |
| R06 | `StockShipped` では予約数量ぶん `onHand` と `reserved` を減らす | `StockProjection.apply` -> `getStock` | `tests/projection.test.ts`, `tests/projection-contracts.test.ts` | 既存 | |
| R07 | `lowStock(threshold)` は `available < threshold` の productId を昇順で返す | `StockProjection.lowStock` | `tests/projection.test.ts`, `tests/projection-contracts.test.ts` | 既存 + 作成 | |
| R08 / F-0006 / F-0007 / F-0008 | `ProjectionState.reservations` が Map の場合、予約数量の集計は Map values を使う | `StockProjection.lowStock` | `tests/projection-contracts.test.ts` / `F-0006/F-0007/F-0008 counts Map reservation quantities when listing low stock` | 作成 | |
| R09 | Projection は書き込みモデルを参照せず、イベントのみから構築する | import 境界 | `tests/architecture.test.ts` | 既存 | |
| R10 | フレームワークに依存しない | package / import 境界 | `tests/architecture.test.ts` | 既存 | 外部依存追加の完全検出は package 差分レビューで扱う |
| R11 | インメモリで完結する | `InMemoryEventStore`, projection integration | `tests/event-store.test.ts`, `tests/integration.test.ts` | 既存 | |
| R12 | テスト以外のプロダクションコードを変更しない | git 差分確認 | 作業範囲確認 | 既存 | 自動検査ではなく差分レビューで扱う |

## 危険分岐テスト
| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| `lowStock` の予約数量集計 | Map に対して `Object.values(state.reservations)` を使い、予約数量を 0 として扱う | `tests/projection-contracts.test.ts` / `F-0006/F-0007/F-0008 counts Map reservation quantities when listing low stock` | |
| 予約によって available が閾値未満になる商品 | `onHand` だけで低在庫判定し、予約済み数量を差し引かない | `tests/projection-contracts.test.ts` | |
| `available < threshold` の境界 | 閾値以上の商品を誤って含める | 既存 `tests/projection.test.ts` | |

## 横断経路テスト
| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| `StockReserved` event -> Projection internal Map -> `lowStock` | `StockProjection.apply(StockReserved)` | `StockProjection.lowStock` | Map に保存された予約数量が lowStock の available 計算へ反映される | `tests/projection-contracts.test.ts` | |
| `CommandHandler -> InMemoryEventStore -> StockProjection` | CommandHandler が生成・保存する DomainEvent | StockProjection | 保存済みイベントを projection に流し、読み取りモデルへ反映する | 既存 `tests/integration.test.ts` | |

## 否定契約
| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| `lowStock` が Map の予約数量を無視する | `onHand=10`, `reserved=7`, threshold `5` の商品 `a` が `lowStock(5)` に含まれることを確認 | `tests/projection-contracts.test.ts` | |
| `Object.values(Map)` 誤用により reserved が常に 0 になる | `lowStock(5)` が `['a', 'c']` を返すことを確認。誤用時は `a` が欠落する | `tests/projection-contracts.test.ts` | |
| `lowStock` がソート順を崩す | 戻り値が `['a', 'c']` の昇順であることを確認 | `tests/projection-contracts.test.ts` | |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `tests/projection-contracts.test.ts` | 単体 | 1 | F-0006/F-0007/F-0008 の Map reservations 集計を `lowStock` の観測可能な戻り値で固定 |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| `src/types.ts` の内容不変 | 実行時挙動ではなく変更禁止ルールのため、差分確認が適切 | final-gate で `src/types.ts` に差分がないことを確認 |
| package 依存追加によるフレームワーク混入 | 本ステップでは package 変更を行わず、追加テストでは完全検出できない | reviewers / final-gate で `package.json` と import 差分を確認 |
| F-0006/F-0007/F-0008 のソース文字列固定 | 「`Object.values` が含まれない」だけの absence-only テストになるため未作成 | 今回追加した振る舞いテストと Disputed Findings の evidence で確認 |

## 実行結果（参考）
現行実装では F-0006/F-0007/F-0008 は stale であり、追加テストも通過している。

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 77 | `npm test`: 10 files / 77 tests passed |
| Fail / Import Error（想定内） | 0 | |
| Error（要対応） | 0 | `npm run typecheck` も成功 |

## Disputed Findings
| findingId | reason | evidence |
|-----------|--------|----------|
| F-0006 | stale。現行 `lowStock` は Map に対して `Object.values()` を使っておらず、`Array.from(state.reservations.values())` で予約数量を集計している | `src/projection.ts:109-119` |
| F-0007 | stale。現行 `lowStock` の予約数量集計は `Array.from(state.reservations.values()).reduce(...)` であり、指摘内容と一致しない | `src/projection.ts:112` |
| F-0008 | stale。現行 `ProjectionState.reservations` は `Map<string, number>` であり、`lowStock` は Map の `.values()` を使って集計している | `src/projection.ts:3-6`, `src/projection.ts:112` |

## 備考（判断がある場合のみ）
- プロダクションコードは変更していない。
- 計画では F-0006/F-0007/F-0008 は stale と判定されていたが、既存 `lowStock` テストは予約数量で available が下がるケースを直接固定していなかったため、回帰防止として観測可能な戻り値テストを 1 件追加した。
- 今回の追加テストは `Object.values` の不在を直接検査せず、誤実装時に `lowStock(5)` の戻り値が変わる振る舞いで検出する。