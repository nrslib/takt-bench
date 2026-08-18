## coding-review
タスク仕様・既存レポート・完全版の Policy／Knowledge を正本として読み、まず変更契約とレビュー区分を確定します。その後、指定された26ファイルの累積差分と影響経路を追い、実コードと実行証跡に裏付けられた blocking finding の有無を判定します。編集・ステージング・コミットは行いません。
一次レビューでは8つの修正 family が確定しており、今回の区分は `follow_up` です。したがって、新規の一般探索は広げず、これらの修正箇所・直接影響経路・指定26ファイルの回帰に絞って確認します。現在は、裁定済み受入条件と適用基準を完全版資料へ照合しています。
適用する基準は、(1) 認証トークンと送信先ホストの一致、(2) 共通 MIME 判定の全 consumer 一貫性、(3) Markdown の literal 文脈を壊さないこと、(4) PR本文を含む3入口の配線、(5) cleanup が元結果・例外を上書きしないこと、(6) 本番コンポーネント横断の保存・staging 証跡です。非該当なのは、要求外の総容量制限や未変更領域の一般的リファクタリングです。これから対象テストを再実行し、レポート記載だけに依存せず現在の状態を確認します。
対象テストは現在のコードで合計199件（unit 139、light IT 1、heavy IT 59）が成功しました。あわせて型契約、分類ルーティング、差分整合も成功しています。残る確認は、private repository 画像取得の外部契約と、指定26ファイルの最終回帰照合です。
# コーディングレビュー

## 結果: APPROVE

Blocking finding はありません。

前回の8修正 family を受入条件に照らして再確認し、すべて解消済みと判定しました。特に以下を確認しています。

- GitHub認証トークンを `github.com` に明示的に結合。公式仕様とも整合しています。[GitHub CLI manual](https://cli.github.com/manual/gh_auth_token)
- PNGの正式な8バイト署名を、PR取得とinline pasteの双方で検証
- Markdownのコードフェンス、inline code、HTMLコメント、インデント式コードを原文保持
- PR本文のみの画像も `add --pr` から保存経路へ到達
- pipelineのcleanup失敗がworkflow結果・元例外を上書きしない
- add・対話CLIの代表的失敗経路でattachment cleanupを実行
- 実storeからtask保存、run context stagingまでのデータフローを軽量ITで確認
- 指定26ファイルの累積変更、参照経路、旧GitHub URL helperの不存在を回帰確認

検証結果:

- 対象コマンド: `npm test -- <関連9ファイル>`
- 結果: unit 139件、light IT 1件、heavy IT 59件、合計199件成功
- TypeScript型契約: 成功
- `git diff --check`: 成功
- TODO、skip、旧helper参照、対象ファイル欠落: なし

ソースファイルの編集は行っていません。

---

## ai-antipattern-review
問題を「PRコメント内画像の取得・添付経路に関する変更について、AI生成コード特有の誤実装・過剰互換・既存パターン逸脱を継続レビューする」と捉えました。まず指定された正本（task、Policy、Knowledge）と既存レポートを全文確認し、reviewMode と未解消 finding を確定してから、修正箇所と直接影響経路だけを実コードで再検証します。編集は行いません。
正本の確認を進めています。Policy では Finding Contract が有効なら ledger の `reviewMode` と lifecycle を正本にし、継続レビューでは open finding の受入条件、修正箇所、同じ根本原因の経路に限定する必要があります。また、テスト実行履歴の欠落自体は issue にせず、コードまたは再現結果で確認できる欠陥だけを報告する方針です。
履歴上、このレビューは `follow_up` です。初回のAIアンチパターン指摘は2件（PR本文だけの `add --pr` 配線漏れ、PNG magic bytesの部分判定）で、裁定後の修正 family は計8件です。以降は、これらの受入条件、修正で触れた直接経路、APPROVE前の提示26ファイルの回帰確認に限定します。未変更領域の一般監査は行いません。
現在コードでは、初回2件の受入条件は実装上成立しています。`addTask` は本文・review・commentの3入力を見て本文のみでも共通準備処理へ進み、PNG判定は8バイト完全一致へ更新されています。次に、その2 family と修正が直接触れた認証・Markdown literal・cleanup・production dataflowの対象テストを実行し、レポートではなく現在の実行結果で確認します。
追加の直接経路確認で、修正後のMarkdown literal判定に新しいAI特有の過剰実装リスクを確認しています。画像が1件もない本文でも、各行ごとに先頭から現在行までを再分割・逆走査するため、入力倍増に対して処理時間が約4倍になる挙動です。現在、同じ根本原因を持つ呼び出し箇所と3つのPR入口への影響を絞って再確認しています。
# AI生成コードレビュー

## 結果: REJECT

修正済みのMarkdown解析処理に、入力サイズに対して二乗時間となる過剰実装を1件確認した。

## 今回の指摘（new）

| finding_id | family_tag | 場所 | 問題 | 修正案 |
|---|---|---|---|---|
| `AI-NEW-MARKDOWN-LITERAL-SCAN-158` | `markdown-literal-scan-complexity` | [prReviewAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:158)、[同ファイル](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:435) | `findLiteralRanges()`が各行でindented/fenced code判定を行い、その都度`findInheritedListIndent()`が本文先頭から現在位置までを`slice().split().reverse()`している。画像がない通常本文でも二乗時間と大量の一時配列を要する。実測では22KB/72ms、44KB/279ms、88KB/1,079ms、176KB/4,256msとなり、入力倍増ごとに約4倍化した。これはadd、対話CLI、pipelineの全PR入口に到達する | 本文を一方向に走査し、blockquote・list・paragraph状態を前行から引き継ぐ構造へ変更する。少なくとも行ごとのprefix再分割を除去し、既存28件のMarkdown意味論テストを維持したうえで、大きな画像なし本文に対する退行検証を追加する |

再現コマンドでは全入力で`attachments: 0`だったため、ダウンロード時間ではなくliteral解析自体の増加と確認できた。

## 解消済み（resolved）

- `AI-NEW-TASKS-PR-BODY-194`: PR本文のみでも画像準備へ到達し、空のPRだけを拒否する実装とテストを確認。
- `AI-NEW-IMAGE-MAGIC-16`: PNGの8バイト署名、短縮・途中不一致の拒否、inline paste側のfixture移行を確認。

## 検証結果

対象14ファイル、計415テストが成功した。型契約検査と`git diff --check`も成功している。継続指摘・再開指摘はないが、新規findingが1件あるためREJECTとする。

---

## architecture-review
問題を「PRコメント内画像のダウンロード機能に関する累積変更を、元要件・既存の指摘履歴・現在コードに照らして設計レビューする」と整理しました。まず正本の仕様、全文のPolicy／Knowledge、既存レポートを読み、レビュー区分と未解消 finding を確定します。その後、変更された契約の入口から保存・消費までを追跡します。編集は行いません。
正本のPolicy／Knowledgeを全文確認しました。今回適用する主な基準は、PR画像という新契約の全入口での配線一貫性、GitHub固有責務と共有画像保存責務の分離、外部取得・一時資産の失敗時整合性、置換後の旧経路削除です。既存履歴では初回のアーキテクチャ指摘4件を含む8 familyが修正対象となり、修正・検証側は全件完了を報告しています。ここからはその報告を現在コードで独立に再確認します。
現在コードでは、初回の4件はいずれも構造上修正されています。具体的には、PR本文を含む入口判定、PNG 8バイト署名、pipeline一時task specのbest-effort cleanup、GitHub URL規則の`infra/github`移管を確認しました。加えて、add／対話CLI／pipelineの3入口から、画像準備・task spec保存・run context staging・所有終了時cleanupまでの実経路も再追跡できています。次に、現在の作業ツリーで対象テストを実行し、報告履歴ではなく現状態を検証します。
対象テストは現在の作業ツリーで成功しました。内訳は unit 5ファイル139件、light IT 1件、heavy分類3ファイル59件で、型契約検査も成功しています。提示された26ファイルの存在、旧`githubAttachmentUrl`経路の不存在、変更productionコード内の`any`／TODO／FIXME不在、累積差分の空白エラー不在も確認しました。最終判定の直前確認として、元要件と4件のアーキテクチャ受入条件に対応する行を再読します。
# アーキテクチャレビュー

## 結果: APPROVE

ブロッキング問題はありません。

初回のアーキテクチャ指摘4件について、現在コードで解消を確認しました。

- PR本文のみでも`add --pr`の画像準備へ到達する
- PNGの正式な8バイト署名を検証する
- pipeline cleanup失敗がworkflow結果・元例外を上書きしない
- GitHub固有URL規則が`infra/github`に隔離され、共有storeが汎用化されている

add、対話CLI、pipelineから、画像抽出・保存・task spec・run context staging・cleanupまでの配線も一貫しています。旧`githubAttachmentUrl`経路や未使用の互換経路は残っていません。

検証結果:

- 型契約検査: 成功
- unit: 5ファイル、139件成功
- light IT: 1件成功
- heavy分類: 3ファイル、59件成功
- `git diff --check`: 問題なし
- 提示された変更対象26件を回帰確認済み

実private GitHubとの通信は未実施ですが、ホスト固定の認証選択、Authorization伝播、URL拒否、MIME・magic bytes・サイズ制限は決定的テストで確認されており、修正を要する欠陥は確認されませんでした。

---

## security-review
問題を、PRコメント内の画像取得経路で新たに生じた信頼境界・低信頼URL・ファイル保存処理のセキュリティ監査として整理します。まず正本の Policy／Knowledge／タスク仕様と過去レポートを全文確認し、その後 open finding と修正経路に限定して実コードを追跡します。ソースは変更せず、検証と指摘のみ行います。
正本の裁定では、前回のセキュリティ指摘 `SEC-001`（PR単位の件数・累積容量制限）は元要件を超えるため修正対象外です。したがって今回は一般探索を再開せず、修正後の回帰として、認証ホスト固定、リダイレクト、MIME／magic bytes、単体サイズ上限、保存先・一時ファイル・cleanup、各 `--pr` 入口への到達経路を確認します。
実コードでは、許可URLを `https://github.com`・標準ポート・資格情報なし・attachment用パスへ限定し、`gh auth token --hostname github.com` で送信先と資格情報を結合しています。Node 25.7.0 の実挙動でも、クロスオリジンリダイレクト時に `Authorization` が転送されないことをローカル自己テストで確認しました。続いて拒否・サイズ超過・署名不一致・private permission・パストラバーサル拒否・cleanupを対象テストで回帰確認します。
# セキュリティレビュー

## 結果: APPROVE

Blocking finding はありません。

確認結果:

- GitHub画像URLは HTTPS・`github.com`・attachment用パスに限定されています。
- 認証トークンは `gh auth token --hostname github.com` で取得され、送信先ホストと一致します。
- クロスオリジンリダイレクト時に `Authorization` が転送されないことを Node.js 25.7.0 で実証しました。
- Content-Type、magic bytes、10 MiB上限を検証しています。
- 一時ディレクトリ／ファイルはそれぞれ `0700`／`0600` で作成され、session IDのパストラバーサルを拒否します。
- コマンド実行は固定コマンドと引数配列で、シェル文字列連結はありません。
- 依存関係の変更、機密情報のログ露出、任意外部URL取得はありません。
- 前回の `SEC-001` は裁定どおり、元要件にないPR単位の件数・累積容量制限を要求する overreach であり、再指摘しません。
- 提示された変更対象26ファイルの差分・参照経路を回帰確認しました。

検証証跡:

- 対象テスト: unit 5ファイル139件、heavy IT 2ファイル40件、light IT 1件がすべて成功
- TypeScript type contracts: 成功
- `git diff --check`: 成功
- ソースファイルの編集: なし

---

## testing-review
変更された画像添付・PR画像ダウンロード経路について、元要件、レビュー台帳、既存レポート、実装テストを突合し、テスト品質だけを評価します。まず指定された Knowledge／Policy と task・report を全文確認し、その後に対象テストと直接影響経路を再検証します。編集は行いません。
指定資料から、この実行は既存指摘の修正確認を中心とする継続レビューとして扱います。初回テストレビューと remediation の計画・実績・検証を正本の要件に戻して照合し、必要な場合だけ修正箇所の直接経路へ範囲を広げます。
初回の2件について、現在のテストは受入条件に対応する観測点を持っています。結合テストは外部画像取得だけを置換し、実際の画像保存、task永続化、task spec生成、resolver、run context stagingを通しています。cleanup側も、add保存失敗時の永続状態不変と、対話実行失敗時の元例外同一性・cleanup 1回を直接検証しています。次に分類配線と対象テストを実行して証跡を更新します。
変更対象一覧の回帰確認では、共通PNG署名へ移行した既存の対話入力テスト群も対象に含めます。これらは新機能の一般探索ではなく、共有MIME判定への移行で既存の画像貼り付け経路が壊れていないことの確認です。
# テストレビュー結果: APPROVE

ブロッキングとなるテスト品質上の問題はありません。

- `TEST-NEW-pr-image-dataflow-L29`: 解消済み。軽量ITが実store、task保存、task spec生成、resolver、run context stagingを通し、画像bytesと`order.md`参照を検証しています。[pr-image-dataflow.integration.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/pr-image-dataflow.integration.test.ts:45)
- `TEST-NEW-pr-image-cleanup-L301`: 解消済み。add保存失敗時の永続状態・cleanup回数と、PR実行失敗時の元例外同一性・cleanup回数を直接検証しています。[addTask.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/addTask.test.ts:410)、[cli-routing-pr-resolve.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/cli-routing-pr-resolve.test.ts:408)
- 新規ITは軽量ITへ明示的かつ排他的に分類されています。[test-classification.mjs](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/scripts/test-classification.mjs:363)

独立実行した変更対象テストと分類契約は、14ファイル・415件すべて成功しました。型契約チェックも各実行で成功しています。実private GitHub repositoryとの通信は外部資格情報が必要なため未確認ですが、外部境界を除く変更契約は決定的テストで確認済みです。