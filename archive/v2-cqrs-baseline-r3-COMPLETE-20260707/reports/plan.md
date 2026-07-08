# タスク計画

## 元の要求
在庫管理ドメインをイベントソーシングで実装するライブラリを作ってください。

仕様は README.md に記載されています。公開 API は src/types.ts の型定義に準拠し、利用者が src/index.ts から import できる形にしてください。

フレームワークには依存せず、インメモリで完結するライブラリとして実装してください。アーキテクチャ上の制約は README.md の「アーキテクチャ要件」に従ってください。

## 分析結果

### 目的
現在 open の F-0006/F-0007/F-0008 について、現行コードと突き合わせて再修正が必要か判定する。

結論として、F-0006/F-0007/F-0008 はすべて stale な指摘である。現行 `src/projection.ts:112` は既に `Array.from(state.reservations.values())` を使用しており、ledger が指摘する `Object.values(state.reservations)` は存在しない。したがって、実装変更は計画しない。次工程では同じ箇所を再修正せず、Disputed Findings として扱う。

### 分解した要件
| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | `src/types.ts` の公開契約を変更しない | 明示 | README.md:46、src/types.ts:1-120 |
| 2 | `src/index.ts` の公開 API シグネチャを変更しない | 明示 | README.md:46、src/index.ts:6-11 |
| 3 | 利用者は `src/index.ts` と `src/types.ts` だけを import して使える | 明示 | README.md:7-8、src/index.ts:6-11 |
| 4 | `StockProjection` はイベントから在庫の読み取りモデルを構築する | 明示 | README.md:17 |
| 5 | `getStock(productId)` は `{ onHand, reserved, available }` を返す | 明示 | README.md:35、src/projection.ts:95-107 |
| 6 | `StockShipped` では予約数量ぶん `onHand` と `reserved` を減らす | 明示 | README.md:36、src/projection.ts:74-90 |
| 7 | `lowStock(threshold)` は `available < threshold` の productId を昇順で返す | 明示 | README.md:37、src/projection.ts:109-119 |
| 8 | `ProjectionState.reservations` が Map の場合、予約数量の集計は Map values を使う | 暗黙 | F-0006/F-0007/F-0008 の指摘対象。現行コードは対応済み |
| 9 | プロジェクションは書き込みモデルを参照せず、イベントのみから構築する | 明示 | README.md:45、src/projection.ts:1 |
| 10 | フレームワークに依存しない | 明示 | ユーザー要求。package.json:10-13 は devDependencies のみ |
| 11 | インメモリで完結する | 明示 | ユーザー要求。src/event-store.ts は Map ベースのインメモリ実装 |
| 12 | テストファイルは変更しない | 明示 | README.md:51 |

### 参照資料の調査結果
参照資料として README.md、src/types.ts、Knowledge Source、現行 src 配下、現行 tests 配下、Finding ledger を確認した。

- README.md は `StockProjection` の責務を「イベントから在庫の読み取りモデルを構築する」と定義している（README.md:17）。
- README.md は `lowStock(threshold)` の仕様を「`available < threshold` の productId を昇順で返す」と定義している（README.md:37）。
- `src/types.ts` は公開契約であり、イベント型、`StockLevel`、`EventStore` などを定義している。変更禁止である（src/types.ts:1-120、README.md:46）。
- `src/projection.ts` の内部 `ProjectionState.reservations` は現在 `Map<string, number>` である（src/projection.ts:3-6）。
- `src/projection.ts` の `getStock` は `Array.from(state.reservations.values()).reduce(...)` で予約数量を合計している（src/projection.ts:100）。
- `src/projection.ts` の `lowStock` も `Array.from(state.reservations.values()).reduce(...)` で予約数量を合計している（src/projection.ts:112）。
- `rg` による確認では、`src/projection.ts` に `Object.values(state.reservations)` は存在しない。
- `src/domain.ts:124` に `Object.values(state.reservations)` は存在するが、これは `ProductState.reservations: Record<string, number>` に対する集計であり、Map を対象とする F-0006/F-0007/F-0008 とは別件である。
- `tests/projection.test.ts:59-68` は `lowStock` の昇順・閾値判定を検証している。
- `tests/projection-contracts.test.ts:88-94` は内部 reservation storage が Map であることを検証している。
- `npm test` は 10 files / 76 tests すべて通過。
- `npm run typecheck` は通過。
- Finding ledger では F-0001〜F-0005 は resolved。F-0006/F-0007/F-0008 は open だが、現行コードとは一致しない。

### スコープ
現行コードに対する実装修正は不要。

| ファイル | 変更要否 | 理由 |
|---------|----------|------|
| `src/projection.ts` | 変更不要 | F-0006/F-0007/F-0008 の指摘対象である `lowStock` は既に `Array.from(state.reservations.values())` を使用している |
| `src/types.ts` | 変更不要・変更禁止 | README.md:46 で変更禁止 |
| `src/index.ts` | 変更不要 | 公開 API re-export は現行で維持されている |
| `src/domain.ts` | 変更不要 | `Object.values` は Record 型の `ProductState.reservations` に対する処理で、今回の Map 指摘とは別対象 |
| `tests/` | 変更不要・変更禁止 | README.md:51。現行 76 tests 通過 |

### 検討したアプローチ
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| `src/projection.ts:112` を再修正する | 不採用 | 現行コードは既に `Array.from(state.reservations.values())` で、指摘の `Object.values()` は存在しない |
| `lowStock` の予約数量集計を共通ヘルパー化する | 不採用 | 現行コードは仕様を満たしテストも通過している。今回の open finding 解消に不要な追加改善になる |
| F-0006/F-0007/F-0008 を stale として dispute する | 採用 | ledger の open 状態が現行コードと不一致。再修正ループを避けるべき条件に該当する |
| テストを追加・変更する | 不採用 | tests 配下は README.md:51 で変更禁止。既存テストも `lowStock` と Map 内部構造を検証済み |

### 実装アプローチ
実装変更は行わない。

次工程では F-0006/F-0007/F-0008 に対して同じ箇所を再修正せず、現行コードが既に修正済みであることを根拠に Disputed Findings として扱う。修正対象コードがないため、`src/projection.ts`、`src/types.ts`、`tests/` は変更しない。

検証としては、現行状態で以下が確認済みである。

- `npm test`: 10 files / 76 tests passed
- `npm run typecheck`: passed

### 到達経路・起動条件
| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `src/index.ts` からの named import |
| 更新が必要な呼び出し元・配線 | なし |
| 起動条件 | 認証、権限、URL、フラグなし。ライブラリ利用者が関数・クラスを直接呼び出す |
| 未対応項目 | なし |

## 実装ガイドライン
- F-0006/F-0007/F-0008 に対して `src/projection.ts:112` を再修正しない。
- `src/projection.ts:112` は現行で `Array.from(state.reservations.values()).reduce(...)` になっており、Map values を正しく集計している。
- `src/projection.ts:100` の `getStock` も同じく `Array.from(state.reservations.values()).reduce(...)` で予約数量を集計している。
- `src/domain.ts:124` の `Object.values(state.reservations)` は `Record<string, number>` に対する処理であり、Map に対する誤用ではないため今回の修正対象にしない。
- tests は変更しない。
- `src/types.ts` は変更しない。
- 実装工程が走る場合でも、コード変更なしで `npm test` と `npm run typecheck` の確認に留める。

## Disputed Findings
| findingId | reason | evidence |
|-----------|--------|----------|
| F-0006 | stale。現行 `src/projection.ts:112` は Map に対して `Object.values()` を使っておらず、既に `Array.from(state.reservations.values())` を使っている | src/projection.ts:109-119 |
| F-0007 | stale。現行 `lowStock` の予約数量集計は `Array.from(state.reservations.values()).reduce(...)` であり、指摘内容と一致しない | src/projection.ts:112 |
| F-0008 | stale。現行 `ProjectionState.reservations` は Map であり、`lowStock` は Map の `.values()` を使って集計している | src/projection.ts:3-6, src/projection.ts:112 |

## スコープ外
| 項目 | 除外理由 |
|------|---------|
| `src/projection.ts` の追加リファクタリング | 現行コードが F-0006/F-0007/F-0008 を満たしており、追加改善は今回の open finding 対応範囲外 |
| `src/types.ts` の変更 | README.md:46 で変更禁止 |
| テスト変更 | README.md:51 で tests 配下は変更禁止 |
| ledger ファイルの手動編集 | このステップではソース編集禁止。Finding manager が adjudicate する対象 |

## 確認事項
なし。