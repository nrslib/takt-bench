# 修正完了検証

## 結果: verified

## サマリー

`PRIMG-CAPABILITY-NORMALIZATION` は完了しています。共通解決関数、3 consumer の移行、旧判定ロジックの削除、既存契約の保持を現在のコード・検索結果・対象テストで独立確認しました。

## 修正単位の整合性

| 修正単位 | 対象 finding | 前提・方法・証拠能力の整合性 | 判定 |
|----------|--------------|------------------------------|------|
| `PRIMG-CAPABILITY-NORMALIZATION` | `AI-NEW-src-app-cli-routing-inputs-L67`, `ADJ-FOLLOWUP-src-features-tasks-add-L198` | `GitProvider` の optional capability を共通境界で正規化し、対応・非対応双方を直接テストしている。3 consumer の参照経路も静的に確認済み。 | 適合 |

## 完了義務の独立検証

| 修正単位 | 義務ID | 対象 finding | 不変条件と対象経路 | 独立に用いた反例・観測点 | 観測結果 | 証拠 | 判定 |
|----------|--------|--------------|--------------------|----------------------------|----------|------|------|
| `PRIMG-CAPABILITY-NORMALIZATION` | OBL-1 | `AI-NEW-src-app-cli-routing-inputs-L67`, `ADJ-FOLLOWUP-src-features-tasks-add-L198` | 対応 provider で resolver を実行し、結果を返す | resolver の呼び出し引数、attachments、cleanup を直接確認 | 成立 | `src/infra/git/index.ts:140-146`、`git-factory.test.ts` 18 tests 成功 | 完了 |
| `PRIMG-CAPABILITY-NORMALIZATION` | OBL-2 | 同上 | 非対応 provider で元データ、空 attachments、no-op cleanup を返す | resolver 未定義 provider の fallback と `cleanup()` の戻り値を確認 | 成立 | `src/infra/git/index.ts:148`、`git-factory.test.ts` 成功 | 完了 |
| `PRIMG-CAPABILITY-NORMALIZATION` | OBL-3 | 同上 | 3 consumer が共通関数を利用する | production code 全体を検索し、呼び出し箇所を照合 | 成立 | `routing-inputs.ts:67`、`steps.ts:231`、`add/index.ts:198` | 完了 |
| `PRIMG-CAPABILITY-NORMALIZATION` | OBL-4 | 同上 | 3 consumer から旧 fallback 生成を削除する | consumer 内の capability 直接判定と fallback 残存を検索 | 成立 | 直接判定は `types.ts` の定義と `index.ts` の共通 helper のみ | 完了 |
| `PRIMG-CAPABILITY-NORMALIZATION` | OBL-5 | 同上 | PR input、pipeline、add の戻り値・引数・cleanup 契約を保持する | 対象 consumer テストと cwd 伝播・失敗 cleanup 経路を実行 | 成立 | consumer 対象 97 tests、`addTask.test.ts` 23 tests 成功 | 完了 |

## 不成立・未確認事項

なし。

## 環境要因により実証できない後続確認（判定非ブロッキング）

| 対象 | 環境要因 | リポジトリ内で解消不能な根拠 | 現在確認した代替証拠 | 後続確認 |
|------|----------|------------------------------|--------------------------|----------|
| なし | なし | なし | なし | なし |

## 実行証跡

| 対象 | 方法 | 結果 |
|------|------|------|
| 共通解決関数の対応・非対応 provider | `npm test -- src/__tests__/git-factory.test.ts` | 成功、18 tests |
| CLI / pipeline / cwd 伝播 | `npm test -- src/__tests__/cli-routing-pr-resolve.test.ts src/__tests__/pipelineExecution.test.ts src/__tests__/git-cwd-propagation.test.ts` | 成功、97 tests |
| `takt add --pr` 経路 | 同コマンド内で `src/__tests__/addTask.test.ts` を実行 | 成功、23 tests |
| 型契約 | 各 `npm test` 実行時の `test:type-contracts` | 成功 |
| 3 consumer の共通 helper 配線 | `rg -n "resolvePrImages\("` による静的確認 | 成功 |
| 旧 capability 判定の削除 | consumer と共通層の参照検索 | 残存なし |