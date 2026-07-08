# テスト作成レポート

## 要件-テスト対応表
| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| REQ-REP-01 | `save` は upsert、`findById` は missing で `undefined`、`delete` は boolean、`all` は保存順 | `InMemoryTaskRepository` 直接呼び出し | `tests/repository.test.ts` | 既存 | |
| REQ-REP-02 | repository は保存時・返却時に `tags` / `Date` / 配列の参照を共有しない | `save` → `findById` / `all` | `tests/repository.test.ts`, `tests/contract-regression.test.ts` | 作成 | |
| REQ-SVC-01 | `createTask` は ID、時刻、初期 status、既定値、正規化済み入力を保存して返す | `TaskService.createTask` → repository | `tests/create-task.test.ts` | 既存 | |
| REQ-SVC-02 | `getTask` は存在しない id に `NotFoundError` を投げる | `TaskService.getTask` | `tests/contract-regression.test.ts` | 作成 | |
| REQ-SVC-03 | `updateTask` は active 状態のみ更新し、`id` / `status` / `createdAt` を保持し、`updatedAt` を進める | `createTask` → `changeStatus` → `updateTask` | `tests/update-transitions.test.ts`, `tests/contract-regression.test.ts` | 作成 | |
| REQ-SVC-04 | `updateTask` は title / description / priority / tags / dueDate の正規化と境界値を守る | `TaskService.updateTask` | `tests/update-transitions.test.ts`, `tests/contract-regression.test.ts` | 作成 | |
| REQ-SVC-05 | `changeStatus` は許可遷移のみ保存し、不許可遷移・同一状態・terminal 状態からの遷移を拒否する | `TaskService.changeStatus` | `tests/update-transitions.test.ts`, `tests/contract-regression.test.ts` | 作成 | |
| REQ-SVC-06 | `assign` / `unassign` は active 状態のみ許可し、担当者正規化・解除・`updatedAt` 更新を行う | `TaskService.assign` / `unassign` | `tests/query.test.ts`, `tests/contract-regression.test.ts` | 作成 | |
| REQ-SVC-07 | 存在しない id への変更操作は `NotFoundError` | `updateTask` / `changeStatus` / `assign` / `unassign` | `tests/update-transitions.test.ts`, `tests/query.test.ts`, `tests/contract-regression.test.ts` | 作成 | |
| REQ-LIST-01 | `listTasks` は status / assignee / tag / overdueAsOf を AND 条件で絞り込む | `TaskService.listTasks` | `tests/query.test.ts`, `tests/contract-regression.test.ts` | 作成 | |
| REQ-LIST-02 | `listTasks` は priority → dueDate → createdAt → id 昇順で並べる | `TaskService.listTasks` | `tests/query.test.ts`, `tests/contract-regression.test.ts` | 作成 | |
| REQ-PUB-01 | 利用者は `src/index.ts` から公開 API を import できる | `../src/index.js` import | 既存テスト全体、`tests/contract-regression.test.ts` | 作成 | |
| REQ-ARCH-01 | `src/types.ts` の公開契約を変更しない | 差分確認 | 未作成 | 未作成 | 実行時契約ではなく変更禁止ルールのため、後続の差分確認で検証する |
| REQ-ARCH-02 | service/repository 内で `Date.now()` / `new Date()` / `Math.random()` を直接使わない | ソース検索 | 未作成 | 未作成 | 実行時に安定検出しにくい静的制約のため、実装後の `rg` とレビューで確認する |
| REQ-ARCH-03 | 検証ロジックを create/update で重複実装しない | ソースレビュー | 未作成 | 未作成 | 構造品質の制約であり、単体テストでは重複実装を直接観測できない |
| REQ-ARCH-04 | `TaskService` は repository 具象実装に依存しない | 型・ソースレビュー | 未作成 | 未作成 | 依存方向の静的制約のため、実装後レビューで確認する |

## 危険分岐テスト
| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| Date の浅いコピー | `structuredClone` 等を使わず Date だけ参照共有する実装 | `tests/contract-regression.test.ts` | |
| `all()` 配列自体の共有 | 返却配列への `push` が repository 内部状態に影響する実装 | `tests/contract-regression.test.ts` | |
| `createTask` / `getTask` / `updateTask` / `changeStatus` / `assign` の返却値共有 | 呼び出し側が返却値を mutate すると保存済みタスクが壊れる実装 | `tests/contract-regression.test.ts` | |
| `getTask` missing id | 汎用 `Error` や `undefined` 返却で済ませる実装 | `tests/contract-regression.test.ts` | |
| `in_progress` 更新 | `updateTask` を `todo` のみに誤制限する実装 | `tests/contract-regression.test.ts` | |
| update の共通バリデーション漏れ | create だけ trim・境界値対応し、update で漏れる実装 | `tests/contract-regression.test.ts` | |
| 不許可状態遷移の部分失敗 | 例外を投げても status や `updatedAt` を変更してしまう実装 | `tests/contract-regression.test.ts` | |
| `in_progress` 同一遷移 | `todo` の同一遷移だけ拒否し、他状態の同一遷移を許す実装 | `tests/contract-regression.test.ts` | |
| terminal 状態への assign/unassign | `done` だけ拒否し `cancelled` を許す、または unassign 側だけ漏れる実装 | `tests/contract-regression.test.ts` | |
| overdue 境界 | `dueDate <= overdueAsOf` として同時刻を期限切れ扱いする実装 | `tests/contract-regression.test.ts` | |
| sort 最終 tie-break | repository 挿入順に依存し、id 昇順を実装しない実装 | `tests/contract-regression.test.ts` | |
| assignee フィルタ | assignee フィルタを勝手に trim して完全一致契約を壊す実装 | `tests/contract-regression.test.ts` | |
| cancelled overdue | active 判定から `cancelled` を除外し忘れる実装 | `tests/contract-regression.test.ts` | |

## 横断経路テスト
| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| `src/index.ts` → `TaskService` → `InMemoryTaskRepository` | `createTask` | `getTask` / `listTasks` | 公開入口から生成したタスクが保存・取得・検索できる | `tests/create-task.test.ts`, `tests/query.test.ts`, `tests/contract-regression.test.ts` | |
| `clock.now()` → 作成・更新操作 → returned record | `FixedClock` | `createdAt` / `updatedAt` | 注入 clock の時刻が保存・返却に反映される | `tests/create-task.test.ts`, `tests/update-transitions.test.ts`, `tests/query.test.ts`, `tests/contract-regression.test.ts` | |
| `idGenerator.next()` → repository 保存 → list sort | `FixedIds` / `SeqIds` | `TaskRecord.id`, `listTasks` | 注入 ID が保存され、id 昇順ソートに使われる | `tests/create-task.test.ts`, `tests/contract-regression.test.ts` | |
| status 遷移 → update/assign/list | `changeStatus` | `updateTask` / `assign` / `unassign` / `listTasks` | 状態変更後の active/terminal 判定が後続操作に反映される | `tests/update-transitions.test.ts`, `tests/query.test.ts`, `tests/contract-regression.test.ts` | |
| dueDate 保存 → overdue filter | `createTask` / `updateTask` | `listTasks({ overdueAsOf })` | dueDate の保存値が期限切れ判定に使われる | `tests/query.test.ts`, `tests/contract-regression.test.ts` | |

## 否定契約
| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| repository 内部状態と呼び出し側オブジェクトの参照共有 | 保存後・取得後に `Date` / `tags` / 配列を mutate して再取得する | `tests/repository.test.ts`, `tests/contract-regression.test.ts` | |
| service 返却値と保存済み状態の参照共有 | 返却値を mutate して `getTask` で再取得する | `tests/query.test.ts`, `tests/contract-regression.test.ts` | |
| missing id を汎用 Error や undefined で扱う | `toThrow(NotFoundError)` でエラー分類を確認する | `tests/update-transitions.test.ts`, `tests/query.test.ts`, `tests/contract-regression.test.ts` | |
| terminal 状態のタスクを更新・担当変更する | `done` / `cancelled` 後に操作して `InvalidTransitionError` を確認する | `tests/update-transitions.test.ts`, `tests/query.test.ts`, `tests/contract-regression.test.ts` | |
| 不許可遷移で状態が部分更新される | 例外後に `getTask` で status と `updatedAt` を確認する | `tests/contract-regression.test.ts` | |
| `overdueAsOf` 同時刻を期限切れ扱いする | dueDate と overdueAsOf が同一時刻のタスクを検索結果から除外する | `tests/contract-regression.test.ts` | |
| assignee フィルタを暗黙 trim する | `alice` は一致、` alice ` は不一致として確認する | `tests/contract-regression.test.ts` | |
| 空 tag フィルタで全件返却する | 空白 tag フィルタが空配列になることを確認する | `tests/contract-regression.test.ts` | |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `tests/contract-regression.test.ts` | 単体 / 統合 | 26 | repository の Date 防御的コピー、service 返却値の参照分離、update 境界、状態遷移の副作用なし、assign/unassign の terminal 状態、listTasks の境界・id tie-break・完全一致条件を追加 |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| `src/types.ts` の変更禁止 | 実行時の振る舞いではなく差分ルールのため | 実装後に `src/types.ts` 差分なしを確認する |
| `Date.now()` / `new Date()` / `Math.random()` の未使用 | ランタイムテストでは直接 API 使用箇所を安定検出できないため | 実装後に `rg -n "Date\\.now|new Date|Math\\.random" src` を実行する |
| 検証ロジックの一箇所集約 | 挙動テストでは重複実装そのものを検出できないため | 実装レビューで helper 集約を確認する |
| service が永続状態を持たない | 外部から直接観測できる契約ではなく構造制約のため | 実装レビューで service の private state が注入依存のみであることを確認する |
| `TaskService` が `InMemoryTaskRepository` 具象に依存しない | 型・import の静的制約のため | 実装レビューで service が `TaskRepository` のみに依存することを確認する |

## 実行結果（参考）
実装前のためテスト失敗・import エラーは想定内。

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 0 | `npm test -- --reporter=dot` 実行結果 |
| Fail / Import Error（想定内） | 86 | `src/index.ts` の `Not implemented` 起因。既存 60 件 + 追加 26 件 |
| Error（要対応） | 0 | 追加テストの import パスミスや型エラーは確認されていない |

`npm run typecheck` は成功した。

## 備考（判断がある場合のみ）
- 追加テストはすべて公開入口 `../src/index.js` から `TaskService` / `InMemoryTaskRepository` を利用する形にした。
- 別途インテグレーション専用ファイルは作成していない。既存テストと追加テストが、公開入口から service、repository、clock、idGenerator を横断する主要経路を通しているため。