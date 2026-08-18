今回は実装作業のため `coding` スキルを適用します。まず指定された正本（`order.md`、Policy、Knowledge、Report Directory）と現在コードを再確認し、U2・U6の全完了義務を依存順に実装します。コミット・ステージング・プッシュは行いません。
正本の確認で、今回の実装対象は計画どおり `format.ts`、`pr-images.ts`、`github-pr-images.test.ts`、`pipelineExecution.test.ts` に限定されることを確認しています。続けて、修正用Policy/Knowledgeと直近の計画・過去レポートを読み切り、現在コードの実際の責務分担を照合します。
照合結果、原因は計画どおり二重化された順序定義です。`format.ts` にレビュー分類・節順の単一定義を置き、`pr-images.ts` はその表示順を直接使う形に移行します。U6は本番コードを変更せず、PR画像付きpipelineの false／例外で実filesystem cleanupを検証するテストだけを追加します。
U2の共通順序ヘルパー移行と、Markdown→HTML／HTML→Markdown、formatter本文・添付一覧の整合テストを追加しました。U6には、実際のtask spec・画像ファイル・画像親directory・`.takt/tasks`を false／例外の両terminalで確認するケースを追加しています。まず変更対象ファイル単位のテストを順番に実行します。
対象ファイルの全体テストは通過しました（画像テスト18件、formatter 25件、pipeline 55件）。次に、変更差分の静的確認を行ってから、指定された品質ゲートを順番に実行します。失敗が出た場合は、そのコマンドだけを原因修正後に再実行します。
ビルド、lint、全unit gate（86ファイル・合計5337件）は成功しました。追加した `pipelineExecution.test.ts` は軽量IT分類対象のため、規約に従い分類契約テストを先に実行してから、指定の軽量ITゲートへ進みます。
分類契約（17件）と軽量ITゲート（133ファイル・2148件）は成功しました。分類契約では既存スクリプト由来のログ警告が出ましたが、テスト結果と終了コードは成功です。続けてmock E2E、今回の変更がworkflow実行経路に触れるためsmoke E2Eを実行します。
mock E2E（16ファイル・48成功、13 skip）とsmoke E2E（5ファイル・21成功、1 skip）も成功しました。ここから必須の編集後セルフスキャンとして、旧順序経路・未使用化・依存方向・差分整合性を再検索し、必要なら修正後に影響する検証だけ再実行します。
## 作業結果

- 修正完了

## 変更内容と受入条件

- U2: formatterのレビュー節順を共通化し、画像抽出も同じ順序を使用。Markdown/HTML双方の順序、本文、placeholder、添付一覧を検証。
- U6: PR画像付きpipelineのfalse／例外時に、task spec・画像ファイル・親directory・`.takt/tasks`が削除され、cleanupが1回 בלבדであることを実filesystemで検証。本番cleanupコードは変更なし。

## 検証結果と証拠

- `npm run build` 成功
- `npm run lint` 成功
- `npm test` 成功（86 files、5337 tests）
- 対象テスト成功：画像18件、formatter25件、pipeline55件
- `HOME=/tmp/takt-bench-v3-home npm run test:it` 成功（133 files、2148 tests）
- `npm run test:e2e:mock` 成功（48 passed、13 skipped）
- `npm run test:e2e:smoke` 成功（21 passed、1 skipped）
- `git diff --check` 成功。旧comments先行経路・未使用参照は残っていません。