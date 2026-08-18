# 修正完了検証

## 結果: verified

## サマリー

`FSME-01` の全不変条件を現在のコード、決定的な反例テスト、実process確認、正式mock E2E入口で独立検証した。

初回4シャードの並列実行、全初回完了後の限定的な1回再測定、通常失敗・別エラー・signal・起動失敗・CI実行の非救済、最終attemptによる終了状態集約が成立している。正式な `npm run test:e2e:mock` は、初回shard 2のbare `onTaskUpdate` timeoutを全初回完了後に再測定し、終了コード0で完了した。全4結果JSONも `success=true`、失敗テスト0件だった。

## 修正単位の整合性

| 修正単位 | 対象 finding | 前提・方法・証拠能力の整合性 | 判定 |
|----------|--------------|------------------------------|------|
| `FSME-01` | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | 正式入口を `package.json` の `test:e2e:mock` に維持し、既存 `vitest-birpc-noise.mjs` を分類の正本として再利用している。変更は出力収集、限定的再測定、終了状態集約のrunner境界に閉じており、productコード、E2E spec、skip、timeout、shard構成を変更していない。決定的テストと正式入口の実行結果を併用できるため証拠能力も十分 | 適合 |

## 完了義務の独立検証

| 修正単位 | 義務ID | 対象 finding | 不変条件と対象経路 | 独立に用いた反例・観測点 | 観測結果 | 証拠 | 判定 |
|----------|--------|--------------|--------------------|----------------------------|----------|------|------|
| `FSME-01` | `FSME-01-1a` | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | 各実attemptが明示された`cwd`と隔離`env`を受け、stdout・stderr・終了状態を返す | `runTeedCommand`を実processで起動し、`cwd=/private/tmp`と専用環境変数を子processから観測 | 成立 | `scripts/teed-command.mjs`、Node inline probe終了コード0 | 完了 |
| `FSME-01` | `FSME-01-1b` | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | 各attemptでHOME・XDG・TMPDIRを新規作成し、成功・非0・起動失敗を問わずcleanupする | `runShardAttempt`の`try/finally`を追跡し、正式E2E後に今回実行時刻のshard一時ディレクトリが残らないことを確認 | 成立 | `scripts/run-e2e-mock-shards.mjs`、一時ディレクトリ更新時刻確認 | 完了 |
| `FSME-01` | `FSME-01-2` | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | 初回4シャードを並列起動し、全初回完了後にだけ再測定を開始する | 遅延初回shardとnoise shardを組み合わせ、4件すべてのfinish後に5回目がstartする順序を観測 | 成立 | `src/__tests__/e2eMockRunner.test.ts` 7件成功。正式E2Eでもshard 4完了ログ後にshard 2再測定ログを確認 | 完了 |
| `FSME-01` | `FSME-01-3a` | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | ローカルの非0結果で、成功テスト1件以上・失敗0件・bare `onTaskUpdate` timeoutのみの場合だけ再測定する | 限定noise出力を与え、対象shardだけ5回目に実行されることを観測 | 成立 | `e2eMockRunner.test.ts`、`npmTestEntrypoint.test.ts` | 完了 |
| `FSME-01` | `FSME-01-3b` | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | assertion失敗を救済しない | failed testとAssertionErrorを含む結果を入力し、初回4回で終了コード1となることを観測 | 成立 | `e2eMockRunner.test.ts` | 完了 |
| `FSME-01` | `FSME-01-3c` | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | 別エラー、引数付きtimeout、成功テスト0件を救済しない | ECONNREFUSED、引数付き`onTaskUpdate` timeout、0 passedを共有判定器へ入力 | 成立 | `npm test -- src/__tests__/npmTestEntrypoint.test.ts`、49件成功 | 完了 |
| `FSME-01` | `FSME-01-3d` | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | CIではbare timeoutでも再測定しない | `isCI=true`で限定noise結果を入力し、初回4回・終了コード1を観測 | 成立 | `e2eMockRunner.test.ts` | 完了 |
| `FSME-01` | `FSME-01-3e` | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | signal終了を再測定しない | `SIGTERM`付き結果を入力し、初回4回・終了コード1を観測 | 成立 | `e2eMockRunner.test.ts` | 完了 |
| `FSME-01` | `FSME-01-3f` | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | 起動失敗を再測定せず失敗として保持する | 実行依存からspawn errorをthrowし、初回4回・終了コード1を観測 | 成立 | `e2eMockRunner.test.ts` | 完了 |
| `FSME-01` | `FSME-01-3g` | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | 再測定は最大1回で、同一spec・同一引数を維持する | 再測定も限定noiseとなる結果と、初回・再測定のrun引数比較を使用 | 成立 | 呼び出し5回で終了コード1、再測定runと初回runの同値、`--reporter verbose`維持を確認 | 完了 |
| `FSME-01` | `FSME-01-4a` | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | 全settled shardが成功した場合だけ全体終了コード0とする | 初回noise後の再測定成功を入力 | 成立 | runner対象テスト終了コード0、正式E2E終了コード0 | 完了 |
| `FSME-01` | `FSME-01-4b` | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | 再測定失敗または任意のsettled失敗が残れば全体を失敗させる | 再測定再失敗、通常失敗、別エラー、signal、起動失敗を個別入力 | 成立 | runner対象テストで各ケース終了コード1 | 完了 |
| `FSME-01` | `FSME-01-4c` | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | 正式入口の4シャードが最終作業ツリーで完了し、全体終了コード0となる | `npm run test:e2e:mock`を正式入口から実行し、process終了状態と全JSONを観測 | 成立 | shard 1: 27件、shard 2: 28件、shard 3: 52件、shard 4: 55件成功。全JSON `success=true`・失敗0件。全体終了コード0 | 完了 |

## 不成立・未確認事項

なし

## 環境要因により実証できない後続確認（判定非ブロッキング）

なし

## 実行証跡

| 対象 | 方法 | 結果 |
|------|------|------|
| runner状態遷移と再測定規則 | `npm test -- src/__tests__/e2eMockRunner.test.ts` | 1ファイル・7件成功 |
| birpc分類の成立例・失敗例・境界値 | `npm test -- src/__tests__/npmTestEntrypoint.test.ts` | 1ファイル・49件成功 |
| teeの出力収集・非0・起動失敗・stdio drain | `npm test -- src/__tests__/it-teed-command.test.ts` | 1ファイル・4件成功 |
| `cwd`・`env`伝播 | `runTeedCommand`を使うNode inline probe | 終了コード0、子processで指定値を確認 |
| 正式mock E2E受入条件 | `npm run test:e2e:mock` | 初回shard 2の限定noiseを全初回完了後に1回再測定し、全体終了コード0 |
| E2E結果JSON | `mock-shard-1.json`から`mock-shard-4.json`を解析 | 全て`success=true`、失敗テスト0件 |
| attempt cleanup | 正式E2E後のshard一時ディレクトリ更新時刻を確認 | 今回実行による残存なし |
| 差分整合性 | `git diff --check` | 成功 |