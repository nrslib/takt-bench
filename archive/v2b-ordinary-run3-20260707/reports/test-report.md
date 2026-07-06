# テスト作成レポート

## 要件-テスト対応表
| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| T-01 | `InMemoryTaskRepository.save` は保存時に `Date` を含めて防御的コピーする | 永続化境界 | `tests/repository.test.ts` / `save 後に引数の Date を変更しても内部状態は変わらない` | 作成 | |
| T-02 | `findById` は返却時に `Date` を含めて防御的コピーする | 永続化境界 | `tests/repository.test.ts` / `findById の返り値の Date を変更しても内部状態は変わらない` | 作成 | |
| T-03 | `all` は返却時に `Date` を含めて防御的コピーする | 永続化境界 | `tests/repository.test.ts` / `all の返り値の Date を変更しても内部状態は変わらない` | 作成 | |
| T-04 | `getTask` は存在しない ID で `NotFoundError` を投げる | 実行時 | `tests/create-task.test.ts` / `getTask は存在しない id で NotFoundError` | 作成 | |
| T-05 | `createTask` は入力 `dueDate` と保存済みタスクの参照を共有しない | 実行時→永続化 | `tests/create-task.test.ts` / `createTask 後に入力 dueDate を変更しても保存済みタスクは変わらない` | 作成 | |
| T-06 | `updateTask` は `in_progress` のタスク更新を許可する | 実行時 | `tests/update-transitions.test.ts` / `in_progress のタスクは更新できる` | 作成 | |
| T-07 | `updateTask` は `description` 指定時に trim して保存する | 実行時→永続化 | `tests/update-transitions.test.ts` / `description は指定された場合だけ trim して更新される` | 作成 | |
| T-08 | `updateTask` は現在時刻ちょうどの `dueDate` を許可する | 実行時 | `tests/update-transitions.test.ts` / `現在時刻ちょうどの dueDate への更新は許可される` | 作成 | |
| T-09 | `updateTask` は入力 `dueDate` と保存済みタスクの参照を共有しない | 実行時→永続化 | `tests/update-transitions.test.ts` / `updateTask 後に入力 dueDate を変更しても保存済みタスクは変わらない` | 作成 | |
| T-10 | `assign` は `cancelled` のタスクを拒否する | 実行時 | `tests/query.test.ts` / `cancelled のタスクへの assign は InvalidTransitionError` | 作成 | |
| T-11 | `unassign` は `updatedAt` を `clock.now()` に進める | 実行時→永続化 | `tests/query.test.ts` / `unassign は updatedAt を進める` | 作成 | |
| T-12 | `unassign` は `done` / `cancelled` のタスクを拒否する | 実行時 | `tests/query.test.ts` / `done のタスクへの unassign は InvalidTransitionError`, `cancelled のタスクへの unassign は InvalidTransitionError` | 作成 | |
| T-13 | `unassign` は存在しない ID で `NotFoundError` を投げる | 実行時 | `tests/query.test.ts` / `存在しない id への unassign は NotFoundError` | 作成 | |
| T-14 | `overdueAsOf` は `dueDate < overdueAsOf` のみ期限切れ扱いにする | 実行時検索 | `tests/query.test.ts` / `overdueAsOf と同時刻の dueDate は期限切れに含めない` | 作成 | |
| T-15 | `listTasks` は priority / dueDate / createdAt が同じ場合に `id` 昇順で返す | 実行時検索 | `tests/query.test.ts` / `priority・dueDate・createdAt が同じなら id 昇順` | 作成 | |
| T-16 | 利用者入口は `src/index.ts` からの import | 公開 API | 既存の全テストが `../src/index.js` 経由で `InMemoryTaskRepository` / `TaskService` を使用 | 既存 | |

## 危険分岐テスト
| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| `Date` の参照共有 | `tags` だけコピーし、`createdAt` / `updatedAt` / `dueDate` を同一参照で保存・返却する実装 | `tests/repository.test.ts` の Date 防御的コピー 3 件 | |
| 未存在 ID | `getTask` / `unassign` が `undefined` を返す、または汎用 `Error` を投げる実装 | `getTask は存在しない id で NotFoundError`, `存在しない id への unassign は NotFoundError` | |
| 入力 `dueDate` の参照共有 | create/update 後に呼び出し側の `Date` 変更が保存済みタスクへ反映される実装 | `createTask 後に入力 dueDate を変更しても保存済みタスクは変わらない`, `updateTask 後に入力 dueDate を変更しても保存済みタスクは変わらない` | |
| 状態ガード漏れ | `cancelled` への `assign` や終端状態への `unassign` を許可する実装 | `cancelled のタスクへの assign は InvalidTransitionError`, `done/cancelled のタスクへの unassign は InvalidTransitionError` | |
| 境界値 | `dueDate <= now` や `dueDate <= overdueAsOf` と誤判定する実装 | `現在時刻ちょうどの dueDate への更新は許可される`, `overdueAsOf と同時刻の dueDate は期限切れに含めない` | |
| ソートの最終タイブレーク | 保存順のまま返し、`id` 昇順を実装しない検索 | `priority・dueDate・createdAt が同じなら id 昇順` | |

## 横断経路テスト
| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| `createTask` → repository 保存 → `getTask` | `TaskService.createTask` | `TaskService.getTask` | 入力 `dueDate` の参照変更が保存済みタスクに影響しない | `tests/create-task.test.ts` / `createTask 後に入力 dueDate を変更しても保存済みタスクは変わらない` | |
| `updateTask` → repository 保存 → `getTask` | `TaskService.updateTask` | `TaskService.getTask` | 更新入力 `dueDate` の参照変更が保存済みタスクに影響しない | `tests/update-transitions.test.ts` / `updateTask 後に入力 dueDate を変更しても保存済みタスクは変わらない` | |
| repository 保存 → `TaskService.listTasks` | `InMemoryTaskRepository.save` | `TaskService.listTasks` | repository の保存順ではなく、検索仕様の `id` 昇順で返す | `tests/query.test.ts` / `priority・dueDate・createdAt が同じなら id 昇順` | |
| `assign` / `unassign` → 状態チェック → repository 保存 | `TaskService.assign` / `TaskService.unassign` | `TaskService` の状態変更系 | 終端状態では変更せず、許可状態では `updatedAt` を更新する | `tests/query.test.ts` の assign/unassign 追加テスト | |

## 否定契約
| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| repository 内部状態と外部オブジェクトの参照共有 | 保存後または取得後に `Date` を破壊的変更し、再取得値が変わらないことを見る | `tests/repository.test.ts` の Date 防御的コピー 3 件 | |
| 未存在 ID のサイレント成功 | `NotFoundError` が投げられることを見る | `getTask は存在しない id で NotFoundError`, `存在しない id への unassign は NotFoundError` | |
| 終端状態への担当者変更 | `InvalidTransitionError` が投げられることを見る | `cancelled のタスクへの assign は InvalidTransitionError`, `done/cancelled のタスクへの unassign は InvalidTransitionError` | |
| 期限切れ判定で同時刻を含めること | `overdueAsOf` と同時刻の `dueDate` が返らないことを見る | `overdueAsOf と同時刻の dueDate は期限切れに含めない` | |
| ソートで保存順に依存すること | 同一キーのデータを `task-c`, `task-a`, `task-b` の順で保存し、`task-a`, `task-b`, `task-c` で返ることを見る | `priority・dueDate・createdAt が同じなら id 昇順` | |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `tests/repository.test.ts` | 単体 | 3 | repository の `Date` 防御的コピーを保存時・単体取得時・一覧取得時で検証 |
| `tests/create-task.test.ts` | 統合 | 2 | `getTask` の NotFound と create 入力 `dueDate` の参照共有防止を検証 |
| `tests/update-transitions.test.ts` | 統合 | 4 | `in_progress` 更新、`description` trim、`dueDate` 境界、更新入力 `Date` の参照共有防止を検証 |
| `tests/query.test.ts` | 統合 | 7 | assign/unassign の異常系・副作用、overdue 境界、list の `id` 昇順を検証 |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| サービスが永続状態を持たないこと | 実行時の戻り値だけではクラス内部フィールドの設計制約を完全には固定できないため | 実装レビューで `TaskService` が `repo` / `clock` / `idGenerator` 以外の永続状態を持たないことを確認 |
| `Date.now()` / `new Date()` / `Math.random()` をサービス・リポジトリ内で直接使わないこと | 注入 clock/id の利用は既存テストと追加テストで観測できるが、禁止 API の不使用は静的レビュー向きの制約であるため | 実装レビューで禁止 API の使用有無を確認 |
| create/update の検証ロジックが一箇所に集約されていること | 同じ入力で同じ結果になることは既存・追加テストで確認できるが、重複実装の有無は構造制約であるため | 実装レビューで正規化 helper の共通化を確認 |
| フレームワーク非依存 | テスト対象がライブラリ API であり、依存導入の有無は実装・package 差分の確認が適切なため | 実装レビューで framework import や依存追加がないことを確認 |
| DB・外部 API・ファイル永続化を使わないこと | 現在の公開契約はインメモリ repository の戻り値で観測する形であり、外部副作用の不使用は構造確認が適切なため | 実装レビューで外部 I/O がないことを確認 |

## 実行結果（参考）
実装前のためテスト失敗・import エラーは想定内。

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 0 | 依存未インストールのためテスト本体は未実行 |
| Fail / Import Error（想定内） | 0 | 未実装到達前に停止 |
| Error（要対応） | 2 | `npm test` は `vitest: command not found`、`npm run typecheck` は `tsc: command not found` で停止 |

## 備考（判断がある場合のみ）
- 新規テストファイルは作らず、既存の責務別テストファイルへ追加した。
- 追加テストは 16 件。
- `git diff --check` は成功。
- `node_modules` や `package-lock.json` を生成すると「テストファイルのみ」の制約から外れるため、依存インストールは実施していない。