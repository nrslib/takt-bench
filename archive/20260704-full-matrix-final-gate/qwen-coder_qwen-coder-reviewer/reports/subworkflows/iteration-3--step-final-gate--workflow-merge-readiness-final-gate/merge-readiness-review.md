# Merge Readiness Review

## 結果: REJECT

## サマリー
最大のブロッカーは、`src/index.ts` が README にない `calculateAvailable` を公開しており、公開 API シグネチャ変更禁止に違反している点です。加えて、`StockProjection` が書き込みモデルである `ProductState` と `evolve()` に依存しており、README のプロジェクション独立性要件を満たしていません。

## 保守前提のマージ品質チェック
| # | 観点 | 状態 | 根拠 | コメント |
|---|------|------|------|----------|
| 1 | 要求充足 | 未充足 | `README.md:45-46`, `src/index.ts:7`, `src/projection.ts:1-12` | 公開 API 追加と projection の書き込みモデル依存が残存 |
| 2 | 既存契約・既存フローへの影響 | 問題あり | `src/index.ts:7` | `calculateAvailable` が新たに公開入口へ露出 |
| 3 | テスト・検証 | 十分 | `npm test`: 51 passed, `npm run typecheck`: 成功 | 機能テストは通過。ただし契約違反はテスト外 |
| 4 | 要求外変更・スコープクリープ | 問題あり | `README.md:7-17`, `src/index.ts:7` | README の公開 API 一覧外 helper を公開 |
| 5 | 保守可能性・将来変更容易性 | 問題あり | `src/projection.ts:1-12` | projection が aggregate state の変更に巻き込まれる |
| 6 | 明白なセキュリティ・データ保護・運用リスク | 問題なし | `rg "any\\b|TODO|FIXME|catch\\s*\\(" src tests README.md` | 該当リスクは検出なし |

## 横断監査証跡
| # | 変更カテゴリ | 抽出した項目 | 確認した検索語・ファイル | 判定 | コメント |
|---|--------------|--------------|--------------------------|------|----------|
| 1 | entrypoint / helper | `calculateAvailable` | `calculateAvailable` / `src/index.ts:7`, `src/domain.ts:22` | 問題あり | 内部 helper が公開 API に追加されている |
| 2 | 型 / helper / projection | `ProductState`, `evolve`, `getInitialState` | `ProductState`, `from './domain'` / `src/projection.ts:1-12` | 問題あり | projection が書き込みモデルと domain evolve に依存 |
| 3 | import | `DomainError`, `ProductState` | `DomainError`, `ProductState` / `src/command-handler.ts:1` | 問題あり | `--noUnusedLocals` で未使用 import を確認 |

## 要求照合
| # | 要求 | 元要件の出典 | 状態 | 根拠 | 例外・未確認の根拠 |
|---|------|--------------|------|------|-------------------|
| 1 | README と `src/types.ts` の公開契約に従う | `README.md:7-17`, `src/types.ts:1-120` | 未充足 | `src/index.ts:7` | 公開 API 一覧外の `calculateAvailable` を export |
| 2 | tests 配下 51 件を成功させる | ユーザー要求 | 充足 | `npm test`: 51 passed | なし |
| 3 | `src/index.ts` の公開 API シグネチャ変更禁止 | `README.md:46` | 未充足 | `src/index.ts:7` | 追加 export あり |
| 4 | projection は書き込みモデルを参照せずイベントのみから構築 | `README.md:45` | 未充足 | `src/projection.ts:1-12` | `ProductState` と `evolve()` を参照 |

## 今回の指摘（new）
| # | finding_id | family_tag | カテゴリ | 場所 | 問題 | 修正案 |
|---|------------|------------|---------|------|------|--------|
| 1 | MERGE-NEW-src-index-L7 | maintainability-readiness | 契約破壊 / スコープクリープ | `src/index.ts:7` | README にない `calculateAvailable` を公開し、公開 API シグネチャ変更禁止に違反 | `calculateAvailable` を `src/index.ts` から export しない |
| 2 | MERGE-NEW-src-projection-L1 | maintainability-readiness | 要求未充足 / 保守困難化 | `src/projection.ts:1-12` | `StockProjection` が `ProductState` と `evolve()` に依存し、書き込みモデルを参照している | projection 独自の読み取り状態を持ち、`DomainEvent` のみで更新する |
| 3 | MERGE-NEW-src-command-handler-L1 | maintainability-readiness | 保守困難化 | `src/command-handler.ts:1` | `DomainError` と `ProductState` が未使用 import として残存 | 未使用 import を削除する |

## 検証証跡
- ビルド: `npm run typecheck` 成功
- テスト: `npm test` で 4 files / 51 tests passed
- 追加確認: `npx tsc --noEmit --noUnusedLocals` で `src/command-handler.ts:1` の未使用 import を検出

## REJECT判定条件
- `new` のブロッカーが3件あるため REJECT。