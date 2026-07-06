# タスク計画

## 元の要求
README.md の仕様と src/types.ts の公開契約に従って、タスク管理のサービス層を実装してください。tests/ 配下の全テスト（60 件）が成功する状態にしてください。テストコード（tests/）と src/types.ts の変更は禁止です。src/index.ts の公開 API シグネチャも変更禁止です。README の「アーキテクチャ要件」セクション（サービスの無状態性、clock/idGenerator の注入、検証の一元化、防御的コピー）を守ってください。

## 分析結果

### 目的
README.md で定義された仕様に従い、`InMemoryTaskRepository` と `TaskService` を実装して、tests/ 配下の60件のテスト全てを合格状態にすること。

### 分解した要件
| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | `InMemoryTaskRepository.save(task)` の実装 | 明示 | upsert。防御的コピー取り、内部状態保護 |
| 2 | `InMemoryTaskRepository.findById(id)` の実装 | 明示 | 存在時 TaskRecord、存在せずは undefined。防御的コピー返却 |
| 3 | `InMemoryTaskRepository.delete(id)` の実装 | 明示 | 存在時 true + 実体削除、存在せず false |
| 4 | `InMemoryTaskRepository.all()` の実装 | 明示 | 保存順（挿入順）で全件返却。防御的コピー返却 |
| 5 | `TaskService.createTask(input)` の実装 | 明示 | 検証 → id生成 → status='todo' → 時刻設定 → repo.save → 返却 |
| 6 | `TaskService.getTask(id)` の実装 | 明示 | repo.findById で取得、未foundは NotFoundError |
| 7 | `TaskService.updateTask(id, input)` の実装 | 明示 | 対象を取得、status check（todo/in_progressのみ）→ 変更値反映 → updatedAt更新 → repo.save → 返却 |
| 8 | `TaskService.changeStatus(id, next)` の実装 | 明示 | 現在ステータス取得 → 遷移許可チェック（5通りのみ）→ 変更 → updatedAt更新 → repo.save → 返却 |
| 9 | `TaskService.assign(id, assignee)` の実装 | 明示 | 対象取得 → status check（todo/in_progressのみ）→ assignee検証（trim後空なら ValidationError）→ 更新 → updatedAt更新 → repo.save → 返却 |
| 10 | `TaskService.unassign(id)` の実装 | 明示 | 対象取得 → status check（todo/in_progressのみ）→ assignee to undefined → updatedAt更新 → repo.save → 返却 |
| 11 | `TaskService.listTasks(filter?)` の実装 | 明示 | repo.all()取得 → filter適用（AND）→ ソート（priority→dueDate→createdAt→id）→ 防御的コピー返却 |
| 12 | title は trim 後空文字なら ValidationError | 明示 | create/update 共通 |
| 13 | title は trim 後 201 文字以上なら ValidationError | 明示 | create/update 共通。200文字まで許可 |
| 14 | description は trim して保存、未指定は空文字列 | 明示 | create/update 共通 |
| 15 | priority は未指定なら medium がデフォルト | 明示 | create 時 |
| 16 | assignee は指定時、trim 後空文字なら ValidationError | 明示 | create/update/assign 共通 |
| 17 | tags は trim→小文字化→空要素除去→重複除去（順序保持） | 明示 | create/update 共通 |
| 18 | dueDate は指定時、clock.now() より過去なら ValidationError | 明示 | 現在時刻ちょうどは許可。create/update 共通 |
| 19 | updateTask/dueDate: null で期限解除 | 明示 | updateTask のみ |
| 20 | updateTask/dueDate: undefined で変更なし | 明示 | updateTask のみ |
| 21 | changeStatus の許可遷移（5つのみ） | 明示 | todo→in_progress, todo→cancelled, in_progress→done, in_progress→todo, in_progress→cancelled |
| 22 | 同一ステータスへの遷移は InvalidTransitionError | 明示 | changeStatus |
| 23 | done/cancelled からの遷移は InvalidTransitionError | 明示 | changeStatus |
| 24 | 変更操作はすべて updatedAt = clock.now() | 明示 | create/createTask/getTask/変更系全操作 |
| 25 | 存在しない id 操作は NotFoundError | 明示 | getTask/updateTask/changeStatus/assign/unassign |
| 26 | listTasks の filter: status 完全一致 | 明示 | |
| 27 | listTasks の filter: assignee 完全一致 | 明示 | |
| 28 | listTasks の filter: tag（正規化後完全一致） | 明示 | フィルタ値も trim→小文字化 |
| 29 | listTasks の filter: overdueAsOf（dueDate ありかつ status todo/in_progress 且つ dueDate < 基準） | 明示 | |
| 30 | listTasks の filter: 複数条件 AND | 明示 | |
| 31 | listTasks のソート: priority（high→medium→low） | 明示 | |
| 32 | listTasks のソート: dueDate 昇順（未設定は最后） | 明示 | |
| 33 | listTasks のソート: createdAt 昇順（dueDate 同時） | 明示 | |
| 34 | listTasks のソート: id 昇順（createdAt 同時） | 明示 | |
| 35 | 防御的コピー: repo.save に渡した引数変更は内部影響なし | 明示 | repository.test.ts:44-53 |
| 36 | 防御的コピー: findById/all 返値変更は内部影響なし | 明示 | repository.test.ts:55-73 |
| 37 | 防御的コピー: listTasks 返値変更は内部影響なし | 明示 | query.test.ts:130-138 |
| 38 | サービスは状態を持たない | 明示 | アーキテクチャ要件 |
| 39 | 時刻・ID は注入された clock/idGenerator から取得 | 明示 | アーキテクチャ要件。Date.now/new Date/Math.random 使用禁止 |
| 40 | 検証ロジックは一元化 | 明示 | アーキテクチャ要件。create/update で重複実装しない |

### 参照資料の調査結果（参照資料がある場合）
- 指示書に外部実装の参照資料は指定されていない。タスク指示書内の記述（README.md と src/types.ts）が唯一のソース・オブ・トゥルース。
- README.md に明記された仕様と、現在の `src/index.ts`（Throw Only 状態）との差分が実装対象。
- `tests/helpers.ts` の `makeService()` 実装から、`TaskService` のコンストラクタ引数は `(repo, clock, idGenerator)` 且つ実装は `new InMemoryTaskRepository()` であることを確認。
- `tests/{create-task,test}.ts:4` から `TaskService` の引数順序が `(repo, clock, idGenerator)` と確定。

### スコープ
- `src/index.ts` 全体の修正（`InMemoryTaskRepository` と `TaskService` の各メソッド実装）
- 新規ファイル `src/validation.ts` の作成（検証ロジック一元化のため）
- 影響範囲は上記のみ。`src/types.ts`, `src/index.ts` の公開シグネチャ、`tests/` 各ファイルは一切変更しない。

### 検討したアプローチ（設計判断がある場合）
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| 検証ロジックを create/update で重複実装する | 不採用 | アーキテクチャ要件（検証の一元化）に反するため |
| Map の代わりに配列で store を実装する | 不採用 | Map の方が O(1) ランダムアクセスで効率的、また識別子が string で既に existent なため |
| 返り値に参照を直接返す（防御的コピーなし） | 不採用 | repository.test.ts/query.test.ts で明示的に変更チェックあり、要件35-37 |

### 実装アプローチ
1. `src/validation.ts` を新規作成し、共通のバリデーションロジックを集約
   - `validateCreate`, `validateUpdate` 関数を実装
   - 両関数とも入力値の trim, 長さチェック, priority default 設定, tags 正規化, dueDate past check を実施
2. `InMemoryTaskRepository` を実装
   - 内部 store は `Map<string, TaskRecord>`（保存順保持のため Map を優先、`all()` で挿入順が必要なため iterable を活用）
   - `save`: 防御的コピー（JSON parse/stringify or spread for deep copy）を取り、Map に保存
   - `findById`: 存在時に防御的コピー返却
   - `all`: 全件配列化、各要素を防御的コピーした新配列返却
   - `delete`: 存在チェック後 delete して true/false 返却
3. `TaskService` を実装
   - `createTask`: validateCreate → id生成 → 時刻設定 → repo.save → 返却
   - `getTask`: repo.findById で取得、未foundなら NotFoundError
   - `updateTask`: getTask → status check（todo/in_progress）→ validateUpdate → 変更反映 → updatedAt更新 → repo.save → 返却
   - `changeStatus`: getTask → status check → 遷移許可チェック（5通り）→ 変更 → updatedAt更新 → repo.save → 返却
   - `assign`: getTask → status check → assignee validate（trim後空なら ValidationError）→ 変更 → updatedAt更新 → repo.save → 返却
   - `unassign`: getTask → status check → assignee=undefined → updatedAt更新 → repo.save → 返却
   - `listTasks`: repo.all() → filter apply（status/assignee/tag/overdueAsOf, AND）→ ソート（priority→dueDate→createdAt→id）→ 返却時に防御的コピー（mapでspread）

### 到達経路・起動条件（利用者向け機能の追加/変更がある場合）
- なし（内部実装のみ、利用者向け機能の追加/変更なし）

## 実装ガイドライン
- `src/validation.ts` に共通バリデーション関数 `validateCreateTask(input, clock)` と `validateUpdateTask(input, clock)` を実装。両関数は validation error 時に ValidationError throw。
- `InMemoryTaskRepository` 内部の store は `Map<string, TaskRecord>` を使用。保存順保持のため Map の insert order を活用。
- 防御的コピーには `JSON.parse(JSON.stringify(obj))` を使用（深層コピー確保のため）。
- `TaskService` は状態を持たず、すべてのメソッドで `this.repo`, `this.clock`, `this.idGenerator` を利用。
- `updateTask` の dueDate handling: `undefined` は変更なし、`null` は解除、`Date` は設定。
- `changeStatus` の遷移許可チェックは、許可リストを明示的に定義し、それ以外なら InvalidTransitionError throw。
- `listTasks` のソートは、comparison function で優先度（high→medium→low, numeric mapping）、dueDate（未設定は最後）、createdAt（昇順）、id（昇順）の順で多重比較。
- `tags` 正規化: `input.tags?.map(t => t.trim().toLowerCase()).filter(t => t !== '').filter((v, i, a) => a.indexOf(v) === i)`（順序保持のため indexOf で重複除去）。
- `dueDate` past check: `input.dueDate && input.dueDate.getTime() < clock.now().getTime()`（現在時刻ちょうどは `>=` のため許可）。
- `assignee` validate: 指定があった場合のみ trim 後空文字でエラー（未指定は許可）。
- `title` validate: `input.title.trim()` の長さチェック（0なら ValidationError、201以上なら ValidationError）。

## スコープ外
- `src/types.ts` の型・エラー変更（公開契約変更禁止）
- `src/index.ts` の公開シグネチャ変更
- `tests/` 各ファイルの変更（テスト変更禁止）
- バックエンドの実装（既に全公開APIが `src/index.ts` に存在し、Throw Only 状態のため）

## 確認事項
- 無し。すべての要件は README.md と tests/ から直接導け、実装の根拠は確定している。