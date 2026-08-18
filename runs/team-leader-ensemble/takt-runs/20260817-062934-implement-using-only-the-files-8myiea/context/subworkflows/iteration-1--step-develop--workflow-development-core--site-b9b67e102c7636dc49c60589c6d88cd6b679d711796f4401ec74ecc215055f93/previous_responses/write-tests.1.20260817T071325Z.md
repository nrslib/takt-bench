問題は、指定された変更契約に対するテストを先に追加し、プロダクションコードを一切変更せずに未実装失敗まで確認することです。`coding` スキルと指定された正本・Policy・Report Directoryのみを確認し、テスト作成、実行、差分セルフスキャンの順に進めます。
`coding` スキルを適用します。指定された6つの基準ファイルを全文確認した後、タスク正本と履歴に基づくテスト対象を確定します。
指定の `context/task` には `order.md` のみ、指定 Report Directory には `plan.md` のみが存在します。これら以外のレポートディレクトリは参照せず、続けて `order.md`・Knowledge・PolicyをEOFまで確認します。
`order.md` と指定 Report Directory の `plan.md` を全文確認し、完了契約は `PR-IMG-1`、`PR-ATT-1`、`PR-REF-1`、`PR-ROUTE-1`、`PR-PIPE-1`、`PR-KEEP-1`、`PR-QUAL-1` と確定しました。SCN は4件あり、各シナリオに主テストを対応させます。Knowledge と Policy は長いため、分割表示でEOFまで読み進めます。
作業ツリーは変更なしです。既存経路は、PR取得（`infra/github`）、共通整形（`infra/git`）、task保存、通常CLI、pipelineに分かれており、既存の画像添付テストとPR取得テストが存在します。次に各所有者の公開契約とfixtureを直接読み、重複しない最小テストへ絞ります。
既存の添付保存・run-context stagingは既に契約テストで保護されているため、重複せず、今回の差分に必要な境界だけを追加します。主な追加対象は、GitHub画像抽出・検証、formatterの参照置換、`add --pr`保存、通常`--pr` seed配線、pipelineのtask spec handoffです。これからテストのみ編集します。
テストを追加しました。編集対象は `src/__tests__` 配下のみで、PR画像の4本文源・非対象文脈・Content-Type/magic bytes/サイズ検証、formatter置換、`add --pr`保存、通常CLI seed、pipeline task spec staging/cleanup、既存PR添付後の採番を観測します。まず対象テストを実行し、失敗が未実装動作によるものかを確認します。
最初の実行は、テスト失敗ではなく依存関係未導入で `tsc: command not found` となりました。ソース・テストの失敗とは分離して、既存のlockfileに従って依存関係を導入してから再実行します。
テスト先行の追加分を対象ファイルごとに実行し、未実装起因の失敗とテスト自体の不備を切り分けます。プロダクションコードは変更しません。
追加したテストは、既存契約のテストを除き、いずれも想定した未実装箇所で失敗しています。画像番号の既存ストア経路だけは現行実装で成立しているため通過しました。次に差分と型・未使用参照を確認し、テスト側の欠陥がないか再点検します。
差分確認で `npm install` が一時的に変更した `package-lock.json` は、テスト成果物ではないため復元し、現在はテストファイルのみが変更対象です。続けて型契約とLintを実行し、今回のテスト編集に起因する静的な問題を確認します。
型契約とLintは通過しました。分類契約テストは、今回変更した `github-pr.test.ts` と `pipelineExecution.test.ts` が境界テストとして検出された一方、分類一覧に未登録のため失敗しました。既存の分類ルールを確認し、テストファイル側で必要な登録だけを追加します。
境界を実際に跨ぐ新規テストは、分類を偽装せず `.integration.test.ts` として分離しました。これによりPR画像取得とpipelineの実ファイル転送は重い統合ランナーへ入り、既存の単体テスト分類は維持されます。新規統合テストと分類契約を再実行します。
分類契約は通過しました。新規統合テストの失敗も、PR画像取得・検証とpipelineの `taskSpec` 未実装箇所に限定され、fixtureや分類の不備ではありません。移動後の既存テスト群を再実行して、テスト整理による回帰がないことを確認します。
最終の新規PR画像統合テストも、未実装時の期待失敗（4件）として再確認できました。これから編集差分だけを対象に、未使用化・依存方向・ファイル範囲を機械的にセルフスキャンし、シナリオとテストの対応を整理します。
セルフスキャンでは、未使用 import・変数はLintで検出されず、追加 import はテストから既存のproduction経路を参照する方向のみでした。`git status` もテストファイルだけで、productionコードや `package-lock.json` の変更はありません。最後に差分整合性を確認します。
テスト先行工程の静的確認は完了しています。品質契約にあるbuildの基準値も記録するため、プロダクション未実装の現状態で `npm run build` だけ実行します。テストの期待失敗は変わりません。
テスト先行工程を完了しました。プロダクションコードは変更していません。

追加・更新したテスト：

| 契約・シナリオ | テスト |
|---|---|
| PR-IMG-1 / SCN-PR-IMG-1-P1, N1 | `github-pr-attachments.integration.test.ts` |
| PR-ATT-1 / PR-REF-1 / SCN-PR-ATT-1-P1 | `git-format.test.ts`, `addTask.test.ts` |
| PR-ROUTE-1 / SCN-PR-ATT-1-N1 | `cli-routing-pr-resolve.test.ts`, `imageAttachments.test.ts` |
| PR-PIPE-1 | `pipeline-steps.test.ts`, `pipeline-pr-attachments.integration.test.ts` |

確認結果：

- `npm run build` 成功
- `npm run lint` 成功
- `npm run test:type-contracts` 成功
- `releaseVerificationWiring.test.ts` 成功
- `git diff --check` 成功
- 変更対象はテストファイルのみ

追加テストは、画像抽出・検証・placeholder置換・add/pipeline配線が未実装のため、期待どおり失敗しました。後段の実装ステップでこれらを通過させる必要があります。