# テスト作成レポート

## 要件-テスト対応表
| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| WT-R01 | 利用者が `src/index.ts` から公開 API と公開エラーを import できる | 公開 API import | `tests/contract-regressions.test.ts` / `src/index.ts からサービスと公開エラーを import できる` | 作成 | |
| WT-R02 | `InMemoryTaskRepository.save/findById/delete/all` の upsert、未存在 `undefined`、boolean delete、保存順 | 永続化境界 | `tests/repository.test.ts` | 既存 | |
| WT-R03 | Repository が `TaskRecord`、`tags`、`Date` を防御的コピーする | 永続化境界 | `tests/repository.test.ts`、`tests/contract-regressions.test.ts` / `Date フィールドも保存時・取得時・一覧取得時に参照共有しない` | 作成 | |
| WT-R04 | `createTask` が入力を検証・正規化し、ID・時刻・初期状態・デフォルト値を設定する | Service → Repository | `tests/create-task.test.ts` | 既存 | |
| WT-R05 | `createTask` の入力 `Date` と返り値を変更しても保存済みタスクに影響しない | Service → Repository → getTask | `tests/contract-regressions.test.ts` / `createTask の入力と返り値を変更しても保存済みタスクは変わらない` | 作成 | |
| WT-R06 | `getTask` は存在しない id で `NotFoundError` を投げる | Service 読み取り | `tests/contract-regressions.test.ts` / `存在しない id の getTask は NotFoundError` | 作成 | |
| WT-R07 | `updateTask` は NotFound、終端状態拒否、部分更新、期限解除、時刻更新、id/status/createdAt 保持を満たす | Service 変更操作 | `tests/update-transitions.test.ts`、`tests/contract-regressions.test.ts` | 作成 | |
| WT-R08 | `changeStatus` は許可された 5 遷移のみ通し、同一状態・終端状態・未存在 id を拒否する | Service 状態遷移 | `tests/update-transitions.test.ts` | 既存 | |
| WT-R09 | `assign/unassign` は active 状態のみ許可し、NotFound 優先、trim/ValidationError、updatedAt 更新を満たす | Service 担当者変更 | `tests/query.test.ts`、`tests/contract-regressions.test.ts` | 作成 | |
| WT-R10 | `listTasks` は各フィルタ、AND 条件、overdue、priority/dueDate/createdAt/id のソートを満たす | Service 検索 | `tests/query.test.ts`、`tests/contract-regressions.test.ts` | 作成 | |
| WT-R11 | フレームワーク非依存、インメモリ完結、時刻・ID 注入、サービス非永続状態、検証ロジック集約 | 実装構造 | なし | 未作成 | 実装前の構造契約であり、ソース本文固定テストは禁止条件に該当するため。挙動としては既存/追加テストで時計・ID・Repository 境界を部分的に固定し、構造は implement/review で確認する。 |
| WT-R12 | `src/types.ts` の公開型・エラーを変更しない | 公開契約 | なし | 未作成 | 型定義変更禁止はレビュー対象。今回の write_tests ではプロダクションコードと型定義を変更していない。 |

## 危険分岐テスト
| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| `Date` の参照共有 | `tags` だけコピーして `createdAt/updatedAt/dueDate` を共有する実装 | `tests/contract-regressions.test.ts` / `Date フィールドも保存時・取得時・一覧取得時に参照共有しない` | |
| create の入力/返り値参照共有 | 入力 `dueDate` や返却 `TaskRecord` の mutation が保存済み状態に漏れる実装 | `tests/contract-regressions.test.ts` / `createTask の入力と返り値を変更しても保存済みタスクは変わらない` | |
| update の部分更新 | 未指定 `description/tags/dueDate/priority/assignee` をデフォルト値で上書きする実装 | `tests/contract-regressions.test.ts` / `未指定フィールドは既存値を維持し updatedAt だけ更新する` | |
| active 状態判定 | `todo` だけ更新可能にして `in_progress` 更新を拒否する実装 | `tests/contract-regressions.test.ts` / `in_progress のタスクは更新できる` | |
| dueDate 境界値 | `dueDate <= now` を不正扱いにする実装 | `tests/contract-regressions.test.ts` / `現在時刻ちょうどの dueDate への更新は許可される` | |
| NotFound 優先 | `assign('missing', '  ')` で `ValidationError` を先に投げる実装 | `tests/contract-regressions.test.ts` / `存在しない id への assign は assignee 検証より先に NotFoundError` | |
| 終端状態の担当者変更 | `cancelled` タスクへの assign/unassign を許可する実装 | `tests/contract-regressions.test.ts` / `cancelled のタスクへの assign / unassign は InvalidTransitionError` | |
| overdue 境界 | `dueDate <= overdueAsOf` を期限切れ扱いにする実装 | `tests/contract-regressions.test.ts` / `dueDate が overdueAsOf と同時刻のタスクは期限切れに含めない` | |
| sort タイブレーク | priority/dueDate/createdAt 同値時に保存順のまま返す実装 | `tests/contract-regressions.test.ts` / `priority・dueDate・createdAt が同じなら id 昇順で並ぶ` | |

## 横断経路テスト
| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| `src/index.ts` import → 利用者コード | `src/index.ts` | ライブラリ利用者 | 公開クラスと公開エラーが入口から利用できる | `tests/contract-regressions.test.ts` / `src/index.ts からサービスと公開エラーを import できる` | |
| `createTask` → `repo.save` → `getTask` | `TaskService.createTask` | `TaskService.getTask` | 正規化済みタスクが保存され、外部 mutation が保存状態に漏れない | `tests/contract-regressions.test.ts` / `createTask の入力と返り値を変更しても保存済みタスクは変わらない` | |
| `repo.save` → `repo.findById` / `repo.all` | `InMemoryTaskRepository.save` | `findById` / `all` | 保存時・取得時・一覧取得時の防御的コピー | `tests/contract-regressions.test.ts` / `Date フィールドも保存時・取得時・一覧取得時に参照共有しない` | |
| `repo.save` → `TaskService.listTasks` | `InMemoryTaskRepository.save` | `TaskService.listTasks` | 同順位条件で id 昇順ソートが適用される | `tests/contract-regressions.test.ts` / `priority・dueDate・createdAt が同じなら id 昇順で並ぶ` | |

## 否定契約
| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| Repository 内部状態と外部オブジェクトの参照共有 | 外部で `Date` を mutate 後に再取得して値が変わらないことを確認 | `tests/contract-regressions.test.ts` / `Date フィールドも保存時・取得時・一覧取得時に参照共有しない` | |
| 保存済みタスクと create の入力/返り値の参照共有 | 入力 `Date` と返り値を mutate 後に `getTask` で保存状態を確認 | `tests/contract-regressions.test.ts` / `createTask の入力と返り値を変更しても保存済みタスクは変わらない` | |
| 未存在 id の変更操作で別エラーを先に返す | `assign('missing', '  ')` が `NotFoundError` になることを確認 | `tests/contract-regressions.test.ts` / `存在しない id への assign は assignee 検証より先に NotFoundError` | |
| `cancelled` タスクへの担当者変更 | `assign/unassign` が `InvalidTransitionError` になることを確認 | `tests/contract-regressions.test.ts` / `cancelled のタスクへの assign / unassign は InvalidTransitionError` | |
| `dueDate === overdueAsOf` を期限切れに含める | `listTasks({ overdueAsOf })` が空配列を返すことを確認 | `tests/contract-regressions.test.ts` / `dueDate が overdueAsOf と同時刻のタスクは期限切れに含めない` | |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `tests/contract-regressions.test.ts` | 単体 / 統合 | 13 | 公開 API import、Repository の Date 防御的コピー、Service の参照共有防止、get/update/assign/unassign/list の境界・否定契約を追加 |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| `Date.now()` / 引数なし `new Date()` / `Math.random()` を直接使わない | 実装前であり、ソース本文を固定するテストは脆くなるため作成しない | implement 後にコードレビューで確認。必要なら振る舞いとして clock/idGenerator の利用を追加検証する |
| 検証ロジックが create/update で重複実装されていないこと | 構造品質の契約であり、テストで安全に観測しにくい | reviewers / final-gate で実装構造を確認する |
| サービスが永続状態を持たないこと | 内部構造契約であり、挙動テストでは完全には固定できない | implement 後に `TaskService` のフィールドと Repository 境界をレビューする |
| フレームワーク非依存・外部 DB/API 非依存 | 依存追加の有無は構造確認が適切 | package 差分と import をレビューする |

## 実行結果（参考）
実装前のためテスト失敗・import エラーは想定内。

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 0 | 依存未導入のためテストランナーが起動していない |
| Fail / Import Error（想定内） | 0 | 未実装コード起因の失敗までは到達していない |
| Error（要対応） | 2 | `npm test`: `vitest: command not found`、`npm run typecheck`: `tsc: command not found` |

## 備考
- プロダクションコード、`src/types.ts`、README、package 設定は変更していない。
- 既存の未追跡ファイル `.takt/.gitignore` と `meta.json` は変更していない。
- Finding ledger に既存の open/resolved/waived/conflict ID はなかったため、Finding ID は参照していない。