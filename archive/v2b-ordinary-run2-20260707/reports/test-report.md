# テスト作成レポート

## 要件-テスト対応表
| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| R01-R04 | `src/index.ts` から `InMemoryTaskRepository` / `TaskService` を import して使える | 公開 API | 既存 `tests/helpers.ts`、追加 `tests/contract-regressions.test.ts` | 既存/作成 | |
| R07-R11 | repository の upsert、削除、保存順、防御的コピー | 永続化境界 | 既存 `tests/repository.test.ts`、追加 `InMemoryTaskRepository の防御的コピー契約` | 既存/作成 | |
| R12,R14,R15 | `clock` / `idGenerator` 注入値を使う | 実行時依存注入 | 追加 `TaskService.createTask の注入依存契約` | 作成 | |
| R17-R23 | create/update 共通の入力正規化・検証 | service 入力 | 既存 create/update テスト、追加 `現在時刻ちょうどの dueDate へ更新できる` | 既存/作成 | |
| R24-R28 | create/update の保存値、状態維持、`updatedAt` 更新 | service → repository | 既存 create/update テスト、追加 `in_progress のタスクは更新できる` | 既存/作成 | |
| R29-R31 | `dueDate` 更新・解除・未変更 | service 入力 | 既存 update テスト、追加 dueDate 境界テスト | 既存/作成 | |
| R32-R37 | 状態遷移、担当者操作、不存在 ID のエラー分類 | service 操作 | 既存 transition/query テスト、追加 assign/unassign/getTask 補強 | 既存/作成 | |
| R38-R43 | filter と sort の契約 | service query | 既存 query テスト、追加 AND 条件、overdue 境界、id 昇順 | 既存/作成 | |
| R44 | service 返却値が内部状態と参照共有しない | service → repository | 追加 `TaskService の参照分離契約` | 作成 | |
| R05,R06,R13,R16 | フレームワーク非依存、インメモリ完結、service は永続状態を持たない、検証集約 | 実装構造 | テスト未作成 | 未作成 | 実装構造の制約であり、レビューで `src/index.ts` の依存・状態保持・重複を確認する方が適切 |

## 危険分岐テスト
| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| Date の参照共有 | `Date` を shallow copy して内部状態が変更される | `InMemoryTaskRepository の防御的コピー契約` | |
| service 返却値の参照共有 | `createTask` / `getTask` の返り値変更が保存済み task を壊す | `TaskService の参照分離契約` | |
| 不存在 ID と不正入力の競合 | 入力検証を先に実行して `NotFoundError` ではなく `ValidationError` になる | `存在しない id は入力検証より先に NotFoundError を返す`、`assign は存在しない id なら assignee 検証より先に NotFoundError を返す` | |
| `overdueAsOf` 境界 | `dueDate <= overdueAsOf` と誤実装する | `dueDate が overdueAsOf と同時刻のタスクは期限切れに含めない` | |
| sort 最終キー | 挿入順のまま返し、id 昇順タイブレークを実装しない | `priority、dueDate、createdAt が同じ場合は id 昇順で並ぶ` | |
| invalid terminal operation | `cancelled` の task を unassign できてしまう | `cancelled のタスクへの unassign は InvalidTransitionError` | |

## 横断経路テスト
| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| `createTask` → repository → `getTask` | `TaskService.createTask` | `TaskService.getTask` | 保存値と返却値が参照共有しない | `createTask の返り値を変更しても保存済みタスクは変わらない` | |
| `idGenerator.next()` → task id → repository key | `IdGenerator` | `InMemoryTaskRepository.findById` | 生成 ID をそのまま保存に使う | `idGenerator が返した id をそのまま使う` | |
| `clock.now()` → createdAt/updatedAt | `Clock` | `TaskRecord` | 注入 clock の時刻を使う | `clock.now が返した時刻を createdAt と updatedAt に使う` | |
| `listTasks(filter)` → normalized filter → sort | `TaskFilter` | `TaskService.listTasks` | AND 条件と sort 契約を同時に保証 | `status、assignee、tag、overdueAsOf は AND 条件で適用される` | |

## 否定契約
| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| repository 内部状態と `Date` を共有する | 返却値・入力値の `Date#setTime` 後に再取得する | `InMemoryTaskRepository の防御的コピー契約` | |
| service 内部状態と task object を共有する | 返却 task を mutate 後に `getTask` で再取得する | `TaskService の参照分離契約` | |
| 存在しない ID に対して validation error を返す | 不正入力付き missing id 操作で例外型を見る | update/assign の NotFound 優先テスト | |
| `dueDate === overdueAsOf` を overdue 扱いする | 同時刻 task と 1ms 過去 task の返却差を見る | overdue 境界テスト | |
| 過去 dueDate で ID を消費・保存する | `idGenerator` 呼び出し回数と repository 空配列を見る | `過去の dueDate では idGenerator を呼ばず ValidationError を返す` | |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `tests/contract-regressions.test.ts` | 単体/軽量統合 | 20 | repository 防御的コピー、service 参照分離、update/assign/unassign/list/getTask/create の契約補強 |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| フレームワーク非依存 | import や依存関係の構造制約であり、挙動テストよりレビューが適切 | 実装後に runtime dependency、HTTP/DB/DI framework import がないことを確認 |
| service が永続状態を持たない | private field の実装詳細検査になるためテスト化しない | 実装レビューで `repo` 以外に task collection を保持していないことを確認 |
| validation helper の一箇所集約 | テストで内部 helper 数を固定すると実装詳細テストになる | レビューで create/update の検証重複がないことを確認 |
| `Date.now()` / 時刻取得目的の `new Date()` / `Math.random()` 不使用 | 文字列走査テストは脆く、実装詳細固定になる | 実装レビューで注入依存のみを使っていることを確認 |

## 実行結果（参考）
実装前のためテスト失敗・import エラーは想定内。

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 0 | 実行環境で test runner が起動できなかった |
| Fail / Import Error（想定内） | 0 | 未実装起因の失敗までは到達せず |
| Error（要対応） | 2 | `npm test`: `vitest: command not found`、`npm run typecheck`: `tsc: command not found`。devDependencies 未インストール状態 |

## 備考
- プロダクションコードは変更していません。
- 既存テストと重複しすぎないよう、既存で薄かった `Date` 防御的コピー、エラー優先順位、`unassign`、`listTasks` の境界・タイブレーク、注入依存の観測に絞って追加しました。