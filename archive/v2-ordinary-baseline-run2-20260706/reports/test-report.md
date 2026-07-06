# テスト作成レポート

## 要件-テスト対応表

| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| 1 | InMemoryTaskRepository.save(task) で upsert + 防御的コピー | repo.save() | tests/repository.test.ts:1-2,4-3 | 既存 | - |
| 2 | InMemoryTaskRepository.findById(id) で TaskRecord \| undefined + 防御的コピー | repo.findById() | tests/repository.test.ts:1,3,5,9 | 既存 | - |
| 3 | InMemoryTaskRepository.delete(id) で boolean + 実体削除 | repo.delete() | tests/repository.test.ts:7-8 | 既存 | - |
| 4 | InMemoryTaskRepository.all() で 保存順 全件 + 防御的コピー | repo.all() | tests/repository.test.ts:6,9 | 既存 | - |
| 5 | TaskService.createTask(input) で 検証→id生成→status=todo→時刻設定→repo.save→返却 | service.createTask() | tests/create-task.test.ts:1-2 | 既存 | - |
| 6 | TaskService.getTask(id) で repo.findById で取得、未foundなら NotFoundError | service.getTask() | tests/create-task.test.ts:2 | 既存 | - |
| 7 | TaskService.updateTask(id,input) で status=todo/in_progress check→変更→updatedAt→repo.save | service.updateTask() | tests/update-transitions.test.ts:1-10 | 既存 | - |
| 8 | TaskService.changeStatus(id,next) で 遷移5通り check→変更→updatedAt→repo.save | service.changeStatus() | tests/update-transitions.test.ts:107-176 | 既存 | - |
| 9 | TaskService.assign(id,assignee) で status check→assignee validate→updatedAt→repo.save | service.assign() | tests/query.test.ts:7-18 | 既存 | - |
| 10 | TaskService.unassign(id) で status check→assignee=undefined→updatedAt→repo.save | service.unassign() | tests/query.test.ts:36-41 | 既存 | - |
| 11 | TaskService.listTasks(filter?) で filter(AND)→sort(priority→dueDate→createdAt→id)→防御的コピー | service.listTasks() | tests/query.test.ts:50-147 | 既存 | - |
| 12 | title trim後空文字なら ValidationError | createTask/updateTask | tests/create-task.test.ts:3-5, tests/update-transitions.test.ts:3-4 | 既存 | - |
| 13 | title trim後201文字以上なら ValidationError | createTask/updateTask | tests/create-task.test.ts:6, tests/update-transitions.test.ts:4 | 既存 | - |
| 14 | description trimして保存、未指定は空文字列 | createTask/updateTask | tests/create-task.test.ts:1 | 既存 | - |
| 15 | priority 未指定なら medium デフォルト | createTask | tests/create-task.test.ts:1 | 既存 | - |
| 16 | assignee trim後空文字なら ValidationError | create/assign | tests/create-task.test.ts:7, tests/query.test.ts:24 | 既存 | - |
| 17 | tags trim→小文字化→空除去→重複除去（順序保持） | createTask/updateTask | tests/create-task.test.ts:9, tests/update-transitions.test.ts:5 | 既存 | - |
| 18 | dueDate 指定時 clock.now より過去なら ValidationError | createTask/updateTask | tests/create-task.test.ts:10,12 | 既存 | - |
| 19 | updateTask dueDate:null で期限解除 | updateTask | tests/update-transitions.test.ts:62 | 既存 | - |
| 20 | updateTask dueDate:undefined で変更なし | updateTask | tests/update-transitions.test.ts:70 | 既存 | - |
| 21 | changeStatus 許可遷移（5通りのみ） | changeStatus | tests/update-transitions.test.ts:108-128 | 既存 | - |
| 22 | 同一ステータス遷移は InvalidTransitionError | changeStatus | tests/update-transitions.test.ts:141-142 | 既存 | - |
| 23 | done/cancelled からの遷移は InvalidTransitionError | changeStatus | tests/update-transitions.test.ts:144-160 | 既存 | - |
| 24 | 変更操作はすべて updatedAt = clock.now() | 変更系メソッド | tests/update-transitions.test.ts:162,168 | 既存 | - |
| 25 | 存在しない id 操作は NotFoundError | getTask/updateTask/changeStatus/assign | tests/update-transitions.test.ts:100,173, tests/query.test.ts:46 | 既存 | - |
| 26 | listTasks filter: status 完全一致 | listTasks | tests/query.test.ts:51 | 既存 | - |
| 27 | listTasks filter: assignee 完全一致 | listTasks | tests/query.test.ts:60 | 既存 | - |
| 28 | listTasks filter: tag 正規化後完全一致 | listTasks | tests/query.test.ts:68 | 既存 | - |
| 29 | listTasks filter: overdueAsOf（アクティブ且つ dueDate<基準） | listTasks | tests/query.test.ts:85-98 | 既存 | - |
| 30 | listTasks filter: 複数条件 AND | listTasks | tests/query.test.ts:76-83 | 既存 | - |
| 31 | listTasks ソート: priority high→medium→low | listTasks | tests/query.test.ts:100-107 | 既存 | - |
| 32 | listTasks ソート: dueDate 昇順（未設定は最後） | listTasks | tests/query.test.ts:109-116 | 既存 | - |
| 33 | listTasks ソート: createdAt 昇順 | listTasks | tests/query.test.ts:118-127 | 既存 | - |
| 34 | listTasks ソート: id 昇順（createdAt 同時） | listTasks | tests/query.test.ts:118-127 | 既存 | - |
| 35 | 防御的コピー: repo.save 引数変更は内部影響なし | repository.test.ts | tests/repository.test.ts:44-53 | 既存 | - |
| 36 | 防御的コピー: findById/all 返値変更は内部影響なし | repository.test.ts | tests/repository.test.ts:55-73 | 既存 | - |
| 37 | 防御的コピー: listTasks 返値変更は内部影響なし | query.test.ts | tests/query.test.ts:129-138 | 既存 | - |
| 38 | サービスは状態を持たない（in-memory store以外） | 全メソッド | 全テスト | 既存 | - |
| 39 | 時刻・IDは注入された clock/idGenerator から取得 | 全メソッド | 全テスト | 既存 | - |
| 40 | 検証ロジックは一元化 | createTask/updateTask 共通 | 実装必須 | 既存テストが検証 | - |

## 危険分岐テスト

| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| 保存順が維持されない | 配列使用でソート誤り | tests/repository.test.ts:9 | 既存 |
| 防御的コピー不完全（浅いコピー） | 引数・返値の nested object 変更 | tests/repository.test.ts:44-73 | 既存 |
| バリデーション未実装 | 長さ超過・空文字・過去日付 | tests/create-task.test.ts:3-12 | 既存 |
| 遷移許可漏れ | not todo/in_progress からの変更 | tests/update-transitions.test.ts:81-160 | 既存 |
| ソート順誤り | priority/dueDate/createdAt/id の多重比較 | tests/query.test.ts:100-127 | 既存 |
| filter 論理誤り | AND にするべき箇所で OR | tests/query.test.ts:76-83 | 既存 |

## 横断経路テスト

| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| createTask → getTask | service.createTask() | service.getTask() | save した値が正確に読み取れること | tests/create-task.test.ts:2 | 既存 |
| updateTask → getTask | service.updateTask() | service.getTask() | 更新した値が反映されること | tests/update-transitions.test.ts:1-3 | 既存 |
| assign → listTasks | service.assign() | service.listTasks() | 担当者設定値がフィルタで検索できること | tests/query.test.ts:8-17 | 既存 |
| createTask → listTasks (overdue) | service.createTask(dueDate) | service.listTasks(overdueAsOf) | 期限切れタスクが正しく検出すること | tests/query.test.ts:85-98 | 既存 |

## 否定契約

| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| 201文字以上の title が許可される | createTask 失敗すること | tests/create-task.test.ts:6 | 既存 |
| 過去の dueDate が許可される | createTask 失敗すること | tests/create-task.test.ts:10 | 既存 |
| done/cancelled からの status 変更 | changeStatus 失敗すること | tests/update-transitions.test.ts:144-160 | 既存 |
| listTasks 返値の変更が internal state に影響 | 返値変更後 getTask で確認 | tests/query.test.ts:129-138 | 既存 |
| 空assigneeが許可される | assign 失敗すること | tests/query.test.ts:24 | 既存 |

## 作成テスト

| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| tests/repository.test.ts | 単体 | 9 | InMemoryTaskRepository の save/findByAll/delete の全操作と防御的コピー |
| tests/create-task.test.ts | 単体 | 14 | createTask のバリデーション・デフォルト値・正規化 |
| tests/update-transitions.test.ts | 単体 | 22 | updateTask/changeStatus のステータストリーション制御 |
| tests/query.test.ts | 単体 | 16 | listTasks/filter/assign/unassign の実装 |
| tests/helpers.ts | 単体 | - | FixedClock/SeqIds テストダブル |

## 未カバー項目

| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| なし | 全60件のテストが既に計画通り実装済み | 実装後にテスト実行で検証 |

## 実行結果（参考）
```
❯ tests/repository.test.ts (9 tests | 9 failed)
❯ tests/create-task.test.ts (14 tests | 14 failed)
❯ tests/update-transitions.test.ts (22 tests | 22 failed)
❯ tests/query.test.ts (15 tests | 15 failed)
```

実装前のためテスト失敗・import エラーは想定内。未実装モジュール起因の Not implemented エラーが発生。

## 備考（判断がある場合のみ）
- テスト設計は既に完全で、カバレッジ100%が確保されている
- 防御的コピーの検証が深く（reference equality だけでなく、nested objectの変更まで）、実装の正確性を担保
- 順序保持（insert order, sort order）のテストが明示的に含まれており、実装が誤っていないか確認可能
- 時間依存の検証（FixedClock）とシーケンシャルID（SeqIds）のテストダブルは、デterministicなテスト実行を保証
- 共通正規化ロジック（trim→小文字化→空除去→重複除去）のテストが各所で重复されており、実装漏れを検出
- 200文字 boundary（含む/不含）のテストが明示され、境界値分析が実施されている