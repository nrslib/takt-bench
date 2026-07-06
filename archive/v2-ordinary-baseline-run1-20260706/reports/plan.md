```markdown
# タスク計画

## 元の要求
README.md の仕様と src/types.ts の公開契約に従って、タスク管理のサービス層を実装してください。
tests/ 配下の全テスト（60 件）が成功する状態にしてください。
テストコード（tests/）と src/types.ts の変更は禁止です。src/index.ts の公開 API シグネチャも変更禁止です。
README の「アーキテクチャ要件」セクション（サービスの無状態性、clock/idGenerator の注入、検証の一元化、防御的コピー）を守ってください。

## 分析結果

### 目的
README.md で定義されたAPI仕様に従い、InMemoryTaskRepository と TaskService を実装し、tests/ 配下の60件のテストがすべて通る状態にすること。

### 分解した要件
| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | InMemoryTaskRepository.save: 引数オブジェクトの防御的コピーで保存 | 明示 | README "InMemoryTaskRepository のセマンティクス" |
| 2 | InMemoryTaskRepository.findById: 返り値の防御的コピーで返す | 明示 | README "InMemoryTaskRepository のセマンティクス" |
| 3 | InMemoryTaskRepository.all: 保存順（挿入順）で全件返す | 明示 | README "all は保存順で返す" |
| 4 | InMemoryTaskRepository.delete: 削除成功(true)/失敗(false) を返す | 明示 | README "InMemoryTaskRepository のセマンティクス" |
| 5 | TaskService.createTask: title/description/assignee/tags/dueDate のバリデーションと正規化 | 明示 | README "バリデーション規則" + "TaskService の規則" |
| 6 | TaskService.createTask: id Generator.next()、status='todo'、createdAt=updatedAt=clock.now() | 明示 | README "createTask(input)" |
| 7 | TaskService.getTask: 存在しなければ NotFoundError | 明示 | README "getTask(id)" |
| 8 | TaskService.updateTask: status が 'todo'/'in_progress' 以外は InvalidTransitionError | 明示 | README "updateTask(id, input)" |
| 9 | TaskService.updateTask: dueDate は Dateで更新、nullで解除、undefinedで変更なし | 明示 | README "updateTask(id, input)" |
| 10 | TaskService.updateTask: id/status/createdAt は変わらず、updatedAt=clock.now() | 明示 | README "updateTask(id, input)" |
| 11 | TaskService.changeStatus: 許可される遷移は5通りのみ（todo→in_progress/cancelled, in_progress→done/todo/cancelled） | 明示 | README "changeStatus(id, next)" |
| 12 | TaskService.changeStatus: 同一状態遷移・done/cancelledからの遷移は InvalidTransitionError | 明示 | README "changeStatus(id, next)" |
| 13 | TaskService.assign/unassign: 対象が 'todo'/'in_progress' 以外なら InvalidTransitionError | 明示 | README "assign(id, assignee) / unassign(id)" |
| 14 | TaskService.assign: assignee は trim して空なら ValidationError | 明示 | README "assign(id, assignee)" |
| 15 | TaskService.listTasks: status/assignee/tag フィルタ（完全一致） | 明示 | README "listTasks(filter?)" |
| 16 | TaskService.listTasks: overdueAsOf は dueDate あり且つ dueDate < 基準かつstatusがtodo/in_progress | 明示 | README "listTasks(filter?)" |
| 17 | TaskService.listTasks: 複数条件は AND | 明示 | README "listTasks(filter?)" |
| 18 | TaskService.listTasks: 並び順 = priority(high→medium→low) → dueDate昇順(未設定最後) → createdAt昇順 → id昇順 | 明示 | README "listTasks(filter?)" |
| 19 | TaskService.listTasks: 返り値の防御的コピー | 明示 | README "listTasks > 返り値を変更しても内部状態は変わらない" |
| 20 | バリデーション一元化: createTask/updateTask で重複実装しない | 暗黙 | README "検証ロジックは一箇所に集約" |
| 21 | サービスの無状態性: 永続状態はリポジトリだけが持つ | 暗黙 | README "アーキテクチャ要件" |
| 22 | clock/idGenerator 経由での時刻・ID取得: Date.now()/new Date()/Math.random() を使わない | 暗黙 | README "アーキテクチャ要件" |

- 並列表現は別行にする: `title/description/assignee/tags/dueDate` → 別々の要件（1-4, 6, 9）
- 複合条件は検証可能な最小単位に分解: `dueDate: Date/null/undefined` → 要件9で1つの項目として扱い
- 唯一の参照元: README.md, src/types.ts, tests/ 全テスト

### 参照資料の調査結果（参照資料がある場合）
指示書の「参照資料」は README.md と src/types.ts のみ。外部実装は指定されていない。
README.md の仕様を、テストコード（tests/）の期待動作で裏取りした上で実装する。
README の仕様とテストの期待が矛盾する場合は、テストの期待を優先する（テストが仕様の実装例）。

### スコープ
- src/index.ts 内で InMemoryTaskRepository クラスと TaskService クラスの実装を記述
- 既存 src/types.ts のエクスポート型・エラーはそのまま使用（変更禁止）
- tests/helpers.ts の makeService() で自動的に TaskService への配線が完了
- 新規モジュールは src/index.ts 内に追記形式で実装（ファイル追加は不要）

### 検討したアプローチ（設計判断がある場合）
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| バリデーションロジックを ValidationUtils クラスに分離 | 採用 | createTask/updateTask で重複実装を避けるため（README 要件20） |
| InMemoryTaskRepository 内部に Map と配列の併用 | 採用 | save順保持（配列）＋ findById O(1)（Map）のため |
| tags 正規化ロジックを private メソッド化 | 採用 | createTask/updateTask で重複を避けるため |
| listTasks のフィルタ＋ソートを個別実装 | 採用 | 検証可能な最小単位のテストに対応するため |

### 実装アプローチ
1. src/index.ts 上部に InMemoryTaskRepository 実装（内部 Map + 配列）
2. 中ほどに ValidationUtils（trim, validateTitle, validateAssignee, validateDueDate, normalizeTags）
3. TaskService 実装（6メソッド：createTask, getTask, updateTask, changeStatus, assign, unassign, listTasks）
4. 各メソッドは防御的コピー＋clock/idGenerator経由の取得

### 到達経路・起動条件（利用者向け機能の追加/変更がある場合）
| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | なし（ライブラリ関数としてテスト経由で使用） |
| 更新が必要な呼び出し元・配線 | tests/helpers.ts の makeService() による自動配線（更新不要） |
| 起動条件 | なし（Node.js/Vitest環境でテスト実行時に自動起動） |
| 未対応項目 | なし |

## 実装ガイドライン（設計が必要な場合のみ）
- **InMemoryTaskRepository**: 内部に `private tasks: Map<string, TaskRecord>` と `private order: TaskRecord[]` を持つ
- **save**: Map に保存＋配列末尾に push、引数を深拷贝（JSON.stringify/structuredClone）
- **findById/all**: 返り値を深拷贝（tags 配列含む）
- **delete**: Map.delete() が true なら order.filter() で配列から削除
- **ValidationUtils**: 
  - validateTitle(title: string): string（trim後空ならthrow, 201文字以上ならthrow）
  - validateAssignee(assignee?: string): string | undefined（trim後空ならthrow）
  - validateDueDate(dueDate: Date, clock: Clock): Date（過去ならthrow）
  - normalizeTags(tags?: string[]): string[]（trim→小文字→空除去→重複除去）
- **TaskService.createTask**: validateTitle＋validateAssignee＋validateDueDate＋normalizeTags→Repo.save→返却
- **TaskService.updateTask**: validateTitle（存在時）＋validateDueDate（Date時）＋normalizeTags→Repo.findById→新しいrecord→Repo.save
- **TaskService.changeStatus**: 許可される遷移5通りをif-else列出→clock.now()でupdatedAt更新→Repo.save
- **TaskService.listTasks**: filter条件（status/assignee/tag/overdueAsOf）→ソート（priority→dueDate→createdAt→id）
- **防御的コピー**: 引数と返り値両方向で深拷贝（structuredClone 或は JSON.parse(JSON.stringify())）

## スコープ外
| 項目 | 除外理由 |
|------|---------|
| 新規ファイル追加 | src/index.ts 内にすべて収める（README "src/index.ts の公開 API シグネチャも変更禁止"） |
| tests/ の変更 | 明示的禁止 |
| src/types.ts の変更 | 明示的禁止 |
| モジュール分割のリファクタリング | 小規模タスクのため、src/index.ts 内に完結させる |
| DB永続化 | インメモリ実装指定 |

## 確認事項（あれば）
- なし
```