## coding-review
問題を「指定されたタスク資料と実行履歴を正本に、継続レビューの未解決指摘と修正経路を検証すること」と捉えました。まずポリシー・ナレッジ・タスク資料・既存レポートを全文確認し、レビュー区分と変更契約を確定してから、対象差分と到達経路を読みます。ファイル編集は行いません。
正本の全文確認を終えました。今回に適用される中心基準は、GitHub画像取得という新しい外部I/O境界の許可対象・Content-Type/magic bytes・サイズ制限、`add --pr` と pipeline `--pr` の入口から保存・本文参照までの一貫性、失敗時の副作用整合性、そして同じ契約を持つ各入口の回帰テストです。次に、前回までの指摘台帳と直近修正履歴を特定します。
直近修正は、(1) Markdown/HTML ASTによる画像抽出、(2) 添付番号の予約境界、(3) mock E2Eの限定的再測定、の3経路です。コード上では、再測定は全初回完了後・非CI・既知のbare `onTaskUpdate` timeoutのみ・最大1回に限定され、通常失敗やsignalは救済しません。ここから各修正の対象テストを現在の作業ツリーで再実行し、同時に共通allocatorの全利用側と40ファイルの回帰範囲を照合します。
対象テストは、AST抽出・ダウンロード境界・番号割当・`add --pr`・対話CLI・pipeline・retry・保存済みtask復元を含む12ファイル232件が成功しました。一方、実行経路の再現で、独立したPR本文と後続コメントを連結してから1つのMarkdownとして解析しているため、前の本文に未閉鎖コードフェンスがあると後続コメントの正規な画像までコード扱いになり、添付が0件になることを確認しました。同じ原因が3つの`--pr`入口すべてに存在するため、これをブロッキング指摘として確定します。
## 結果: REJECT

### Finding

1. **[P2] PRの独立した本文・コメントを別々のMarkdown境界として解析してください**

   - `finding_id`: `CODE-NEW-pr-review-fragment-isolation-L92`
   - 状態: `new`
   - 場所: [prReviewAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:92)

   `formatPrReviewAsTask(prReview)`でPR本文、review、通常コメントを連結した後、全体を一度だけ`fromMarkdown()`へ渡しています。そのため、ある本文の未閉鎖コードフェンスが、独立した後続コメントまでコードブロックとして扱わせます。

   PR本文を` ```md\nunclosed example`、後続コメントをGitHub画像にした再現では、実行結果が`attachments: 0`となり、リモート画像URLも本文に残りました。本来は後続コメントの画像をダウンロードすべきです。この問題は`add --pr`、対話CLI、pipelineの全入口に共通します。

   `PrReviewData`の本文・各review・各コメントを独立したMarkdown断片として解析・置換し、placeholder割当とURL重複排除だけを全断片で共有してから整形してください。未閉鎖フェンスを含むPR本文の後に画像付きコメントがある回帰テストも必要です。

### 検証

対象12ファイル232件のテストと型契約は成功しました。前回のmock E2E証跡・番号割当・AST移行に関する指摘は解消を確認していますが、上記の入力境界問題が残るため差し戻します。

---

## ai-antipattern-review
問題を「PRコメント内の画像をダウンロードして各実行経路へ渡す変更」に対する継続的なAIアンチパターンレビューとして扱います。まず正本の要件・ポリシー・ナレッジ・既存レポートを全文確認し、open finding と変更契約を特定したうえで、修正箇所と直接影響経路だけを実コードで再検証します。編集は行いません。
正本の確認が終わり、今回に適用される基準は、画像取得・検証・保存・本文参照の一貫した配線、不要な互換経路やフォールバックの残存、追加コードの到達性、既存の責務境界との整合です。指定された今回の Report Directory は空だったため、次に親ワークフローの最新レポートから継続レビューの open finding と直近の修正履歴を特定します。
継続対象は、(1) mock E2Eの限定的再測定runner、(2) Markdown/HTML解析への置換、(3)画像index予約境界の修正です。実コード上では、再測定は既存の厳密なbirpc判定を再利用し、通常失敗・signal・CI・再測定再失敗を成功扱いしない構造になっています。次に、この3経路の対象テストと差分整合性を実行して確認します。
対象テストは48件すべて成功しました（runner 7件、画像index 8件、PR画像解析33件）。差分チェックも成功し、今回の修正箇所に未使用コード、未根拠のTODO/FIXME、`any`、空catchはありません。最後に、open finding の受入条件と現在の決定箇所を再照合して判定を確定します。
# AI生成コードレビュー

## 結果: APPROVE

ブロッキングとなるAI生成コード特有の問題は確認されませんでした。

確認内容:

- mock E2E再測定は既存のbirpc判定を再利用し、通常失敗・signal・CI・再測定失敗を救済しない
- Markdown/HTML画像解析は実在する依存へ配線され、旧独自解析は残存していない
- 画像indexはplaceholderと実attachmentパスのみを予約し、不要な互換・fallback経路はない
- 提示された変更対象40ファイルを回帰確認
- `git diff --check` 成功
- 対象テスト3ファイル、計48件成功

`FINAL-NEW-MOCK-E2E-EVIDENCE-01` の受入条件も、修正検証記録と現在のコードで解消を確認しました。

---

## architecture-review
問題を「PRコメント内の画像ダウンロードに関する変更の設計レビュー」と捉え、まず task 正本・ポリシー／ナレッジ全文・過去レポートから変更契約と未解決 finding を確定します。その後、変更箇所と直接影響経路だけを読み取り、配線・責務境界・契約一貫性を検証します。編集は行いません。
正本と履歴から、今回のレビュー区分は `follow_up`、未解決の中心は最終 mock E2E の実行証跡であり、その修正に伴って E2E shard runner、Markdown AST 解析、画像番号予約ロジックが変更されたことを確認しました。ここからは、旧アーキテクチャ指摘の再発有無と、この3つの修正境界が既存の PR 画像データフローを壊していないかに絞って追跡します。
設計上の主要境界は、`infra/github` が URL・認証ダウンロードを所有し、`shared` が MIME 検証・一時ストア・採番を所有し、`features/tasks` が PR 本文変換と task spec 化を所有する形で保たれています。現在、AST 置換・採番・runner 再測定の境界条件を対象テストで再確認しています。
# アーキテクチャレビュー

## 結果: APPROVE

ブロッキング指摘はありません。

- 提示された変更対象40ファイルと直接影響経路を回帰確認しました。
- Markdown／HTML AST解析、GitHubダウンロード、共通画像ストア、task保存、対話CLI、pipelineの責務・依存方向は適切です。
- 画像番号allocatorは任意長番号と既存添付を安全に予約し、過去の採番衝突問題は解消済みです。
- mock E2E runnerは限定的なbirpc noiseだけを最大1回再測定し、通常失敗・CI・signal・起動失敗を成功扱いしません。
- 旧実装・旧GitHub URL helper・未使用コードの残存は確認されませんでした。

検証結果:

- 対象テスト8ファイル、159件成功
- TypeScript型契約検査成功
- `git diff --check` 成功
- 修正履歴上の正式mock E2Eは4シャードすべて成功、全体終了コード0
- ソースファイルの編集は行っていません。

---

## security-review
セキュリティ継続レビューとして、まず正本の要件・ポリシー・ナレッジを全文確認し、Report Directory の履歴から open finding と reviewMode を特定します。その後、修正箇所と直接影響する低信頼入力・ファイル保存・外部取得経路だけを再検証します。今回は読み取り専用で、ソース編集は行いません。
正本では、今回適用される判断材料は CLI・ファイル操作、外部画像取得、機密情報、依存関係です。レビュー履歴は現 iteration の出力先にはまだなく、直前までの reviewer レポートと review-resolution が一次の継続履歴になるため、そこから未解消のセキュリティ指摘を追跡します。
継続履歴上、以前のセキュリティ finding `SEC-001`（PR単位の件数・累積容量制限）は解消扱いで、現在の未解決項目は mock E2E 証跡でした。ただし今回の remediation で child process 実行ラッパーと環境伝播が変更されているため、その新しい信頼境界も含め、画像取得制限の回帰とコマンド・環境情報の扱いを現コードで確認します。
`SEC-001` は過去 remediation で `overreach` と裁定され、現実装も当時と同じ「URL単位10 MiB・件数/累積上限なし」です。今回の AST 置換は参照形式を追加しましたが、既にインライン画像で同じ無制限ループへ到達できたため、新しい攻撃能力や trust boundary 拡大とは確認できません。このため再オープンせず、承認前の回帰確認として提示40ファイルを変更契約ごとに走査します。
主要なセキュリティ境界テストを現在コードで再実行中です。対象は URL/認証・MIME/magic bytes・単体サイズ制限、Markdown/HTML 抽出と重複排除、E2E runner の限定再測定、attachment 名・参照境界です。依存監査では今回追加した `mdast-util-from-markdown` と `parse5` に advisory は検出されず、検出された24件は既存依存系列でした。
# セキュリティレビュー結果: APPROVE

ブロッキング finding はありません。

確認内容:

- GitHub URL・認証先の固定、Content-Type・magic bytes・10 MiB制限、トークン非露出
- attachment保存先・ファイル名・権限・symlink拒否・cleanup
- E2E runnerの`spawn(..., shell: false)`、隔離環境、限定的な再測定条件
- 提示された変更対象40ファイルの回帰確認
- 追加依存への既知脆弱性なし。監査で検出された24件は既存依存系列
- `SEC-001`は、今回の変更で攻撃能力や到達範囲が拡大していないため、既存裁定どおり`overreach`として非finding

検証結果:

- 対象4ファイル、68テスト成功
- `git diff --check` 成功
- 実private GitHub通信のみ未確認ですが、資格情報を要する外部環境確認のため非ブロッキングです。

---

## testing-review
問題を、要件・累積変更・既存レポートに照らしたテスト品質レビューとして整理します。まず指定された Policy／Knowledge と task 配下、Report Directory のレビュー履歴を全文確認し、レビュー区分と未解消 finding を確定します。その後、変更された契約に対応するテストと直接影響経路だけを検証します。
正本の確認が完了しました。この実行は明示どおり `follow_up` として扱い、一般探索は再開しません。現在は最新の裁定・修正計画・修正報告と過去の testing finding を突合し、今回の再確認対象を絞っています。
最新 remediation のテストは、再測定の判定・順序・失敗保持を unit で確認しています。一方で production attempt の `cwd`／隔離環境／cleanup は依存注入によりテスト対象外になっており、既存の `teed-command` テストにも新しい `cwd`／`env` 契約の assertion がありません。この点が実際に未カバーか、対象実行と参照走査で確定します。
対象実行はすべて成功しました（runner unit 7件、teed-command heavy IT 4件、画像参照8件、PR画像AST 33件）。ただし成功した `e2eMockRunner.test.ts` は production の `runShardAttempt` を常に差し替え、`it-teed-command.test.ts` の4件はいずれも第3引数を渡していません。したがって remediation で追加した `cwd`／`env` 伝播は、レポートの記述と異なり永続的な回帰テストに含まれていません。最終判定用に該当箇所を再読します。
# テストレビュー

## 結果: REJECT

### `TEST-NEW-e2e-runner-attempt-boundary-L31`（new）

- 場所: [e2eMockRunner.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/e2eMockRunner.test.ts:49)、[it-teed-command.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/it-teed-command.test.ts:31)
- 問題: `e2eMockRunner.test.ts` は全ケースで `runAttempt` を差し替えるため、実際の `runShardAttempt()` が行う `cwd`・隔離HOME/XDG/TMPDIRの伝播とcleanupを通りません。既存の `it-teed-command.test.ts` も新設された第3引数を一度も使用していません。
- 影響: 修正計画の `FSME-01-1` が定める「各attemptの隔離環境とcleanup」に永続的な回帰テストがありません。修正レポートの「cwd・env伝播をrunnerテストで検証済み」という記録とも一致しません。
- 修正案: `runTeedCommand()`へ一時cwdと専用envを渡し、子プロセスで両方を観測するheavy ITを追加してください。併せてproduction attemptについて、初回・再測定ごとの隔離環境と、成功・起動失敗後のcleanupを検証してください。

確認済みの再測定順序、通常失敗・別エラー・CI・signal・再測定失敗の非救済、Markdown AST、画像index採番には追加の問題はありません。

対象実行結果:

- `e2eMockRunner.test.ts`: 7件成功
- `it-teed-command.test.ts`: 4件成功
- `prReviewAttachments.test.ts`: 33件成功
- `imageAttachmentReferences.test.ts`: 8件成功