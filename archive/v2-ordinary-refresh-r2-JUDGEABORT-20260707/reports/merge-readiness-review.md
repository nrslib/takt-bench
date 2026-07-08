# Merge Readiness Review

## 結果: REJECT

## サマリー
`InMemoryTaskRepository` が README の明示要件に反して `src/index.ts` から import できない状態になっています。F-0001 の解消として行われた隠蔽変更が、元要件の公開 API 契約を壊しているため、このままマージできません。

## 保守前提のマージ品質チェック
| # | 観点 | 状態 | 根拠（ファイル:行 / テスト / 実行証跡） | コメント |
|---|------|------|---------------------------------------|----------|
| 1 | 要求充足 | 未充足 | `README.md:7-13`, `src/index.ts:22`, `src/index.ts:304` | README は `InMemoryTaskRepository` と `TaskService` を `src/index.ts` から re-export すると明記しているが、現状 export は `TaskService` のみ。 |
| 2 | 既存契約・既存フローへの影響 | 問題あり | `src/internal/index.ts:1`, `tests/helpers.ts:3`, `tests/repository.test.ts:3` | 利用者入口ではなく内部入口から repository を使う形にテストが差し替わっており、公開 API 回帰を検出できない。 |
| 3 | テスト・検証 | 不足 | `npm test`: 78 passed, `tests/contract-regressions.test.ts:35-43` | テストは通っているが、公開 API テストが `InMemoryTaskRepository` を `src/index.ts` から import していない。 |
| 4 | 要求外変更・スコープクリープ | 問題あり | `src/internal/index.ts:1` | README にない内部 export 入口が追加され、利用者入口欠落の回避に使われている。 |
| 5 | 保守可能性・将来変更容易性 | 問題あり | `src/index.ts:25`, `src/index.ts:52` | 未使用 import と未使用 helper が残っている。 |
| 6 | 明白なセキュリティ・データ保護・運用リスク | 問題なし | `src/infrastructure/InMemoryTaskRepository.ts:7-22` | インメモリ保存と防御的コピー自体に追加の明白な運用リスクは確認していない。 |

## 横断監査証跡
| # | 変更カテゴリ | 抽出した項目 | 確認した検索語・ファイル | 判定 | コメント |
|---|--------------|--------------|--------------------------|------|----------|
| 1 | entrypoint | `InMemoryTaskRepository` | `InMemoryTaskRepository` / `README.md:12`, `src/index.ts:25`, `src/index.ts:304`, `src/internal/index.ts:1`, `tests/*.ts` | 問題あり | 実装は存在するが利用者向け入口から export されていない。 |
| 2 | helper | `normalizeOptionalAssignee` | `normalizeOptionalAssignee` / `src/index.ts:52` | 問題あり | 定義のみで使用箇所がない。 |
| 3 | import | `InMemoryTaskRepository` import in `src/index.ts` | `InMemoryTaskRepository` / `src/index.ts:25`, `src/index.ts:304` | 問題あり | import されているが export や実装内利用に使われていない。 |

## 要求照合
| # | 要求（タスクから抽出） | 状態 | 根拠（ファイル:行） | コメント |
|---|-------------------|------|-------------------|----------|
| 1 | `InMemoryTaskRepository` と `TaskService` を `src/index.ts` から import できる | 未充足 | `README.md:7-13`, `src/index.ts:304` | `TaskService` のみ export。 |
| 2 | 利用者は `src/index.ts` と `src/types.ts` だけを import して使う | 未充足 | `README.md:8`, `src/internal/index.ts:1` | repository 利用に内部入口が必要になっている。 |
| 3 | インメモリ repository と service の振る舞い | 充足 | `src/infrastructure/InMemoryTaskRepository.ts:4-35`, `src/index.ts:97-304`, `npm test`: 78 passed | 公開入口以外の主要挙動はテスト上通過。 |

## 要求外変更・既存影響
| # | 変更 | ファイル | 判定 | コメント |
|---|------|---------|------|----------|
| 1 | repository 用の内部 export 入口追加 | `src/internal/index.ts` | 問題あり | 元要件の公開入口を満たさず、テストが内部入口へ迂回している。 |
| 2 | テスト import を `src/index.ts` から `src/internal/index.ts` に変更 | `tests/helpers.ts`, `tests/repository.test.ts`, `tests/create-task.test.ts`, `tests/contract-regressions.test.ts` | 問題あり | 公開 API 契約の検証を弱めている。 |

## 観測した指摘
| # | family_tag | カテゴリ | 重大度 | 場所 | 問題 | 修正案 |
|---|------------|---------|--------|------|------|--------|
| 1 | public-api-contract | 要求未充足 / 契約破壊 | high | `src/index.ts:304` | README が求める `InMemoryTaskRepository` の `src/index.ts` re-export がない。F-0001 の resolved 判定は元要件に戻すと受け入れ不可。 | `src/index.ts` から `InMemoryTaskRepository` を export し、テストも `../src/index.js` から import して公開入口を固定する。 |
| 2 | maintainability-readiness | 保守困難化 | low | `src/index.ts:25`, `src/index.ts:52` | `InMemoryTaskRepository` import と `normalizeOptionalAssignee()` が未使用。変更起因の未使用コードであり、保守上のノイズになる。 | export に使う、実装で使う、または削除する。 |

## 検証証跡
- ビルド: `npm run typecheck` を実行し成功。
- テスト: `npm test` を実行し 6 files / 78 tests passed。
- 動作確認: `rg` で `InMemoryTaskRepository`, `export { TaskService`, `from '../src/internal/index.js'`, `normalizeOptionalAssignee` を検索し、公開入口欠落と内部入口利用を確認。

## REJECT判定条件
- マージを止めるべき観測指摘が1件以上あるため REJECT。