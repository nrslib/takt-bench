# タスク計画

## 元の要求
タスク管理機能で利用するサービス層を実装してください。

仕様は README.md に記載されています。公開 API は src/types.ts の型定義に準拠し、利用者が src/index.ts から import できる形にしてください。

フレームワークには依存せず、インメモリで完結するライブラリとして実装してください。アーキテクチャ上の制約は README.md の「アーキテクチャ要件」に従ってください。

## 分析結果

### 目的
`src/types.ts` の公開契約に準拠し、`src/index.ts` から `InMemoryTaskRepository` と `TaskService` を import できる、フレームワーク非依存・インメモリ完結のタスク管理サービス層を実装する。

### 分解した要件
| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | `InMemoryTaskRepository` を実装する | 明示 | `TaskRepository` ポートの実装 |
| 2 | `TaskService` を実装する | 明示 | 生成・更新・状態遷移・担当者・検索のユースケース |
| 3 | 公開 API は `src/types.ts` の型定義に準拠する | 明示 | `src/types.ts` は変更禁止 |
| 4 | 利用者が `src/index.ts` から import できる | 明示 | `src/index.ts` が公開入口 |
| 5 | フレームワークに依存しない | 明示 | Spring/Express 等の依存やアノテーションは不要 |
| 6 | インメモリで完結する | 明示 | DB・外部 API・ファイル永続化は不要 |
| 7 | repository は防御的コピーで内部状態を保護する | 明示 | `tags` 配列と `Date` もコピー対象 |
| 8 | service は永続状態を持たない | 明示 | 永続状態は repository のみ |
| 9 | 時刻は注入された `clock` から取得する | 明示 | `Date.now()` は使用しない |
| 10 | ID は注入された `idGenerator` から取得する | 明示 | `Math.random()` は使用しない |
| 11 | create/update の検証ロジックを一箇所に集約する | 明示 | 重複実装を避ける |
| 12 | service が返すタスクは repository 内部と参照共有しない | 明示 | repository の防御的コピーを前提にする |
| 13 | 既存テストの import 経路を維持する | 暗黙 | tests は `../src/index.js` と `../src/types.js` を参照 |

### 参照資料の調査結果
- `README.md` には実装対象 API、バリデーション、状態遷移、検索、repository セマンティクス、アーキテクチャ要件が記載されている。
- `src/types.ts` には `TaskRecord`、入力型、filter、`Clock`、`IdGenerator`、`TaskRepository`、3種の Error が定義済みで、「公開契約（変更禁止）」と明記されている。
- `src/index.ts` は `export * from './types.js'` 済みだが、`InMemoryTaskRepository` と `TaskService` の全メソッドが `throw new Error('Not implemented')` のまま。
- `tests/helpers.ts` は `new TaskService(repo, clock, new SeqIds())` を使っており、constructor の注入形は既存シグネチャ維持が必要。
- 既存テストは repository、防御的コピー、create、update、状態遷移、assign/unassign、list を広く確認している。一方で `getTask` の NotFound、`Date` の防御的コピー、`unassign` の完了済み拒否、sort の `id` 昇順などは追加テスト候補。

### スコープ
- 変更対象: `src/index.ts`
- 追加候補: `src/repository.ts`、`src/task-service.ts`、`src/task-normalization.ts` などの内部実装ファイル
- 変更不要: `src/types.ts`
- テスト対象: `tests/*.test.ts`
- 外部 DB、HTTP API、CLI、UI、永続化、認証認可は対象外

### 検討したアプローチ
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| `src/index.ts` に全実装を書く | 条件付き採用 | 小規模なら最短。ただし helper と2クラスで肥大化する場合は責務が混ざる |
| 内部ファイルへ分割し `src/index.ts` から re-export する | 採用 | 公開入口を維持しつつ、repository/service/正規化の責務を分けられる |
| 後方互換 API や別 import 経路を追加する | 不採用 | 明示要求にないため不要 |
| フレームワークや DI コンテナを導入する | 不採用 | README のフレームワーク非依存要件に反する |

### 実装アプローチ
1. `src/index.ts` は公開入口として維持し、`export * from './types.js'` と `InMemoryTaskRepository` / `TaskService` の re-export を行う。
2. `InMemoryTaskRepository` は `Map<string, TaskRecord>` を使う。`Map` は挿入順を保持するため `all()` の保存順要件に合う。
3. `cloneTask(task)` を内部 helper として用意し、`tags`、`createdAt`、`updatedAt`、`dueDate` を含めて防御的コピーする。
4. `TaskService` は `repo`、`clock`、`idGenerator` 以外の永続状態を持たない。
5. `normalizeTitle`、`normalizeDescription`、`normalizeAssignee`、`normalizeTags`、`validateDueDate` を共通化し、create/update/assign で使う。
6. `getTask` は `repo.findById(id)` が `undefined` の場合に `NotFoundError` を投げる。
7. `updateTask`、`assign`、`unassign` は対象取得後、`todo` / `in_progress` のみ許可し、それ以外は `InvalidTransitionError`。
8. `changeStatus` は許可遷移5つだけを明示テーブルで判定し、同一状態や終端状態からの遷移は `InvalidTransitionError`。
9. `listTasks` は filter を AND 条件で適用し、priority、dueDate、createdAt、id の順で sort する。
10. 実装後、依存が入った環境で `npm test` と `npm run typecheck` を実行する。現状は `vitest` / `tsc` が見つからず実行不可。

### 到達経路・起動条件
| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `src/index.ts` から `InMemoryTaskRepository` と `TaskService` を import |
| 更新が必要な呼び出し元・配線 | `src/index.ts` の公開 export。内部ファイル分割する場合は re-export を追加 |
| 起動条件 | 利用者が `new InMemoryTaskRepository()` と `new TaskService(repo, clock, idGenerator)` を生成して呼び出す |
| 未対応項目 | なし |

## 実装ガイドライン
- `src/types.ts` の型・Error クラスは変更しない。
- `Date.now()` / 時刻生成目的の `new Date()` / `Math.random()` は service/repository 内で使わない。
- ただし、既存 `Date` の防御的コピーには `new Date(existing.getTime())` を使う。
- `dueDate` は `Date` で更新、`null` で解除、`undefined` で変更なしにする。
- `description` は create では未指定なら空文字、指定時は trim。update では指定された場合のみ trim して更新する。
- `assignee` は create/assign で trim 後空なら `ValidationError`。unassign は `undefined` にする。
- `tags` は trim、小文字化、空除去、重複除去、順序保持を一箇所で実装する。
- NotFound と状態不正の順序は、まず対象取得で `NotFoundError`、存在する場合に状態チェックで `InvalidTransitionError` とする。
- list の sort は `priority: high -> medium -> low`、`dueDate` 未設定は最後、最後に `id` 昇順まで実装する。
- TODO コメントや未実装 throw は残さない。
- 同種の既存実装は存在しないため、参照すべき既存パターンは `tests/helpers.ts` の注入形と `src/index.ts` の公開シグネチャ。

## スコープ外
| 項目 | 除外理由 |
|------|---------|
| `src/types.ts` の公開契約変更 | README とコメントで変更禁止 |
| DB 永続化 | インメモリ完結が明示要件 |
| HTTP Controller / REST API | フレームワーク非依存ライブラリが明示要件 |
| 後方互換用 API | 明示要求なし |
| package 依存追加 | 既存依存で実装可能 |

## 確認事項
- なし。