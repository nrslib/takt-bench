# テスト作成レポート

## 要件-テスト対応表
| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| API-01 | 利用者が `src/index.ts` から公開 API と型を import できる | 公開 API import | `tests/*.test.ts` 全体 | 既存/作成 | |
| DOM-01 | `initialState` は未作成・在庫なし・予約なしを表す | ドメイン状態 | `tests/domain.test.ts` | 既存 | |
| DOM-02 | `evolve` はイベントを状態に適用し、入力 state を変更しない | イベント適用 | `tests/domain.test.ts` | 既存/作成 | |
| DOM-03 | `evolve` は不整合な予約解放/出荷イベントでも throw せず、状態を破壊しない | イベント適用 | `does not throw when releasing a reservation that is not in the event history`, `does not throw when shipping a reservation that is not in the event history` | 作成 | |
| DOM-04 | `CreateProduct` は trim 後の名前で `ProductCreated` を生成し、空名・既存商品を `DomainError` で拒否する | コマンド判定 | `emits ProductCreated with a trimmed name`, 既存 CreateProduct テスト | 作成/既存 | |
| DOM-05 | `ReceiveStock` は存在商品かつ正の整数数量のみ許可し、不正数量は `DomainError` | コマンド判定 | `rejects invalid quantity` | 既存/作成 | |
| DOM-06 | `ReserveStock` は available 以内、未使用 reservationId、正の整数数量のみ許可する | コマンド判定 | `tests/domain.test.ts` ReserveStock テスト | 既存/作成 | |
| DOM-07 | `ReleaseReservation` / `ShipStock` は存在予約のみ許可し、イベントを生成する | コマンド判定 | `tests/domain.test.ts` Release/Ship テスト | 既存 | |
| STORE-01 | 空ストリーム load は `{ events: [], version: 0 }` | 永続化境界 | `tests/event-store.test.ts` | 既存 | |
| STORE-02 | version は保存済みイベント数で、append は expectedVersion 不一致時に `ConcurrencyError` | 永続化境界 | `tests/event-store.test.ts` | 既存 | |
| STORE-03 | 競合 append は何も保存しない | 永続化境界 | `tests/event-store.test.ts` | 既存 | |
| STORE-04 | load 返却配列と append 入力配列の外部 mutation が内部ストアに影響しない | 永続化境界 | `returns a copy so callers cannot mutate the stored stream`, `copies appended event arrays so later caller mutations cannot change the stream` | 既存/作成 | |
| APP-01 | `CommandHandler` は load → replay → decide → append を行い、生成イベントを返す | 実行時オーケストレーション | `tests/command-handler.test.ts` | 既存 | |
| APP-02 | 拒否されたコマンドでは append しない | 実行時オーケストレーション | `appends nothing when the command is rejected` | 既存 | |
| APP-03 | `CommandHandler` は `EventStore` ポートだけに依存し、具象 `InMemoryEventStore` を要求しない | ポート経由 | `works through the EventStore port without depending on InMemoryEventStore` | 作成 | |
| APP-04 | aggregate は `productId` ごとに分離される | 実行時/永続化 | `keeps aggregates isolated per productId` | 既存 | |
| READ-01 | `StockProjection` はイベントから `{ onHand, reserved, available }` を構築し、未知商品は `undefined` | イベント消費 | `tests/projection.test.ts` | 既存 | |
| READ-02 | `StockShipped` は対象 reservationId の予約数量だけを `onHand` と reserved から減らす | イベント消費 | `ships only the quantity tied to the shipped reservationId` | 作成 | |
| READ-03 | `lowStock(threshold)` は `available < threshold` を productId 昇順で返す | Query | `lists products whose available is below the threshold, sorted by productId` | 既存 | |
| READ-04 | `getStock` の返却 object を変更しても projection 内部状態は変わらない | Query | `returns a fresh stock object so callers cannot mutate projection state` | 作成 | |
| INT-01 | コマンドで保存したイベントを store から再読み込みし、projection を再構築できる | CommandHandler → EventStore → StockProjection | `roundtrips command events through the store and rebuilds the stock projection` | 作成 | |
| INT-02 | 複数 product stream が書き込み/読み取りモデルをまたいで分離される | CommandHandler → EventStore → StockProjection | `keeps product streams isolated across write and read models` | 作成 | |
| ARCH-01 | フレームワーク非依存、依存方向、モジュール分割 | 実装構造 | 未作成 | 未作成 | 実行時の戻り値や副作用ではなく構造制約のため、実装後のレビューと typecheck で確認する。APP-03 でポート依存のみ一部固定済み |

## 危険分岐テスト
| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| 空白付き商品名 | `ProductCreated.name` に trim 前の値を保存する | `emits ProductCreated with a trimmed name` | |
| `NaN` / `Infinity` 数量 | `quantity > 0` だけで正の整数判定として扱う | `rejects invalid quantity` | |
| 不整合な release/ship イベント | `evolve` が throw する、または `onHand` を不正に減らす | `does not throw when releasing...`, `does not throw when shipping...` | |
| append 後の呼び出し元配列 mutation | store が append 入力配列参照を保持する | `copies appended event arrays so later caller mutations cannot change the stream` | |
| 具象ストア依存 | `CommandHandler` が `InMemoryEventStore` 固有 API や `instanceof` に依存する | `works through the EventStore port without depending on InMemoryEventStore` | |
| 複数予約の一部出荷 | projection が reservationId 別数量ではなく合計だけで処理する | `ships only the quantity tied to the shipped reservationId` | |
| read model 返却値 mutation | `getStock` が内部状態 object を直接返す | `returns a fresh stock object so callers cannot mutate projection state` | |
| 保存/再読み込み roundtrip | handler/store/projection の配線漏れ、streamId 誤り、version 誤り | `roundtrips command events through the store and rebuilds the stock projection` | |

## 横断経路テスト
| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| `CommandHandler.handle` → `EventStore.append` | `decide` が生成した `DomainEvent[]` | `InMemoryEventStore` | streamId は productId、expectedVersion は load 結果、イベントが保存される | `tests/command-handler.test.ts` | |
| `EventStore.load` → `StockProjection.apply` | `InMemoryEventStore` に保存済みイベント | `StockProjection` | 保存済みイベント列だけから読み取りモデルを再構築できる | `tests/integration.test.ts` | |
| 複数 productId の command → stream → projection | `CommandHandler` | `InMemoryEventStore`, `StockProjection` | productId ごとの stream と read model が混線しない | `keeps product streams isolated across write and read models` | |
| カスタム `EventStore` → `CommandHandler` | `RecordingEventStore` | `CommandHandler` | 具象実装に依存せずポート契約だけで動く | `works through the EventStore port without depending on InMemoryEventStore` | |

## 否定契約
| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| 不正数量をイベント化する | `DomainError` throw を確認 | `rejects invalid quantity` | |
| 空白だけの名前を許可する | `DomainError` throw を確認 | 既存 `rejects empty name` | |
| trim 前の名前を保存する | 生成イベントの `name` を完全一致で確認 | `emits ProductCreated with a trimmed name` | |
| 競合 append で部分保存する | append 失敗後の stream 長を確認 | 既存 `does not store anything when the append conflicts` | |
| load 返却配列 mutation が store に反映される | mutation 後に再 load して件数を確認 | 既存 `returns a copy so callers cannot mutate the stored stream` | |
| append 入力配列 mutation が store に反映される | append 後に入力配列を push し、再 load で内容確認 | `copies appended event arrays...` | |
| projection の返却 object mutation が内部状態に反映される | mutation 後に再 `getStock` して値を確認 | `returns a fresh stock object...` | |
| `CommandHandler` が具象ストアだけを受け付ける | `EventStore` 実装テストダブルで handle を実行 | `works through the EventStore port...` | |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `tests/domain.test.ts` | 単体 | 7 | `evolve` の非throw分岐、`CreateProduct` trim、`NaN`/`Infinity` 数量拒否を追加/拡張 |
| `tests/event-store.test.ts` | 単体 | 1 | append 入力配列の外部 mutation 隔離を追加 |
| `tests/command-handler.test.ts` | 単体 | 1 | `EventStore` ポートのみで `CommandHandler` が動くことを追加 |
| `tests/projection.test.ts` | 単体 | 2 | reservationId 別出荷数量、`getStock` 戻り値 mutation 隔離を追加 |
| `tests/integration.test.ts` | 統合 | 2 | command → store → projection の roundtrip と product stream 分離を追加 |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| フレームワーク非依存 | 実行時契約ではなく依存追加・import 構造の制約であり、テストで固定すると実装詳細に寄りすぎるため | 実装後に `package.json` と `src/` import をレビュー |
| ドメイン層が store/projection に依存しないこと | ファイル分割・依存方向の構造制約であり、公開 API テストから直接観測しづらい | 実装後に `src/domain.ts` の import をレビュー |
| `StockProjection` が書き込みモデルを参照しないこと | 実装構造制約であり、振る舞いは READ-01〜READ-04 と INT-01 で固定済み | 実装後に `StockProjection` の import をレビュー |
| `src/types.ts` 非変更 | テストでファイル本文を固定するのは非実行資産/型定義の過剰固定になるため | 実装後の diff と typecheck で確認 |

## 実行結果（参考）
実装前のためテスト失敗・import エラーは想定内。

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 1 | `npm run typecheck` は成功 |
| Fail / Import Error（想定内） | 28 | `npm test` は 27 failed tests + 1 failed suite。原因は `src/index.ts` の `Not implemented` |
| Error（要対応） | 0 | 追加テストの import パスミスや型エラーは確認されていない |

## 備考（判断がある場合のみ）
- 今回はプロダクションコードを変更せず、テストのみ追加・更新した。
- 3つ以上のモジュールを横断する `CommandHandler → InMemoryEventStore → StockProjection` のデータフローがあるため、統合テストを追加した。
- finding ledger に既存 finding ID はなかったため、finding ID は付与していない。