# task-svc

タスク管理のサービス層を実装するライブラリ。フレームワーク非依存・インメモリで完結する。

## 実装するもの

`src/types.ts` の公開契約（変更禁止）に基づき、次の公開 API を実装して
`src/index.ts` から re-export する。テストは `src/index.ts` と `src/types.ts` にのみ依存する。

| API | 種別 | 責務 |
|-----|------|------|
| `InMemoryTaskRepository` | クラス | `TaskRepository` ポートの実装。防御的コピーで内部状態を保護する |
| `TaskService` | クラス | 生成・更新・状態遷移・担当者・検索のユースケース。`(repo, clock, idGenerator)` を注入する |

## バリデーション規則（createTask / updateTask 共通）

- `title`: trim して空なら `ValidationError`。trim 後 200 文字を超えたら `ValidationError`（200 ちょうどは許可）
- `description`: trim して保存。未指定は空文字列
- `priority`: 未指定は `medium`
- `assignee`: 指定された場合、trim して空なら `ValidationError`。trim 後の値を保存
- `tags`: 各要素を trim → 小文字化し、空要素は除去、重複は最初の出現だけ残す（順序保持）
- `dueDate`: 指定された場合、`clock.now()` より過去なら `ValidationError`（現在時刻ちょうどは許可）

## TaskService の規則

- `createTask(input)`: 検証後、`id = idGenerator.next()`、`status = 'todo'`、
  `createdAt = updatedAt = clock.now()` で保存し、作成したタスクを返す
- `getTask(id)`: 存在しなければ `NotFoundError`
- `updateTask(id, input)`: 対象が `todo` / `in_progress` 以外なら `InvalidTransitionError`。
  `dueDate` は `Date` で更新・`null` で解除・`undefined` で変更なし。
  `id` / `status` / `createdAt` は変わらない。`updatedAt = clock.now()`
- `changeStatus(id, next)`: 許可される遷移は次の5つだけ。それ以外（同一状態への遷移、
  `done` / `cancelled` からの遷移を含む）は `InvalidTransitionError`
  - `todo → in_progress`
  - `todo → cancelled`
  - `in_progress → done`
  - `in_progress → todo`
  - `in_progress → cancelled`
- `assign(id, assignee)` / `unassign(id)`: 対象が `todo` / `in_progress` 以外なら
  `InvalidTransitionError`。`assign` の `assignee` は trim して空なら `ValidationError`
- 上記の変更操作はすべて `updatedAt` を `clock.now()` に更新する
- 存在しない id への操作はすべて `NotFoundError`

## listTasks(filter?) の規則

- `status` / `assignee`: 完全一致
- `tag`: 正規化済みタグ（小文字）との完全一致。フィルタ値も trim → 小文字化してから比較する
- `overdueAsOf`: `dueDate` があり `dueDate < overdueAsOf` かつ status が `todo` / `in_progress`
  のものだけを返す
- 複数条件は AND
- 並び順: priority（high → medium → low）→ dueDate 昇順（未設定は最後）→
  createdAt 昇順 → id 昇順

## InMemoryTaskRepository のセマンティクス

- `save` は upsert。保存時に防御的コピーを取り、呼び出し側があとから引数オブジェクトを
  変更しても内部状態に影響しない
- `findById` / `all` は防御的コピーを返す。返り値（`tags` 配列を含む）を変更しても
  内部状態に影響しない
- `delete` は削除したかどうかを boolean で返す
- `all` は保存順（挿入順）で返す

## アーキテクチャ要件

- サービスは状態を持たない。永続状態はリポジトリだけが持つ
- 時刻と ID は必ず注入された `clock` / `idGenerator` から取得する。
  `Date.now()` / `new Date()` / `Math.random()` をサービス・リポジトリ内で直接使わない
- 検証ロジックは一箇所に集約し、create / update で重複実装しない
- サービスが返すタスクはリポジトリ内部と参照を共有しない

## 開発コマンド

- `npm test` — テスト実行（60 件）
- `npm run typecheck` — 型チェック
