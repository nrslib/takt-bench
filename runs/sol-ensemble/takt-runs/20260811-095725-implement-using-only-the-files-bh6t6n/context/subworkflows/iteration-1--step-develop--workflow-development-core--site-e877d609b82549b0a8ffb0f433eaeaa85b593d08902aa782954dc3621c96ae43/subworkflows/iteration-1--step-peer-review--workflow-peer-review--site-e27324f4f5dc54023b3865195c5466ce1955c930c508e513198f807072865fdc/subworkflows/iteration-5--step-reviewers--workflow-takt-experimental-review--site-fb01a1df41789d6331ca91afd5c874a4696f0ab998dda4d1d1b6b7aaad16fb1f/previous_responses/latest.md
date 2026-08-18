## coding-review
タスク仕様・全ポリシー／ナレッジ・既存レポートを先に読了し、継続レビューの open finding と現在の累積差分を突き合わせます。編集は行わず、必要な検証のみ実行します。
仕様上の変更契約は、PR本文・通常コメント・review summary/threadの画像を安全に取得し、`add --pr` と pipeline `--pr` の双方で task spec に保存・参照させることです。次に、最新レビューで残った指摘と修正報告の受入条件だけへ範囲を絞ります。
最新修正は、Markdown断片全体のHTML状態をsource offset付きで解析し、`<pre>`範囲内だけを除外する方式です。受入条件の反例と実child境界を、現在の作業ツリーで対象実行して確認します。
対象テストは、unit 69件・light IT 1件・heavy IT／分類契約22件がすべて成功しました。最終判断前に、open finding の受入箇所、46件の対象一覧、空白エラーを現在状態でもう一度照合します。
# コーディングレビュー

## 結果: APPROVE

ブロッキング finding はありません。

- PR本文・各コメントは独立したMarkdown断片として解析され、`<pre>`内の画像除外、全体での重複排除・採番・出現順が維持されています。
- `add --pr`、対話CLI、pipelineの3入口が共通の修正済み経路を使用しています。
- E2E attemptは実childへ`cwd`・隔離環境を伝播し、正常時・起動失敗時ともcleanupされます。
- 既存指摘 `CODE-NEW-pr-review-fragment-isolation-L92` と `TEST-NEW-e2e-runner-attempt-boundary-L31` は解消済みです。
- 提示された変更対象46ファイルを回帰確認し、`git diff --check`も成功しました。
- 対象実行結果: unit 69件、light IT 1件、heavy IT／分類契約22件、すべて成功。

---

## ai-antipattern-review
今回の観測可能な変更契約と既存 finding を先に確定し、AI生成コード特有の問題だけを再検証します。まず task 配下の仕様、レビュー履歴、指定された Policy／Knowledge を全文確認し、その後に対象ファイルと直接影響経路を照合します。ソースは変更しません。
仕様上の主契約は、PR本文・通常コメント・review thread の GitHub 画像を検証付きで取得し、`add --pr` と pipeline `--pr` の双方で task attachment と本文参照へ一貫して流すことです。現在の Report Directory は空なので、直前の reviewer／remediation レポートと finding 台帳を、継続レビューの補助証跡として確認します。
直前の修正内容は、Markdown 断片分離と実 child-process attempt 境界の双方で実装・テストが対応しています。一方、3入口の直接経路を追うと、PR画像の一時保存領域を取得した後に `process.exit()` する分岐があり、`finally` による cleanup が実プロセスでは実行されない可能性が確認できたため、同じ cleanup 所有 family を全経路で走査しています。
# AI生成コードレビュー

## 結果: REJECT

### `AI-NEW-pr-attachment-cleanup-hard-exit-L307` — new / P1

[ルーティング処理](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/app/cli/routing.ts:307) はPR画像の一時領域を外側の `finally` で削除しますが、呼び出す `selectAndExecuteTask()` は通常のworkflow失敗時に [`process.exit(1)`](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/execute/selectAndExecute.ts:211) を実行します。`selectOptions.exitOnFailure` が `false` に設定されていないため、`finally` へ制御が戻らず、ダウンロード済みPR画像が一時ディレクトリに残ります。

同じ根本原因は次にも存在します。

- PR解決後のエラー処理: [routing.ts:146](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/app/cli/routing.ts:146)
- head branch欠落時: [routing.ts:318](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/app/cli/routing.ts:318)

実際のcleanup helperを `finally` に置いた子プロセスで再現したところ、終了コード7の後も `attachments/image-1.png` が残りました。

現在のテストは、`selectAndExecuteTask`を「例外を投げるモック」に置換し、`process.exit`も「例外を投げるモック」にしています（[cli-routing-pr-resolve.test.ts:420](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/cli-routing-pr-resolve.test.ts:420)、[同:491](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/cli-routing-pr-resolve.test.ts:491)）。このテストダブルでは本番と異なり `finally` が実行されるため、問題を検出できません。

修正案は、attachment所有スコープ内では hard exit を行わず、`exitOnFailure: false` と例外伝播などでcleanup完了後に最上位層から終了させることです。上記3経路について、実プロセス終了後に一時画像が残らない回帰テストも必要です。

## 既存 finding の確認

- `CODE-NEW-pr-review-fragment-isolation-L92`: 解消を確認
- `TEST-NEW-e2e-runner-attempt-boundary-L31`: 解消を確認
- inline `<pre>` companion: 解消を確認

対象unit 147件、E2E runner unit 7件、変更heavy IT 3件は成功しました。ソース変更は行っていません。

---

## architecture-review
問題を「タスク正本と過去レポートを基準に、継続レビューとして未解消 finding・修正箇所・直接影響経路の設計整合性を再確認する」と整理しました。まず Policy／Knowledge／task／既存レポートを全文確認し、その後に累積差分と該当する呼び出しチェーンを読みます。編集は行いません。
正本と最新履歴から、今回の変更契約は二つです。第一は「PR本文・各コメントを独立したMarkdown断片として解析しつつ、出現順・重複排除・採番・3入口の伝播を共有すること」、第二は「mock E2Eの各attemptでcwd／隔離環境／cleanupを実process境界まで一貫させること」です。直前の修正レポートでは両方を完了扱いとしているため、これから現行コードで受入条件を再確認します。
現行コードでは、3つのPR入口はいずれも `formatPrReviewTask()` の断片情報を `preparePrReviewAttachments()` に渡し、cleanup所有者も各入口の `finally` にあります。E2E側も「環境生成→実child実行→finally cleanup」が単一のattempt境界に集約されています。次に、直前 finding の反例と直接影響するデータフローだけを対象実行します。
## 結果: APPROVE

ブロッキング問題は0件です。前回の以下2件は解消を確認しました。

- `CODE-NEW-pr-review-fragment-isolation-L92`
- `TEST-NEW-e2e-runner-attempt-boundary-L31`

確認内容:

- Markdown断片の独立解析、全体での重複排除・採番・順序維持
- `add --pr`、対話CLI、pipelineの3入口への配線
- inline／nested `<pre>`内画像の除外
- E2E attemptごとのcwd・隔離env伝播、成功・spawn失敗時のcleanup
- 対象テスト179件、分類契約19件が成功
- 提示された変更対象46件を回帰確認
- `git diff --check 7d623634f205 --` 成功

ソース編集は行っていません。

---

## security-review
セキュリティレビューとして、まず正本の `order.md`、完全版の Policy / Knowledge、既存レポートを全文確認し、継続レビューの open finding と変更された信頼境界を特定します。その後、該当する実行経路だけを実コードで再検証します。ソースは編集しません。
正本の確認が完了しました。適用対象は、外部GitHub画像URLという低信頼入力、認証トークン付きHTTP取得、MIME／magic bytes／サイズ検証、添付ファイル保存とcleanup、さらに直近修正で触れた子プロセス・環境伝播です。暗号・認可など到達経路のない一般項目は非適用として、履歴上の未解決項目と直近修正に絞ります。
履歴上のセキュリティ open finding はありません。現在の実装でも、認証前にURLを HTTPS・`github.com`・限定パスへ制限し、`gh auth token --hostname github.com`を引数配列で取得、レスポンスを10 MiB以下に制限し、Content-Type と magic bytes の一致を確認しています。保存名は内部採番され、セッションIDと添付ファイル名のパス境界検証、通常ファイル・非symlink確認も維持されています。次に依存監査と対象テストを実行し、差分全件の回帰確認を確定します。
対象実行はすべて成功しました。画像取得・解析・保存系は5ファイル90件、task/run-contextデータフローと実child境界は3ファイル11件、3つの利用入口とretry添付経路は4ファイル110件が成功しています。依存監査では既存の本タスク外 advisory は検出されましたが、今回追加された `mdast-util-from-markdown` と `parse5`、およびその追加依存は advisory 対象に含まれていません。最終判定前に正本・現コード・差分一覧を再照合します。
# セキュリティレビュー

## 結果: APPROVE

Blocking finding はありません。

- GitHub画像URLは HTTPS、`github.com`、限定されたattachmentパスに制限され、認証前に検証されます。
- `gh`・Git操作は引数配列と `shell: false` を使用しており、コマンドインジェクション経路は確認されません。
- Content-Type、magic bytes、10 MiB上限を検証し、PNG/JPEG/GIF/WebP以外を拒否します。
- 添付保存は内部採番、パス要素検証、非symlink・通常ファイル確認、非公開権限、失敗時cleanupを維持しています。
- `add --pr`、対話CLI、pipelineの全経路で同じ検証済み処理を使用しています。
- 追加依存の `mdast-util-from-markdown` と `parse5` は `npm audit` の脆弱性対象に含まれていません。検出された既存advisoryは今回の変更経路外です。
- 過去の `SEC-001` は裁定どおり `overreach` であり、今回の修正による新しい攻撃能力も確認されませんでした。

対象実行結果: 画像・保存系90件、データフロー／実child境界11件、CLI・pipeline・retry経路110件がすべて成功しました。

---

## testing-review
問題を、元要件・既存レポート・現在の実装テストを突き合わせ、変更された契約に対するテスト品質だけを継続レビューすること、と整理しました。まず正本の Policy／Knowledge と task・Report Directory を全文確認し、レビュー区分と未解決 finding を特定します。
正本を全文確認しました。適用される中心基準は、画像添付の入力→保存→プロンプト消費という複数モジュール経路の結合テスト、ダウンロード副作用の代表的失敗経路、retry／resume 時の添付状態遷移、E2E runner 変更時の timeout・cleanup・分類契約です。次に task 正本と履歴台帳を特定します。
履歴上の未解決 family は `e2e-runner-attempt-boundary` の1件です。最新修正では実 child process を使う heavy IT が追加されています。ここからは、そのテストが本番 attempt executor と同じ所有境界を実際に通り、成功・spawn失敗・再測定・cleanup・分類を観測できているかを現行コードで確認します。
対象 heavy IT は3件すべて成功し、実 child から `cwd` と8個の隔離環境値を観測できました。2回の attempt で一意な root が作られ、成功後・ENOENT 後とも root が削除され、再測定も同じ executor を通ることを確認しています。分類契約19件と runner unit 7件も成功しました。残る作業は、最新の断片解析修正が既存の画像データフローを壊していないことと、提示された変更対象一覧の回帰確認です。
## 結果: APPROVE

ブロッキング finding はありません。

- `TEST-NEW-e2e-runner-attempt-boundary-L31`: 解消済み
- 実 child processへの `cwd`・隔離環境伝播、attemptごとの分離、成功時・spawn失敗時のcleanup、初回・再測定経路を確認
- heavy IT 3件、runner unit 7件、分類契約19件が成功
- PR画像解析 unit 36件、画像データフロー light IT 1件が成功
- 提示された変更対象46件を回帰確認し、`git diff --check 7d623634f205`も成功

実private GitHub repositoryとの通信のみ、外部資格情報が必要なため未確認ですが、判定には影響しません。