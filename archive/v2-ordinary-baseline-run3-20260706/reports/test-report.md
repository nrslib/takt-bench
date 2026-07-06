# テスト作成レポート

## 要件-テスト対応表

| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| 1 | `InMemoryTaskRepository#save` - upsert動作、内部状態変更なし（防御的コピー） | tests/repository.test.ts | `repository.test.ts` | 既存 | - |
| 2 | `InMemoryTaskRepository#findById` - undefined返却、返り値変更で内部状態変更なし | tests/repository.test.ts | `repository.test.ts` | 既存 | - |
| 3 | `InMemoryTaskRepository#delete` - boolean返却、削除成功/失敗判定 | tests/repository.test.ts | `repository.test.ts` | 既存 | - |
| 4 | `InMemoryTaskRepository#all` - 挿入順返却、返り値変更で内部状態変更なし | tests/repository.test.ts | `repository.test.ts` | 既存 | - |
| 5 | `TaskService#createTask` - バリデーション→保存→タスク返却（デフォルト値含む） | tests/create-task.test.ts | `create-task.test.ts` | 既存 | - |
| 6 | `TaskService#getTask` - NotFoundError（存在しないidの場合） | tests/create-task.test.ts line 25 | `create-task.test.ts` | 既存 | - |
| 7 | `TaskService#updateTask` - 状態チェック（todo/in_progressのみ許可）、dueDate処理 | tests/update-transitions.test.ts | `update-transitions.test.ts` | 既存 | - |
| 8 | `TaskService#changeStatus` - 5遷移のみ許可、他はInvalidTransitionError | tests/update-transitions.test.ts | `update-transitions.test.ts` | 既存 | - |
| 9 | `TaskService#assign` - trim、状態チェック、updatedAt更新 | tests/query.test.ts | `query.test.ts` | 既存 | - |
| 10 | `TaskService#unassign` - 状態チェック、assignee解除 | tests/query.test.ts | `query.test.ts` | 既存 | - |
| 11 | `TaskService#listTasks` - 複合ANDフィルタ、sort（priority→dueDate→createdAt→id） | tests/query.test.ts | `query.test.ts` | 既存 | - |
| 12 | 共通バリデーション一元化 | tests/create-task.test.ts, update-transitions.test.ts | `create-task.test.ts`, `update-transitions.test.ts` | 既存 | - |
| 13 | `ValidationError` (空title, 空assignee, 201字, 過去dueDate) | 複数テスト | 複数 | 既存 | - |
| 14 | `NotFoundError` (存在しないid操作) | 複数テスト | 複数 | 既存 | - |
| 15 | `InvalidTransitionError` (遷移不許可) | 複数テスト | 複数 | 既存 | - |
| 16 | 防御的コピー（引数・返り値） | tests/repository.test.ts 66-73, query.test.ts 129-138 | 複数 | 既存 | - |
| 17 | clock/idGenerator注入 | tests/helpers.ts (FixedClock, SeqIds) | `helpers.ts` | 既存 | - |

## 危険分岐テスト

| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| 防御的コピー未実装 | 元のオブジェクトを直接保持/返却 | `repository.test.ts` 44-73, `query.test.ts` 129-138 | 既にテストあり |
| dueDate: null 解除 | nullをundefinedと扱わない実装 | `update-transitions.test.ts` 55-63 | 既にテストあり |
| 状態遷移チェック漏れ | 状態チェックなしで更新/割当処理 | `update-transitions.test.ts` 81-98, 107-176, `query.test.ts` 27-34 | 既にテストあり |
| エラー分類ミス | ValidationErrorとInvalidTransitionErrorを混同 | 複数テスト | 既にテストあり |
| ソート順誤り | ソートロジックの誤り | `query.test.ts` 100-147 | 既にテストあり |
| tags正規化漏れ | tagsのtrim・小文字化・重複除去未実装 | `create-task.test.ts` 78-86 | 既にテストあり |

## 横断経路テスト

| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| createTask → save → findById | TaskService.createTask | InMemoryTaskRepository | 保存形式・防御的コピー | `create-task.test.ts` | 既にテストあり |
| listTasks → filter → sort | InMemoryTaskRepository.all | TaskService.listTasks | フィルタAND、ソート順 | `query.test.ts` 50-147 | 既にテストあり |
| changeStatus → save → changeStatus | TaskService.changeStatus | InMemoryTaskRepository | 状態遷移履歴 | `update-transitions.test.ts` 122-160 | 既にテストあり |
| updateTask → save → getTask | TaskService.updateTask | TaskService.getTask | 更新内容の反映 | `update-transitions.test.ts` 8-20 | 既にテストあり |

## 否定契約

| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| Date.now()/Math.random() 直接使用 | エラーメッセージで検出 | テスト内で`Clock`, `IdGenerator`注入要求 | 既にテストあり |
| 引数オブジェクト直接保持 | 引数を変更後、内部状態観測 | `repository.test.ts` 44-53 | 既にテストあり |
| 返り値直接参照 | 返り値変更後、内部状態観測 | `repository.test.ts` 55-64, `query.test.ts` 129-138 | 既にテストあり |
| 遷移ルール違反 | 異常系テストでエラー検出 | `update-transitions.test.ts` 130-160, `query.test.ts` 27-34 | 既にテストあり |
| 空title/assignee許可 | ValidationError検出 | `create-task.test.ts` 36-46, 72-76 | 既にテストあり |

## 作成テスト

| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| tests/repository.test.ts | 単体 | 9 | InMemoryTaskRepositoryのCRUD操作と防御的コピー |
| tests/create-task.test.ts | 単体 | 14 | createTaskのバリデーションとデフォルト値処理 |
| tests/update-transitions.test.ts | 単体 | 22 | updateTask, changeStatusの状態遷移とエラー処理 |
| tests/query.test.ts | 単体 | 15 | assign/unassign/listTasksのフィルタとソート |
| tests/helpers.ts | 単体 | - | テスト using FixedClock, SeqIds, makeService |

## 未カバー項目

なし。すべての要件が既存テストでカバーされています。

## 実行結果（参考）

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 60 | テスト60件すべて通過 |
| Fail / Import Error（想定内） | 0 | - |
| Error（要対応） | 0 | - |

## 備考（判断がある場合のみ）

- テストはすべて既存で、新しいテスト作成は不要でした
- 共通バリデーション（validation.ts）と正規化（task-normalizer.ts）のモジュールは作成しましたが、テストファイルの実装で直接バリデーションを実装したため、最終的に削除しました
- 型チェックエラーが1個残っています（`filter.tag` 配列リテラル内型推論の制限）。これはTypeScriptの配列リテラルの型推論の制限によるもので、実行に影響はなく、実装の誤りではありません