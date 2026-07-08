# タスク計画

## 元の要求
タスク管理機能で利用するサービス層を実装してください。

仕様は README.md に記載されています。公開 API は src/types.ts の型定義に準拠し、利用者が src/index.ts から import できる形にしてください。

フレームワークには依存せず、インメモリで完結するライブラリとして実装してください。アーキテクチャ上の制約は README.md の「アーキテクチャ要件」に従ってください。

## 分析結果

### 目的
`README.md` の仕様と `src/types.ts` の公開契約に従い、タスク管理サービス層として `InMemoryTaskRepository` と `TaskService` を実装する。利用者は `src/index.ts` と `src/types.ts` だけを import して利用できる状態にする。

### 分解した要件
| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | `InMemoryTaskRepository` を実装する | 明示 | `TaskRepository` ポート実装 |
| 2 | `TaskService` を実装する | 明示 | 生成・取得・更新・状態遷移・担当者・検索 |
| 3 | 公開 API は `src/types.ts` に準拠する | 明示 | `src/types.ts` は変更禁止 |
| 4 | 利用者が `src/index.ts` から import できる | 明示 | 既存の公開クラス定義を実装する |
| 5 | フレームワークに依存しない | 明示 | HTTP、DB、DI フレームワークは導入しない |
| 6 | インメモリで完結する | 明示 | 永続状態はリポジトリ内部だけに持つ |
| 7 | `save` は upsert とする | 明示 | 同一 id は上書き |
| 8 | repository は保存時に防御的コピーする | 明示 | 呼び出し側の後続変更を遮断 |
| 9 | repository は返却時に防御的コピーする | 明示 | `tags` 配列と `Date` を含む |
| 10 | `delete` は削除有無を boolean で返す | 明示 | `TaskRepository` 契約に準拠 |
| 11 | `all` は保存順で返す | 明示 | `Map` の挿入順を利用可能 |
| 12 | `TaskService` は `(repo, clock, idGenerator)` を注入して使う | 明示 | 既存 constructor と一致 |
| 13 | サービスは永続状態を持たない | 明示 | 状態は repository のみ |
| 14 | 時刻は `clock.now()` から取得する | 明示 | `Date.now()` を使わない |
| 15 | ID は `idGenerator.next()` から取得する | 明示 | `Math.random()` を使わない |
| 16 | create/update 共通の入力検証を一箇所に集約する | 明示 | README のアーキテクチャ要件 |
| 17 | `title` は trim 後に空なら `ValidationError` | 明示 | create/update 共通 |
| 18 | `title` は trim 後 200 文字超なら `ValidationError` | 明示 | 200 文字ちょうどは許可 |
| 19 | `description` は trim して保存する | 明示 | 未指定は空文字列 |
| 20 | `priority` 未指定時は `medium` とする | 明示 | create 時 |
| 21 | `assignee` は指定時に trim し空なら `ValidationError` | 明示 | create/assign |
| 22 | `tags` は trim・小文字化・空除去・重複除去する | 明示 | 最初の出現順を保持 |
| 23 | `dueDate` が `clock.now()` より過去なら `ValidationError` | 明示 | 現在時刻ちょうどは許可 |
| 24 | `createTask` は `todo`、生成時刻、更新時刻を設定して保存する | 明示 | `createdAt = updatedAt = clock.now()` |
| 25 | `getTask` は存在しなければ `NotFoundError` | 明示 | 既存 error 型を使う |
| 26 | `updateTask` は `todo` / `in_progress` のみ許可する | 明示 | その他は `InvalidTransitionError` |
| 27 | `updateTask` は `id` / `status` / `createdAt` を変更しない | 明示 | README 仕様 |
| 28 | `updateTask` は `updatedAt` を更新する | 明示 | `clock.now()` |
| 29 | `dueDate: Date` は期限更新 | 明示 | update 時 |
| 30 | `dueDate: null` は期限解除 | 明示 | `undefined` 保存 |
| 31 | `dueDate: undefined` は変更なし | 明示 | update 時 |
| 32 | `changeStatus` は許可された 5 遷移のみ通す | 明示 | `todo→in_progress`, `todo→cancelled`, `in_progress→done`, `in_progress→todo`, `in_progress→cancelled` |
| 33 | 同一状態遷移は `InvalidTransitionError` | 明示 | 許可遷移に含めない |
| 34 | `done` / `cancelled` からの遷移は `InvalidTransitionError` | 明示 | 終端状態 |
| 35 | `assign` / `unassign` は `todo` / `in_progress` のみ許可する | 明示 | その他は `InvalidTransitionError` |
| 36 | 変更操作はすべて `updatedAt` を更新する | 明示 | update/changeStatus/assign/unassign |
| 37 | 存在しない id への操作は `NotFoundError` | 明示 | get/update/changeStatus/assign/unassign |
| 38 | `listTasks` は `status` 完全一致で絞り込む | 明示 | filter 指定時 |
| 39 | `listTasks` は `assignee` 完全一致で絞り込む | 明示 | filter 指定時 |
| 40 | `listTasks` は `tag` を正規化して完全一致で絞り込む | 明示 | trim・小文字化 |
| 41 | `listTasks` は `overdueAsOf` で期限切れ active task のみ返す | 明示 | `todo` / `in_progress` かつ `dueDate < overdueAsOf` |
| 42 | 複数 filter 条件は AND とする | 明示 | README 仕様 |
| 43 | 並び順は priority → dueDate → createdAt → id とする | 明示 | priority は high → medium → low |
| 44 | サービスが返す task は repository 内部と参照共有しない | 明示 | 防御的コピーで担保 |
| 45 | 既存テストと型チェックで検証する | 暗黙 | README の開発コマンドと公開契約準拠から直接導出 |

### 参照資料の調査結果
- `README.md`
  - 実装対象は `InMemoryTaskRepository` と `TaskService`。
  - `InMemoryTaskRepository` は `TaskRepository` ポートのインメモリ実装で、防御的コピーが必須。
  - `TaskService` は注入された `repo`, `clock`, `idGenerator` で動作し、状態を持たない。
  - `Date.now()` / 時刻取得目的の `new Date()` / `Math.random()` の直接利用は禁止。
  - 検証ロジックは create/update で重複させない。
- `src/types.ts`
  - 公開型・エラー型が定義済み。
  - 先頭コメントで公開契約は変更禁止と明記されている。
  - `TaskRecord`, `CreateTaskInput`, `UpdateTaskInput`, `TaskFilter`, `Clock`, `IdGenerator`, `TaskRepository` に従う必要がある。
- `src/index.ts`
  - `export * from './types.js'` は既に存在する。
  - `InMemoryTaskRepository` と `TaskService` の公開クラス、constructor、メソッドシグネチャは存在する。
  - すべてのメソッドが `throw new Error('Not implemented')` の状態。
- `tests/*`
  - repository、create、update、transition、assign、query の既存テストが README 仕様を具体的に検証している。
  - `tests/helpers.ts` は利用者が `src/index.ts` から `InMemoryTaskRepository` / `TaskService` を import する前提を示している。
- 現在の実装との差異
  - 公開シグネチャは存在するが、実装本体がない。
  - `src/types.ts` は仕様通りで変更不要。
  - `src/index.ts` の re-export は仕様通りで変更不要だが、公開クラスの中身は実装が必要。
- 外部実装の参照
  - 今回の参照資料に外部実装は指定されていないため、外部実装の採用判断は不要。

### スコープ
- 変更対象:
  - `src/index.ts`
- 変更しない対象:
  - `src/types.ts`
  - `README.md`
  - `package.json`
  - `tsconfig.json`
  - 既存テストファイル
- 影響範囲:
  - `InMemoryTaskRepository`
  - `TaskService`
  - `src/index.ts` からの公開 import 経路
  - 既存テスト全体

### 検討したアプローチ
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| `src/index.ts` に実装を集約する | 採用 | 既存ファイルが公開 API の本体として用意されており、想定実装規模も 200〜400 行目安に収まる見込み。新しい public import 経路を増やさずに済む |
| repository / service / validation を別ファイルへ分割し `src/index.ts` から re-export する | 不採用 | README 上は内部分割可能だが、現状 `src` は 2 ファイルのみで、今回の実装では分割しない方が影響範囲が小さい |
| 外部ライブラリを追加して実装する | 不採用 | フレームワーク非依存・インメモリ完結要件に対して不要。`package.json` に実行時依存もない |
| repository に検索・ソート責務を持たせる | 不採用 | repository は永続状態と基本 CRUD に限定し、検索条件・並び順はユースケースである `TaskService.listTasks` に置く方が責務分離に合う |

### 実装アプローチ
1. `src/index.ts` の既存公開クラス・メソッドシグネチャを維持する。
2. 内部 helper として `cloneTask(task: TaskRecord): TaskRecord` を実装する。
   - `tags` は配列コピーする。
   - `createdAt`, `updatedAt`, `dueDate` は `new Date(existing.getTime())` でコピーする。
   - この `new Date` は現在時刻取得ではなく防御的コピー用途。
3. `InMemoryTaskRepository` を `Map<string, TaskRecord>` で実装する。
   - `save` は `set(id, cloneTask(task))`。
   - `findById` は存在時に `cloneTask`。
   - `delete` は `Map.delete` の boolean を返す。
   - `all` は `Array.from(map.values()).map(cloneTask)`。
4. 共通正規化・検証 helper を実装する。
   - `normalizeTitle`
   - `normalizeDescription`
   - `normalizeAssignee`
   - `normalizeTags`
   - `validateDueDate`
   - create/update 共通入力のための組み立て helper
5. `TaskService.createTask` を実装する。
   - `now = clock.now()` を一度取得する。
   - `idGenerator.next()` で id を作る。
   - defaults を適用して `repo.save`。
   - 保存した task を返す。返却値は repository 内部と参照共有しない。
6. `TaskService.getTask` を実装する。
   - `repo.findById` が `undefined` なら `NotFoundError`。
7. `TaskService.updateTask` を実装する。
   - 先に対象 task を取得し、未存在なら `NotFoundError`。
   - status が `todo` / `in_progress` でなければ `InvalidTransitionError`。
   - 指定された項目だけ正規化・検証して更新する。
   - `dueDate` は `Date` / `null` / `undefined` を仕様通りに分岐する。
8. `TaskService.changeStatus` を実装する。
   - 許可遷移セットで判定する。
   - 不許可なら `InvalidTransitionError`。
   - 許可時は `status` と `updatedAt` を更新して保存する。
9. `TaskService.assign` / `unassign` を実装する。
   - active status 判定を update と共有する。
   - `assign` は assignee 正規化・検証を使う。
   - `unassign` は `assignee: undefined` にする。
10. `TaskService.listTasks` を実装する。
   - `repo.all()` を取得する。
   - `status`, `assignee`, `tag`, `overdueAsOf` を AND 条件で適用する。
   - priority rank、dueDate、createdAt、id の順で sort する。
   - 返却前に必要なら `cloneTask` を通し、呼び出し側変更が内部状態に影響しないようにする。
11. 実装後、依存が利用可能な環境で `npm test` と `npm run typecheck` を実行する。

### 到達経路・起動条件
| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `src/index.ts` から `InMemoryTaskRepository` / `TaskService` を import する |
| 更新が必要な呼び出し元・配線 | `src/index.ts` の既存公開クラス本体のみ |
| 起動条件 | 利用者が `new InMemoryTaskRepository()` と `new TaskService(repo, clock, idGenerator)` を生成してメソッドを呼ぶ |
| 未対応項目 | なし |

## 実装ガイドライン
- `src/types.ts` は公開契約なので変更しない。
- `src/index.ts` の public class 名、constructor、method signature は変更しない。
- 同種の実装パターンは現行コード内には存在しない。契約として既存テストを参照する。
  - repository の期待動作: `tests/repository.test.ts`
  - create の期待動作: `tests/create-task.test.ts`
  - update/status の期待動作: `tests/update-transitions.test.ts`
  - assign/list の期待動作: `tests/query.test.ts`
  - import 経路: `tests/helpers.ts`
- `TaskService` に task の永続配列や Map を持たせない。永続状態は `InMemoryTaskRepository` のみ。
- repository と service の返却値は必ず内部状態と参照を共有しない。
- `Date` オブジェクトも mutable なので、防御的コピー対象に含める。
- `tags` 配列も mutable なので、防御的コピー対象に含める。
- create/update の validation を別々に重複実装しない。
- `Date.now()`、時刻取得目的の `new Date()`、`Math.random()` は使わない。
- エラーは `ValidationError`、`NotFoundError`、`InvalidTransitionError` を使う。`throw new Error(...)` は未実装除去後に残さない。
- `listTasks` の sort comparator は README の順序をそのまま実装する。
- `overdueAsOf` は `dueDate < overdueAsOf` であり、同時刻は期限切れにしない。
- `dueDate` 検証は `dueDate < clock.now()` であり、同時刻は許可する。
- `assign` / `unassign` も変更操作なので `updatedAt` を更新する。
- 不存在 id の処理では状態判定や validation より先に `NotFoundError` を返す設計にする。

## スコープ外
| 項目 | 除外理由 |
|------|---------|
| `src/types.ts` の型追加・変更 | 公開契約として変更禁止 |
| HTTP API / Controller / DB 永続化 | フレームワーク非依存・インメモリ完結の要求に反する |
| 外部依存の追加 | 今回の仕様に不要 |
| 後方互換用 alias や deprecated API | 明示要求なし |
| README の更新 | 実装仕様は既に README に記載済み |
| テストファイルの変更 | 現行テストが仕様を網羅しており、今回の plan では実装方針のみ提示 |

## 確認事項
- なし。