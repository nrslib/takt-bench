# タスク計画

## 元の要求
在庫管理ドメインをイベントソーシングで実装するライブラリを作ってください。

仕様は README.md に記載されています。公開 API は src/types.ts の型定義に準拠し、利用者が src/index.ts から import できる形にしてください。

フレームワークには依存せず、インメモリで完結するライブラリとして実装してください。アーキテクチャ上の制約は README.md の「アーキテクチャ要件」に従ってください。

## 分析結果

### 目的
README.md と src/types.ts で定義された公開契約に従い、在庫管理ドメインのイベントソーシング実装を完成させる。利用者は src/index.ts と src/types.ts だけを import して使える状態にする。

現状は src/index.ts に公開 API の枠だけが存在し、`evolve`、`decide`、`InMemoryEventStore`、`CommandHandler`、`StockProjection` がすべて `Not implemented` のため、実装が必要。

### 分解した要件
| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | `src/types.ts` の公開契約に準拠する | 明示 | `src/types.ts` は変更禁止 |
| 2 | 利用者が `src/index.ts` から import できる | 明示 | `src/index.ts` の公開 API シグネチャは変更禁止 |
| 3 | フレームワークに依存しない | 明示 | README.md のアーキテクチャ要件と Knowledge のフレームワーク非依存制約に一致 |
| 4 | インメモリで完結する | 明示 | 永続化は `InMemoryEventStore` のみ |
| 5 | `initialState` を未作成の商品状態として公開する | 明示 | 現行 `src/index.ts:16-21` で満たしており変更不要 |
| 6 | `evolve(state, event)` を純粋関数として実装する | 明示 | throw せず、引数を変更しない |
| 7 | `ProductCreated` を状態に適用する | 暗黙 | 要件 6 と README のイベント定義から導出 |
| 8 | `StockReceived` を状態に適用する | 暗黙 | 要件 6 と README のイベント定義から導出 |
| 9 | `StockReserved` を状態に適用する | 暗黙 | 要件 6 と README のイベント定義から導出 |
| 10 | `ReservationReleased` を状態に適用する | 暗黙 | 要件 6 と README のイベント定義から導出 |
| 11 | `StockShipped` を状態に適用する | 暗黙 | 要件 6 と README のイベント定義から導出 |
| 12 | `decide(state, command)` を純粋関数として実装する | 明示 | 不変条件違反は `DomainError` |
| 13 | `CreateProduct` は既存商品を再作成不可にする | 明示 | README.md のドメインルール |
| 14 | `CreateProduct` は trim 後に空の名前を拒否する | 明示 | イベントには trim 後の名前を入れる方針 |
| 15 | `ReceiveStock` は商品存在を必須にする | 明示 | README.md のドメインルール |
| 16 | `ReceiveStock` は正の整数数量だけ許可する | 明示 | 0、負数、小数は `DomainError` |
| 17 | `ReserveStock` は商品存在を必須にする | 明示 | README.md のドメインルール |
| 18 | `ReserveStock` は available 以内だけ許可する | 明示 | available = onHand - 予約数量合計 |
| 19 | `ReserveStock` は未使用 reservationId だけ許可する | 明示 | 重複 reservationId は `DomainError` |
| 20 | `ReserveStock` は正の整数数量だけ許可する | 明示 | 0、負数、小数は `DomainError` |
| 21 | `ReleaseReservation` は既存予約だけ許可する | 明示 | 在庫は変えず予約だけ解放 |
| 22 | `ShipStock` は既存予約だけ許可する | 明示 | 予約数量ぶん onHand を減らし予約を消す |
| 23 | `InMemoryEventStore` を `EventStore` ポート実装として作る | 明示 | `src/types.ts` の `EventStore` に準拠 |
| 24 | 空ストリームの `load` は `{ events: [], version: 0 }` を返す | 明示 | README.md のイベントストアセマンティクス |
| 25 | `version` は保存済みイベント数にする | 明示 | README.md のイベントストアセマンティクス |
| 26 | `append` は expectedVersion 不一致時に `ConcurrencyError` を投げる | 明示 | 競合時は保存しない |
| 27 | `load` が返す events 配列の変更が内部状態に影響しない | 明示 | 配列コピーを返す |
| 28 | `CommandHandler` は load → replay → decide → append を行う | 明示 | README.md の API 責務 |
| 29 | `CommandHandler` は `EventStore` インターフェースにのみ依存する | 明示 | 具象 `InMemoryEventStore` に依存しない |
| 30 | `CommandHandler` の streamId は `command.productId` にする | 暗黙 | テストが `store.load(P)` で確認しているため |
| 31 | `StockProjection` はイベントから読み取りモデルを構築する | 明示 | 書き込みモデルを参照しない |
| 32 | `getStock(productId)` は未知の商品で `undefined` を返す | 明示 | README.md の Projection セマンティクス |
| 33 | `getStock(productId)` は `{ onHand, reserved, available }` を返す | 明示 | available = onHand - reserved |
| 34 | `StockShipped` は予約数量ぶん onHand と reserved を減らす | 明示 | イベント自体に quantity がないため reservationId 別数量の保持が必要 |
| 35 | `lowStock(threshold)` は available < threshold の productId を昇順で返す | 明示 | README.md の Projection セマンティクス |
| 36 | テストは変更しない | 明示 | README.md の開発欄に tests 配下変更禁止 |
| 37 | `npm test` と `npm run typecheck` が通る状態にする | 暗黙 | README.md の開発欄から導出 |

### 参照資料の調査結果
参照資料として README.md と src/types.ts を確認した。

README.md の要点:
- 実装対象 API は `initialState`、`evolve`、`decide`、`InMemoryEventStore`、`CommandHandler`、`StockProjection`。
- ドメインルール、イベントストアの version と楽観的並行性制御、Projection の読み取りモデル仕様が明記されている。
- アーキテクチャ要件として、ドメインロジックの純粋性、`CommandHandler` の `EventStore` ポート依存、Projection のイベント専用構築、`src/types.ts` と `src/index.ts` 公開 API シグネチャ変更禁止がある。

src/types.ts の要点:
- イベント、コマンド、`ProductState`、`StockLevel`、`DomainError`、`ConcurrencyError`、`EventStore` が定義済み。
- 変更禁止の公開契約であり、実装はこの型に合わせる。

現在の実装との差異:
- `initialState` は現行実装で要件を満たしている。
- それ以外の公開 API は `throw new Error('Not implemented')` のみで未実装。
- src 配下には `src/index.ts` と `src/types.ts` しかなく、責務別の内部モジュールはまだ存在しない。
- tests 配下は公開 API の期待動作を固定しており、実装フェーズでは変更しない。

Knowledge / Policy の確認:
- TAKT のバックエンド専門知識では、依存方向は外側から内側、ドメイン層はフレームワーク非依存、アプリケーション層はドメインに依存し adapter の具体実装に依存しないことが示されていた。
- 今回は HTTP/API 層を持たないライブラリなので Controller 関連の知識は対象外。
- `coding` スキルが指す追加参照先 `/Users/m_naruse/work/git/takt/builtins/ja/...` は環境上存在しなかったため確認不能。確認できた TAKT Knowledge と README.md を優先する。

### スコープ
影響範囲:
- `src/index.ts`
  - 公開 API の入口として維持。
  - 既存公開名の export を保持し、内部モジュールから re-export する形に変更する。
- 追加予定の内部実装ファイル
  - `src/domain.ts`
  - `src/event-store.ts`
  - `src/command-handler.ts`
  - `src/projection.ts`
- 変更しないファイル
  - `src/types.ts`
  - `tests/**`
  - README.md
  - package.json / tsconfig.json

新しいパラメータ追加はない。呼び出し元の追加配線は `src/index.ts` の export のみ。

### 検討したアプローチ
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| すべてを `src/index.ts` に直接実装する | 不採用 | 行数は小さく収まる可能性があるが、ドメイン、ストア、コマンドハンドラ、Projection の責務が混在する。Planner 指示の「1 モジュール 1 責務」と README のアーキテクチャ要件に対して弱い。 |
| 責務別に内部モジュールへ分割し、`src/index.ts` から re-export する | 採用 | 公開入口を維持しながら、ドメイン純粋関数、インメモリストア、アプリケーションオーケストレーション、読み取り Projection を分離できる。 |
| `StockProjection` で `ProductState` と `evolve` を再利用して読み取りモデルを作る | 不採用 | README.md が「プロジェクションは書き込みモデルを参照せず、イベントのみから構築」と明示しているため違反。 |
| `CommandHandler` が `InMemoryEventStore` を直接受け取る | 不採用 | README.md が `EventStore` ポートにのみ依存と明示しているため違反。 |

### 実装アプローチ
1. `src/domain.ts` を作成する。
   - `initialState` を移動または再定義して export する。
   - `evolve(state, event)` を実装する。
   - `decide(state, command)` を実装する。
   - 内部ヘルパーとして `reservedQuantity(state)`、`availableQuantity(state)`、`assertProductExists(state)`、`assertPositiveInteger(quantity)` などを置く。
   - ヘルパーは外部公開しない。
   - `DomainError` は `src/types.ts` から import して使用する。
   - 入力 state と `reservations` は変更せず、新しいオブジェクトを返す。

2. `src/event-store.ts` を作成する。
   - `InMemoryEventStore implements EventStore` を実装する。
   - 内部に `Map<string, DomainEvent[]>` を持つ。
   - `load` は未存在 stream で `{ events: [], version: 0 }` を返す。
   - `load` は `events: [...storedEvents]` を返す。
   - `append` は現在 version を確認し、不一致なら `ConcurrencyError` を throw し、保存処理を行わない。
   - 一致時のみ既存配列と新規イベントを結合して保存する。

3. `src/command-handler.ts` を作成する。
   - `CommandHandler` の constructor は `EventStore` を受け取り、private readonly に保持する。
   - `handle(command)` は `command.productId` を streamId として `load` する。
   - `events.reduce(evolve, initialState)` で状態を再構築する。
   - `decide(state, command)` で新イベントを得る。
   - `store.append(streamId, newEvents, loaded.version)` を呼ぶ。
   - newEvents を返す。
   - `decide` が `DomainError` を throw した場合、append しない。

4. `src/projection.ts` を作成する。
   - `StockProjection` を実装する。
   - 内部状態は productId ごとの `{ onHand, reservations }` のような private Map にする。
   - `ProductState` は import しない。
   - `ProductCreated` で productId の読み取り状態を初期化する。
   - `StockReceived` で onHand を加算する。
   - `StockReserved` で reservationId 別数量を記録する。
   - `ReservationReleased` で reservationId を削除する。
   - `StockShipped` では reservationId から数量を取得し、onHand を減らし、予約を削除する。
   - `getStock` は unknown なら `undefined`、既知なら reserved 合計と available を計算して返す。
   - `lowStock(threshold)` は既知 productId を走査し、available < threshold の id を昇順に返す。

5. `src/index.ts` を公開 API 入口として整理する。
   - `export * from './types.js';` を維持する。
   - `export { initialState, evolve, decide } from './domain.js';`
   - `export { InMemoryEventStore } from './event-store.js';`
   - `export { CommandHandler } from './command-handler.js';`
   - `export { StockProjection } from './projection.js';`
   - 公開 API 名とシグネチャは変更しない。

6. 実装後に検証する。
   - `npm test`
   - `npm run typecheck`

### 到達経路・起動条件
| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `src/index.ts` から `initialState`、`evolve`、`decide`、`InMemoryEventStore`、`CommandHandler`、`StockProjection`、および `src/types.ts` の型・エラーを import する |
| 更新が必要な呼び出し元・配線 | `src/index.ts` の re-export |
| 起動条件 | なし。ライブラリとして直接 import して呼び出す |
| 未対応項目 | なし |

## 実装ガイドライン
- `src/types.ts` は変更しない。
- tests 配下は変更しない。
- `src/index.ts` の公開 API 名とシグネチャは変更しない。
- TypeScript の ESM import は既存の `./types.js` と同じく `.js` 拡張子を使う。
- `evolve` は必ず純粋関数にする。入力 state や `state.reservations` を mutate しない。
- `evolve` は README.md の仕様通り throw しない。
- `StockShipped` の `evolve` は `state.reservations[event.reservationId]` の数量を使って onHand を減らす。存在しない予約の場合でも throw せず、数量 0 相当で扱うか、未定義を安全に処理する。正規の不変条件チェックは `decide` 側で行う。
- `decide` は不変条件違反時に `new DomainError(...)` を throw する。
- `decide` の数量検証は `Number.isInteger(quantity) && quantity > 0` にする。
- `CreateProduct` の name は `command.name.trim()` で検証し、イベントにも trim 後の名前を入れる。
- available は `state.onHand - Object.values(state.reservations).reduce(...)` で計算する。
- `InMemoryEventStore.load` は内部配列そのものを返さず、必ずコピーを返す。
- `InMemoryEventStore.append` は expectedVersion 不一致時に保存を一切行わない。
- `CommandHandler` は `EventStore` 型だけに依存する。`InMemoryEventStore` を import しない。
- `CommandHandler` は streamId として `command.productId` を使う。テストは productId ごとの集約分離を前提にしている。
- `StockProjection` は `ProductState`、`initialState`、`evolve` を使わない。Projection 専用の内部状態をイベントから更新する。
- `StockProjection` は `StockShipped` に quantity がないため、予約数量を reservationId ごとに保持する。
- `getStock` が返す `StockLevel` は毎回新しい値オブジェクトでよい。内部状態を直接返さない。
- `lowStock(threshold)` は productId を `.sort()` して昇順にする。
- 参照すべき既存利用パターン:
  - `evolve` の replay 利用: `tests/domain.test.ts:9-10`
  - `evolve` の非破壊性検証: `tests/domain.test.ts:81-85`
  - `decide` の `DomainError` 期待: `tests/domain.test.ts:94-102`
  - `EventStore` の load/append 期待: `tests/event-store.test.ts:7-55`
  - `CommandHandler` の productId stream 利用: `tests/command-handler.test.ts:14-18`
  - `CommandHandler` の version 利用: `tests/command-handler.test.ts:43-51`
  - `StockProjection` のイベント適用入口: `tests/projection.test.ts:4-7`
  - `StockProjection` の lowStock 期待: `tests/projection.test.ts:59-68`

## スコープ外
| 項目 | 除外理由 |
|------|---------|
| 永続 DB 実装 | ユーザー要求がインメモリ完結 |
| HTTP API / Controller | ユーザー要求がフレームワーク非依存ライブラリ |
| `src/types.ts` の型拡張 | README.md で変更禁止 |
| テスト追加・変更 | README.md で tests 配下変更禁止 |
| package.json / tsconfig.json の変更 | 現行設定で TypeScript/Vitest 実行に必要な設定が存在するため不要 |
| 後方互換用 API | 明示要求なし |

## 確認事項
- なし。実装判断に必要な仕様は README.md、src/types.ts、現行テストから確認済み。