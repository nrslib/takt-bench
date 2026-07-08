# タスク計画

## 元の要求
タスク管理機能で利用するサービス層を実装してください。

仕様は README.md に記載されています。公開 API は src/types.ts の型定義に準拠し、利用者が src/index.ts から import できる形にしてください。

フレームワークには依存せず、インメモリで完結するライブラリとして実装してください。アーキテクチャ上の制約は README.md の「アーキテクチャ要件」に従ってください。

## 分析結果

### 目的
README.md の仕様と src/types.ts の公開契約に準拠し、フレームワーク非依存・インメモリ完結のタスク管理サービス層を実装する。利用者は `src/index.ts` と `src/types.ts` だけを import して利用できる状態にする。

### 分解した要件
| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | `InMemoryTaskRepository` を公開 API として実装する | 明示 | README.md:7-13、src/index.ts:19-35 は未実装 |
| 2 | `TaskService` を公開 API として実装する | 明示 | README.md:7-13、src/index.ts:37-70 は未実装 |
| 3 | 利用者が `src/index.ts` から実装クラスを import できる | 明示 | src/index.ts:17 で型は re-export 済み。実装クラスの公開名は維持する |
| 4 | `src/types.ts` の公開契約に準拠する | 明示 | src/types.ts:6-83 に型・エラーが定義済み。変更禁止コメントあり |
| 5 | `TaskRepository` ポートの `save` を upsert として実装する | 明示 | README.md:54-57、src/types.ts:57-62 |
| 6 | `save` 保存時に防御的コピーを取る | 明示 | README.md:56-57、tests/repository.test.ts:44-53 |
| 7 | `findById` は存在しない id に `undefined` を返す | 明示 | src/types.ts:59、tests/repository.test.ts:38-42 |
| 8 | `findById` は防御的コピーを返す | 明示 | README.md:58-59、tests/repository.test.ts:55-64 |
| 9 | `delete` は削除有無を boolean で返す | 明示 | README.md:60、tests/repository.test.ts:75-87 |
| 10 | `all` は保存順で返す | 明示 | README.md:61、tests/repository.test.ts:89-96 |
| 11 | `all` は防御的コピーを返す | 明示 | README.md:58-59、tests/repository.test.ts:66-73 |
| 12 | `createTask` は title を trim し、空なら `ValidationError` | 明示 | README.md:17、tests/create-task.test.ts:28-46 |
| 13 | `createTask` は title が trim 後 200 文字超なら `ValidationError` | 明示 | README.md:17、tests/create-task.test.ts:48-58 |
| 14 | `createTask` は description を trim し、未指定は空文字列にする | 明示 | README.md:18、tests/create-task.test.ts:6-18,28-34 |
| 15 | `createTask` は priority 未指定時に `medium` を保存する | 明示 | README.md:19、tests/create-task.test.ts:6-18 |
| 16 | `createTask` は assignee を trim し、空なら `ValidationError` | 明示 | README.md:20、tests/create-task.test.ts:66-76 |
| 17 | `createTask` は tags を trim、小文字化、空除去、重複除去し、順序を保持する | 明示 | README.md:21、tests/create-task.test.ts:78-86 |
| 18 | `createTask` は過去の dueDate を `ValidationError` にする | 明示 | README.md:22、tests/create-task.test.ts:88-109 |
| 19 | `createTask` は `idGenerator.next()` で id を作る | 明示 | README.md:26-27、tests/create-task.test.ts:6-18、tests/helpers.ts:16-23 |
| 20 | `createTask` は `status = 'todo'` で保存する | 明示 | README.md:26-27、tests/create-task.test.ts:6-18 |
| 21 | `createTask` は `createdAt = updatedAt = clock.now()` で保存する | 明示 | README.md:26-27、tests/create-task.test.ts:6-18、tests/helpers.ts:4-13 |
| 22 | `getTask` は存在しない id に `NotFoundError` を投げる | 明示 | README.md:28。現行テストでは不足 |
| 23 | `updateTask` は存在しない id に `NotFoundError` を投げる | 明示 | README.md:42、tests/update-transitions.test.ts:100-104 |
| 24 | `updateTask` は `todo` / `in_progress` 以外を `InvalidTransitionError` にする | 明示 | README.md:29、tests/update-transitions.test.ts:81-98 |
| 25 | `updateTask` は title / description / priority / tags / dueDate を更新対象にする | 明示 | src/types.ts:32-39、README.md:15-22,29-31 |
| 26 | `updateTask` は `dueDate: Date` で期限更新する | 明示 | README.md:30、tests/update-transitions.test.ts:73-79 |
| 27 | `updateTask` は `dueDate: null` で期限解除する | 明示 | README.md:30、tests/update-transitions.test.ts:55-63 |
| 28 | `updateTask` は `dueDate: undefined` で期限変更なしにする | 明示 | README.md:30、tests/update-transitions.test.ts:65-71 |
| 29 | `updateTask` は id / status / createdAt を変更しない | 明示 | README.md:31、tests/update-transitions.test.ts:8-29 |
| 30 | `updateTask` は updatedAt を `clock.now()` に更新する | 明示 | README.md:31、tests/update-transitions.test.ts:8-19 |
| 31 | `changeStatus` は README 記載の5遷移だけを許可する | 明示 | README.md:32-38、tests/update-transitions.test.ts:107-160 |
| 32 | `changeStatus` は同一状態への遷移を `InvalidTransitionError` にする | 明示 | README.md:32-33、tests/update-transitions.test.ts:137-142 |
| 33 | `changeStatus` は `done` / `cancelled` からの遷移を `InvalidTransitionError` にする | 明示 | README.md:32-33、tests/update-transitions.test.ts:144-160 |
| 34 | `changeStatus` は updatedAt を `clock.now()` に更新する | 明示 | README.md:41、tests/update-transitions.test.ts:162-169 |
| 35 | `assign` は存在しない id に `NotFoundError` を投げる | 明示 | README.md:42、tests/query.test.ts:43-47 |
| 36 | `assign` は `todo` / `in_progress` 以外を `InvalidTransitionError` にする | 明示 | README.md:39-40、tests/query.test.ts:27-34 |
| 37 | `assign` は assignee を trim し、空なら `ValidationError` にする | 明示 | README.md:39-40、tests/query.test.ts:8-25 |
| 38 | `assign` は updatedAt を `clock.now()` に更新する | 明示 | README.md:41、tests/query.test.ts:8-18 |
| 39 | `unassign` は担当者を解除する | 明示 | README.md:39、tests/query.test.ts:36-41 |
| 40 | `unassign` は存在しない id に `NotFoundError` を投げる | 明示 | README.md:42。現行テストでは不足 |
| 41 | `unassign` は `todo` / `in_progress` 以外を `InvalidTransitionError` にする | 明示 | README.md:39-40。現行テストでは不足 |
| 42 | `unassign` は updatedAt を `clock.now()` に更新する | 明示 | README.md:41。現行テストでは不足 |
| 43 | `listTasks` は status 完全一致で絞り込む | 明示 | README.md:46、tests/query.test.ts:51-58 |
| 44 | `listTasks` は assignee 完全一致で絞り込む | 明示 | README.md:46、tests/query.test.ts:60-66 |
| 45 | `listTasks` は tag フィルタを trim・小文字化して完全一致で比較する | 明示 | README.md:47、tests/query.test.ts:68-74 |
| 46 | `listTasks` は overdueAsOf 指定時、期限切れかつ active な task だけ返す | 明示 | README.md:48-49、tests/query.test.ts:85-98 |
| 47 | `listTasks` は複数条件を AND で扱う | 明示 | README.md:50、tests/query.test.ts:76-83 |
| 48 | `listTasks` は priority high → medium → low で並べる | 明示 | README.md:51、tests/query.test.ts:100-107 |
| 49 | `listTasks` は dueDate 昇順、未設定は最後で並べる | 明示 | README.md:51-52、tests/query.test.ts:109-116 |
| 50 | `listTasks` は createdAt 昇順で並べる | 明示 | README.md:52、tests/query.test.ts:118-127 |
| 51 | `listTasks` は id 昇順で並べる | 明示 | README.md:52。現行テストでは不足 |
| 52 | サービスは永続状態を持たない | 明示 | README.md:63-65 |
| 53 | 永続状態はリポジトリだけが持つ | 明示 | README.md:65 |
| 54 | 時刻は注入された `clock` から取得する | 明示 | README.md:66-67、tests/helpers.ts:4-13 |
| 55 | ID は注入された `idGenerator` から取得する | 明示 | README.md:66-67、tests/helpers.ts:16-23 |
| 56 | サービス・リポジトリ内で `Date.now()` / `new Date()` / `Math.random()` を現在時刻や ID 生成に使わない | 明示 | README.md:66-67 |
| 57 | 検証ロジックを一箇所に集約し、create / update で重複実装しない | 明示 | README.md:68 |
| 58 | サービスが返すタスクはリポジトリ内部と参照を共有しない | 明示 | README.md:69、tests/query.test.ts:129-138 |
| 59 | フレームワークに依存しない | 明示 | README.md:3、README.md:63-69 |
| 60 | インメモリで完結する | 明示 | README.md:3、README.md:54-61 |

### 参照資料の調査結果
参照資料として README.md と src/types.ts を確認した。

README.md は、実装対象 API、バリデーション、状態遷移、検索条件、リポジトリセマンティクス、アーキテクチャ制約を具体的に定義している。現在の src/index.ts には同じ公開 API 名が存在するが、`InMemoryTaskRepository` と `TaskService` の全メソッドが `throw new Error('Not implemented')` のままで、README.md の仕様を満たしていない。

src/types.ts は公開契約であり、`TaskStatus`、`Priority`、`TaskRecord`、入力型、フィルタ型、`Clock`、`IdGenerator`、`TaskRepository`、3種類のエラー型を定義している。ファイル先頭に「公開契約（変更禁止）」とあるため、実装では型定義を変更しない。

既存テストは以下を確認済み。
- tests/repository.test.ts はリポジトリの upsert、防御的コピー、delete、保存順を検証している。
- tests/create-task.test.ts は createTask のデフォルト値、trim、title 長、assignee、tags、dueDate を検証している。
- tests/update-transitions.test.ts は updateTask と changeStatus の主要ルールを検証している。
- tests/query.test.ts は assign / unassign の一部と listTasks の主要条件・ソート・防御的コピーを検証している。

現行テストで不足している README 直結の検証は、`getTask` missing、`unassign` missing、`unassign` の終了状態エラー、`unassign` の updatedAt 更新、`listTasks` の id 昇順 tie-breaker、`updateTask` の description / priority 更新、サービス返却値の Date 防御的コピーである。

Knowledge の Source Path も確認した。該当する制約は、フレームワーク非依存、外向き依存を持たない設計、読み取りと書き込みの責務分離、具体的な例外型の使用である。本タスクは HTTP Controller や DB Adapter を持たないライブラリなので、README の簡素なポート・サービス構成を優先する。

coding skill の参照ファイルも確認を試みたが、指定パス `/Users/m_naruse/work/git/takt/builtins/ja/...` はこの環境では存在しなかった。そのため、読み取れた SKILL.md、README.md、src/types.ts、Knowledge を根拠に計画した。

### スコープ
対象は `src/index.ts` の未実装 API と、それを分割する場合の `src/` 配下の内部実装ファイルである。`src/types.ts` は公開契約のため変更しない。テスト追加は次ステップ `write_tests` の対象であり、README から直接導ける不足検証に限定する。

影響範囲:
- `src/index.ts`: 公開 API の re-export、または既存クラスの実装置き換え
- `src/repository.ts`: 追加する場合、`InMemoryTaskRepository`
- `src/service.ts`: 追加する場合、`TaskService`
- `src/task-validation.ts`: 追加する場合、入力正規化と検証
- `src/task-copy.ts`: 追加する場合、`TaskRecord` の防御的コピー
- `tests/*.test.ts`: 次ステップで不足仕様のテスト追加候補

新しい外部依存、HTTP 層、DB 層、CLI、設定ファイル変更は不要。

### 検討したアプローチ
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| `src/index.ts` 1ファイルに全実装を書く | 不採用 | 小規模にはできるが、Repository、Service、Validation、Copy の責務が混在しやすく、README の検証ロジック集約要件と Knowledge の 1モジュール1責務に反する方向になりやすい |
| `src/index.ts` を公開入口にし、内部実装を責務別ファイルに分割する | 採用 | 利用者の import 経路を維持しつつ、Repository、Service、Validation、Copy を分離できる。過度な抽象化なしで責務を明確にできる |
| ヘキサゴナル構造の domain/application/adapter ディレクトリを新設する | 不採用 | README の要求はインメモリ完結の小さなライブラリであり、HTTP/DB/外部 Adapter がない。ディレクトリ階層を増やすとスコープ過剰になる |
| `TaskRepository` 以外の追加ポートや抽象インターフェースを作る | 不採用 | src/types.ts に必要な公開契約が既にある。将来拡張の抽象化は今回の明示要求ではない |
| 後方互換の alias や deprecated API を追加する | 不採用 | 既存 API は未実装で、README に追加 API の要求がない |

### 実装アプローチ
1. `src/types.ts` は変更しない。
2. `src/index.ts` は公開入口として維持し、`export * from './types.js'` を残す。
3. `src/index.ts` から `InMemoryTaskRepository` と `TaskService` を re-export する。既存の公開名とコンストラクタシグネチャは維持する。
4. `InMemoryTaskRepository` は `Map<string, TaskRecord>` を内部状態に使う。`Map` は挿入順を保持し、同じ id の上書きでは順序を変えないため、README の保存順要件に合う。
5. `TaskRecord` の防御的コピー helper を用意し、`tags` 配列と `Date` フィールドをコピーする。サービス・リポジトリが返す値は内部状態と参照を共有しない。
6. Date コピーは helper に集約する。README の禁止は時刻生成の直接依存を避ける意図なので、`clock.now()` 以外で現在時刻を生成しない。レビュー上の誤解を避けるため、引数なし `new Date()`、`Date.now()`、`Math.random()` は使わない。
7. バリデーション helper を一箇所に集約する。
   - `normalizeTitle`
   - `normalizeDescription`
   - `normalizeAssignee`
   - `normalizeTags`
   - `normalizeDueDate`
   - create / update はこれらを共有する。
8. `createTask` は `const now = clock.now()` を一度だけ取得し、dueDate 検証、createdAt、updatedAt に同じ時刻を使う。
9. `updateTask`、`changeStatus`、`assign`、`unassign` は、対象取得、存在確認、状態確認、変更レコード作成、`repo.save`、返却の順に実装する。
10. 状態遷移は許可遷移テーブルで表現する。条件分岐を散らさない。
11. active 判定は `todo` / `in_progress` の helper に集約する。
12. `listTasks` は `repo.all()` のコピー結果を元に filter と sort を行う。filter は AND、sort は README の順序に固定する。
13. エラーは src/types.ts の `ValidationError`、`NotFoundError`、`InvalidTransitionError` を使い、汎用 Error を投げない。
14. 実装後は依存が入った環境で `npm test` と `npm run typecheck` を実行する。

### 到達経路・起動条件
| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `src/index.ts` から `InMemoryTaskRepository` / `TaskService` を import する。型とエラーは `src/types.ts` または `src/index.ts` から import する |
| 更新が必要な呼び出し元・配線 | `src/index.ts` の re-export。内部分割する場合は `src/repository.ts` と `src/service.ts` を `src/index.ts` に接続する |
| 起動条件 | ライブラリ利用者が `new InMemoryTaskRepository()` と `new TaskService(repo, clock, idGenerator)` を作成する。認証、権限、URL、feature flag は存在しない |
| 未対応項目 | なし |

## 実装ガイドライン
- `src/types.ts` は変更しない。公開契約の追加・削除・変更は禁止。
- `src/index.ts` の利用者向け公開名は維持する。既存コメントにある通り、内部モジュール分割は自由だが、利用者が `src/index.ts` から import できる状態を壊さない。
- 参照すべき既存パターン:
  - `tests/helpers.ts:27-35` は `new InMemoryTaskRepository()` と `new TaskService(repo, clock, new SeqIds())` の想定利用形を示す。
  - `tests/helpers.ts:4-13` は clock が Date のコピーを返す想定を示す。
  - `tests/helpers.ts:16-23` は idGenerator が順次 ID を返す想定を示す。
  - `tests/repository.test.ts:44-73` はリポジトリ防御的コピーの期待値を示す。
  - `tests/query.test.ts:129-138` はサービス返却値の mutation が内部状態に影響しない期待値を示す。
- `InMemoryTaskRepository` は内部 `Map` だけを状態として持つ。サービス側に配列やキャッシュを持たせない。
- `save` は upsert とし、同じ id の再保存で件数を増やさない。
- `all` は `Array.from(map.values())` 相当で保存順を保つ。その後に各要素をコピーして返す。
- `TaskService` は repo から得たコピーを直接変更してもよいが、変更後は必ず新しい `TaskRecord` として `repo.save` する。repo 内部参照に依存しない。
- `clock.now()` は create/update/status/assign/unassign の各操作で必要なタイミングに一度取得し、その操作内で同じ `now` を使う。
- `idGenerator.next()` は `createTask` のみで呼ぶ。
- `Date.now()`、引数なし `new Date()`、`Math.random()` は実装に入れない。
- Date 比較は `date.getTime()` で行う。
- `dueDate` の過去判定は `dueDate.getTime() < now.getTime()` とし、等しい時刻は許可する。
- `UpdateTaskInput.dueDate` は `undefined` と `null` を区別する。`undefined` は変更なし、`null` は解除。
- `UpdateTaskInput` に `assignee` は存在しないため、担当者変更は `assign` / `unassign` のみで扱う。
- title / description / assignee / tags / dueDate の正規化は helper に集約し、create と update で同じ title/tags/dueDate ルールを共有する。
- tag の重複除去は最初の出現順を保持する。`Set` を使う場合も push 前に存在確認する。
- `listTasks` の tag filter も保存時と同じ trim・小文字化で比較する。ただし空 tag filter の仕様は README に明記がないため、正規化後の空文字と完全一致比較になり、結果は通常空になる実装でよい。
- priority sort は明示的な rank map を使う。文字列比較に依存しない。
- dueDate sort は「両方なしなら次条件」「片方なしならなしを後ろ」「両方ありなら昇順」とする。
- id sort は最後の tie-breaker として `localeCompare` または単純比較で昇順にする。テストは仕様に合わせて固定する。
- エラーメッセージ文言は既存テストが型で検証しているため厳密固定は不要だが、原因が分かる短い文にする。
- 新しいパラメータ追加は不要。したがって追加配線は `src/index.ts` の re-export のみ。
- フレームワーク、DB、HTTP、環境変数、グローバル状態は導入しない。
- 後方互換 alias、未使用コード、TODO コメントは追加しない。
- テスト追加を行う場合は README 直結の不足分に限定する。
  - `getTask` missing id
  - `unassign` missing id
  - `unassign` done / cancelled
  - `unassign` updatedAt
  - `listTasks` id 昇順
  - `updateTask` description / priority
  - サービス返却値の Date 防御的コピー

## スコープ外
| 項目 | 除外理由 |
|------|---------|
| `src/types.ts` の変更 | 公開契約として変更禁止と明記されている |
| HTTP Controller / REST API | README はフレームワーク非依存ライブラリを要求しており、HTTP 層は要求されていない |
| DB 永続化 | README はインメモリ完結を要求している |
| 認証・認可 | 利用者向け入口はライブラリ API のみで、認証要件は存在しない |
| 外部依存追加 | 既存の型と標準機能で実装可能 |
| 後方互換 API | 現行 API は未実装で、追加 API の要求がない |
| git commit / git push | 実行ルールで禁止されている |

## 確認事項
- ユーザーに確認が必要な不明点はなし。
- `npm test -- --runInBand` は `vitest: command not found` で実行できなかった。依存がインストールされた環境で `npm test` と `npm run typecheck` を再実行する必要がある。