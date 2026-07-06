# Merge Readiness Review

## 結果: REJECT

## サマリー
`src/index.ts` からの `src/types.ts` re-export が削除されており、README と元の公開 API シグネチャ変更禁止に反する公開契約破壊があります。加えて `createTask` の作成時刻取得が `createdAt = updatedAt = clock.now()` 契約を厳密に満たしていません。

## 保守前提のマージ品質チェック
| # | 観点 | 状態 | 根拠（ファイル:行 / テスト / 実行証跡） | コメント |
|---|------|------|---------------------------------------|----------|
| 1 | 要求充足 | 未充足 | `README.md:7-8`, `src/index.ts:17`, `git show HEAD:src/index.ts:17` | 元は `export * from './types.js'` があり、現差分で削除されている |
| 2 | 既存契約・既存フローへの影響 | 問題あり | `/tmp/task-svc-decl-final-gate-20260706/src/index.d.ts:6-26` | 生成宣言に `ValidationError` / `TaskRecord` などの re-export が存在しない |
| 3 | テスト・検証 | 不足 | `npm test`: 60 passed | テストは成功したが、公開 re-export と進行する Clock での同時刻契約を検出していない |
| 4 | 要求外変更・スコープクリープ | 問題あり | `src/index.ts:17` | 公開 API 面の削除は実装要求を超えた契約変更 |
| 5 | 保守可能性・将来変更容易性 | 問題あり | `src/index.ts:17`, `src/index.ts:101-102` | 未使用 import と時刻契約の曖昧化が残る |
| 6 | 明白なセキュリティ・データ保護・運用リスク | 問題なし | `src/index.ts:46-65`, `src/index.ts:105-106` | 防御的コピー経路は確認済み |

## 横断監査証跡
| # | 変更カテゴリ | 抽出した項目 | 確認した検索語・ファイル | 判定 | コメント |
|---|--------------|--------------|--------------------------|------|----------|
| 1 | entrypoint / 公開契約 | `src/index.ts` re-export | `export *`, `ValidationError`, `TaskRecord` / `src/index.ts`, generated `index.d.ts` | 問題あり | 型・エラーが index から公開されない |
| 2 | helper / validation | `validateCreateTask`, `validateUpdateTask`, `normalizeTags`, `trimAssignee` | `input.xxx =`, `validateCreateTask`, `validateUpdateTask` / `src/validation.ts`, `src/index.ts` | 問題なし | F-0001〜F-0005 の入力ミューテーションと重複は再発なし |
| 3 | clock/idGenerator | `clock.now`, `idGenerator.next` | `Date.now`, `new Date(`, `Math.random`, `clock.now` / `src/index.ts`, `src/validation.ts` | 問題あり | `createTask` で `clock.now()` を2回呼び、同一作成時刻契約が崩れる可能性あり |

## 要求照合
| # | 要求（タスクから抽出） | 状態 | 根拠（ファイル:行） | コメント |
|---|-------------------|------|-------------------|----------|
| 1 | `src/index.ts` の公開 API シグネチャ変更禁止 | 未充足 | `src/index.ts:17`, `git show HEAD:src/index.ts:17` | `export * from './types.js'` が削除された |
| 2 | `createTask` は `createdAt = updatedAt = clock.now()` | 未充足 | `README.md:26-27`, `src/index.ts:101-102` | `clock.now()` を別々に呼ぶため進行 clock で値がずれる |
| 3 | tests/ 全60件成功 | 充足 | `npm test`: 4 files, 60 passed | 実行済み |
| 4 | `src/types.ts` と `tests/` 変更禁止 | 充足 | `git diff -- src/types.ts tests/...` 出力なし | 差分なし |

## 要求外変更・既存影響
| # | 変更 | ファイル | 判定 | コメント |
|---|------|---------|------|----------|
| 1 | `src/types.ts` の index re-export 削除 | `src/index.ts` | 問題あり | 公開 API シグネチャ変更禁止に反する |
| 2 | `ValidationError` の未使用 import 追加 | `src/index.ts` | 問題あり | `NotFoundError` / `InvalidTransitionError` は使用されるが `ValidationError` は未使用 |

## 観測した指摘
| # | family_tag | カテゴリ | 重大度 | 場所 | 問題 | 修正案 |
|---|------------|---------|--------|------|------|--------|
| 1 | maintainability-readiness | 契約破壊 | high | `src/index.ts:17` | 元の `export * from './types.js'` が削除され、README の re-export 要求と公開 API シグネチャ変更禁止に違反している | `export * from './types.js';` を復元する |
| 2 | maintainability-readiness | 要求未充足 | medium | `src/index.ts:101-102` | `createTask` が `clock.now()` を2回呼び、進行する Clock 実装で `createdAt` と `updatedAt` が一致しない | `const now = this.clock.now();` を一度取得して両方に使う |
| 3 | maintainability-readiness | 保守困難化 | low | `src/index.ts:17` | `ValidationError` が未使用 import として残っている | 使用しない import を削除する |

## 検証証跡
- ビルド: `npm run typecheck` 実行、成功
- テスト: `npm test` 実行、4ファイル60件成功
- 動作確認: 宣言生成 `npx tsc --declaration --emitDeclarationOnly --outDir /tmp/task-svc-decl-final-gate-20260706` 実行、生成 `src/index.d.ts` に `src/types.ts` の re-export がないことを確認

## REJECT判定条件
- マージを止めるべき観測指摘が1件以上あるため REJECT。