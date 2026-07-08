# テスト作成レポート

## 要件-テスト対応表
| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| P01-P08, P48 | `InMemoryTaskRepository` が upsert、未存在 `undefined`、削除 boolean、保存順、防御的コピーを満たす。`Date` も内部状態と共有しない | `src/index.ts` → `InMemoryTaskRepository` → 永続化境界 | `tests/repository.test.ts` | 既存 + 作成 | |
| P09-P14 | `TaskService` が注入された repo/clock/idGenerator を使い、create/get の戻り値・初期値・NotFound を満たす | `src/index.ts` → `TaskService.createTask/getTask` → Repository | `tests/create-task.test.ts` | 既存 + 作成 | |
| P15-P20 | `updateTask` が更新可能フィールドだけを更新し、`id/status/createdAt` を保持し、`dueDate` の `Date/null/undefined` 契約を満たす | `src/index.ts` → `TaskService.updateTask` → Repository | `tests/update-transitions.test.ts` | 既存 + 作成 | |
| P21-P23 | `changeStatus` が許可5遷移だけを成功させ、同一状態・終端状態からの遷移を拒否する | `src/index.ts` → `TaskService.changeStatus` → Repository | `tests/update-transitions.test.ts` | 既存 | |
| P24-P28 | `assign/unassign` が active 状態だけで動作し、NotFound/Validation/InvalidTransition を分類する | `src/index.ts` → `TaskService.assign/unassign` → Repository | `tests/query.test.ts` | 既存 + 作成 | |
| P29-P33 | `listTasks` が `status/assignee/tag/overdueAsOf` を AND 条件で絞り込む | `src/index.ts` → `TaskService.listTasks` → Repository `all` | `tests/query.test.ts` | 既存 + 作成 | |
| P34-P37 | `listTasks` が priority → dueDate → createdAt → id の順で並べる | `src/index.ts` → `TaskService.listTasks` → Repository `all` | `tests/query.test.ts` | 既存 + 作成 | |
| P38-P40 | サービスが永続状態を持たず、時刻と ID を注入依存から取得する | Service public API + テストダブル | `tests/create-task.test.ts`, `tests/update-transitions.test.ts`, `tests/query.test.ts` | 既存 + 作成 | 構造面は実装レビューで確認 |
| P41 | create/update の検証ロジックが一箇所に集約される | create/update の同種入力 | `tests/create-task.test.ts`, `tests/update-transitions.test.ts` | 既存 + 作成 | 振る舞いは検証。重複実装の有無はソース構造レビュー対象 |
| P42-P44 | Service 返却値が Repository 内部状態と参照共有せず、公開入口から import できる | `src/index.ts` → Service → Repository | `tests/create-task.test.ts`, `tests/query.test.ts` | 既存 + 作成 | |
| P45-P46 | フレームワーク非依存・インメモリ完結 | 実装依存関係 | 未作成 | 未作成 | 実行時の値契約ではなく依存構造の制約。実装差分レビューと typecheck で確認 |
| P47 | `UpdateTaskInput` にない `assignee` を `updateTask` で更新しない | `TaskService.updateTask` | `UpdateTaskInput にない assignee は更新しない` | 作成 | |

## 危険分岐テスト
| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| `Date` の防御的コピー | `tags` だけ clone し、mutable な `Date` を共有する | `save 後に引数オブジェクトの Date を変更しても内部状態は変わらない`, `findById の返り値の Date を変更しても内部状態は変わらない` | |
| Service 返却値の参照共有 | `createTask` の返り値を内部保存オブジェクトとして返す | `createTask の返り値を変更しても保存済みタスクは変わらない` | |
| NotFound 分類 | 未存在 `getTask` を `undefined` や汎用 `Error` にする | `存在しない id の getTask は NotFoundError` | |
| 未知フィールド混入 | `updateTask` で input を丸ごと spread して `assignee` を更新する | `UpdateTaskInput にない assignee は更新しない` | |
| `dueDate` 更新 | `null/undefined` だけ扱い、`Date` 更新を落とす | `dueDate は Date で更新できる` | |
| `assignee` filter | `assignee` filter を勝手に trim する | `assignee フィルタは完全一致で比較する` | |
| 期限境界 | `dueDate <= overdueAsOf` を期限切れ扱いにする | `overdueAsOf と dueDate が同時刻なら期限切れではない` | |
| sort tie-break | Repository の挿入順をそのまま返し、id 昇順を実装しない | `createdAt も同じなら id 昇順` | |
| 終端状態への担当者操作 | `cancelled` への assign/unassign を許可する | `cancelled のタスクへの assign は InvalidTransitionError`, `cancelled のタスクへの unassign は InvalidTransitionError` | |
| unassign の未存在 ID | `unassign` の NotFound を漏らす | `存在しない id への unassign は NotFoundError` | |

## 横断経路テスト
| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| `src/index.ts` → `TaskService` → `InMemoryTaskRepository` | `createTask` | `getTask/listTasks/updateTask` | 作成・保存・取得・更新が公開入口から通る | 既存の Service 系テスト全般 | |
| `Repository.save` → `Repository.findById/all` | Repository | Service/listTasks | 保存済み `TaskRecord` が防御的コピーとして返る | `tests/repository.test.ts`, `tests/create-task.test.ts`, `tests/query.test.ts` | |
| `TaskService.updateTask` → Repository 保存 → `getTask` | updateTask | getTask | 更新対象外フィールドが保持される | `UpdateTaskInput にない assignee は更新しない` | |
| `Repository.all` → `TaskService.listTasks` sort/filter | Repository | listTasks | Repository 挿入順に依存せず README の sort 契約を適用する | `createdAt も同じなら id 昇順` | |

## 否定契約
| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| `Date` 参照を内部状態と共有する | 返却値や保存前入力の `Date` を mutate 後、再取得値を確認 | `tests/repository.test.ts`, `tests/create-task.test.ts` | |
| `updateTask` で担当者を更新する | 型外 `assignee` を渡し、既存担当者が保持されることを確認 | `UpdateTaskInput にない assignee は更新しない` | |
| `assignee` filter を正規化する | `' alice '` で検索し空配列になることを確認 | `assignee フィルタは完全一致で比較する` | |
| 同時刻の期限を overdue 扱いする | `dueDate === overdueAsOf` の結果が空であることを確認 | `overdueAsOf と dueDate が同時刻なら期限切れではない` | |
| 終端状態への担当者変更を許可する | `cancelled` で assign/unassign し `InvalidTransitionError` を確認 | `tests/query.test.ts` | |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `tests/repository.test.ts` | 単体 | 2 | Repository 境界で `Date` を防御的コピーする契約 |
| `tests/create-task.test.ts` | 統合 | 2 | `getTask` NotFound と create 返却値の非共有 |
| `tests/update-transitions.test.ts` | 統合 | 4 | `description/priority/dueDate` 更新、`assignee` 非更新 |
| `tests/query.test.ts` | 統合 | 7 | assign/unassign 異常系、filter/sort/overdue 境界 |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| P41 検証ロジック集約 | 振る舞いテストで重複実装の有無は直接観測できない。内部 helper 名や構造を固定するテストは過剰に実装詳細へ依存するため未作成 | implement/reviewers で create/update の検証ロジックが一箇所に集約されていることをソースレビュー |
| P45 フレームワーク非依存 | 実装前で依存追加が存在せず、README 文言やファイル構造を固定するテストは非実行資産テストになるため未作成 | 実装差分で Express/Spring 等の依存や import がないことを確認 |
| P46 インメモリ完結 | DB/ファイル/外部 API 呼び出しの不在は実装構造の制約であり、現段階で実行契約として観測できないため未作成 | 実装差分で fs/DB/HTTP クライアント等の依存がないことを確認 |

## 実行結果（参考）
実装前のためテスト失敗・import エラーは想定内。

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 0 | 依存ツール未インストールのため未到達 |
| Fail / Import Error（想定内） | 0 | 未実装起因の失敗までは到達せず |
| Error（要対応） | 2 | `npm test`: `vitest: command not found`、`npm run typecheck`: `tsc: command not found` |

## 備考（判断がある場合のみ）
- 追加・変更はテストファイルのみ。
- 既存テストパターンに合わせ、すべて `src/index.ts` の公開入口から import する形にした。
- `tests/query.test.ts` の id 昇順テストは、Repository に同一 priority/dueDate/createdAt のデータを逆順保存し、`listTasks` が挿入順に依存しないことを検証する。