問題は、`PRIMG-CAPABILITY-NORMALIZATION` の全完了義務を、修正報告に依存せず現在の差分・実装・テストで独立検証することです。まず指定された Knowledge / Policy と最新レポートを全文確認し、その後に変更差分、全 consumer、境界関数、対象テストを照合します。ソースは編集しません。
指定された Knowledge は 1,024 行を先頭から EOF まで確認しました。次に同じ手順で 1,405 行の Policy 全文を確認し、特に verifier の判定基準、契約置換、テスト証拠の扱いを適用範囲として固定します。
Policy と主仕様、裁定、修正計画、修正報告を確認しました。適用範囲は `PRIMG-CAPABILITY-NORMALIZATION` のみで、判定は「共通境界の対応/非対応挙動」「3 consumer の移行」「旧経路削除」「既存戻り値・cleanup 契約の保持」に限定します。次に現在のコード上の全参照経路を再走査します。
参照走査では、実コードの `resolvePrImages` 呼び出しは計画どおり 3 consumer に限定され、optional capability の直接判定は `GitProvider` 定義と共通 helper 内だけでした。次は修正単位の直接テストと 3 consumer の対象テストを、報告記録ではなく現在の checkout で実行して確認します。
対象テストは現在の checkout で成功しました。`git-factory.test.ts` は 18 tests、consumer 側は `cli-routing-pr-resolve`・`pipelineExecution`・`git-cwd-propagation` の計 97 tests、`addTask.test.ts` は 23 tests が通過しています。最後に判定直前の静的再確認として、3 consumer の呼び出し、旧判定の不存在、対応/非対応 provider の分岐を再確認します。
判定: `verified`（APPROVE）

指摘はありません。

- `resolvePrImages` が対応 provider への委譲と非対応時の identity fallback を実装済み。[index.ts:140](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/infra/git/index.ts:140)
- 3 consumer が共通 helper を利用し、旧判定ロジックは残存していません。
- 対象テスト成功:
  - `git-factory.test.ts`: 18 tests
  - consumer 3ファイル: 97 tests
  - `addTask.test.ts`: 23 tests
- Type contract check も成功しています。
- `incomplete` / `plan_invalid` に該当する不足は確認されませんでした。