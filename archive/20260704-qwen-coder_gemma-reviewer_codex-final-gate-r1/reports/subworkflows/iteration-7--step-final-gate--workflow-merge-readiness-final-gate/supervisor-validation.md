# 最終検証結果

## 結果: REJECT

## 要件充足チェック

| # | 分解した要件 | 元要件の出典 | 充足 | 根拠（ファイル:行） | 例外・optional 化の根拠 |
|---|------------|--------------|------|-------------------|--------------------------|
| 1 | `src/types.ts` の公開契約に基づく API を `src/index.ts` から公開する | README.md:7-17 | 充足 | `src/index.ts:14`, `src/index.ts:33`, `src/index.ts:35-38` | なし |
| 2 | `initialState` は未作成の商品を表す | README.md:12 | 充足 | `src/index.ts:16-21`, `tests/domain.test.ts:29-35` | なし |
| 3 | `evolve` はイベントを状態に適用する | README.md:13 | 充足 | `src/domain.ts:4-45` | なし |
| 4 | `evolve` は引数を変更しない | README.md:13 | 充足 | `src/domain.ts:7-43`, `tests/domain.test.ts:76-80` | なし |
| 5 | `evolve` は throw しない | README.md:13 | 充足 | `src/domain.ts:4-45` に throw なし | なし |
| 6 | `decide` はコマンドからイベントを導出する | README.md:14 | 充足 | `src/domain.ts:47-60`, `src/domain.ts:62-121` | なし |
| 7 | `decide` の不変条件違反は `DomainError` | README.md:14 | 充足 | `src/domain.ts:63-68`, `src/domain.ts:74-78`, `src/domain.ts:84-97`, `src/domain.ts:104-118` | なし |
| 8 | `CreateProduct` は既存商品を再作成不可 | README.md:21 | 充足 | `src/domain.ts:63-65`, `tests/domain.test.ts:95-99` | なし |
| 9 | `CreateProduct` の名前は trim 後に空でない | README.md:21 | 充足 | `src/domain.ts:66-70`, `tests/domain.test.ts:101-104` | なし |
| 10 | `ReceiveStock` は商品が存在すること | README.md:22 | 充足 | `src/domain.ts:73-76`, `tests/domain.test.ts:113-116` | なし |
| 11 | `ReceiveStock` の数量は正の整数 | README.md:22 | 充足 | `src/domain.ts:77-80`, `src/domain.ts:123-125`, `tests/domain.test.ts:119-122` | なし |
| 12 | `ReserveStock` は商品が存在すること | README.md:23 | 充足 | `src/domain.ts:83-86`, `tests/domain.test.ts:148-151` | なし |
| 13 | `ReserveStock` は available 以内 | README.md:23 | 充足 | `src/domain.ts:94-98`, `tests/domain.test.ts:128-140` | なし |
| 14 | `ReserveStock` の `reservationId` は未使用であること | README.md:23 | 充足 | `src/domain.ts:90-92`, `tests/domain.test.ts:143-146` | なし |
| 15 | `ReserveStock` の数量は正の整数 | README.md:23 | 充足 | `src/domain.ts:87-89`, `src/domain.ts:123-125`, `tests/domain.test.ts:153-156` | なし |
| 16 | `ReleaseReservation` は予約が存在すること | README.md:24 | 充足 | `src/domain.ts:103-110`, `tests/domain.test.ts:162-169` | なし |
| 17 | `ReleaseReservation` は在庫を変えず予約だけ解放する | README.md:24 | 充足 | `src/domain.ts:29-34`, `tests/domain.test.ts:56-60` | なし |
| 18 | `ShipStock` は予約が存在すること | README.md:25 | 充足 | `src/domain.ts:113-120`, `tests/domain.test.ts:172-179` | なし |
| 19 | `ShipStock` は予約数量ぶん `onHand` を減らし予約を消す | README.md:25 | 充足 | `src/domain.ts:36-43`, `tests/domain.test.ts:62-66` | なし |
| 20 | `InMemoryEventStore` は `EventStore` ポートを実装する | README.md:15 | 充足 | `src/event-store.ts:3-28`, `src/types.ts:115-119` | なし |
| 21 | 空ストリームの `load` は `{ events: [], version: 0 }` | README.md:29 | 充足 | `src/event-store.ts:6-10`, `tests/event-store.test.ts:7-10` | なし |
| 22 | `version` は保存済みイベント数 | README.md:29 | 充足 | `src/event-store.ts:22-26`, `tests/event-store.test.ts:12-24` | なし |
| 23 | `append` は version 不一致で `ConcurrencyError` | README.md:30 | 充足 | `src/event-store.ts:18-20`, `tests/event-store.test.ts:26-31` | なし |
| 24 | `append` 競合時は何も保存しない | README.md:30 | 充足 | `src/event-store.ts:18-20`, `tests/event-store.test.ts:33-39` | なし |
| 25 | `load` が返す配列変更は内部に影響しない | README.md:31 | 充足 | `src/event-store.ts:11`, `tests/event-store.test.ts:49-55` | なし |
| 26 | `CommandHandler` は load → replay → decide → append を行う | README.md:16 | 充足 | `src/command-handler.ts:10-20`, `tests/command-handler.test.ts:13-67` | なし |
| 27 | `StockProjection` はイベントから読み取りモデルを構築する | README.md:17 | 未充足 | `src/projection.ts:10`, `src/projection.ts:35`, `src/projection.ts:42`, `src/projection.ts:56` | 商品別に予約数量を保持していない |
| 28 | `getStock(productId)` は `{ onHand, reserved, available }` を返す | README.md:35 | 充足 | `src/projection.ts:70-80`, `tests/projection.test.ts:21-57` | なし |
| 29 | 未知商品の `getStock(productId)` は `undefined` | README.md:35 | 充足 | `src/projection.ts:70-74`, `tests/projection.test.ts:17-19` | なし |
| 30 | `StockShipped` では予約数量ぶん `onHand` と `reserved` が減る | README.md:36 | 未充足 | `src/projection.ts:10`, `src/projection.ts:35`, `src/projection.ts:56-62` | 同じ `reservationId` が別商品で使われると別商品の数量で減算する |
| 31 | `lowStock(threshold)` は `available < threshold` の productId を昇順で返す | README.md:37 | 充足 | `src/projection.ts:82-93`, `tests/projection.test.ts:59-68` | なし |
| 32 | ドメインロジックはストアやプロジェクションに依存しない | README.md:43 | 充足 | `src/domain.ts:1-2` | なし |
| 33 | `CommandHandler` は具象ストアに依存しない | README.md:44 | 充足 | `src/command-handler.ts:4-8`, `src/types.ts:115-119` | なし |
| 34 | プロジェクションは書き込みモデルを参照せずイベントのみから構築する | README.md:45 | 充足 | `src/projection.ts:1`, `src/projection.ts:12-68` | なし |
| 35 | `src/types.ts` は変更禁止 | README.md:46 | 充足 | `git diff -- src/types.ts` に差分なし | なし |
| 36 | `tests/` は変更禁止 | ユーザー要求 | 充足 | `git diff -- tests/...` に差分なし | なし |
| 37 | `src/index.ts` の公開 API シグネチャ変更禁止 | README.md:46 / ユーザー要求 | 充足 | `src/index.ts:14`, `src/index.ts:33`, `src/index.ts:35-38` | なし |
| 38 | tests 配下 51 件が成功する状態 | ユーザー要求 | 充足証跡あり | `fix.2.20260704T025839Z.md` に `npm test`: 51 tests passed | この supervise では再実行禁止 |
| 39 | 型チェックが通る状態 | README.md:52 | 充足証跡あり | `fix.2.20260704T025839Z.md` に `npm run typecheck`: 型エラーなし | この supervise では再実行禁止 |

## 前段 finding の再評価

| finding_id | 前段判定 | 元の期待結果 | 再評価 | 根拠 |
|------------|----------|--------------|--------|------|
| CODE-NEW-src-command-handler-L5 | resolved | `currentState` がリクエスト間で汚染されないこと | 妥当 | `src/command-handler.ts:14` で `currentState` は `handle` 内ローカル |
| ARCH-NEW-index-L23-shallow | resolved | `initialState.reservations` を含むネスト状態が変更不能であること | 妥当 | `src/index.ts:23-33` で再帰的 `deepFreeze` 適用 |
| AI-NEW-command-handler-L5 | resolved | 冗長な状態保持を削除すること | 妥当 | `src/command-handler.ts:3-21` に状態保持プロパティなし |
| AI-NEW-command-handler-L19 | resolved | 意味のない `try-catch` を削除すること | 妥当 | `src/command-handler.ts:10-20` に `try-catch` なし |

## 未分類の懸念チェック

| レビュー | 懸念 | finding化状態 | 監督判定 | 根拠 |
|----------|------|---------------|----------|------|
| architect-review | 最新無印では懸念なし | 非finding分類なし | 追加 REJECT 理由あり | `src/projection.ts:10`, `src/projection.ts:35`, `src/projection.ts:56` |
| coding-review | Projection が正しいと承認 | 未分類 | REJECT理由 | 同一 `reservationId` が別商品で使われるケースを検証していない |
| ai-antipattern-review | 最新無印では懸念なし | 非finding分類なし | 追加 REJECT 理由あり | `src/projection.ts:10`, `src/projection.ts:35`, `src/projection.ts:56` |

## 保守スコープチェック（保守 workflow の場合のみ）

| 観点 | 結果 | 根拠 |
|------|------|------|
| 必須変更のみか | 対象外 | 本件は保守 workflow ではなく実装タスク |
| 関連変更の理由が明確か | 対象外 | 本件は保守 workflow ではなく実装タスク |
| 不要変更が残っていないか | 対象外 | 本件は保守 workflow ではなく実装タスク |
| コメント削除が要求外で起きていないか | 対象外 | 本件は保守 workflow ではなく実装タスク |
| 型名・ファイル配置・公開APIが要求外で変わっていないか | 対象外 | 本件は保守 workflow ではなく実装タスク |
| UI文言・アクセシビリティ名・テスト期待値が要求外で変わっていないか | 対象外 | UI変更なし |

## 検証サマリー

| 項目 | 状態 | 確認方法 |
|------|------|---------|
| テスト | OK | `fix.2.20260704T025839Z.md` に `npm test`: 51 tests passed (4 test files passed) の証跡あり |
| ビルド | OK | `fix.2.20260704T025839Z.md` に `npm run typecheck`: 型エラーなしの証跡あり |
| 動作確認 | NG | 実コード確認により、Projection の同一 `reservationId` 商品間衝突ケースで README の期待挙動を満たさない |

## 未確認範囲

| 項目 | 影響 | 扱い |
|------|------|------|
| この supervise フェーズでのテスト・型チェック再実行 | 補助要件 | 指示により再実行禁止。既存証跡のみ使用 |
| 同一 `reservationId` を別商品で使う Projection 動作の実行テスト | 主要要件 | 実コード上の契約不整合として REJECT 理由 |

## 今回の指摘（new）

| # | finding_id | 項目 | 根拠 | 理由 | 必要アクション |
|---|------------|------|------|------|----------------|
| 1 | VAL-NEW-src-projection-L10-reservation-scope | Projection の商品間予約衝突 | `src/projection.ts:10`, `src/projection.ts:35`, `src/projection.ts:42`, `src/projection.ts:56` | 予約数量を `reservationId` だけで保持しているため、商品Aと商品Bで同じ `reservationId` を使うと、後から適用された商品の数量で上書きされる。`StockShipped` / `ReservationReleased` が対象商品の予約数量を使えない | 予約数量を `productId` と `reservationId` の組で管理する。例: `Record<string, Record<string, number>>` または複合キーを使用し、release/ship も同じキーで参照・削除する |

## 継続指摘（persists）

| # | finding_id | 前回根拠 | 今回根拠 | 理由 | 必要アクション |
|---|------------|----------|----------|------|----------------|
| なし | - | - | - | - | - |

## 解消済み（resolved）

| finding_id | 元の期待結果 | 解消根拠 |
|------------|--------------|----------|
| CODE-NEW-src-command-handler-L5 | `currentState` がリクエスト間で汚染されないこと | `src/command-handler.ts:14` でローカル変数として再構築 |
| ARCH-NEW-index-L23-shallow | `initialState` のネストオブジェクトも変更不能であること | `src/index.ts:23-33` の `deepFreeze` |
| AI-NEW-command-handler-L5 | 冗長な状態保持を削除すること | `src/command-handler.ts:3-21` に状態保持プロパティなし |
| AI-NEW-command-handler-L19 | 意味のない `try-catch` を削除すること | `src/command-handler.ts:10-20` に `try-catch` なし |

## 成果物

- 作成: なし（supervise フェーズではファイル作成なし）
- 変更: なし（supervise フェーズではファイル変更なし）

## 未完了項目（REJECTの場合）

| # | 項目 | 理由 |
|---|------|------|
| 1 | `StockProjection` の予約数量管理 | 商品別に予約数量を管理していないため、同一 `reservationId` が別商品で使われると `StockShipped` / `ReservationReleased` の結果が誤る |

## REJECT判定条件

- `new` 指摘 `VAL-NEW-src-projection-L10-reservation-scope` が1件あるため REJECT。