# Merge Readiness Review

## 結果: REJECT

## サマリー
テスト 51 件と typecheck は成功していますが、`StockProjection` が README のアーキテクチャ要件に反して書き込みモデル `ProductState` と `evolve()` に依存しています。加えて、今回追加された `src/event-store.ts` に未使用 import が残っており、保守前提ではマージ不可です。

## 保守前提のマージ品質チェック
| # | 観点 | 状態 | 根拠（ファイル:行 / テスト / 実行証跡） | コメント |
|---|------|------|---------------------------------------|----------|
| 1 | 要求充足 | 未充足 | `README.md:45`, `src/projection.ts:1`, `src/projection.ts:5`, `src/projection.ts:12` | プロジェクションが書き込みモデルを参照しない要件を満たしていません |
| 2 | 既存契約・既存フローへの影響 | 問題あり | `src/projection.ts:2`, `src/evolve.ts:3` | 読み取りモデルが集約状態更新ロジックに結合しています |
| 3 | テスト・検証 | 十分 | `npm test`: 51 passed, `npm run typecheck`: 成功 | 実行証跡上は成功しています |
| 4 | 要求外変更・スコープクリープ | 問題なし | `git diff -- src/index.ts`, `rg --files src tests` | README/types/tests の変更は確認していません |
| 5 | 保守可能性・将来変更容易性 | 問題あり | `src/event-store.ts:1` | 未使用の `Command` import が残っています |
| 6 | 明白なセキュリティ・データ保護・運用リスク | 問題なし | `rg -n "any|TODO|FIXME|catch" src tests README.md` | ブロッキング相当の該当は確認していません |

## 横断監査証跡
| # | 変更カテゴリ | 抽出した項目 | 確認した検索語・ファイル | 判定 | コメント |
|---|--------------|--------------|--------------------------|------|----------|
| 1 | 型 / entrypoint | `ProductState`, `StockProjection`, `evolve` | `rg -n "StockProjection|projection|ProductState|evolve"` / `src/projection.ts:1-12`, `README.md:43-45` | 問題あり | プロジェクションが集約状態型とドメイン更新関数に依存しています |
| 2 | 型 / import | `Command` | `rg -n "\bCommand\b" src/event-store.ts src/command-handler.ts src/decide.ts src/types.ts` / `src/event-store.ts:1` | 問題あり | `src/event-store.ts` では import のみで未使用です |
| 3 | resolved finding | F-0006, F-0009, F-0010, F-0011 | `rg -n "Object\.hasOwn|state\.reservations" src` / `src/decide.ts:32`, `src/decide.ts:43`, `src/decide.ts:50`, `src/evolve.ts:19` | 問題なし | 予約 ID の継承プロパティ混入は `Object.hasOwn` で遮断されています |
| 4 | 公開入口 | `initialState`, `decide`, `evolve`, `InMemoryEventStore`, `CommandHandler`, `StockProjection` | `rg -n "export \*|initialState|class|function" src` / `src/index.ts:8-23` | 問題なし | `src/index.ts` は公開 API を re-export する構成です |

## 要求照合
| # | 要求（タスクから抽出） | 状態 | 根拠（ファイル:行） | コメント |
|---|-------------------|------|-------------------|----------|
| 1 | README.md と src/types.ts の契約に従う | 未充足 | `README.md:45`, `src/projection.ts:1-12` | プロジェクション独立性の契約違反です |
| 2 | tests/ 配下の全テスト 51 件成功 | 充足 | `npm test`: 51 passed | 確認済み |
| 3 | tests/ と src/types.ts を変更しない | 充足 | `git diff -- README.md src/types.ts tests ...` | 差分は `src/index.ts` と新規 `src/*.ts` 実装ファイル中心です |
| 4 | src/index.ts の公開 API シグネチャ変更禁止 | 充足 | `src/index.ts:8-23` | 既定 API は re-export されています |
| 5 | アーキテクチャ要件を守る | 未充足 | `README.md:43-45`, `src/projection.ts:1-12` | プロジェクションが書き込みモデルを参照しています |

## 観測した指摘
| # | family_tag | カテゴリ | 重大度 | 場所 | 問題 | 修正案 |
|---|------------|---------|--------|------|------|--------|
| 1 | maintainability-readiness | 要求未充足 | high | `src/projection.ts:1`, `src/projection.ts:5`, `src/projection.ts:12` | `StockProjection` が `ProductState` を保持し、`evolve()` を呼び出して読み取りモデルを構築しています。README.md:45 の「プロジェクションは書き込みモデル（集約の状態）を参照せず、イベントのみから構築すること」に反します。 | `StockProjection` 内に投影専用の状態を定義し、`DomainEvent` ごとに直接 `onHand` / `reserved` / `available` 算出用データを更新してください。`ProductState` と `evolve` への依存は削除してください。 |
| 2 | maintainability-readiness | 保守困難化 | medium | `src/event-store.ts:1` | `Command` が import されていますが、`src/event-store.ts` 内で使用されていません。今回追加された未使用コードです。 | `Command` を import から削除してください。 |

## 検証証跡
- ビルド: `npm run typecheck` を実行し成功
- テスト: `npm test` を実行し 4 files / 51 tests passed
- 動作確認: `README.md`, `src/types.ts`, `src/index.ts`, `src/decide.ts`, `src/evolve.ts`, `src/event-store.ts`, `src/command-handler.ts`, `src/projection.ts`, `tests/*.test.ts`, `findings-ledger.json`, 前段レビューレポートを確認

## REJECT判定条件
- マージを止めるべき観測指摘が 1 件以上あるため REJECT