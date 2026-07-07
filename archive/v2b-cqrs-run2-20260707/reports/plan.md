# タスク計画

## 元の要求
在庫管理ドメインをイベントソーシングで実装するライブラリを作ってください。

仕様は README.md に記載されています。公開 API は src/types.ts の型定義に準拠し、利用者が src/index.ts から import できる形にしてください。

フレームワークには依存せず、インメモリで完結するライブラリとして実装してください。アーキテクチャ上の制約は README.md の「アーキテクチャ要件」に従ってください。

## 分析結果

### 目的
`README.md` の仕様と `src/types.ts` の公開契約に従い、在庫管理ドメインのイベントソーシングライブラリを実装する。利用者は `src/index.ts` と `src/types.ts` のみを import して、ドメイン判定、イベント適用、インメモリイベントストア、コマンドハンドラ、在庫プロジェクションを利用できる状態にする。

### 分解した要件
| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | `src/types.ts` の公開契約に準拠する | 明示 | 型定義は `src/types.ts:1-120` で確認。変更禁止 |
| 2 | 利用者が `src/index.ts` から公開 API を import できる | 明示 | 現在 `src/index.ts:14` は `types` を re-export 済み |
| 3 | `initialState` は未作成の商品を表す | 明示 | 現在 `src/index.ts:16-21` は `exists: false`, `name: ''`, `onHand: 0`, `reservations: {}` で要件を満たすため変更不要 |
| 4 | `evolve(state, event)` を実装する | 明示 | 現在 `src/index.ts:23-25` は未実装のため変更要 |
| 5 | `evolve` は throw しない | 明示 | README `13` 行、テスト `tests/domain.test.ts:37-85` |
| 6 | `evolve` は入力 state を変更しない | 明示 | README `13` 行、テスト `tests/domain.test.ts:81-85` |
| 7 | `decide(state, command)` を実装する | 明示 | 現在 `src/index.ts:27-29` は未実装のため変更要 |
| 8 | `decide` はコマンドから新イベントを導出する | 明示 | README `14` 行 |
| 9 | `decide` は不変条件違反時に `DomainError` を throw する | 明示 | `DomainError` は `src/types.ts:107-108`、テスト `tests/domain.test.ts:94-180` |
| 10 | `CreateProduct` は既存商品を再作成不可にする | 明示 | README `21` 行、テスト `tests/domain.test.ts:94-98` |
| 11 | `CreateProduct` は trim 後に空の名前を拒否する | 明示 | README `21` 行、テスト `tests/domain.test.ts:100-103` |
| 12 | `ReceiveStock` は商品が存在する場合だけ許可する | 明示 | README `22` 行、テスト `tests/domain.test.ts:106-116` |
| 13 | `ReceiveStock` は正の整数数量だけ許可する | 明示 | README `22` 行、テスト `tests/domain.test.ts:118-122` |
| 14 | `ReserveStock` は商品が存在する場合だけ許可する | 明示 | README `23` 行、テスト `tests/domain.test.ts:148-151` |
| 15 | `ReserveStock` は available 以内だけ許可する | 明示 | README `23` 行、テスト `tests/domain.test.ts:128-140` |
| 16 | `ReserveStock` は重複 `reservationId` を拒否する | 明示 | README `23` 行、テスト `tests/domain.test.ts:143-146` |
| 17 | `ReserveStock` は正の整数数量だけ許可する | 明示 | README `23` 行、テスト `tests/domain.test.ts:153-156` |
| 18 | `ReleaseReservation` は存在する予約だけ許可する | 明示 | README `24` 行、テスト `tests/domain.test.ts:162-170` |
| 19 | `ReleaseReservation` は在庫を変えず予約だけ解放する | 明示 | README `24` 行、テスト `tests/domain.test.ts:56-60` |
| 20 | `ShipStock` は存在する予約だけ許可する | 明示 | README `25` 行、テスト `tests/domain.test.ts:172-180` |
| 21 | `ShipStock` は予約数量ぶん `onHand` を減らして予約を消す | 明示 | README `25` 行、テスト `tests/domain.test.ts:62-66` |
| 22 | `InMemoryEventStore` を `EventStore` ポート実装として実装する | 明示 | 現在 `src/index.ts:31-39` は未実装のため変更要 |
| 23 | イベントストアの `version` は保存済みイベント数にする | 明示 | README `29` 行、テスト `tests/event-store.test.ts:12-25` |
| 24 | 空ストリームの `load` は `{ events: [], version: 0 }` を返す | 明示 | README `29` 行、テスト `tests/event-store.test.ts:7-10` |
| 25 | `append` は expectedVersion 不一致時に `ConcurrencyError` を throw する | 明示 | README `30` 行、`ConcurrencyError` は `src/types.ts:110-111` |
| 26 | `append` の競合時は何も保存しない | 明示 | README `30` 行、テスト `tests/event-store.test.ts:34-39` |
| 27 | `load` が返す配列の変更は内部ストアに影響させない | 明示 | README `31` 行、テスト `tests/event-store.test.ts:49-55` |
| 28 | `CommandHandler` を実装する | 明示 | 現在 `src/index.ts:41-49` は未実装のため変更要 |
| 29 | `CommandHandler` は `load -> replay -> decide -> append` を行う | 明示 | README `16` 行、テスト `tests/command-handler.test.ts:21-52` |
| 30 | `CommandHandler` は `EventStore` ポートにのみ依存する | 明示 | README `44` 行、constructor は `src/index.ts:42` で `EventStore` 型を受ける |
| 31 | `CommandHandler` は aggregate を `productId` ごとに分離する | 暗黙 | コマンド型はすべて `productId` を持つ `src/types.ts:49-78`。テスト `tests/command-handler.test.ts:69-78` |
| 32 | `StockProjection` を実装する | 明示 | 現在 `src/index.ts:51-63` は未実装のため変更要 |
| 33 | `StockProjection` はイベントだけから読み取りモデルを構築する | 明示 | README `17`, `45` 行 |
| 34 | `getStock(productId)` は未知商品に `undefined` を返す | 明示 | README `35` 行、テスト `tests/projection.test.ts:17-19` |
| 35 | `getStock(productId)` は `{ onHand, reserved, available }` を返す | 明示 | README `35` 行、テスト `tests/projection.test.ts:21-57` |
| 36 | `StockShipped` の projection は予約数量ぶん `onHand` と `reserved` を減らす | 明示 | README `36` 行、テスト `tests/projection.test.ts:43-48` |
| 37 | `lowStock(threshold)` は `available < threshold` の productId を昇順で返す | 明示 | README `37` 行、テスト `tests/projection.test.ts:59-68` |
| 38 | フレームワークに依存しない | 明示 | `package.json:10-13` は devDependencies のみで runtime framework なし。実装も追加依存不要 |
| 39 | インメモリで完結する | 明示 | 外部 DB/API を使わず、`Map` など標準ライブラリで実装する |
| 40 | `src/index.ts` の公開 API シグネチャを変更しない | 明示 | README `46` 行、現行シグネチャは `src/index.ts:16-63` |
| 41 | `tests/` 配下を変更しない | 明示 | README `51` 行で vitest tests 配下が指定されている |

### 参照資料の調査結果
参照資料は `README.md` と `src/types.ts`。

`README.md` は公開 API、ドメインルール、イベントストアのセマンティクス、プロジェクションのセマンティクス、アーキテクチャ要件を定義している。`src/types.ts` はイベント、コマンド、集約状態、読み取りモデル、エラー、`EventStore` ポートの公開契約を定義しており、変更禁止。

現在の主要差異は、`src/index.ts` に公開 API の枠だけが存在し、`evolve`, `decide`, `InMemoryEventStore`, `CommandHandler`, `StockProjection` がすべて `throw new Error('Not implemented')` になっている点。`initialState` と `export * from './types.js'` は既に存在する。

テストは README の仕様を具体例として検証している。`npm run typecheck` は現状でも成功したが、`npm test` は未実装により 4 ファイルすべて失敗した。なお、`npm test -- --runInBand` は Vitest では未対応オプションで失敗するため、検証は `npm test` を使う。

### スコープ
影響範囲は `src/` 配下のみ。

変更対象:
- `src/index.ts`
- 新規追加候補: `src/domain.ts`
- 新規追加候補: `src/event-store.ts`
- 新規追加候補: `src/command-handler.ts`
- 新規追加候補: `src/projection.ts`

変更しない:
- `src/types.ts`
- `tests/` 配下
- `README.md`
- `package.json`
- `tsconfig.json`
- `vitest.config.ts`

### 検討したアプローチ
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| すべて `src/index.ts` に実装する | 不採用 | 公開シグネチャは保てるが、ドメイン、ストア、アプリケーション、プロジェクションの責務が 1 ファイルに集中する。README のアーキテクチャ要件と Knowledge の責務分離方針に対して弱い |
| `src/index.ts` は公開入口にし、責務ごとに内部モジュールへ分割する | 採用 | `src/index.ts` から import できる要件を守りつつ、ドメインロジック、イベントストア、コマンドオーケストレーション、読み取りモデルを分離できる |
| イベントストアを外部永続化対応に拡張する | 不採用 | 明示要求はインメモリ完結。外部 DB/API はスコープ外 |
| projection で `evolve` / `ProductState` を再利用する | 不採用 | README `45` 行が「プロジェクションは書き込みモデルを参照せず、イベントのみから構築」と明記しているため |

### 実装アプローチ
1. `src/domain.ts` を追加し、`initialState`, `evolve`, `decide` を実装する。
   - `ProductState` のコピーを返し、`reservations` も都度コピーする。
   - `evolve` はイベント履歴が整合していない場合でも throw しない。`ReservationReleased` や `StockShipped` で予約がない場合は、予約数量を `0` として扱い、予約削除だけを安全に行う。
   - `available` は `onHand - sum(reservations)` で計算する内部 helper にする。
   - 数量チェックは `Number.isInteger(quantity) && quantity > 0`。
   - `CreateProduct` の名前は `trim()` 後に空でないことを検証し、発行する `ProductCreated.name` も trim 後の値にする。
   - 不変条件違反は必ず `DomainError` を throw する。

2. `src/event-store.ts` を追加し、`InMemoryEventStore implements EventStore` を実装する。
   - 内部状態は `Map<string, DomainEvent[]>`。
   - `load` は `{ events: [...storedEvents], version: storedEvents.length }` を返す。
   - 空ストリームは `{ events: [], version: 0 }`。
   - `append` は現在 version を先に確認し、不一致なら `ConcurrencyError` を throw して保存しない。
   - 一致した場合のみ `existing.concat(events)` またはコピー配列で保存する。

3. `src/command-handler.ts` を追加し、`CommandHandler` を実装する。
   - constructor は `EventStore` を private field に保持する。
   - `handle(command)` は `command.productId` を streamId として使う。
   - `store.load(streamId)` で履歴と version を取得する。
   - `events.reduce(evolve, initialState)` で状態を再構築する。
   - `decide(state, command)` で新規イベントを得る。
   - `store.append(streamId, newEvents, version)` を呼ぶ。
   - `decide` が `DomainError` を throw した場合、`append` は呼ばれない構造にする。
   - 戻り値は `newEvents`。

4. `src/projection.ts` を追加し、`StockProjection` を実装する。
   - 書き込みモデル `ProductState` には依存しない。
   - 内部状態は productId ごとの `{ onHand, reservations }` を `Map` で持つ。
   - `ProductCreated` で productId の読み取りモデルを初期化する。
   - `StockReceived` で `onHand` を加算する。
   - `StockReserved` で予約数量を reservationId に保存する。
   - `ReservationReleased` で予約を削除する。
   - `StockShipped` は保存済み予約数量を取得し、`onHand` から差し引き、予約を削除する。
   - `getStock` は `reserved = sum(reservations)`、`available = onHand - reserved` を計算して返す。
   - `getStock` は内部状態の参照を返さず、新しい object を返す。
   - `lowStock(threshold)` は `getStock` 相当の available を使い、該当 productId を昇順に sort して返す。

5. `src/index.ts` を公開入口として整理する。
   - `export * from './types.js';` は維持する。
   - `initialState`, `evolve`, `decide`, `InMemoryEventStore`, `CommandHandler`, `StockProjection` を内部モジュールから re-export する。
   - 既存の未実装スタブは削除する。
   - 公開 API 名と引数・戻り値のシグネチャは現行 `src/index.ts:16-63` と一致させる。

### 到達経路・起動条件
| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `src/index.ts` からの named import。例: `import { CommandHandler, InMemoryEventStore } from '../src/index'` |
| 更新が必要な呼び出し元・配線 | `src/index.ts` の re-export。内部モジュールを追加する場合、`.js` 拡張子付き import/export を使う |
| 起動条件 | 認証、権限、URL、フラグなし。ライブラリ利用者が関数・クラスを直接呼び出す |
| 未対応項目 | なし |

## 実装ガイドライン
- `src/types.ts` は変更しない。`DomainEvent`, `Command`, `ProductState`, `StockLevel`, `DomainError`, `ConcurrencyError`, `EventStore` は既存型を import して使う。
- TypeScript 設定は `moduleResolution: "Bundler"`、`type: "module"`。既存 `src/index.ts:12,14` と同じく内部 import/export では `.js` 拡張子を使う。
- ドメイン層は `src/domain.ts` に閉じる。`InMemoryEventStore` や `StockProjection` を import しない。
- `CommandHandler` は `EventStore` 型だけに依存する。`InMemoryEventStore` を import しない。
- `StockProjection` は `ProductState`, `initialState`, `evolve`, `decide` を使わない。イベントだけを入力にして読み取りモデルを更新する。
- `evolve` と `decide` では入力 `state.reservations` を直接変更しない。`{ ...state.reservations }` でコピーしてから変更する。
- `evolve` は README `13` 行に従い throw しない。整合性検証は `decide` 側に寄せる。
- `decide` は README `14` 行に従い、不変条件違反時は `DomainError` を使う。汎用 `Error` は使わない。
- `append` は競合判定を保存より前に行う。競合時に一部でも保存される実装にしない。
- `load` は配列コピーを返す。テスト `tests/event-store.test.ts:49-55` が呼び出し側 mutation の隔離を確認している。
- `StockShipped` はイベントに数量を持たないため、projection 側にも reservationId ごとの数量保持が必要。`reserved` 合計だけを保持する設計では README `36` 行を満たせない。
- `lowStock` は `available < threshold` であり `<=` ではない。返却順は productId 昇順。
- テスト変更は禁止。実装後は `npm test` と `npm run typecheck` で確認する。

## スコープ外
| 項目 | 除外理由 |
|------|---------|
| 外部 DB 永続化 | 明示要求が「インメモリで完結」 |
| HTTP API / Controller | ライブラリ実装が要求であり、フレームワーク非依存が明示されている |
| npm パッケージ公開設定 | 要求は `src/index.ts` から利用可能にすることまで |
| `src/types.ts` の型追加・変更 | README `46` 行で変更禁止 |
| テストの追加・修正 | README `51` 行で tests 配下変更禁止 |

## 確認事項
なし。