# テスト作成レポート

## 要件-テスト対応表
| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| PLAN-01〜04 | `src/index.ts` から公開 API と型を import できる | 公開入口 | 既存 `tests/helpers.ts`、各 `tests/*.test.ts` の import | 既存 | |
| PLAN-05〜11 | `InMemoryTaskRepository` の upsert、missing、delete、保存順、防御的コピー | Repository 永続化境界 | `tests/repository.test.ts` | 既存 + 作成 | |
| PLAN-12〜21 | `createTask` の入力正規化、デフォルト、ID、時刻、dueDate 検証 | Service → Repository | `tests/create-task.test.ts` | 既存 | |
| PLAN-22 | 存在しない `getTask` は `NotFoundError` | Service 参照入口 | `存在しない id の getTask は NotFoundError` | 作成 | |
| PLAN-23〜30 | `updateTask` の missing、状態制約、更新対象、時刻更新、不変フィールド | Service 更新入口 | `tests/update-transitions.test.ts` | 既存 + 作成 | |
| PLAN-31〜34 | `changeStatus` の許可遷移、禁止遷移、時刻更新 | Service 状態遷移入口 | `tests/update-transitions.test.ts` | 既存 | |
| PLAN-35〜42 | `assign` / `unassign` の missing、状態制約、正規化、時刻更新 | Service 担当者入口 | `tests/query.test.ts` | 既存 + 作成 | |
| PLAN-43〜51 | `listTasks` の filter、AND、overdue、sort 全条件 | Service 検索入口 | `tests/query.test.ts` | 既存 + 作成 | |
| PLAN-52〜58 | サービスが永続状態を持たず、repo と参照共有しない。時刻/ID は注入経由 | Service → Repository → Clock/IdGenerator | `tests/create-task.test.ts`, `tests/query.test.ts`, `tests/repository.test.ts` | 既存 + 作成 | |
| PLAN-56〜57 | `Date.now()` / 引数なし `new Date()` / `Math.random()` 不使用、検証ロジック集約 | ソース構造 | なし | 未作成 | 実装前テストでは直接観測しにくい構造契約。実装レビュー・静的確認で検証する |
| PLAN-59〜60 | フレームワーク非依存・インメモリ完結 | ソース構造 / Repository 経路 | `tests/repository.test.ts`、各 Service テスト | 一部既存 | 外部依存なしの構造確認は実装レビューで検証する |

## 危険分岐テスト
| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| missing id | `getTask` / `unassign` が汎用 Error や `undefined` を返す | `存在しない id の getTask は NotFoundError`, `存在しない id への unassign は NotFoundError` | |
| 終了状態 | `done` / `cancelled` のタスクから担当者解除できてしまう | `%s のタスクへの unassign は InvalidTransitionError` | |
| 更新対象漏れ | `description` / `priority` / `dueDate: Date` を無視する | `description を trim して更新できる`, `priority を更新できる`, `dueDate: Date で期限を更新できる` | |
| sort tie-breaker | priority/dueDate/createdAt 同値時に保存順のまま返す | `createdAt も同じなら id 昇順` | |
| Date 参照共有 | `Date` オブジェクトを浅いコピーで返し、呼び出し側 mutation が内部状態を壊す | Repository と Service の Date 防御的コピーテスト | |

## 横断経路テスト
| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| `createTask` → `repo.save` → `getTask` | Service | Repository / Service | 作成結果の Date mutation が保存済み状態に影響しない | `返り値の Date を変更しても保存済みタスクは変わらない` | |
| `repo.save` → `findById` | Repository | Repository 利用者 | 保存引数と返却値の Date が内部状態と共有されない | `save 後に引数の Date を変更しても内部状態は変わらない`, `findById の返り値の Date を変更しても内部状態は変わらない` | |
| `TaskService` + `InMemoryTaskRepository` + custom `IdGenerator` | ID 生成 | `listTasks` sort | createdAt 同値時に id 昇順が最終 tie-breaker になる | `createdAt も同じなら id 昇順` | |
| `unassign` → `clock.now()` → `repo.save` | Clock | Service / Repository | 担当者解除でも `updatedAt` が更新される | `unassign は updatedAt を進める` | |

## 否定契約
| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| 存在しない id を正常扱いする | 具体例外型を検証 | `存在しない id の getTask は NotFoundError`, `存在しない id への unassign は NotFoundError` | |
| 終了状態のタスクを変更する | `InvalidTransitionError` を検証 | `%s のタスクへの unassign は InvalidTransitionError` | |
| list の同値ソートで id 昇順を省略する | 生成順と id 昇順をずらして結果順を検証 | `createdAt も同じなら id 昇順` | |
| 返却 Date の mutation が内部状態へ伝播する | 返却値の Date を破壊後に再取得して検証 | Date 防御的コピーテスト | |
| 実装内で禁止 API を使う | なし | 未作成 | `Date.now()` / `Math.random()` 等はソース構造契約のため、後続実装レビューで確認する |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `tests/create-task.test.ts` | 単体 / 公開 API 経路 | 2 | `getTask` missing と Service 返却 Date 防御的コピー |
| `tests/update-transitions.test.ts` | 単体 / 公開 API 経路 | 3 | `description`、`priority`、`dueDate: Date` 更新 |
| `tests/query.test.ts` | 単体 / 横断経路 | 5 | `unassign` の missing・終了状態・updatedAt、`listTasks` id 昇順 |
| `tests/repository.test.ts` | 単体 | 2 | Repository 保存時・返却時の Date 防御的コピー |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| `Date.now()` / 引数なし `new Date()` / `Math.random()` 不使用 | 実装前テストでは直接の振る舞いとして安定検出しにくい | implement / review ステップで `rg` 等による静的確認 |
| 検証ロジックの一箇所集約 | 外部 API の観測結果では重複実装を判定できない | review ステップで構造確認 |
| サービスが状態を持たない | 振る舞いテストでは一部しか検出できない | 実装レビューでフィールド・キャッシュ有無を確認 |
| フレームワーク非依存 | 実装前に依存導入有無をテストで固定しない | review ステップで import と package 差分を確認 |

## 実行結果（参考）
実装前のためテスト失敗・import エラーは想定内。ただし今回は依存未インストールにより runner が起動しなかった。

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 0 | `vitest` が起動できず未確認 |
| Fail / Import Error（想定内） | 0 | runner 起動前に終了 |
| Error（要対応） | 2 | `npm test`: `vitest: command not found`、`npm run typecheck`: `tsc: command not found` |

## 備考（判断がある場合のみ）
- プロダクションコードは変更していない。
- テストは既存の `tests/**/*.test.ts` 構成と `makeService` ヘルパー利用に合わせた。
- `listTasks` の id 昇順テストだけは、id 生成順を制御するためテスト内の `PresetIds` を使って `TaskService` と `InMemoryTaskRepository` を直接構成した。