# タスク計画

## 元の要求

タスク管理機能で利用するサービス層を実装してください。

仕様は README.md に記載されています。公開 API は src/types.ts の型定義に準拠し、利用者が src/index.ts から import できる形にしてください。

フレームワークには依存せず、インメモリで完結するライブラリとして実装してください。アーキテクチャ上の制約は README.md の「アーキテクチャ要件」に従ってください。

## 分析結果

### 目的

`README.md` の仕様と `src/types.ts` の公開契約に従い、タスク管理サービス層をフレームワーク非依存・インメモリ完結の TypeScript ライブラリとして実装する。利用者は `src/index.ts` から `InMemoryTaskRepository` と `TaskService` を import できる状態にする。

現状、`src/index.ts` の `InMemoryTaskRepository` と `TaskService` は全メソッドが `throw new Error('Not implemented')` のスタブであり、`npm test` は 60 件すべて失敗している。`npm run typecheck` は現状通過している。

### 分解した要件

| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | `InMemoryTaskRepository` を公開 API として実装する | 明示 | README.md:10-13、src/index.ts:19-35 |
| 2 | `TaskRepository` ポートに準拠する | 明示 | src/types.ts:57-62 |
| 3 | repository の保存先はインメモリにする | 明示 | README.md:3、README.md:54-61 |
| 4 | `save` は upsert として動作する | 明示 | README.md:56-57 |
| 5 | `save` は保存時に防御的コピーを取る | 明示 | README.md:56-57 |
| 6 | `findById` は存在しない id に `undefined` を返す | 明示 | src/types.ts:59、tests/repository.test.ts:38-42 |
| 7 | `findById` は防御的コピーを返す | 明示 | README.md:58-59 |
| 8 | `all` は防御的コピー配列を返す | 明示 | README.md:58-59 |
| 9 | `all` は保存順、つまり挿入順で返す | 明示 | README.md:61 |
| 10 | `delete` は削除有無を boolean で返す | 明示 | README.md:60 |
| 11 | `TaskService` を公開 API として実装する | 明示 | README.md:10-13、src/index.ts:37-71 |
| 12 | `TaskService` は `(repo, clock, idGenerator)` を注入して使う | 明示 | README.md:13、src/index.ts:38-42 |
| 13 | `createTask` は検証後に id を `idGenerator.next()` から取得する | 明示 | README.md:26-27 |
| 14 | `createTask` は status を `todo` にする | 明示 | README.md:26-27 |
| 15 | `createTask` は `createdAt` と `updatedAt` を `clock.now()` にする | 明示 | README.md:26-27 |
| 16 | `createTask` は作成したタスクを保存して返す | 明示 | README.md:26-27 |
| 17 | `getTask` は存在しない id に `NotFoundError` を投げる | 明示 | README.md:28 |
| 18 | `updateTask` は対象が `todo` でなければ更新不可にする | 明示 | README.md:29 |
| 19 | `updateTask` は対象が `in_progress` でなければ更新不可にする | 明示 | README.md:29 |
| 20 | `updateTask` は対象が `done` または `cancelled` の場合 `InvalidTransitionError` にする | 明示 | README.md:29 |
| 21 | `updateTask` は `id` を変えない | 明示 | README.md:31 |
| 22 | `updateTask` は `status` を変えない | 明示 | README.md:31 |
| 23 | `updateTask` は `createdAt` を変えない | 明示 | README.md:31 |
| 24 | `updateTask` は `updatedAt` を `clock.now()` に更新する | 明示 | README.md:31 |
| 25 | `updateTask` の `dueDate: Date` は期限を更新する | 明示 | README.md:30 |
| 26 | `updateTask` の `dueDate: null` は期限を解除する | 明示 | README.md:30 |
| 27 | `updateTask` の `dueDate: undefined` は期限を変更しない | 明示 | README.md:30 |
| 28 | `changeStatus` は `todo -> in_progress` を許可する | 明示 | README.md:32-38 |
| 29 | `changeStatus` は `todo -> cancelled` を許可する | 明示 | README.md:32-38 |
| 30 | `changeStatus` は `in_progress -> done` を許可する | 明示 | README.md:32-38 |
| 31 | `changeStatus` は `in_progress -> todo` を許可する | 明示 | README.md:32-38 |
| 32 | `changeStatus` は `in_progress -> cancelled` を許可する | 明示 | README.md:32-38 |
| 33 | `changeStatus` は同一状態への遷移を拒否する | 明示 | README.md:32-33 |
| 34 | `changeStatus` は `done` からの遷移を拒否する | 明示 | README.md:32-33 |
| 35 | `changeStatus` は `cancelled` からの遷移を拒否する | 明示 | README.md:32-33 |
| 36 | `assign` は active 状態のタスクに担当者を設定する | 明示 | README.md:39-40 |
| 37 | `assign` は担当者を trim し、空なら `ValidationError` にする | 明示 | README.md:39-40 |
| 38 | `unassign` は active 状態のタスクから担当者を外す | 明示 | README.md:39-40 |
| 39 | 変更操作はすべて `updatedAt` を更新する | 明示 | README.md:41 |
| 40 | 存在しない id への操作はすべて `NotFoundError` にする | 明示 | README.md:42 |
| 41 | `title` は trim して保存する | 明示 | README.md:17 |
| 42 | trim 後の `title` が空なら `ValidationError` にする | 明示 | README.md:17 |
| 43 | trim 後の `title` が 200 文字超なら `ValidationError` にする | 明示 | README.md:17 |
| 44 | trim 後の `title` が 200 文字ちょうどなら許可する | 明示 | README.md:17 |
| 45 | `description` は trim して保存する | 明示 | README.md:18 |
| 46 | `description` 未指定は空文字列にする | 明示 | README.md:18 |
| 47 | `priority` 未指定は `medium` にする | 明示 | README.md:19 |
| 48 | `assignee` は指定時に trim して保存する | 明示 | README.md:20 |
| 49 | trim 後の `assignee` が空なら `ValidationError` にする | 明示 | README.md:20 |
| 50 | `tags` は各要素を trim する | 明示 | README.md:21 |
| 51 | `tags` は小文字化する | 明示 | README.md:21 |
| 52 | `tags` は空要素を除去する | 明示 | README.md:21 |
| 53 | `tags` は重複を最初の出現だけ残して除去する | 明示 | README.md:21 |
| 54 | `tags` は順序を保持する | 明示 | README.md:21 |
| 55 | `dueDate` は `clock.now()` より過去なら `ValidationError` にする | 明示 | README.md:22 |
| 56 | `dueDate` は現在時刻ちょうどなら許可する | 明示 | README.md:22 |
| 57 | `listTasks` は `status` 完全一致で絞り込む | 明示 | README.md:46 |
| 58 | `listTasks` は `assignee` 完全一致で絞り込む | 明示 | README.md:46 |
| 59 | `listTasks` は `tag` フィルタ値を trim する | 明示 | README.md:47 |
| 60 | `listTasks` は `tag` フィルタ値を小文字化する | 明示 | README.md:47 |
| 61 | `listTasks` は正規化済みタグとの完全一致で絞り込む | 明示 | README.md:47 |
| 62 | `listTasks` は `overdueAsOf` より `dueDate` が前のものだけを期限切れとする | 明示 | README.md:48-49 |
| 63 | `listTasks` の期限切れ対象は `todo` と `in_progress` のみにする | 明示 | README.md:48-49 |
| 64 | `listTasks` の複数条件は AND にする | 明示 | README.md:50 |
| 65 | `listTasks` は priority を high、medium、low の順に並べる | 明示 | README.md:51-52 |
| 66 | `listTasks` は dueDate 昇順で並べ、未設定は最後にする | 明示 | README.md:51-52 |
| 67 | `listTasks` は createdAt 昇順で並べる | 明示 | README.md:51-52 |
| 68 | `listTasks` は id 昇順で並べる | 明示 | README.md:51-52 |
| 69 | サービスは永続状態を持たない | 明示 | README.md:65 |
| 70 | 永続状態は repository だけが持つ | 明示 | README.md:65 |
| 71 | 時刻は `clock` から取得する | 明示 | README.md:66-67 |
| 72 | ID は `idGenerator` から取得する | 明示 | README.md:66-67 |
| 73 | service/repository 内で `Date.now()` を直接使わない | 明示 | README.md:66-67 |
| 74 | service/repository 内で `new Date()` を直接使わない | 明示 | README.md:66-67 |
| 75 | service/repository 内で `Math.random()` を直接使わない | 明示 | README.md:66-67 |
| 76 | 検証ロジックは一箇所に集約する | 明示 | README.md:68 |
| 77 | create/update で検証を重複実装しない | 明示 | README.md:68 |
| 78 | サービスが返すタスクは repository 内部と参照を共有しない | 明示 | README.md:69 |
| 79 | 利用者は `src/index.ts` から公開 API を import できる | 明示 | README.md:7-8 |
| 80 | `src/types.ts` の公開契約を変更しない | 暗黙 | 明示要求「型定義に準拠」および src/types.ts:1-3 から導出 |
| 81 | `TaskService` は repository の具象実装に依存しない | 暗黙 | README.md:13 の `TaskRepository` 注入と Knowledge の依存方向から導出 |
| 82 | repository の Date と tags も参照共有しない | 暗黙 | README.md:56-59、README.md:69 の防御的コピー要件から導出 |

### 参照資料の調査結果

参照資料として `README.md` と `src/types.ts` を確認した。

- `README.md` は実装対象、バリデーション、状態遷移、一覧検索、repository セマンティクス、アーキテクチャ制約を定義している。
- `src/types.ts` は公開契約であり、`TaskStatus`、`Priority`、`TaskRecord`、入力型、フィルタ型、`Clock`、`IdGenerator`、`TaskRepository`、3 種のエラー型を定義している。
- `src/types.ts` 冒頭に「公開契約（変更禁止）」とあるため、このファイルは変更対象にしない。
- `src/index.ts` は公開シグネチャを持つが、実装はすべて未実装スタブである。
- `tests/*.test.ts` は README の仕様を直接検証している。特に `tests/repository.test.ts` は repository の防御的コピーと保存順、`tests/create-task.test.ts` は create のバリデーション、`tests/update-transitions.test.ts` は更新と状態遷移、`tests/query.test.ts` は assign/unassign と listTasks を確認している。
- `tests/helpers.ts` は `FixedClock` と `SeqIds` を提供し、サービスが clock/idGenerator 注入に従うことを前提にしている。

Knowledge Source の `.takt/runs/20260708-005125-readme-md-api-src-types-ts/context/knowledge/plan.1.20260708T005125Z.md` も確認した。今回の設計に関係する制約は、フレームワーク非依存、依存方向、アプリケーション層が具象 adapter に依存しないこと、状態遷移やビジネスルールを適切な層に置くことである。今回の小規模 TypeScript ライブラリでは、`TaskService` を application/usecase 相当、`TaskRepository` を port、`InMemoryTaskRepository` を outbound adapter 相当として扱う。

### スコープ

影響範囲は以下。

- `src/index.ts`
  - 公開 re-export の入口として維持する。
  - 既存の未実装クラス定義は、別モジュールからの re-export に置き換える計画。
- `src/repository.ts`
  - 新規追加。
  - `InMemoryTaskRepository` を実装する。
- `src/service.ts`
  - 新規追加。
  - `TaskService` と validation/helper を実装する。
- `src/types.ts`
  - 変更しない。
- `tests/`
  - 既存テストは仕様確認に使う。
  - この plan の実装対象には含めないが、後続の write_tests ステップでは既存 60 テストで不足がないか確認する。

### 検討したアプローチ

| アプローチ | 採否 | 理由 |
|-----------|------|------|
| `src/index.ts` 1 ファイルに repository と service をすべて実装する | 不採用 | 現在の `index.ts` は公開入口であり、repository と service の責務が混在する。Knowledge の 1 モジュール 1 責務にも合いにくい。 |
| `src/repository.ts` と `src/service.ts` に分割し、`src/index.ts` から re-export する | 採用 | 1 モジュール 1 責務にでき、公開 API は `src/index.ts` から維持できる。`src/index.ts` のコメントでも内部モジュール分割は許容されている。 |
| `TaskService` が `InMemoryTaskRepository` を直接生成・利用する | 不採用 | `TaskService(repo, clock, idGenerator)` 注入仕様に反する。アプリケーション層が具象 adapter に依存する形にもなる。 |
| `TaskService` が `TaskRepository` インターフェースだけに依存する | 採用 | `src/types.ts` の port に準拠し、README の注入仕様と Knowledge の依存方向に合う。 |
| Date の防御的コピーに `new Date(date.getTime())` を使う | 不採用 | README.md:66-67 の `new Date()` 直接使用禁止に抵触しやすい。 |
| Date と配列の防御的コピーに `structuredClone` を使う | 採用 | `new Date()` を src 実装内で直接使わずに `Date` と `tags` を深くコピーできる。 |

### 実装アプローチ

1. `src/repository.ts` を追加する。
   - `TaskRecord` と `TaskRepository` を `src/types.ts` から import する。
   - `InMemoryTaskRepository implements TaskRepository` を定義する。
   - 内部状態は `Map<string, TaskRecord>` のみとする。
   - `cloneTask(task: TaskRecord): TaskRecord` は `structuredClone(task)` を使う。
   - `save` は `Map.set(task.id, cloneTask(task))` とする。
   - `findById` は未存在なら `undefined`、存在すれば clone を返す。
   - `delete` は `Map.delete(id)` を返す。
   - `all` は `Array.from(this.tasks.values(), cloneTask)` で保存順を保つ。

2. `src/service.ts` を追加する。
   - `TaskService` は `TaskRepository`、`Clock`、`IdGenerator` のみを constructor で受け取る。
   - 永続状態を持たない。持つのは注入依存のみ。
   - helper は module scope に置く。
     - `normalizeTitle`
     - `normalizeDescription`
     - `normalizeAssignee`
     - `normalizeTags`
     - `validateDueDate`
     - `isActiveStatus`
     - `assertEditable`
     - `findTaskOrThrow`
     - `cloneTask`
   - validation helper は create/update/assign で共有し、同じ検証を複数メソッドに重複実装しない。

3. `createTask(input)` を実装する。
   - `const now = this.clock.now()` を一度だけ取得する。
   - `title`、`description`、`priority`、`assignee`、`tags`、`dueDate` を正規化・検証する。
   - `id` は `this.idGenerator.next()` から取得する。
   - `status` は `'todo'`。
   - `createdAt` と `updatedAt` は `now`。
   - `repo.save(task)` 後、`this.getTask(task.id)` で clone 済みの保存結果を返す。

4. `getTask(id)` を実装する。
   - `repo.findById(id)` が `undefined` なら `NotFoundError`。
   - 存在すればそのまま返す。repository が clone を返す前提。

5. `updateTask(id, input)` を実装する。
   - 先に `findTaskOrThrow` で存在確認し、missing は `NotFoundError`。
   - `todo` または `in_progress` 以外は `InvalidTransitionError`。
   - `title`、`description`、`priority`、`tags` は `undefined` なら既存値を維持し、指定があれば正規化・検証する。
   - `dueDate` は `null` なら `undefined`、`Date` なら検証して更新、`undefined` なら維持する。
   - `id`、`status`、`createdAt` は既存値を維持する。
   - `updatedAt` は `clock.now()`。
   - 保存後に `getTask(id)` を返す。

6. `changeStatus(id, next)` を実装する。
   - 存在しない id は `NotFoundError`。
   - 許可遷移を定数で定義する。
   - 許可遷移以外は `InvalidTransitionError`。
   - 許可される場合のみ `status` と `updatedAt` を更新して保存する。

7. `assign(id, assignee)` と `unassign(id)` を実装する。
   - 存在しない id は `NotFoundError`。
   - `todo` または `in_progress` 以外は `InvalidTransitionError`。
   - `assign` は `assignee` を trim し、空なら `ValidationError`。
   - `unassign` は `assignee: undefined` にする。
   - どちらも `updatedAt` を `clock.now()` に更新する。

8. `listTasks(filter?)` を実装する。
   - `repo.all()` の clone 済み配列を取得する。
   - `status`、`assignee`、`tag`、`overdueAsOf` を AND で適用する。
   - `tag` フィルタ値は trim、小文字化する。
   - `overdueAsOf` は `dueDate` が存在し、`dueDate.getTime() < overdueAsOf.getTime()` かつ active status のものだけを残す。
   - sort は priority rank、dueDate、createdAt、id の順に比較する。
   - priority rank は `{ high: 0, medium: 1, low: 2 }` とする。
   - dueDate 未設定は `Number.POSITIVE_INFINITY` として最後に並べる。
   - id 昇順は `<` / `>` で比較し、locale 依存にしない。

9. `src/index.ts` を公開入口に整理する。
   - `export * from './types.js';`
   - `export { InMemoryTaskRepository } from './repository.js';`
   - `export { TaskService } from './service.js';`

10. 実装後の検証。
    - `npm test`
    - `npm run typecheck`
    - `rg -n "Not implemented|Date\\.now|new Date|Math\\.random|throw new Error" src`

### 到達経路・起動条件

| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `src/index.ts` から `InMemoryTaskRepository` と `TaskService` を import する |
| 更新が必要な呼び出し元・配線 | `src/index.ts` の re-export。既存テストは `../src/index.js` から import しているため、この入口を維持する |
| 起動条件 | フレームワーク、認証、URL、フラグなし。利用者が `new TaskService(repo, clock, idGenerator)` を生成して各メソッドを呼ぶ |
| 未対応項目 | なし |

## 実装ガイドライン

- `src/types.ts` は変更しない。公開契約、型、エラー型は既存定義を使用する。
- `TaskService` は `TaskRepository` にだけ依存し、`InMemoryTaskRepository` を import しない。
- `InMemoryTaskRepository` は `TaskService` を import しない。
- `src/index.ts` は公開 API の入口に限定し、実装詳細は `src/repository.ts` と `src/service.ts` に置く。
- 現在の `src/index.ts` の未実装メソッドは削除または置換し、`Not implemented` を残さない。
- `Date.now()`、`new Date()`、`Math.random()` を `src` 配下の実装に書かない。
- 防御的コピーには `structuredClone` を使う。`TaskRecord` は plain object、Date、配列、文字列だけで構成されるため、今回の用途に合う。
- `clock.now()` が返す Date オブジェクトも、repository 保存時と返却時に clone されるようにする。
- validation は helper に集約する。create/update/assign の各メソッド内に同じ trim・長さ・空チェックを重複して書かない。
- dueDate の過去判定は `date.getTime() < now.getTime()` とし、同時刻は許可する。
- `UpdateTaskInput` の `dueDate` は `undefined` と property 不在をどちらも変更なしとして扱う。
- `description` は create では未指定を空文字列、update では `undefined` を変更なしにする。
- `tags` の重複除去は `Set` で実装してよいが、最初の出現順を維持する。
- 状態遷移は許可リストで判定し、条件分岐を散らさない。
- missing id の判定は各操作の先頭で行い、`NotFoundError` を優先する。
- `done` / `cancelled` の更新、assign、unassign は `InvalidTransitionError` にする。
- `listTasks` は repository から取得した配列だけを sort し、repository 内部配列や内部 Map を変更しない。
- エラーメッセージはテストで固定されていないため、簡潔で原因が分かる文字列にする。ただしエラー型は必ず仕様どおりにする。
- 参照すべき既存パターン:
  - `tests/helpers.ts:4-13` の `FixedClock` が clock 注入の前提。
  - `tests/helpers.ts:16-23` の `SeqIds` が idGenerator 注入の前提。
  - `tests/helpers.ts:27-35` の `makeService` が利用者側の生成経路。
  - `tests/repository.test.ts:5-18` の `record` helper が `TaskRecord` の期待形。
- 同種の repository/service 実装は現コード内に存在しないため、README と `src/types.ts` を主根拠に実装する。

## スコープ外

| 項目 | 除外理由 |
|------|---------|
| `src/types.ts` の型変更 | 公開契約で変更禁止。要求も「準拠」であり変更ではない |
| REST Controller や HTTP API | README はフレームワーク非依存のライブラリ実装を要求している |
| DB 永続化 | README はインメモリ完結を要求している |
| 認証・認可 | 要求、README、型定義に存在しない |
| 外部 API 連携 | 要求、README、型定義に存在しない |
| 後方互換レイヤー | 既存実装が未実装であり、後方互換要求もない |
| README の更新 | 実装要求であり、仕様変更要求ではない |

## 確認事項

なし。