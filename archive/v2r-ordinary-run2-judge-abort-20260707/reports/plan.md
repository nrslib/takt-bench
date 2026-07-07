# タスク計画

## 元の要求
タスク管理機能で利用するサービス層を実装してください。

仕様は README.md に記載されています。公開 API は src/types.ts の型定義に準拠し、利用者が src/index.ts から import できる形にしてください。

フレームワークには依存せず、インメモリで完結するライブラリとして実装してください。アーキテクチャ上の制約は README.md の「アーキテクチャ要件」に従ってください。

## 分析結果

### 目的
`README.md` の仕様に従い、`src/types.ts` の公開契約を変更せず、`src/index.ts` から利用できるインメモリ完結の `InMemoryTaskRepository` と `TaskService` を実装する。現状の `src/index.ts` は公開クラスとメソッドシグネチャだけがあり、全メソッドが `throw new Error('Not implemented')` の未実装状態である。

### 分解した要件
| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | `InMemoryTaskRepository` を `TaskRepository` ポート実装として公開する | 明示 | README.md の「実装するもの」 |
| 2 | `InMemoryTaskRepository.save` は upsert として動作する | 明示 | 同じ `id` は上書き |
| 3 | `InMemoryTaskRepository.save` は保存時に防御的コピーを取る | 明示 | 呼び出し側の後続 mutation を内部状態へ反映しない |
| 4 | `InMemoryTaskRepository.findById` は存在しない `id` で `undefined` を返す | 明示 | `TaskRepository` 契約に準拠 |
| 5 | `InMemoryTaskRepository.findById` は防御的コピーを返す | 明示 | `tags` 配列と `Date` の参照共有を避ける |
| 6 | `InMemoryTaskRepository.all` は保存順で全件を返す | 明示 | 挿入順保持が必要 |
| 7 | `InMemoryTaskRepository.all` は防御的コピーを返す | 明示 | 返り値の mutation を内部状態へ反映しない |
| 8 | `InMemoryTaskRepository.delete` は削除できたかを boolean で返す | 明示 | `true` / `false` |
| 9 | `TaskService` を `(repo, clock, idGenerator)` 注入で公開する | 明示 | `src/index.ts` の constructor 署名は既に存在 |
| 10 | `createTask` は入力を検証・正規化する | 明示 | `title`、`description`、`priority`、`assignee`、`tags`、`dueDate` |
| 11 | `createTask` は `idGenerator.next()` から `id` を取得する | 明示 | `Math.random()` 等は禁止 |
| 12 | `createTask` は `status = 'todo'` で作成する | 明示 | 初期状態 |
| 13 | `createTask` は `createdAt` と `updatedAt` に `clock.now()` を使う | 明示 | 直接時刻取得は禁止 |
| 14 | `createTask` は保存したタスクを返す | 明示 | 返却値も内部状態と参照共有しない |
| 15 | `getTask` は存在しない `id` で `NotFoundError` を投げる | 明示 | README.md の規則 |
| 16 | `updateTask` は存在しない `id` で `NotFoundError` を投げる | 明示 | 変更操作共通 |
| 17 | `updateTask` は対象が `todo` / `in_progress` 以外なら `InvalidTransitionError` を投げる | 明示 | `done` / `cancelled` は更新不可 |
| 18 | `updateTask` は入力された項目のみ検証・正規化して更新する | 明示 | `undefined` は変更なし |
| 19 | `updateTask` は `dueDate: Date` で更新する | 明示 | 過去日時は `ValidationError` |
| 20 | `updateTask` は `dueDate: null` で期限を解除する | 明示 | `dueDate` を `undefined` にする |
| 21 | `updateTask` は `dueDate: undefined` で期限を変更しない | 明示 | 未指定扱い |
| 22 | `updateTask` は `id` / `status` / `createdAt` を変更しない | 明示 | 既存値を保持 |
| 23 | `updateTask` は `updatedAt` を `clock.now()` に更新する | 明示 | 変更操作共通 |
| 24 | `changeStatus` は許可された 5 遷移だけを通す | 明示 | `todo → in_progress`、`todo → cancelled`、`in_progress → done`、`in_progress → todo`、`in_progress → cancelled` |
| 25 | `changeStatus` は同一状態への遷移を `InvalidTransitionError` にする | 明示 | 許可リスト外 |
| 26 | `changeStatus` は `done` / `cancelled` からの遷移を `InvalidTransitionError` にする | 明示 | 許可リスト外 |
| 27 | `changeStatus` は存在しない `id` で `NotFoundError` を投げる | 明示 | 変更操作共通 |
| 28 | `changeStatus` は `updatedAt` を `clock.now()` に更新する | 明示 | 変更操作共通 |
| 29 | `assign` は存在しない `id` で `NotFoundError` を投げる | 明示 | 変更操作共通 |
| 30 | `assign` は対象が `todo` / `in_progress` 以外なら `InvalidTransitionError` を投げる | 明示 | README.md の規則 |
| 31 | `assign` は `assignee` を trim して保存する | 明示 | 空文字は不可 |
| 32 | `assign` は trim 後空なら `ValidationError` を投げる | 明示 | README.md のバリデーション |
| 33 | `assign` は `updatedAt` を `clock.now()` に更新する | 明示 | 変更操作共通 |
| 34 | `unassign` は存在しない `id` で `NotFoundError` を投げる | 明示 | 変更操作共通 |
| 35 | `unassign` は対象が `todo` / `in_progress` 以外なら `InvalidTransitionError` を投げる | 明示 | `assign` / `unassign` 共通 |
| 36 | `unassign` は `assignee` を `undefined` にする | 明示 | 担当者解除 |
| 37 | `unassign` は `updatedAt` を `clock.now()` に更新する | 明示 | 変更操作共通 |
| 38 | `listTasks` は `status` 完全一致で絞り込む | 明示 | filter 条件 |
| 39 | `listTasks` は `assignee` 完全一致で絞り込む | 明示 | filter 条件 |
| 40 | `listTasks` は `tag` を trim・小文字化して比較する | 明示 | 正規化済みタグとの完全一致 |
| 41 | `listTasks` は `overdueAsOf` 指定時、期限切れかつ active なタスクだけを返す | 明示 | `dueDate < overdueAsOf` かつ `todo` / `in_progress` |
| 42 | `listTasks` は複数条件を AND で適用する | 明示 | filter 条件 |
| 43 | `listTasks` は priority の順に並べる | 明示 | `high → medium → low` |
| 44 | `listTasks` は同 priority では dueDate 昇順に並べる | 明示 | 未設定は最後 |
| 45 | `listTasks` は同 dueDate では createdAt 昇順に並べる | 明示 | README.md の並び順 |
| 46 | `listTasks` は同 createdAt では id 昇順に並べる | 明示 | README.md の並び順 |
| 47 | 検証ロジックは create / update で重複実装しない | 明示 | アーキテクチャ要件 |
| 48 | サービスは永続状態を持たない | 明示 | 永続状態は repository のみ |
| 49 | サービス・リポジトリ内で `Date.now()` / `new Date()` / `Math.random()` を直接使わない | 明示 | README.md のアーキテクチャ要件。ただし防御的コピーで `new Date(existing.getTime())` を使う必要はある |
| 50 | サービスが返すタスクは repository 内部と参照共有しない | 明示 | repository の防御的コピーで満たす |
| 51 | 利用者は `src/index.ts` と `src/types.ts` だけを import して使える | 明示 | `src/index.ts` から公開 API を export する |
| 52 | フレームワークに依存しない | 明示 | 外部 framework / DB / HTTP 依存を追加しない |
| 53 | インメモリで完結する | 明示 | repository 内部の `Map` 等だけで保持する |
| 54 | `src/types.ts` の公開型・エラーは変更しない | 暗黙 | 「公開 API は src/types.ts の型定義に準拠」およびファイルコメント「変更禁止」から直接導出 |

### 参照資料の調査結果
参照資料として `README.md` と `src/types.ts` を確認した。

`README.md` には、実装対象 API、バリデーション、サービス規則、検索規則、repository セマンティクス、アーキテクチャ要件が記載されている。特に `src/index.ts` から `InMemoryTaskRepository` と `TaskService` を公開し、利用者は `src/index.ts` と `src/types.ts` だけを import する、という入口条件が明記されている。

`src/types.ts` には、変更禁止の公開契約として `TaskStatus`、`Priority`、`TaskRecord`、`CreateTaskInput`、`UpdateTaskInput`、`TaskFilter`、`Clock`、`IdGenerator`、`TaskRepository`、`ValidationError`、`NotFoundError`、`InvalidTransitionError` が定義済みである。実装はこの型に合わせる必要があり、型定義自体の変更は不要。

現在の `src/index.ts` には、`export * from './types.js'`、`InMemoryTaskRepository`、`TaskService` の公開シグネチャが既にある。ただし、`InMemoryTaskRepository` の 4 メソッドと `TaskService` の 7 メソッドはすべて `throw new Error('Not implemented')` で未実装である。

既存テストは `tests/repository.test.ts`、`tests/create-task.test.ts`、`tests/update-transitions.test.ts`、`tests/query.test.ts` に分かれており、README の主要仕様を検証している。`tests/helpers.ts` では `FixedClock`、`SeqIds`、`makeService` が定義され、`new TaskService(repo, clock, new SeqIds())` で利用する前提になっている。

Knowledge / Policy については、プロンプトで渡されたバックエンド Knowledge を確認した。依存方向、フレームワーク非依存、状態遷移やビジネスルールを適切な層に置く方針が今回の README のアーキテクチャ要件と整合する。なお、coding skill の追加参照先 `/Users/m_naruse/work/git/takt/builtins/ja/...` はこの環境では存在せず、読み込みできなかった。

### スコープ
影響範囲は原則として `src/index.ts` のみ。

変更対象:
- `src/index.ts`
  - `InMemoryTaskRepository` の実装
  - `TaskService` の実装
  - 同ファイル内の private helper / 定数の追加

変更不要:
- `src/types.ts`
  - 公開契約であり変更禁止。既に必要な型とエラーが定義済み。
- `README.md`
  - 仕様のソースであり変更不要。
- `tests/*`
  - 既に README の主要仕様を検証している。write_tests ステップでは不足がないか確認する余地はあるが、本タスクの実装計画として既存テスト変更は必須ではない。
- package / tsconfig / vitest 設定
  - 実装に必要な設定変更は確認されていない。

### 検討したアプローチ
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| `src/index.ts` に実装を集約する | 採用 | 既に公開シグネチャが存在し、README も内部モジュール分割は任意としている。実装後も 1 ファイル 200-400 行目安に収まる見込みで、公開入口も単純に保てる。 |
| `repository.ts` / `service.ts` / `validation.ts` に分割し `index.ts` から re-export する | 不採用 | 現在のコードベースは `src/index.ts` と `src/types.ts` のみで小さい。今回の要件では分割による利益よりファイル増加の方が大きい。 |
| `TaskRecord` を class 化してドメインモデルを追加する | 不採用 | `src/types.ts` の公開契約は interface ベースで定義済み。class 追加は仕様外の抽象化であり不要。 |
| repository に `Map<string, TaskRecord>` を持たせる | 採用 | インメモリ完結、upsert、挿入順保持に合う。JavaScript の `Map` は既存キー更新時に挿入順を維持する。 |
| service 内に配列や Map を持たせる | 不採用 | README の「サービスは状態を持たない。永続状態はリポジトリだけが持つ」に反する。 |

### 実装アプローチ
`src/index.ts` の既存公開シグネチャを維持し、内部 helper を追加して実装する。

1. import を整理する
   - `ValidationError`、`NotFoundError`、`InvalidTransitionError` を runtime import する。
   - `TaskRecord` 等の型は type import のままでよい。
   - `export * from './types.js'` は維持する。

2. 防御的コピー helper を実装する
   - `cloneTask(task: TaskRecord): TaskRecord`
   - `tags` は `[...]` でコピーする。
   - `createdAt`、`updatedAt`、`dueDate` は既存 `Date` の `getTime()` からコピーする。
   - これは外部入力や repository 内部状態との参照共有を断つためのもの。
   - README の直接 `new Date()` 禁止は「時刻取得」の禁止が主旨であり、既存 `Date` の防御的コピーは内部状態保護に必要。ただし Coder は `Date.now()` や引数なし `new Date()` を使わないこと。

3. `InMemoryTaskRepository` を実装する
   - private `tasks = new Map<string, TaskRecord>()` を持つ。
   - `save(task)` は `this.tasks.set(task.id, cloneTask(task))`。
   - `findById(id)` は存在しなければ `undefined`、存在すれば `cloneTask(task)`。
   - `delete(id)` は `this.tasks.delete(id)`。
   - `all()` は `Array.from(this.tasks.values(), cloneTask)` で保存順のコピーを返す。

4. バリデーション・正規化 helper を実装する
   - `normalizeTitle(title: string): string`
     - trim 後空なら `ValidationError`
     - 200 文字超なら `ValidationError`
   - `normalizeDescription(description: string | undefined): string`
     - undefined は `''`
     - 指定時は trim
   - `normalizeAssignee(assignee: string): string`
     - trim 後空なら `ValidationError`
   - `normalizeOptionalAssignee(assignee: string | undefined): string | undefined`
     - undefined は undefined
     - 指定時は `normalizeAssignee`
   - `normalizeTags(tags: string[] | undefined): string[]`
     - undefined は `[]`
     - 各要素を trim、小文字化
     - 空要素は除去
     - 重複は最初だけ残し、順序保持
   - `validateDueDate(dueDate: Date | undefined, now: Date): Date | undefined`
     - undefined は undefined
     - `dueDate.getTime() < now.getTime()` なら `ValidationError`
     - 許可時は防御的コピーした Date を返す
   - update 用には、指定された項目だけを扱う。特に `description?: string` と `tags?: string[]` は undefined の場合に既存値を維持する。

5. active 状態判定 helper を実装する
   - `isActive(status)` は `todo` / `in_progress`。
   - `assertActiveForMutation(task)` は active でなければ `InvalidTransitionError`。
   - `getExistingTask(id)` は `repo.findById(id)` し、なければ `NotFoundError`。

6. `TaskService.createTask` を実装する
   - `const now = this.clock.now()` を 1 回取得する。
   - 入力を正規化する。
   - `id = this.idGenerator.next()`、`status = 'todo'`、`createdAt = updatedAt = now`。
   - `repo.save(task)` 後、`repo.findById(id)` または `cloneTask(task)` 相当を返す。
   - repository がコピーを返すため、`getExistingTask(id)` で取得して返すと参照共有を避けやすい。

7. `TaskService.getTask` を実装する
   - `repo.findById(id)` を返す。
   - undefined なら `NotFoundError`。

8. `TaskService.updateTask` を実装する
   - `getExistingTask(id)`。
   - active 状態チェック。
   - `const now = this.clock.now()` を取得する。
   - `input.title !== undefined` の場合だけ title を正規化して更新。
   - `input.description !== undefined` の場合だけ description を trim して更新。
   - `input.priority !== undefined` の場合だけ priority を更新。
   - `input.tags !== undefined` の場合だけ tags を正規化して更新。
   - `input.dueDate === null` なら `dueDate = undefined`。
   - `input.dueDate instanceof Date` 相当なら過去判定して更新。
   - `input.dueDate === undefined` なら existing の dueDate を維持。
   - `id`、`status`、`createdAt` は existing を保持。
   - `updatedAt = now`。
   - 保存後のコピーを返す。

9. `TaskService.changeStatus` を実装する
   - `getExistingTask(id)`。
   - 許可遷移を `Record<TaskStatus, readonly TaskStatus[]>` 等で定義する。
   - `allowedTransitions[current].includes(next)` で判定し、不可なら `InvalidTransitionError`。
   - `updatedAt = this.clock.now()`。
   - 保存後のコピーを返す。

10. `TaskService.assign` / `unassign` を実装する
    - `getExistingTask(id)`。
    - active 状態チェック。
    - `assign` は `normalizeAssignee`。
    - `unassign` は `assignee = undefined`。
    - `updatedAt = this.clock.now()`。
    - 保存後のコピーを返す。

11. `TaskService.listTasks` を実装する
    - `let tasks = this.repo.all()` でコピー済みの配列を取得する。
    - filter がある場合だけ条件を順に適用する。
    - `tag` filter は `filter.tag.trim().toLowerCase()` に正規化する。空文字の場合は、正規化済みタグに空タグは存在しないため自然に一致なしとなる。
    - overdue は `task.dueDate !== undefined && task.dueDate.getTime() < overdueAsOf.getTime() && isActive(task.status)`。
    - sort は以下の順:
      1. priority rank: `high = 0`, `medium = 1`, `low = 2`
      2. dueDate: あり同士は昇順、なしは最後
      3. createdAt 昇順
      4. id 昇順
    - `repo.all()` がコピーを返す前提だが、sort 後も個々の task はコピーなので追加 clone は必須ではない。ただし service 返却値の参照共有をより明確にするなら、最後に `tasks.map(cloneTask)` としてもよい。

12. エラーメッセージ
    - テストはエラー型を主に検証しているため、メッセージは簡潔でよい。
    - 例: `Task not found: ${id}`、`Title is required`、`Invalid status transition: ${current} -> ${next}`。

13. 検証
    - 実装後に `npm test` と `npm run typecheck` を実行する。
    - 今回の plan 実行時点では `vitest` と `tsc` が見つからず、どちらも実行不能だった。依存関係が導入された環境で再実行が必要。

### 到達経路・起動条件（利用者向け機能の追加/変更がある場合）
| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | ライブラリ利用者が `src/index.ts` から `InMemoryTaskRepository`、`TaskService`、および `src/types.ts` 由来の型・エラーを import する |
| 更新が必要な呼び出し元・配線 | `src/index.ts` の既存クラス実装のみ。公開シグネチャと `export * from './types.js'` は維持 |
| 起動条件 | フレームワーク、認証、権限、URL、feature flag なし。利用者が `new InMemoryTaskRepository()` と `new TaskService(repo, clock, idGenerator)` を作成して呼び出す |
| 未対応項目 | なし |

## 実装ガイドライン（設計が必要な場合のみ）
- `src/types.ts` は変更しない。公開契約は既に定義済みで、実装はこの型に合わせる。
- `src/index.ts` の公開クラス名、constructor、メソッド名、引数、返り値型を変更しない。
- 同種の実装パターンは既存ソースには存在しない。参照すべき既存パターンは、`tests/helpers.ts` の `makeService` が示す `new TaskService(repo, clock, new SeqIds())` の利用形、および各テストが示す期待動作。
- repository の永続状態は `InMemoryTaskRepository` の private `Map` のみに置く。`TaskService` に永続状態を追加しない。
- `Date.now()`、引数なし `new Date()`、`Math.random()` を service / repository 内で使わない。時刻取得は `clock.now()`、ID 取得は `idGenerator.next()` に限定する。
- 防御的コピーのために既存 `Date` から `new Date(existing.getTime())` を作ることは必要。これは「現在時刻の直接取得」ではなく参照共有を避ける処理として扱う。
- `tags` 配列、`Date` オブジェクト、`TaskRecord` オブジェクトは repository 境界で必ずコピーする。
- create / update のバリデーションは helper に集約し、同じ title / tags / dueDate ルールを重複実装しない。
- `description` の扱いに注意する。create では未指定を空文字にするが、update では未指定なら既存値を維持する。
- `dueDate` の扱いに注意する。update では `Date`、`null`、`undefined` の 3 ケースを区別する。
- NotFound 判定と InvalidTransition 判定の順序は、まず対象取得、存在しなければ `NotFoundError`、存在すれば状態チェックにする。
- `changeStatus` は許可リスト方式にし、同一状態や終端状態からの遷移を個別の例外条件で散らさない。
- `listTasks` の sort は comparator を明示し、README の順序をそのまま実装する。
- 新しいパラメータ追加は不要。配線対象は既存 `TaskService` constructor の `repo`、`clock`、`idGenerator` のみ。
- フレームワーク、DB、HTTP、外部 API 依存は追加しない。
- 後方互換用の別名 API、deprecated API、未使用 helper は追加しない。

## スコープ外（項目がある場合のみ）
| 項目 | 除外理由 |
|------|---------|
| `src/types.ts` の型追加・変更 | 公開契約は変更禁止であり、既に必要な型が定義済み |
| REST Controller / HTTP API | README はフレームワーク非依存のライブラリ実装を要求している |
| 永続 DB 対応 | README はインメモリ完結を要求している |
| 認証・認可 | 要求に含まれておらず、ライブラリ層の責務ではない |
| package 設定変更 | 現在の実装要件に不要 |
| git commit / push | ワークフロー規則で禁止 |

## 確認事項（あれば）
なし。