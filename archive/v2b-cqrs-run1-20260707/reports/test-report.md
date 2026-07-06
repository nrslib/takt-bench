# テスト作成レポート

## 要件-テスト対応表
| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| RT-01 | 利用者が `src/index.ts` から公開 API と型を import できる | 公開 API import | `tests/*.test.ts` の `../src/index` import | 既存/作成 | |
| RT-02 | `initialState` は未作成・在庫0・予約なし | ドメイン定数 | `tests/domain.test.ts` / `initialState` | 既存 | |
| RT-03 | `evolve` は各イベントを状態へ適用し、入力を mutate しない | イベント replay | `tests/domain.test.ts` / `evolve` | 既存/作成 | |
| RT-04 | `StockShipped` は予約数量ぶん減算し、未知予約 replay では throw しない | イベント replay | `tests/domain.test.ts` / `does not throw when replaying StockShipped for an unknown reservation` | 作成 | |
| RT-05 | `CreateProduct` は新規作成イベントを返し、既存商品・空名を `DomainError` にする。名前は trim 後をイベントに入れる | コマンド決定 | `tests/domain.test.ts` / `decide: CreateProduct` | 既存/作成 | |
| RT-06 | `ReceiveStock` / `ReserveStock` は商品存在、正の整数、available、予約ID重複を検証する | コマンド決定 | `tests/domain.test.ts` / `decide: ReceiveStock`, `decide: ReserveStock` | 既存 | |
| RT-07 | `ReleaseReservation` / `ShipStock` は既存予約だけ許可し、拒否時は `DomainError` | コマンド決定 | `tests/domain.test.ts` / `decide: ReleaseReservation / ShipStock` | 既存 | |
| RT-08 | `InMemoryEventStore` は空stream、version、競合時 `ConcurrencyError`、stream分離、load配列コピーを保証する | 永続化境界 | `tests/event-store.test.ts` | 既存 | |
| RT-09 | `CommandHandler` は load → replay → decide → append を行い、reject時は append しない | アプリケーション経路 | `tests/command-handler.test.ts` | 既存 | |
| RT-10 | `CommandHandler` は `EventStore` ポートだけで動き、`productId` を streamId、loaded version を expectedVersion に使う | ポート境界 | `tests/command-handler.test.ts` / `orchestrates through the EventStore port using productId as streamId` | 作成 | |
| RT-11 | `StockProjection` はイベントから `onHand/reserved/available` を構築し、未知商品は `undefined`、`lowStock` は昇順かつ `< threshold` | 読み取りモデル | `tests/projection.test.ts` | 既存 | |
| RT-12 | 保存されたイベント履歴を読み直して Projection に流すと、出荷・予約解放後の読み取りモデルが正しく構築される | CommandHandler → EventStore → Projection | `tests/integration.test.ts` | 作成 | |

## 危険分岐テスト
| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| trim 済み商品名 | 空白つき name をそのまま `ProductCreated` に保存する | `tests/domain.test.ts` / `trims the product name in the emitted ProductCreated event` | |
| 未知予約の `StockShipped` replay | `evolve` が replay 中に throw する、または `NaN` を作る | `tests/domain.test.ts` / `does not throw when replaying StockShipped for an unknown reservation` | |
| ポート依存 | `CommandHandler` が `InMemoryEventStore` 具象に依存して任意の `EventStore` で動かない | `tests/command-handler.test.ts` / `orchestrates through the EventStore port using productId as streamId` | |
| expectedVersion 伝搬 | append に固定値や誤った version を渡す | `tests/command-handler.test.ts` / `orchestrates through the EventStore port using productId as streamId` | |
| roundtrip | 保存された履歴と Projection の解釈がずれる | `tests/integration.test.ts` | |

## 横断経路テスト
| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| `CommandHandler.handle` → `InMemoryEventStore.load` → `StockProjection.apply` | `CommandHandler` が生成して store に保存する `DomainEvent[]` | `StockProjection` | 保存済みイベント履歴だけから `StockLevel` と `lowStock` が再構築できる | `tests/integration.test.ts` / `builds the stock read model from events persisted by the command handler` | |
| `EventStore.load` → `CommandHandler.append` | `EventStore.load` の `version` | `CommandHandler` | loaded version を expectedVersion として append に渡す | `tests/command-handler.test.ts` / `orchestrates through the EventStore port using productId as streamId` | |

## 否定契約
| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| 不変条件違反で通常イベントを返す | `DomainError` を throw することを検証 | `tests/domain.test.ts`, `tests/command-handler.test.ts` | |
| 競合 append で保存する | 競合後の stream 長を検証 | `tests/event-store.test.ts` / `does not store anything when the append conflicts` | |
| load 結果の配列変更が内部状態へ反映される | load 配列を push 後、再 load の件数を検証 | `tests/event-store.test.ts` / `returns a copy so callers cannot mutate the stored stream` | |
| `CommandHandler` が具象 store 前提で動く | 手製の `EventStore` 実装を渡して handle する | `tests/command-handler.test.ts` / `orchestrates through the EventStore port using productId as streamId` | |
| Projection が threshold 以下を含める | `available === threshold` が `lowStock` に含まれないことを検証 | `tests/projection.test.ts`, `tests/integration.test.ts` | |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `tests/domain.test.ts` | 単体 | 2 | `StockShipped` 未知予約 replay、`CreateProduct` name trim |
| `tests/command-handler.test.ts` | 単体 | 1 | `EventStore` ポート経由の load/append と streamId/version 伝搬 |
| `tests/integration.test.ts` | 統合 | 1 | CommandHandler で保存したイベント履歴から Projection を構築する roundtrip |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| フレームワーク非依存 | ランタイム挙動ではなく依存関係の静的制約のため、今回のブラックボックステストでは直接固定しない | 実装後レビューで外部フレームワーク import がないことを確認 |
| Projection が書き込みモデルを参照しない | 公開 API 経由の挙動からは内部 import を直接観測できない | 実装後レビューで `ProductState`、`initialState`、`evolve` への依存がないことを確認 |
| `src/types.ts` と `src/index.ts` の公開シグネチャ不変 | 型定義そのものの差分検査は今回追加していない | 実装後に `npm run typecheck` と差分レビューで確認 |

## 実行結果（参考）
実装前のためテスト失敗は想定内。

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 0 | 現行プロダクションコードが未実装のため |
| Fail / Import Error（想定内） | 23 failed tests + 1 failed suite | `src/index.ts` の `Not implemented` 起因 |
| Error（要対応） | 0 | `npm run typecheck` は成功。import パスミスや型エラーは検出されていない |

## 備考（判断がある場合のみ）
- プロダクションコードは変更していない。
- 追加テストは公開 API の観測可能な契約だけを対象にし、内部モジュール分割には依存していない。
- findings-ledger に既存 finding ID はないため、参照した finding はない。