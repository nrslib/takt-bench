# タスク計画

## 元の要求
タスク管理機能で利用するサービス層を実装してください。

仕様は README.md に記載されています。公開 API は src/types.ts の型定義に準拠し、利用者が src/index.ts から import できる形にしてください。

フレームワークには依存せず、インメモリで完結するライブラリとして実装してください。アーキテクチャ上の制約は README.md の「アーキテクチャ要件」に従ってください。

## 分析結果

### 目的
`README.md` の仕様と `src/types.ts` の公開契約に従い、フレームワーク非依存・インメモリ完結のタスク管理サービス層を実装する。利用者は `src/index.ts` から `InMemoryTaskRepository` と `TaskService` を import できる状態にする。

### 分解した要件
| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | `InMemoryTaskRepository` を `TaskRepository` ポートの実装として提供する | 明示 | README.md の「実装するもの」に記載 |
| 2 | Repository の `save` は upsert として動作する | 明示 | 同じ id は上書き |
| 3 | Repository は保存時に防御的コピーを取る | 明示 | 呼び出し側の後続 mutation を内部状態へ反映させない |
| 4 | Repository の `findById` は存在しない id で `undefined` を返す | 明示 | `TaskRepository` 型に準拠 |
| 5 | Repository の `findById` は防御的コピーを返す | 明示 | `tags` 配列と `Date` も共有しない |
| 6 | Repository の `all` は保存順で全件を返す | 明示 | Map の挿入順利用で実現可能 |
| 7 | Repository の `all` は防御的コピーを返す | 明示 | 返却要素の mutation を内部状態へ反映させない |
| 8 | Repository の `delete` は削除できたかを boolean で返す | 明示 | `TaskRepository` 型に準拠 |
| 9 | `TaskService` を `(repo, clock, idGenerator)` 注入で提供する | 明示 | constructor 既存シグネチャを維持 |
| 10 | `createTask` は入力を検証・正規化して保存する | 明示 | title/description/priority/assignee/tags/dueDate |
| 11 | `createTask` は `idGenerator.next()` で id を採番する | 明示 | `Math.random()` 等は使わない |
| 12 | `createTask` は `status = 'todo'` で作成する | 明示 | 初期状態 |
| 13 | `createTask` は `createdAt = updatedAt = clock.now()` で作成する | 明示 | 現在時刻は注入 clock のみ |
| 14 | `getTask` は存在しない id で `NotFoundError` を投げる | 明示 | README.md の TaskService 規則 |
| 15 | `updateTask` は対象が `todo` / `in_progress` 以外なら `InvalidTransitionError` を投げる | 明示 | `done` / `cancelled` は更新不可 |
| 16 | `updateTask` は `id` / `status` / `createdAt` を変更しない | 明示 | 更新可能フィールドのみ反映 |
| 17 | `updateTask` は `updatedAt = clock.now()` に更新する | 明示 | 変更操作共通 |
| 18 | `updateTask` の `dueDate` は `Date` で更新する | 明示 | `UpdateTaskInput` の契約 |
| 19 | `updateTask` の `dueDate` は `null` で解除する | 明示 | `undefined` と区別 |
| 20 | `updateTask` の `dueDate` は `undefined` で変更しない | 明示 | 入力省略時の保持 |
| 21 | `changeStatus` は許可された5遷移だけを成功させる | 明示 | `todo→in_progress`, `todo→cancelled`, `in_progress→done`, `in_progress→todo`, `in_progress→cancelled` |
| 22 | `changeStatus` は同一状態への遷移を拒否する | 明示 | `InvalidTransitionError` |
| 23 | `changeStatus` は `done` / `cancelled` からの遷移を拒否する | 明示 | `InvalidTransitionError` |
| 24 | `assign` は `todo` / `in_progress` 以外なら `InvalidTransitionError` を投げる | 明示 | 状態制約 |
| 25 | `assign` は assignee を trim し、空なら `ValidationError` を投げる | 明示 | 正規化済み値を保存 |
| 26 | `unassign` は `todo` / `in_progress` 以外なら `InvalidTransitionError` を投げる | 明示 | README.md では assign/unassign 共通 |
| 27 | `assign` / `unassign` は `updatedAt = clock.now()` に更新する | 明示 | 変更操作共通 |
| 28 | 存在しない id への変更操作はすべて `NotFoundError` を投げる | 明示 | update/changeStatus/assign/unassign |
| 29 | `listTasks` は `status` 完全一致で絞り込む | 明示 | filter 条件 |
| 30 | `listTasks` は `assignee` 完全一致で絞り込む | 明示 | filter 条件。trim は仕様にないため行わない |
| 31 | `listTasks` は `tag` を trim・小文字化し、正規化済みタグと完全一致で絞り込む | 明示 | filter 条件 |
| 32 | `listTasks` は `overdueAsOf` に対して期限切れかつアクティブなタスクのみ返す | 明示 | `dueDate < overdueAsOf` かつ `todo` / `in_progress` |
| 33 | `listTasks` の複数条件は AND とする | 明示 | filter 条件 |
| 34 | `listTasks` は priority 順で並べる | 明示 | high → medium → low |
| 35 | `listTasks` は同 priority で dueDate 昇順に並べる | 明示 | dueDate 未設定は最後 |
| 36 | `listTasks` は同 dueDate で createdAt 昇順に並べる | 明示 | README.md の並び順 |
| 37 | `listTasks` は同 createdAt で id 昇順に並べる | 明示 | README.md の並び順 |
| 38 | サービスは永続状態を持たない | 明示 | 永続状態は Repository のみ |
| 39 | 時刻は必ず注入された `clock` から取得する | 明示 | `Date.now()` / 現在時刻取得目的の `new Date()` 禁止 |
| 40 | ID は必ず注入された `idGenerator` から取得する | 明示 | `Math.random()` 禁止 |
| 41 | create/update の検証ロジックは一箇所に集約する | 明示 | 重複実装しない |
| 42 | サービスが返す Task は Repository 内部状態と参照共有しない | 明示 | Repository の防御的コピー、または返却前 clone で担保 |
| 43 | `src/types.ts` の公開契約を変更しない | 明示 | ファイル冒頭コメントに「変更禁止」 |
| 44 | `src/index.ts` から公開 API を import できる状態にする | 明示 | 利用者入口 |
| 45 | フレームワークに依存しない | 明示 | Spring/Express 等は不要 |
| 46 | インメモリで完結する | 明示 | DB/ファイル/外部 API は不要 |
| 47 | `UpdateTaskInput` に assignee は存在しないため、updateTask では担当者を更新しない | 暗黙 | `src/types.ts` の型定義から直接導出。担当者変更は `assign` / `unassign` で扱う |
| 48 | `Date` も防御的コピー対象に含める | 暗黙 | `TaskRecord` の `createdAt` / `updatedAt` / `dueDate` が mutable な `Date` 型であり、内部状態保護要件から直接導出 |

### 参照資料の調査結果（参照資料がある場合）
参照資料として `README.md` と `src/types.ts` を確認した。

`README.md` は、実装対象 API、バリデーション規則、TaskService の状態遷移規則、listTasks の filter/sort、Repository の防御的コピー、アーキテクチャ要件を定義している。現在の `src/index.ts` は公開シグネチャのみ存在し、`InMemoryTaskRepository` と `TaskService` の全メソッドが `throw new Error('Not implemented')` になっているため、主要実装は未着手である。

`src/types.ts` は公開契約として `TaskStatus`, `Priority`, `TaskRecord`, `CreateTaskInput`, `UpdateTaskInput`, `TaskFilter`, `Clock`, `IdGenerator`, `TaskRepository`, `ValidationError`, `NotFoundError`, `InvalidTransitionError` を定義している。冒頭コメントに「公開契約（変更禁止）」とあるため、このファイルは変更しない。

既存テストは `tests/repository.test.ts`, `tests/create-task.test.ts`, `tests/update-transitions.test.ts`, `tests/query.test.ts`, `tests/helpers.ts` に存在する。Repository の基本動作、createTask、updateTask、状態遷移、assign/unassign、listTasks の主要条件は検証されている。一方で、README の全仕様に対しては `getTask` の NotFound、`updateTask` の description/priority 更新、unassign のエラー系、Repository の Date 防御的コピー、listTasks の id 昇順タイブレークなどが未検証である。

Knowledge / Policy として、提供されたバックエンド専門知識、および coding スキルのポリシーを確認した。今回の TypeScript ライブラリには HTTP Controller や外部 adapter は存在しないが、依存方向、状態責務の分離、Fail Fast、公開契約維持、不要な後方互換コード禁止、過剰抽象化禁止が適用される。

### スコープ
対象は `src` 配下の実装と、それに対応する `tests` 配下のテスト追加に限定する。

変更対象候補:
- `src/index.ts`
- `src/repository.ts`
- `src/service.ts`
- `src/task-record.ts`
- `tests/repository.test.ts`
- `tests/create-task.test.ts`
- `tests/update-transitions.test.ts`
- `tests/query.test.ts`

変更しない対象:
- `src/types.ts`
- `README.md`
- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `meta.json`
- `.takt` 配下

現行の未追跡ファイルとして `.takt/.gitignore` と `meta.json` が確認されたが、今回の作業では触れない。

### 検討したアプローチ（設計判断がある場合）
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| `src/index.ts` 1ファイルに Repository / Service / helper をすべて実装する | 不採用 | 1ファイルに複数責務が集中し、実装後に200行を超える可能性が高い。README 上も内部モジュール分割は許可されている |
| `src/index.ts` は公開入口にして、Repository / Service / TaskRecord clone を内部モジュールへ分ける | 採用 | 1モジュール1責務に近く、公開 API は `src/index.ts` から維持できる |
| Domain/Application/Adapter の深いディレクトリ構造を新設する | 不採用 | 小規模なインメモリライブラリに対して過剰。外部 adapter やフレームワーク境界がない |
| 検証ロジックを createTask / updateTask に個別実装する | 不採用 | README の「検証ロジックは一箇所に集約」に反する |
| 正規化 helper を `service.ts` 内 private 関数として置く | 採用 | 公開不要で、TaskService のユースケース実装に閉じる責務 |
| 追加の公開 factory や default clock/idGenerator を提供する | 不採用 | 要求外の API 追加であり、時刻・ID 注入の明示性も落ちる |
| Legacy status や旧入力形式を許容する | 不採用 | 後方互換対応の明示要求がない |

### 実装アプローチ
1. `src/task-record.ts` を追加し、内部用の `cloneTaskRecord(task: TaskRecord): TaskRecord` を実装する。
   - `tags` は新しい配列にする。
   - `createdAt` / `updatedAt` / `dueDate` は `new Date(existing.getTime())` で複製する。
   - この `new Date(...)` は現在時刻取得ではなく defensive copy 目的に限定する。

2. `src/repository.ts` を追加し、`InMemoryTaskRepository implements TaskRepository` を実装する。
   - 内部状態は `Map<string, TaskRecord>`。
   - `save` は `this.tasks.set(task.id, cloneTaskRecord(task))`。
   - `findById` は存在しなければ `undefined`、存在すれば clone を返す。
   - `delete` は `Map.delete` の boolean を返す。
   - `all` は `Array.from(this.tasks.values()).map(cloneTaskRecord)` とし、Map の挿入順を利用する。

3. `src/service.ts` を追加し、`TaskService` を実装する。
   - constructor は既存の `(repo, clock, idGenerator)` を維持する。
   - private helper として以下を置く。
     - `normalizeTitle`
     - `normalizeDescription`
     - `normalizeAssignee`
     - `normalizeTags`
     - `validateDueDate`
     - `normalizeCreateInput`
     - `normalizeUpdateInput`
     - `assertActiveForMutation`
     - `getExistingTask`
     - `isAllowedTransition`
     - `compareTasks`
   - `normalizeCreateInput` と `normalizeUpdateInput` で title/description/tags/dueDate の共通検証を集約する。
   - `clock.now()` は各変更操作で一度取得し、検証と `updatedAt` に同じ基準時刻を使う。

4. `createTask` を実装する。
   - `now = clock.now()`。
   - 入力を正規化する。
   - `id = idGenerator.next()`。
   - `status = 'todo'`, `createdAt = now`, `updatedAt = now`。
   - `repo.save(task)` 後、Repository 内部と参照共有しない `TaskRecord` を返す。

5. `getTask` を実装する。
   - `repo.findById(id)` を呼ぶ。
   - `undefined` なら `NotFoundError`。
   - 見つかった task を返す。Repository が clone を返すため内部共有しない。

6. `updateTask` を実装する。
   - 先に対象を取得し、なければ `NotFoundError`。
   - `todo` / `in_progress` 以外なら `InvalidTransitionError`。
   - `now = clock.now()`。
   - title/description/priority/tags/dueDate のうち指定された値だけ更新する。
   - `id` / `status` / `createdAt` は既存値を保持する。
   - `updatedAt = now`。
   - `dueDate: null` は `undefined` に変換し、`dueDate: undefined` は既存値を保持する。

7. `changeStatus` を実装する。
   - 先に対象を取得し、なければ `NotFoundError`。
   - 許可遷移だけを通す。
   - 同一状態、`todo→done`、`done` / `cancelled` からの遷移は `InvalidTransitionError`。
   - 成功時は `status = next`, `updatedAt = clock.now()`。

8. `assign` / `unassign` を実装する。
   - 先に対象を取得し、なければ `NotFoundError`。
   - `todo` / `in_progress` 以外なら `InvalidTransitionError`。
   - `assign` は assignee を trim し、空なら `ValidationError`。
   - `unassign` は `assignee = undefined`。
   - 成功時は `updatedAt = clock.now()`。

9. `listTasks` を実装する。
   - `repo.all()` から開始する。
   - `status`, `assignee`, `tag`, `overdueAsOf` を AND で適用する。
   - `tag` filter は trim・小文字化して比較する。
   - `overdueAsOf` は `dueDate !== undefined`, `dueDate < overdueAsOf`, `status` が `todo` / `in_progress` を満たすものだけ通す。
   - sort は priority rank、dueDate、createdAt、id の順に比較する。
   - 返却値は Repository 由来の clone であり、内部状態と共有しない。

10. `src/index.ts` を公開入口として更新する。
   - `export * from './types.js';`
   - `export { InMemoryTaskRepository } from './repository.js';`
   - `export { TaskService } from './service.js';`
   - 既存の未実装 class 定義は削除する。

11. テストを補強する。
   - 既存テストを壊さず、README 未検証箇所を追加する。
   - テストは `src/index.ts` と `src/types.ts` から import する既存方針を維持する。

12. 検証する。
   - `npm test`
   - `npm run typecheck`

現時点で `npm test` と `npm run typecheck` は実行したが、環境に `vitest` / `tsc` がなく `command not found` で失敗した。`package.json` には `vitest` と `typescript` の devDependencies、および `test` / `typecheck` scripts は定義済みである。

### 到達経路・起動条件（利用者向け機能の追加/変更がある場合）
| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `src/index.ts` から `InMemoryTaskRepository` / `TaskService` を import する |
| 更新が必要な呼び出し元・配線 | `src/index.ts` の re-export。既存テストは `../src/index.js` から import しているため、この入口を維持する |
| 起動条件 | 認証・権限・URL・feature flag は存在しない。利用者が `new TaskService(repo, clock, idGenerator)` で依存を注入してメソッドを呼ぶ |
| 未対応項目 | なし |

## 実装ガイドライン（設計が必要な場合のみ）
- `src/types.ts` は変更しない。公開型・公開エラーは既存定義を使う。
- `TaskService` の public method signature は現在の `src/index.ts` にあるものを維持する。
- `src/index.ts` は公開入口に徹し、実装詳細 helper を公開しない。
- `TaskService` に永続状態を持たせない。Repository、Clock、IdGenerator 以外の mutable field を追加しない。
- Repository の内部状態は `Map<string, TaskRecord>` に限定する。
- Repository は `TaskRecord` を保存・返却するすべての境界で clone する。
- `TaskRecord` の clone では `tags` と `Date` を必ず複製する。
- `clock.now()` の戻り値は mutable な `Date` のため、TaskRecord に入れる際は clone 方針を統一する。
- `Date.now()`、現在時刻取得目的の zero-arg `new Date()`、`Math.random()` は実装に入れない。
- `new Date(existing.getTime())` は Date clone helper に閉じ込める。
- create/update 共通の validation は helper に集約する。title/tags/dueDate の同じ判定を public method 内に重複させない。
- title は trim 後に空、または 201 文字以上なら `ValidationError`。200 文字は許可する。
- description は指定時に trim、未指定時は空文字列。update では未指定なら既存値保持。
- priority は create 未指定時 `medium`。update では未指定なら既存値保持。
- assignee は create/assign で指定された場合のみ trim し、空なら `ValidationError`。updateTask では `UpdateTaskInput` に存在しないため扱わない。
- tags は trim、小文字化、空除去、重複除去、順序保持を行う。重複判定は正規化後の文字列で行う。
- dueDate は `clock.now()` より過去なら `ValidationError`。同時刻は許可する。
- updateTask では対象取得を先に行い、存在しなければ `NotFoundError` を優先する。
- updateTask / assign / unassign は状態制約を検証し、`done` / `cancelled` なら `InvalidTransitionError`。
- changeStatus は許可遷移を明示的に判定する。要求外の遷移や同一状態遷移を許可しない。
- listTasks の sort comparator は priority → dueDate → createdAt → id の順で、README の並び順と同じ粒度にする。
- `assignee` filter は README に trim 指定がないため完全一致のみとする。
- `tag` filter は README に指定があるため trim・小文字化して比較する。
- `overdueAsOf` は `dueDate < overdueAsOf` であり、同時刻は期限切れにしない。
- 例外は `ValidationError` / `NotFoundError` / `InvalidTransitionError` を使い、汎用 `Error` で代用しない。
- 後方互換用の旧 status、別名 priority、追加 input 形式は実装しない。
- default clock、default idGenerator、factory function などの追加公開 API は実装しない。
- フレームワーク、DB、ファイル永続化、外部 API 呼び出し、キャッシュは追加しない。
- 参照すべき既存実装パターンは、テストの import 経路として `tests/helpers.ts` が `InMemoryTaskRepository` と `TaskService` を `../src/index.js` から import している点である。この入口を壊さない。
- 変更の影響範囲は `src/index.ts` の公開配線、内部実装モジュール、既存テストと追加テストに限定する。
- 新しい constructor parameter や public method parameter は追加しないため、呼び出し元の配線追加は不要。

## スコープ外（項目がある場合のみ）
| 項目 | 除外理由 |
|------|---------|
| `src/types.ts` の型追加・型変更 | 公開契約として変更禁止 |
| README の修正 | 実装仕様の Source of Truth であり、今回の要求は実装 |
| package / tsconfig / vitest 設定変更 | 現行設定に必要 script と devDependencies が存在する |
| DB 永続化 | インメモリ完結が明示要求 |
| HTTP API / Controller | フレームワーク非依存ライブラリが明示要求 |
| 認証・認可 | 要求に存在しない |
| 後方互換コード | 明示要求がないため禁止 |
| 追加公開 API | `src/types.ts` と README に定義された公開 API の範囲外 |
| キャッシュ・検索インデックス | 要求に存在せず、インメモリ Repository と listTasks で十分 |

## 確認事項（あれば）
なし。