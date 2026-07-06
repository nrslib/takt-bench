# タスク計画

## 元の要求
README.md の仕様と src/types.ts の公開契約に従って、タスク管理のサービス層を実装してください。tests/ 配下の全テスト（60 件）が成功する状態にしてください。テストコード（tests/）と src/types.ts の変更は禁止です。src/index.ts の公開 API シグネチャも変更禁止です。README の「アーキテクチャ要件」セクション（サービスの無状態性、clock/idGenerator の注入、検証の一元化、防御的コピー）を守ってください。

## 分析結果

### 目的
README.md の仕様に従って、タスク管理サービスの `InMemoryTaskRepository` と `TaskService` を実装し、60件のテストすべてをパスすること。

### 分解した要件
| # | 要件 | 種別 | 備考 |
|---|------|------|------|
| 1 | `InMemoryTaskRepository#save(task)` の実装 | 明示 | 上書き保存（upsert）、防御的コピー |
| 2 | `InMemoryTaskRepository#findById(id)` の実装 | 明示 | 存在しなければ `undefined`、防御的コピー返却 |
| 3 | `InMemoryTaskRepository#delete(id)` の実装 | 明示 | 削除したか boolean で返す |
| 4 | `InMemoryTaskRepository#all()` の実装 | 明示 | 保存順（挿入順）で返す、防御的コピー |
| 5 | `TaskService#createTask(input)` の実装 | 明示 | バリデーション→保存→作成したタスク返却 |
| 6 | `TaskService#getTask(id)` の実装 | 明示 | 存在しなければ `NotFoundError` |
| 7 | `TaskService#updateTask(id, input)` の実装 | 明示 | `todo`/`in_progress` 以外は `InvalidTransitionError` |
| 8 | `TaskService#changeStatus(id, next)` の実装 | 明示 | 5つの許可遷移のみ、他は `InvalidTransitionError` |
| 9 | `TaskService#assign(id, assignee)` の実装 | 明示 | `todo`/`in_progress` 以外は `InvalidTransitionError` |
| 10 | `TaskService#unassign(id)` の実装 | 明示 | `todo`/`in_progress` 以外は `InvalidTransitionError` |
| 11 | `TaskService#listTasks(filter?)` の実装 | 明示 | 複合フィルタ（AND）、ソート（priority→dueDate→createdAt→id） |
| 12 | 共通バリデーション（title description priority assignee tags dueDate） | 明示 | create/updateで重複しないよう一元化 |
| 13 | `ValidationError` ハンドリング | 明示 | 空title, trim後201字以上, 空assignee, 過去dueDate |
| 14 | `NotFoundError` ハンドリング | 明示 | 存在しないid操作時の例外 |
| 15 | `InvalidTransitionError` ハンドリング | 明示 | 状態遷移不許可時の例外 |
| 16 | 防御的コピー（引数・返り値） | 明示 | アーキテクチャ要件、内部状態の不変性保証 |
| 17 | clock/idGenerator注入 | 明示 | `Date.now()`/`Math.random()` 使用禁止 |

### 参照資料の調査結果（参照資料がある場合）
- **README.md**: タスク管理サービスのAPI仕様とアーキテクチャ要件の定義
- **src/types.ts**: 公開契約（interface・型定義、エラークラス）
- **src/index.ts**: インターフェースの型定義、未実装スタブ
- **tests/*.test.ts**: 各APIの期待動作（60件のテストケース）
- **tests/helpers.ts**: テスト用ヘルパー（`FixedClock`, `SeqIds`, `makeService`）
- 主要差異: すべての実装がスタブ状態（"Not implemented"）で、テストが失敗中

### スコープ
- `src/index.ts` 内の以下のメソッド実装
  - `InMemoryTaskRepository`: save, findById, delete, all（4メソッド）
  - `TaskService`: createTask, getTask, updateTask, changeStatus, assign, unassign, listTasks（7メソッド）
- 共通ヘルパー作成（バリデーション・タスク正規化）：コード重複回避のため
- 新規作成ファイル: `src/validation.ts`, `src/task-normalizer.ts`（計算上0-2ファイル）

### 検討したアプローチ（設計判断がある場合）
| アプローチ | 採否 | 理由 |
|-----------|------|------|
| クラス分割: validationモジュールを分離 | 採用 | create/updateでバリデーションロジックの重複を防ぐため、一元化 |
| クラス分割: task-normalizerモジュールを分離 | 採用 | tags正規化処理（trim→小文字→空除去→重複除去）を一元化 |
| 内部ストレージ: Map<string, TaskRecord> | 採用 | findById/upsert/O(1)性能、挿入順保持目的でSetでid管理 |
| 返り値: 深層コピー（JSON.stringfy/parse） | 採用 | 防御的コピー要件、tags配列含む完全コピーを保証 |
| バリデーション: オプションのtrim挙動 | 採用 | README line 17-20に明記、空文字チェックはtrim後 |

### 実装アプローチ
1. `src/validation.ts` に共通バリデーションを実装（title, description, priority, assignee, tags, dueDate）
2. `src/task-normalizer.ts` にtags正規化処理を実装
3. `src/index.ts` に `InMemoryTaskRepository` を実装（内部Map＋挿入順管理配列）
4. `src/index.ts` に `TaskService` を実装（各メソッドのビジネスロジック）
5. `TaskService#updateTask` は `TaskService#changeStatus` と同様の状態チェックロジックを共通化

### 到達経路・起動条件
- 到達入口: テストコード（tests/*.test.ts）から直接メソッド呼び出し
- 呼び出し元更新: 不要（APIシグネチャ変更禁止、テストは変更禁止）
- 起動条件: なし（テスト実行時に自動起動）

## 実装ガイドライン
- **InMemoryTaskRepository**: 内部 `Map<string, TaskRecord>` + `Array<string>`（id挿入順管理）、すべて防御的コピー
- **TaskService**:
  - バリデーション: createTask/updateTaskで重複実装しないよう、共通ヘルパー使用
  - 状態遷移: changeStatusで5つの遷移のみ許可、他は `InvalidTransitionError`
  - `updateTask`: `dueDate: null` で解除、`undefined` で変更なし、`Date` で更新
  - `listTasks`: フィルタAND、ソート優先順 priority(high→medium→low)→dueDate(昇順,未設定最後)→createdAt→id
- **Error handling**: `ValidationError`, `NotFoundError`, `InvalidTransitionError` をtypes.tsに定義されたコンストラクターで生成
- **アーキテクチャ要件**:
  - `Date.now()` / `new Date()` / `Math.random()` 使用禁止（clock/idGenerator注入）
  - 引数・返り値の参照共有を避ける（深層コピー）

## スコープ外
- テストコード（tests/）の変更（禁止）
- src/types.ts の変更（禁止）
- src/index.ts の公開APIシグネチャ変更（禁止）
- ドキュメント更新（README.md変更不要）
- TypeScript型定義変更（型チェックは既存に合わせる）

## 確認事項
- なし（すべての要件をテストとREADMEで確認済み、実装可能な情報を十分に確保）
```