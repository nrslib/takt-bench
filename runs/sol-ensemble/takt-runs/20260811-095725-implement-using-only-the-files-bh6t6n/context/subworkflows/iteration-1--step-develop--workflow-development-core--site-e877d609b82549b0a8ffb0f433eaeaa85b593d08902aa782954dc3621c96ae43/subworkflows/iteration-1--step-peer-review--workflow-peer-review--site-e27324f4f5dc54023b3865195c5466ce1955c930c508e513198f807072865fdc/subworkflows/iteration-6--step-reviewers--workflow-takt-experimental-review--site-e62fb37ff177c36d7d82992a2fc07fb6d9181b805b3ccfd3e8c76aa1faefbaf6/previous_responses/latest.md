## coding-review
問題を「タスク仕様と実行履歴を正本に、継続レビューの対象範囲を確定し、現在の累積差分と影響経路から blocking finding の有無を判定する」と整理しました。まず task、Policy／Knowledge、既存レポート、Finding Contract を全文確認し、その後に対象差分と必要なテスト証跡を照合します。編集は行いません。
正本の確認から、今回は画像 URL の抽出・認証付き取得・形式／サイズ検証・task spec への保存・本文参照の書換え・`add --pr`／pipeline `--pr` の両入口が変更契約です。直前まで複数回の remediation があるため、一般探索を広げる前に ledger と最新の review／fix 記録から未解決事項を確定します。
最新裁定で open だった family は「PR attachment 取得後の hard exit が cleanup を迂回する」です。現在コードでは store 取得直後に同期 `exit` cleanup を登録し、通常完了では同じ一回性関数を `finally` から終了させる形になっています。次に、3つの hard-exit 経路・listener 解放・実 child 終了後のファイル不存在を対象テストで再確認します。
# コーディングレビュー結果: APPROVE

Blocking finding はありません。

前回の `pr-attachment-cleanup-hard-exit` は解消済みです。

- PR attachment 取得直後に終了時 cleanup を登録
- hard exit 前に同期 cleanup を実行
- 通常終了時に listener を解除
- cleanup の二重実行を防止
- 解決済み project `cwd` を明示的に伝播

検証結果:

- 対象 unit／heavy IT／分類契約: 5ファイル、64件成功
- TypeScript type-contract 検査成功
- `git diff --check 7d623634f205 --` 成功
- 提示された変更対象50ファイルを最終回帰確認済み
- ソースファイルの編集は行っていません。

---

## ai-antipattern-review
今回の契約変更と過去レビューの未解決事項を先に確定し、指定された Policy／Knowledge を全文確認したうえで、`follow_up` の範囲（open finding、修正箇所、直接影響経路）に限定して再検証します。ソースは編集せず、現在の実コードと実行結果だけを根拠に判定します。
要件の中心は、GitHub PR 内の画像参照を安全に取得し、`add --pr` と pipeline `--pr` の双方で同じ attachment 契約へ流すことです。適用基準は、外部取得境界の検証、全入口への配線、状態・一時ファイルの後始末、同一契約の共通所有、テストダブルと本番契約の一致です。現在、指定 Report Directory 自体には過去レポートが見当たらないため、同じ実行履歴内の台帳・直前レポートを特定しています。
未解決 family の現在実装では、PR attachment store 取得直後に同期 `exit` cleanup を登録し、通常経路では同じ一回性関数を `finally` から終了させています。cleanup 本体が同期 `rmSync` であること、3つの hard-exit 経路が登録後にあることを確認しました。次に、指摘の再現条件を直接通す対象テストと実 child-process テストを現状態で実行します。
未解決 finding の対象テストは、unit 2件、routing 31件、実 child-process heavy IT 1件、分類契約19件が現状態で成功しました。承認前の回帰確認として、提示された変更一覧を要件経路ごとに再照合し、PR解析・認証ダウンロード・attachment保存・add／pipeline・再試行時の採番・E2E runner の対象テストを分類済み runner でまとめて確認します。
回帰確認では、変更契約を構成する unit 7ファイル162件、light IT 3ファイル13件、heavy IT 3ファイル44件が追加で成功しました。依存パッケージも実インストール済みで、add／interactive／pipeline／retry／E2E attempt の各経路に未配線や旧フォールバックの再残存は確認されていません。最終判定前に、元 finding の受入条件と現在行を再照合します。
# AI生成コードレビュー

## 結果: APPROVE

ブロッキング問題はありません。

既存 finding `AI-NEW-pr-attachment-cleanup-hard-exit-L307` は解消済みです。

- PR attachment 取得直後に同期 exit cleanup を登録しています（[routing.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/app/cli/routing.ts:125)）。
- cleanup は一回だけ実行され、listener も解除されます（[processExitCleanup.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/app/cli/processExitCleanup.ts:1)）。
- workflow失敗、PR context検証失敗、head branch欠落の各 hard-exit 経路で、終了前のcleanupを検証しています。
- 実child process終了後の画像・session directory不存在も確認できました。
- 通常完了、取消、例外では外側の `finally` がcleanupとlistener解除を担います。
- `resolvePrInput()` の `cwd` は必須化され、不要な `process.cwd()` フォールバックは残っていません。

実行結果：

- cleanup unit: 2件成功
- routing回帰: 31件成功
- process終了 heavy IT: 1件成功
- 分類契約: 19件成功
- 追加回帰確認: unit 162件、light IT 13件、heavy IT 44件成功
- `git diff --check`: 成功
- `mdast-util-from-markdown@2.0.3`、`parse5@8.0.1` の実在を確認

提示された変更対象50件について、累積差分と主要な add／interactive／pipeline／retry／E2E 経路を回帰確認し、未配線、幻覚API、不要な旧経路・フォールバック、変更契約を壊すスコープクリープは確認されませんでした。

---

## architecture-review
変更契約と責務境界を先に確定し、継続レビューの台帳にある未解決 finding、その修正箇所、直接影響経路に限定して設計妥当性を再検証します。まず指定された task・policy・knowledge・過去レポートを全文確認し、その後に現在コードと累積差分を照合します。ソースは変更せず、読み取りと検証のみ行います。
正本と履歴を確認した結果、このレビューは `follow_up` で、対象は `AI-NEW-pr-attachment-cleanup-hard-exit-L307` の1 familyです。受入条件は、PR画像store取得後の3つの hard-exit 経路で終了前に同期cleanupし、通常完了・取消・例外ではlistenerを残さず、cleanupを一度だけ実行し、既存の終了コード・表示・attachment伝播・project `cwd` を維持することです。これから現行コードと実行境界を独立に照合します。
現行実装では、`resolvePrInput()`直後にcleanupを登録し、`process.exit()`の3経路より前に所有境界が成立しています。実cleanupは同期 `rmSync` で、helperが例外を吸収し、一回性とlistener解除は同じ `finish()` に集約されています。次に、対象テストを現行ワークツリーで再実行し、hard-exit直後の観測・実child終了後の不存在・分類配線を確認します。
対象テストは、unit側44件・heavy側20件がすべて成功しました。50件の変更対象は全て現存し、テスト実行後も対象数は50件のまま、`git diff --check 7d623634f205 --`も成功しています。最後に同一 family の全経路を現行行番号で再照合し、判定を確定します。
# アーキテクチャレビュー

## 結果: APPROVE

ブロッキング問題は確認されませんでした。

- `AI-NEW-pr-attachment-cleanup-hard-exit-L307`: resolved
- PR attachment取得直後に同期cleanupを登録し、workflow失敗・PR context検証失敗・head branch欠落の全hard-exit経路を保護しています。[routing.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/app/cli/routing.ts:124)
- cleanupの一回性とlistener解除は専用境界に集約されています。[processExitCleanup.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/app/cli/processExitCleanup.ts:1)
- project `cwd` は必須の解決済み値として画像取得経路へ伝播しています。[routing-inputs.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/app/cli/routing-inputs.ts:52)
- add・pipeline経路は既存の `finally` cleanupを維持しており、今回のhard-exit familyとは契約上分離されています。

検証結果:

- 対象unit: 3ファイル、44件成功
- heavy IT・分類契約: 2ファイル、20件成功
- 変更対象50件すべての存在を確認
- `git diff --check 7d623634f205 --`: 成功
- ソース編集は行っていません。

---

## security-review
セキュリティレビューとして、まず正本の要件・完全版 Policy / Knowledge・過去レポートを読み、継続レビューの open finding と変更された信頼境界を特定します。その後、該当する実装経路と回帰範囲だけを検証します。ファイル編集は行いません。
正本を確認しました。今回適用される中心基準は、GitHub コメント由来の低信頼 URL・レスポンス本文が、認証済み外部取得・ファイル保存・タスク本文参照へ入る新しい境界です。継続レビューのため、現在は過去レポートと finding 台帳から未解決事項を確定しています。
実装上、PR attachment store の取得直後に同期 `exit` cleanup が登録され、通常終了では同じ一回性関数が listener を解除して cleanup する構造を確認しました。次に、3つの hard-exit 配線と実 child process 終了後のファイル不存在を対象テストで再実証します。
対象テストは、unit 44件と実 child process の heavy IT 1件がすべて成功しました。依存関係も base から新規追加された30パッケージに `npm audit` 該当はなく、既存バージョンの更新もありません。最終判定前に、提示された50ファイルの存在・形式と主要セキュリティ不変条件を再確認します。
# セキュリティレビュー結果: APPROVE

Blocking finding はありません。

- PR attachment 取得直後に同期 `exit` cleanup が登録され、workflow失敗・PR検証失敗・head branch欠落を含む hard-exit 経路で一時画像が削除されます。
- 通常終了・例外時も listener が解除され、cleanup は一度だけ実行されます。
- `cwd` は解決済みプロジェクトパスの必須指定です。
- GitHub URL制限、認証ホスト固定、MIME・magic bytes・10 MiB上限は維持されています。
- 対象テストは unit 44件、実child process heavy IT 1件が成功しました。
- 新規30依存パッケージに `npm audit` 該当はありません。検出された既存依存のadvisoryはbaseからバージョン変更がなく、今回の変更対象外です。
- 提示された50ファイルはすべて存在し、競合マーカー、末尾空白、diff形式エラーはありません。

既存指摘 `AI-NEW-pr-attachment-cleanup-hard-exit-L307` は解消済みと判定します。

---

## testing-review
テスト品質レビューとして、まず指定された task・Policy・Knowledge を全文確認し、Report Directory の計画／既存 finding と現在の実装・テストを突合します。編集は行いません。
指定資料から、今回は「PR 本文・通常コメント・レビュー要約・スレッドコメントの画像を attachment 化し、add と pipeline の両経路で参照可能にする」契約と、その失敗・cleanup・テスト分類が中心だと確認しました。次に reviewMode と過去レポートの未解決事項を確定します。
reviewMode は Finding Contract なしの `follow_up` です。未解決 family は「PR attachment 取得後の hard exit が cleanup を迂回する問題」1件に限定されており、今回の確認範囲はその修正、回帰テスト、heavy IT 配線、直接影響する通常終了経路です。
現在のテストは、3つの hard-exit 経路を「exit listener 実行直後・モック例外前」で観測し、helper 自体は実 child process の非0終了後にファイル不存在を確認する二層構成です。これから対象4本を実行し、分類先と実終了境界を実証します。
対象テストは、unit 156件相当（33件＋123件）、light IT 1件、heavy IT 22件相当（20件＋21件のうち重複する分類契約を含む）がすべて成功しました。hard-exit テストは unit、実 child process テストは heavy IT、データフローは light IT に正しく振り分けられています。最後に提示50ファイルの存在と差分整合性を回帰確認します。
# テストレビュー

## 結果: APPROVE

blocking finding はありません。

### 解消確認

| finding_id | 判定 | 根拠 |
|---|---|---|
| `AI-NEW-pr-attachment-cleanup-hard-exit-L307` | resolved | workflow失敗、PR context検証失敗、head branch欠落の3経路で、`process.exit()`直前にcleanupが1回実行されることを確認。実child process終了後の画像・session directory不存在もheavy ITで確認 |

### 評価

- hard-exit、通常終了、取消、例外、cleanup一回性、listener解除を検証済み
- route配線はunit、実process境界はheavy IT、PR画像データフローはlight ITへ適切に分離
- テスト名、Arrange-Act-Assert、独立した一時ディレクトリ、cleanup構造に問題なし
- 解決済みproject `cwd`の明示伝播を確認
- 提示された変更対象50件は全件存在し、`git diff --check 7d623634f205`も成功

### 実行結果

- unit: 156件成功
- light IT: 1件成功
- heavy IT: 41件成功
- TypeScript type-contract検査: 成功
- テスト分類契約: 成功

実private GitHub repositoryとの接続は外部資格情報が必要なため未確認ですが、今回のcleanup修正の判定には影響しません。