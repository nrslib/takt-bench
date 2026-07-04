# 最終検証結果

## 結果: REJECT

## 要件充足チェック

| # | 分解した要件 | 元要件の出典 | 充足 | 根拠（ファイル:行） | 例外・optional 化の根拠 |
|---|------------|--------------|------|-------------------|--------------------------|
| 1 | README.md の仕様に従う | User Request / `README.md:5-46` | ❌ | `src/projection.ts:1-13` が `ProductState` / `evolve` / `getInitialState` に依存し、`README.md:45` に反する | なし |
| 2 | `src/types.ts` の公開契約に従う | User Request / `src/types.ts:1-120` | ✅ | `src/types.ts` は差分なし。実装は `DomainEvent` / `Command` / `EventStore` 型を参照 | なし |
| 3 | `initialState` を公開する | `README.md:12` | ✅ | `src/index.ts:7`, `src/domain.ts:12` | なし |
| 4 | `evolve(state, event)` を公開する | `README.md:13` | ✅ | `src/index.ts:7`, `src/domain.ts:26-51` | なし |
| 5 | `evolve` は引数を変更しない | `README.md:13` | ✅ | `src/domain.ts:27` で state と reservations をコピー | なし |
| 6 | `decide(state, command)` を公開する | `README.md:14` | ✅ | `src/index.ts:7`, `src/domain.ts:53-69` | なし |
| 7 | `decide` の不変条件違反は `DomainError` | `README.md:14` | ✅ | `src/domain.ts:71-127` | なし |
| 8 | `InMemoryEventStore` を公開する | `README.md:15` | ✅ | `src/index.ts:8`, `src/event-store.ts:3-21` | なし |
| 9 | `CommandHandler` を公開する | `README.md:16` | ✅ | `src/index.ts:9`, `src/command-handler.ts:4-18` | なし |
| 10 | `StockProjection` を公開する | `README.md:17` | ✅ | `src/index.ts:10`, `src/projection.ts:4-40` | なし |
| 11 | `CreateProduct`: 既存商品は再作成不可 | `README.md:21` | ✅ | `src/domain.ts:71-74` | なし |
| 12 | `CreateProduct`: 名前は trim 後に空でない | `README.md:21` | ✅ | `src/domain.ts:75-79` | なし |
| 13 | `ReceiveStock`: 商品が存在すること | `README.md:22` | ✅ | `src/domain.ts:82-85` | なし |
| 14 | `ReceiveStock`: 数量は正の整数 | `README.md:22` | ✅ | `src/domain.ts:86-90` | なし |
| 15 | `ReserveStock`: 商品が存在すること | `README.md:23` | ✅ | `src/domain.ts:92-95` | なし |
| 16 | `ReserveStock`: available 以内であること | `README.md:23` | ✅ | `src/domain.ts:102-106` | なし |
| 17 | `ReserveStock`: `reservationId` は未使用であること | `README.md:23` | ✅ | `src/domain.ts:99-101` | なし |
| 18 | `ReserveStock`: 数量は正の整数 | `README.md:23` | ✅ | `src/domain.ts:96-98` | なし |
| 19 | `ReleaseReservation`: 予約が存在すること | `README.md:24` | ✅ | `src/domain.ts:109-117` | なし |
| 20 | `ShipStock`: 予約が存在すること | `README.md:25` | ✅ | `src/domain.ts:119-127` | なし |
| 21 | 空ストリームの `load` は `{ events: [], version: 0 }` | `README.md:29` | ✅ | `src/event-store.ts:7-11` | なし |
| 22 | `version` は保存済みイベント数 | `README.md:29` | ✅ | `src/event-store.ts:20` | なし |
| 23 | `append` は expectedVersion 不一致で `ConcurrencyError` | `README.md:30` | ✅ | `src/event-store.ts:13-17` | なし |
| 24 | `append` 競合時は何も保存しない | `README.md:30` | ✅ | `src/event-store.ts:15-17` は保存前に throw | なし |
| 25 | `load` の返却配列変更が内部に影響しない | `README.md:31` | ✅ | `src/event-store.ts:10` | なし |
| 26 | `getStock(productId)` は未知商品で `undefined` | `README.md:35` | ✅ | `src/projection.ts:15-19` | なし |
| 27 | `getStock(productId)` は `{ onHand, reserved, available }` | `README.md:35` | ✅ | `src/projection.ts:20-26` | なし |
| 28 | `StockShipped` は予約数量ぶん `onHand` と `reserved` を減らす | `README.md:36` | ✅ | `src/domain.ts:42-45`, `src/projection.ts:12` | なし |
| 29 | `lowStock(threshold)` は `available < threshold` | `README.md:37` | ✅ | `src/projection.ts:29-38` | なし |
| 30 | `lowStock(threshold)` は productId 昇順 | `README.md:37` | ✅ | `src/projection.ts:38` | なし |
| 31 | ドメインロジックは純粋に保ち、ストアに依存しない | `README.md:43` | ✅ | `src/domain.ts:1` は `types` のみ import | なし |
| 32 | ドメインロジックはプロジェクションに依存しない | `README.md:43` | ✅ | `src/domain.ts:1` は `types` のみ import | なし |
| 33 | `CommandHandler` は `EventStore` ポートにのみ依存 | `README.md:44` | ✅ | `src/command-handler.ts:1,5-8` | なし |
| 34 | `CommandHandler` は具象 `InMemoryEventStore` に依存しない | `README.md:44` | ✅ | `src/command-handler.ts:1-18` に `InMemoryEventStore` import なし | なし |
| 35 | プロジェクションは書き込みモデルを参照しない | `README.md:45` | ❌ | `src/projection.ts:1-5` が `ProductState` を保持 | なし |
| 36 | プロジェクションはイベントのみから構築する | `README.md:45` | ❌ | `src/projection.ts:2,12` がドメインの `evolve` に依存 | なし |
| 37 | `src/types.ts` は変更禁止 | User Request / `README.md:46` | ✅ | `git diff -- src/types.ts` 差分なし | なし |
| 38 | `tests/` は変更禁止 | User Request | ✅ | `git diff -- tests/...` 差分なし | なし |
| 39 | `src/index.ts` の公開 API シグネチャ変更禁止 | User Request / `README.md:46` | ❌ | `src/index.ts:7` が README にない `calculateAvailable` を公開 | なし |
| 40 | tests 配下の全テスト 51 件が成功 | User Request | ✅ | 実装ログ: `npm test`: 51 tests passed (4 test files) | なし |
| 41 | `npm run typecheck` で型エラーなし | Quality Gates | ⚠️ | 実装ログは No errors。`architect-review.md:29` は未実行・推定と記録 | なし |

## 前段 finding の再評価

| finding_id | 前段判定 | 元の期待結果 | 再評価 | 根拠 |
|------------|----------|--------------|--------|------|
| ARCH-NEW-src-projection-L20 | new / Warning | available 計算の重複を整理する | 妥当。ただし前段の「domain の `calculateAvailable` を import」案は overreach | `src/projection.ts:20-21`, `src/projection.ts:32-33`, `README.md:45` |
| AI-lowStock-mutability | 非finding分類済み | `lowStock()` の返却配列が内部状態を壊さない | false_positive | `src/projection.ts:29-39` の `result` はメソッド内ローカル配列 |
| AI-getInitialState-redundant | 非finding分類済み | 未使用または冗長なら削除 | false_positive。ただし Projection がこれに依存する点は別 finding | `src/domain.ts:3-12`, `src/projection.ts:2,9` |
| Previous-deepFreeze-state-copy | resolved 扱い | `evolve` が `reservations` を破壊しない | 妥当 | `src/domain.ts:27` |
| Previous-projection-shared-state | resolved 扱い | 商品ごとの状態が共有されない | 機能面では妥当。ただし README の独立性要件は未充足 | `src/projection.ts:4-13`, `README.md:45` |

## 未分類の懸念チェック

| レビュー | 懸念 | finding化状態 | 監督判定 | 根拠 |
|----------|------|---------------|----------|------|
| architect-review | Projection が `calculateAvailable` と同等計算を重複 | finding化済み | 妥当。ただし推奨修正先は不適切 | `src/projection.ts:20-21`, `src/projection.ts:32-33` |
| architect-review | typecheck は未実行だが型エラーなしと推定 | 未分類 | 検証証跡の矛盾として扱う | `architect-review.md:29`, 実装ログの `npm run typecheck`: No errors |
| ai-antipattern-review | `lowStock()` の配列ミュータビリティ | 非finding分類済み | false_positive として妥当 | `src/projection.ts:29-39` |
| ai-antipattern-review | `getInitialState()` の存在 | 非finding分類済み | 冗長性は false_positive。ただし Projection 依存は REJECT 理由 | `src/domain.ts:3-12`, `src/projection.ts:2,9` |
| coding-review | 未使用コードなし | 未分類 | 不正確。`src/command-handler.ts:1` に未使用 import あり | `src/command-handler.ts:1` |

## 保守スコープチェック（保守 workflow の場合のみ）

| 観点 | 結果 | 根拠 |
|------|------|------|
| 必須変更のみか | ❌ | `src/index.ts:7` で要求外の `calculateAvailable` 公開 API が追加されている |
| 関連変更の理由が明確か | ✅ | `src/domain.ts`, `src/event-store.ts`, `src/command-handler.ts`, `src/projection.ts` の追加は実装要求に対応 |
| 不要変更が残っていないか | ❌ | `src/command-handler.ts:1` に未使用 import が残存 |
| コメント削除が要求外で起きていないか | ✅ | 削除ファイルなし。`src/index.ts` のスタブ置換は実装に必要 |
| 型名・ファイル配置・公開APIが要求外で変わっていないか | ❌ | `src/index.ts:7` が `calculateAvailable` を追加公開 |
| UI文言・アクセシビリティ名・テスト期待値が要求外で変わっていないか | ✅ | UIなし。`tests/` 差分なし |

## 検証サマリー

| 項目 | 状態 | 確認方法 |
|------|------|---------|
| テスト | ✅ | 実装ログに `npm test`: 51 tests passed (4 test files) と記録。レビュー各レポートも 51/51 passed と記録 |
| ビルド | ⚠️ | 実装ログと coding-review は `npm run typecheck`: No errors / pass と記録。一方 `architect-review.md:29` は未実行・推定と記録しており証跡が矛盾 |
| 動作確認 | ❌ | テスト上の主要フローは通過。ただし README のアーキテクチャ要件「プロジェクションの独立性」が実コードで未充足 |

## 未確認範囲

| 項目 | 影響 | 扱い |
|------|------|------|
| `npm run typecheck` の一次ログ | 補助要件。ただし Quality Gate | 証跡矛盾として記録。REJECT は主に要件未充足に基づく |
| 実行コマンドの生ログ全文 | 補助証跡 | 実装ステップの最終ログとレポートで代替確認 |

## 今回の指摘（new）

| # | finding_id | 項目 | 根拠 | 理由 | 必要アクション |
|---|------------|------|------|------|----------------|
| 1 | VAL-NEW-src-projection-L1 | アーキテクチャ要件違反 | `README.md:45`, `src/projection.ts:1-13` | Projection が `ProductState` を保持し、`evolve` / `getInitialState` に依存しているため、書き込みモデルを参照せずイベントのみから構築する要件を満たさない | Projection 専用の読み取りモデル状態を持ち、イベントを直接適用する実装に変更する |
| 2 | VAL-NEW-src-index-L7 | 公開 API 変更 | `README.md:7-17`, `README.md:46`, `src/index.ts:7` | README に列挙されていない `calculateAvailable` が `src/index.ts` から公開されている | `calculateAvailable` を `src/index.ts` の公開 export から外す |
| 3 | VAL-NEW-src-command-handler-L1 | 未使用コード | `src/command-handler.ts:1` | `DomainError` と `ProductState` が import されているが使用されていない | 未使用 import を削除する |

## 継続指摘（persists）

| # | finding_id | 前回根拠 | 今回根拠 | 理由 | 必要アクション |
|---|------------|----------|----------|------|----------------|
| 1 | ARCH-NEW-src-projection-L20 | `src/projection.ts:20,32` | `src/projection.ts:20-21`, `src/projection.ts:32-33` | available 計算の重複は残存。ただし domain helper import ではなく Projection 内 helper 化が必要 | Projection の独立性を壊さない形で重複を解消する |

## 解消済み（resolved）

| finding_id | 元の期待結果 | 解消根拠 |
|------------|--------------|----------|
| Previous-deepFreeze-state-copy | `evolve` が frozen input を破壊しない | `src/domain.ts:27` で `state` と `reservations` をコピー |
| Previous-stockshipped-quantity | `StockShipped` はイベントに数量を持たず予約数量で減算 | `src/domain.ts:42-45` が `state.reservations[event.reservationId]` を使用 |
| Previous-product-state-sharing | 商品ごとの Projection 状態が共有されない | `src/projection.ts:8-12` で productId ごとに state を Map 管理 |

## 成果物

- 作成: なし（この supervise フェーズでは作成していない）
- 変更: なし（この supervise フェーズでは変更していない）

## 未完了項目（REJECTの場合）

| # | 項目 | 理由 |
|---|------|------|
| 1 | Projection の独立性 | `src/projection.ts` が書き込みモデル型と domain の `evolve` に依存している |
| 2 | 公開 API 契約 | `src/index.ts` が要求外の `calculateAvailable` を公開している |
| 3 | 未使用 import の除去 | `src/command-handler.ts:1` に未使用 import が残っている |
| 4 | 型チェック証跡の整合 | 実装ログと architect-review の記録が矛盾している |

## REJECT判定条件

- `new` または `persists` が1件以上ある場合のみ REJECT 可
- `finding_id` なしの指摘は無効