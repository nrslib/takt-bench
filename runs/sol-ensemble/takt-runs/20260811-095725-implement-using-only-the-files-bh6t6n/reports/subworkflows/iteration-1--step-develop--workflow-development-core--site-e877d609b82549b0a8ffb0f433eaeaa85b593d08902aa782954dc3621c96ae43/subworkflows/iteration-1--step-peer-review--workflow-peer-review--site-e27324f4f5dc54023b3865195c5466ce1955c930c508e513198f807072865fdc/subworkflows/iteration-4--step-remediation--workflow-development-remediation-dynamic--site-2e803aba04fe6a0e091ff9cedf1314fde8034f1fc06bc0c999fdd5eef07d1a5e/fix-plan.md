# 修正計画

## 結果: 修正計画確定

## 指摘カバレッジ

| finding ID / 出典 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 分類 | 受入条件 |
|-------------------|------|----------------------|-----------------------------|------|----------|
| `FINAL-NEW-MOCK-E2E-EVIDENCE-01` / `fix-report.md` | `fix-report.md`の`FSME-01-1`。4つの結果JSONは失敗テスト0件だが、shard 2がbare `onTaskUpdate` RPC timeoutにより終了コード1 | `FSME-01` | 最終mock E2E証跡がない → 全テスト成功後のVitest worker RPC timeoutをrunnerが全体失敗として確定する → mock E2E runnerに、既存の限定的birpc判定と再測定を適用する境界がない | 構造 | 最終作業ツリーで`npm run test:e2e:mock`の全4シャードが完了し、全体終了コード0となり、その結果が修正レポートへ記録される |

裁定上resolvedまたは`adjudicated_non_actionable`となった他のfindingは、再審査・再修正しない。

## 欠陥 family の最終状態

| 修正単位 | 契約の正本 | 完了対象の全不変条件 | 変更後の責務・正本 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|----------|------------|----------------------|--------------------|--------------------|--------------------------|----------------|
| `FSME-01` | `order.md`の品質要件、`fix-plan.md`の`final-state-mock-e2e-evidence`受入条件、`package.json`の`test:e2e:mock`正式入口 | 初回は既存4シャードを並列実行する。各attemptで隔離HOME・XDG・TMPDIRを使いcleanupする。全初回シャード完了後、ローカル環境で「成功テスト1件以上・失敗テスト0件・エラー見出しがbare `onTaskUpdate` timeoutのみ」を満たす非0シャードだけを同一spec・引数で1回再測定する。再測定失敗、通常のテスト失敗、別エラー、signal、起動失敗、CI上のtimeoutは失敗を維持する。全settled結果が0の場合だけ全体を成功させる | birpc noiseの判定正本は既存`vitest-birpc-noise.mjs`に維持する。`run-e2e-mock-shards.mjs`はshard実行、出力収集、限定的再測定、全体終了状態を所有する。出力転送・収集は既存`teed-command.mjs`を再利用する | `npm run test:e2e:mock` → mock E2E runner → 4 shard → Vitest mock E2E → JSON結果・標準出力・終了状態。失敗時は出力分類 → 対象shardのみ再測定 → settled結果集約。各attemptは環境作成 → 実行 → cleanup | 成立例: 初回全成功、または限定noiseのshardが1回の再測定で成功。失敗例: assertion失敗、別エラー、再測定も非0、signal、起動不能。境界値: 成功テスト0件、引数付きRPC timeout、CI実行は救済しない | productコード、E2E spec、期待値、skip、timeout、shard構成は変更しない。新しい互換経路や旧経路削除はない |

## 実施順序

| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|------|----------|------|--------|----------|----------------|
| 1 | `FSME-01` | 境界変更 | なし | `scripts/teed-command.mjs` | 既存の出力転送・収集・終了状態契約を維持しつつ、mock E2E shard固有の`cwd`と`env`を明示的に渡せる |
| 2 | `FSME-01` | 構造修正 | 順序1 | `scripts/run-e2e-mock-shards.mjs` | shard出力を収集し、全初回実行後に既存birpc判定を満たすローカル失敗だけを1回再測定する。CLI入口と実行関数を分離し、最終settled結果から終了コードを決定する |
| 3 | `FSME-01` | 利用側検証 | 順序2 | `src/__tests__/e2eMockRunner.test.ts` | 限定noiseの1回再測定、全初回完了後の再測定、再測定成功・再失敗、通常失敗、別エラー、CI非救済、同一spec・引数維持を決定的に検証する |
| 4 | `FSME-01` | 最終検証 | 順序3 | ソース変更なし | 正式な`npm run test:e2e:mock`を最終作業ツリーで実行し、4シャード完了・全体終了コード0を記録する |

## 制約適合性

| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 | 品質ゲート |
|----------|--------------|--------------------------|-----------------------------|----------|--------------|
| `FSME-01` | `order.md`品質要件、`fix-plan.md`の修正境界、`fix-report.md`の未完了義務、テスト実行ポリシー | 既存unit runnerと同じ厳密なbirpc分類を再利用し、対象shardを最大1回だけ再測定する。終了コードの無条件無視、JSONの`success: true`だけによる救済、timeout延長、テストskip、期待値弱体化、全E2E直列化は不採用。出力収集処理の複製を避け、既存teed-commandを必要最小限拡張する | unit testでは実processを使わない実行依存注入により再測定規則と終了状態を検証する。最終観測点は正式コマンドの全体終了コード。各shard JSONは補助証拠とし、開始ログや一部spec成功で代用しない | 実失敗を成功扱いせず、既知の限定noiseだけを競合が解消した後に再測定する。再測定も失敗した場合は必ず全体失敗となるため、受入条件を弱めない | `npm test -- src/__tests__/e2eMockRunner.test.ts`、`npm run build`、`npm run lint`、`npm test`、`npm run test:it`、`git diff --check`、`npm run test:e2e:mock` |

実private GitHub通信、全heavy IT、release gate、productコード、E2E spec追加、周辺リファクタリングは裁定境界外のため含めない。

## 再計画事項

- なし。直近失敗の観測結果と既存birpc判定機構から、同じ要求・設計前提で最小修正と決定的な検証方法を確定できる。