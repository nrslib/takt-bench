## coding-review
タスク指示書・既存レポート・指定された Policy／Knowledge を正本として全文確認し、その後に17ファイルの累積差分と実在する入出力経路を追います。編集は行わず、確認できた問題だけを報告します。
正本の確認が完了しました。今回に直接適用する基準は、GitHub URL の信頼境界、Content-Type／magic bytes／サイズ上限、PR本文・通常コメント・review summary・thread comment の全入力経路、`add --pr` と pipeline `--pr` の保存・参照整合、そして副作用の失敗時状態です。これらに絞って差分を追跡します。
差分の主要経路は確認できました。現在は、認証トークンの取得先と送信先が一致するか、Markdown上で実際には画像でない記法を誤取得しないか、ダウンロード失敗時に通信資源が確実に解放されるかを、実装と対象テストで絞り込んでいます。
3件の問題を再現できました。特に、`GH_HOST` が Enterprise を指す環境では Enterprise 用トークンが `github.com` へ送信されること、PNG の8バイト署名を満たさないデータが受理されること、コードフェンス内の画像記法まで実画像として取得・置換されることを、外部通信なしの決定的な実行で確認しています。関連する入口テストも最終確認します。
REJECT — blocking finding が3件あります。

1. `coding-review-1`（new／重大）: Enterprise 用トークンが `github.com` へ漏洩します  
   [prImageDownload.ts:39](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/infra/github/prImageDownload.ts:39) は `gh auth token` のホストを指定していません。一方、取得URLは [githubAttachmentUrl.ts:9](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/shared/utils/githubAttachmentUrl.ts:9) で `github.com` に固定されています。GitHub CLIはホスト未指定時にデフォルトホストを選択します。[GitHub CLI公式仕様](https://cli.github.com/manual/gh_auth_token)  
   `GH_HOST=enterprise.example` と合成Enterpriseトークンを設定した再現では、そのトークンが `github.com` 宛ての `Authorization` ヘッダーへ渡されました。`gh auth token --hostname github.com` とし、Enterprise環境でも送信トークンが混線しないテストを追加してください。

2. `coding-review-2`（new／高）: PNGのmagic bytes検証が不完全です  
   [imageMimeType.ts:17](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/shared/utils/imageMimeType.ts:17) はPNGの先頭4バイトしか確認していません。実行確認では `89 50 4E 47 00 00 00 00` が `image/png` として受理されました。PNG署名は8バイトです。[W3C PNG仕様](https://www.w3.org/TR/png-3/#5PNG-file-signature)  
   8バイトすべてを検証し、[github-pr-image-download.test.ts:15](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/github-pr-image-download.test.ts:15) の4バイトPNG fixtureを完全な署名へ直したうえで、不完全な署名の拒否テストを追加してください。

3. `coding-review-3`（new／中）: コード例内の画像記法までダウンロード・置換されます  
   [prReviewAttachments.ts:22](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:22) はMarkdown構造を考慮せず全文を正規表現で走査します。コードフェンス内の `![example](GitHub URL)` を入力すると、実際に1件ダウンロードされ、コード例が `[Image #1]` に書き換わることを再現しました。Markdown parserを利用するか、少なくともコードフェンス・inline code・HTMLコメントを走査対象外にし、回帰テストを追加してください。

対象の5テストファイル、計121件は成功しましたが、上記3ケースは未検証です。

---

## ai-antipattern-review
今回の変更で追加・置換された契約を、`order.md`、タスク資料、累積差分、実コード、実行レポートの順に突き合わせ、AI生成コード特有の仮定・過剰互換・重複責務・未到達コードを確認します。編集は行わず、指定17ファイルを全件読み、問題が見つかった場合は同じ根本原因を持つ経路まで走査します。
正本の要件では、PR本文・通常コメント・review summary・review thread commentを同一の画像抽出契約に参加させ、GitHub限定取得、Content-Typeとmagic bytes、サイズ上限を経て、`takt add --pr` と pipeline `--pr` の両方で attachment 付き task spec を生成することが必須です。指定された当該レビューの Report Directory には現時点でレポートファイルがなく、次に親ワークフローの実行履歴と Finding Contract の有無を確認します。
実装の中核は、整形後のPR本文を一度だけ走査する `preparePrReviewAttachments`、GitHub認証・取得を所有する `downloadPrImage`、既存task-spec転送を再利用する3入口、共有化された画像一時ストアです。ここまでで幻覚APIや未配線は見つかっていません。現在はテストが本番契約を実際に通しているか、また既存挙動を不必要に置換していないかを指定テスト全件で確認しています。
確認済みの問題は2系列です。1つは既存の「review/commentが空なら終了」という分岐を残したため、PR本文だけに画像がある `takt add --pr` が新機能へ到達しない配線漏れです。もう1つは、既存の4バイト判定をそのまま「magic bytes検証」の共通正本へ昇格させ、4バイトしかない疑似PNGまで受理する見かけ上の検証です。同じ契約を使う入口とテストダブルを走査し、現在のコードで再確認しています。
# AI生成コードレビュー

## 結果: REJECT

指定17ファイルと関連経路を確認し、要件未達と不完全なmagic bytes検証を2件確認しました。

## 今回の指摘（new）

| finding_id | family_tag | 場所 | 問題・修正案 |
|---|---|---|---|
| `AI-NEW-TASKS-PR-BODY-194` | `pr-image-entrypoint-parity` | [src/features/tasks/add/index.ts:194](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/add/index.ts:194) | `reviews` と `comments` が空だと、PR本文を処理する前に終了します。このため本文だけに画像がある `takt add --pr` は保存できません。[addTask.test.ts:345](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/addTask.test.ts:345) も旧挙動を固定しています。コメント有無による早期終了を除去し、本文画像のみの回帰テストを追加してください。 |
| `AI-NEW-IMAGE-MAGIC-16` | `image-magic-validation` | [src/shared/utils/imageMimeType.ts:16](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/shared/utils/imageMimeType.ts:16)、[github-pr-image-download.test.ts:14](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/github-pr-image-download.test.ts:14) | PNGを先頭4バイト、WebPを12バイトだけで受理し、テストも切り詰めた疑似画像を正常値にしています。実行確認でも不正な8バイト列をPNG、`RIFF0000WEBP`をWebPと判定しました。PNGは8バイト、WebPは`RIFF`＋4バイト＋`WEBPVP`まで検証し、不完全なsignatureの拒否テストを追加してください。[PNG仕様](https://www.w3.org/TR/png-3/#5PNG-file-signature)、[WHATWG MIME Sniffing](https://mimesniff.spec.whatwg.org/#matching-an-image-type-pattern) |

## 問題系列の完了走査

- PR本文処理: `add --pr` のみ早期終了し、対話CLIとpipelineはコメントなしでも処理することを確認。
- 画像形式判定: PRダウンロードとinline pasteの全参照、および関連fixtureを確認。GIF/JPEGは定義済みsignatureと一致し、PNG/WebPが同系列の欠陥です。
- URL制限、サイズ上限、attachment伝播、成功・取消・失敗時cleanupには追加findingなし。
- 幻覚API、未使用export、不要な互換経路は確認されませんでした。

## 検証結果

- 新規画像テスト2ファイル: 22件成功
- addの「コメントなし」対象テスト: 1件成功
- 不正signatureの直接実行結果: `["image/png","image/webp"]`
- 実private repositoryとの通信は資格情報が必要なため未確認です。実装欠陥の根拠には使用していません。

---

## architecture-review
問題を「PRコメント内の画像をダウンロードして扱う変更について、要件・累積差分・実行履歴・全17対象ファイルを照合し、責務分割・依存方向・配線・契約置換の欠陥を特定する」と整理しました。まず正本の要件・全文ポリシー・ナレッジ・既存レポートを読み、その後に変更契約と呼び出し経路を追跡します。編集は行いません。
正本ディレクトリには `order.md` のみがあり、実行履歴は開発ステップの `plan.md`、実装判断・スコープ・実装報告、テスト報告に存在します。これらを一次履歴として確認し、提示されたポリシーとナレッジは指定ファイルのEOFまで分割して読みます。
変更契約は、GitHub添付URLの安全な取得、PR本文の画像参照と `TaskAttachment[]` の対応付け、add／対話CLI／pipelineの3入口への伝播、一時資産の所有・解放、既存interactive添付ロジックの共通化です。ここからは実装報告を信用せず、各責務の現在コードと全呼び出し元を直接確認します。
呼び出し経路の照合で、`takt add --pr` だけが画像準備前に「レビュー／通常コメントが0件なら終了」しており、PR本文だけに画像がある明示要件を到達不能にしていることを確認しました。さらに、共有化した画像判定・GitHub URL所有者・pipeline一時specの失敗経路を同一契約の範囲で再走査しています。
# 判定: REJECT

ブロッキング指摘は4件です。

1. `architecture-review-1`（new・高）: PR本文だけに画像がある `takt add --pr` が到達不能です。[add/index.ts:194](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/add/index.ts:194) がレビューと通常コメントが0件なら画像準備前に終了します。PR本文も処理する明示要件に反し、[addTask.test.ts:345](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/addTask.test.ts:345) はこの旧挙動を固定しています。このガードを削除または本文も考慮する条件へ変更し、本文画像のみのPRが保存されるテストへ置換してください。対話CLIとpipelineには同じガードがないことを確認済みです。

2. `architecture-review-2`（new・高）: PNGのmagic bytes検証が不完全です。[imageMimeType.ts:17](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/shared/utils/imageMimeType.ts:17) は先頭4バイトだけでPNGと判定し、[github-pr-image-download.test.ts:15](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/github-pr-image-download.test.ts:15) も4バイトだけのデータを正常画像として受理しています。そのため任意データへ `89 50 4e 47` を付ければContent-Typeとの一致検証を通過します。PNGの完全な8バイトシグネチャを検証し、短いプレフィックスを拒否するテストを追加してください。共有判定を使うPR取得・inline pasteの両経路が対象です。

3. `architecture-review-3`（new・中）: pipelineの一時task spec cleanupが元の実行結果を上書きします。[steps.ts:411](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/pipeline/steps.ts:411) の`finally`から、例外を投げ得る`fs.rmSync`を直接呼んでいます。workflow失敗の`false`や`executeTask`の例外よりcleanup例外が優先され、予定された終了コードへ変換できません。元の結果・例外を保持したままcleanup失敗を記録する構造にし、workflow失敗とcleanup失敗が連続するテストを追加してください。

4. `architecture-review-4`（new・中）: 共通化後もshared層へ呼び出し元固有の責務が漏れています。GitHub固有のURL規則が[githubAttachmentUrl.ts:1](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/shared/utils/githubAttachmentUrl.ts:1) にあり、汎用storeも[imageAttachmentStore.ts:34](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/shared/utils/imageAttachmentStore.ts:34) と同ファイル58行で`pasted`／`interactive`固有のエラー・ログを保持しています。GitHub URL規則は`infra/github`へ移し、shared storeの型・エラー・ログを画像添付一般の契約へ修正してください。

対象テスト3ファイルは40件すべて成功しましたが、1件目と2件目はテスト自体が誤った契約を固定しているため、承認根拠にはなりません。ファイル編集は行っていません。

---

## security-review
変更点は、PR コメント内の画像を外部 URL から取得してローカル添付として扱う経路が中心と見ています。まず正本の要件・ポリシー・ナレッジ・過去レポートを全文確認し、その後、17 ファイルすべてと URL 検証、リダイレクト、保存先、サイズ制限、MIME 判定、CLI 到達経路を追跡します。編集は行いません。
正本から、今回適用される安全契約は「GitHub attachment URL のみに限定」「認証済み取得」「Content-Type と magic bytes の一致確認」「サイズ上限」「保存先の封じ込め」です。レポートディレクトリには過去レポートがなく、初回レビューとして 17 ファイルを全件確認します。依存関係・暗号・認証一般は、今回の変更経路に参加しない限り対象外とします。
主要な取得処理は初期 URL を `https://github.com/.../assets/...` に限定し、シェル文字列連結を使わず、1 ファイル 10 MiB のストリーム上限と Content-Type/magic bytes の一致を実装しています。次に、リダイレクト時の認証ヘッダー、添付総数・総容量、共有一時ディレクトリから task spec へのコピー境界を重点的に検証しています。
確認できた主な懸念は、1 ファイル当たりの上限はある一方、低信頼な PR 本文・コメントが指定できる「画像数」と「合計バイト数」に上限がない点です。実装は一意 URL をすべて順次取得し、pipeline では一時保存後に task spec と run context へコピーするため、攻撃者が多数の有効な 10 MiB 画像を貼るとローカルのディスク・帯域消費が画像数に比例して増えます。同じ欠陥 family として `takt add --pr`、対話 `--pr`、pipeline `--pr` の全入口を再確認します。
## 判定: REJECT

### SEC-001 — PR 画像の総件数・総容量が無制限（Medium / new）

[prReviewAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:42) は、低信頼な PR 本文・コメントから抽出した一意 URL を、件数や累積容量を検査せずすべてダウンロードします。

- 攻撃者: PR 本文・コメントを編集できる利用者
- 制御入力: 有効な GitHub attachment URL の件数
- 到達経路: `takt add --pr`、対話 `takt --pr`、pipeline `--pr`
- 影響: 帯域、メモリ、一時領域、プロジェクト領域の枯渇によるローカル DoS
- 増幅要因: 各画像は最大 10 MiB まで許可され、pipeline では一時保存後に task spec と run context へ複製されます。

再現手順:

1. PR コメントに、それぞれ異なる有効な最大 10 MiB の attachment URL を多数記載する。
2. `takt --pipeline --pr <番号> --workflow default --skip-git` または `takt add --pr <番号>` を実行する。
3. 期待結果は総件数または総容量到達時の拒否ですが、実際は全 URL が順次取得・保存されます。

修正案:

- 一意 URL の最大件数を、認証・取得前に検査する。
- PR 全体の累積ダウンロード容量上限を設ける。
- `downloadPrImage` に残容量を渡し、Content-Length とストリーム読込の両方で累積上限を強制する。
- 件数・累積容量それぞれについて境界値と超過時の cleanup テストを追加する。

同じ family の3入口はすべて共通ヘルパーを通るため、同一指摘に集約しました。ローカル利用者が直接制御する inline paste は今回の低信頼 PR 境界には含めません。

検証: 対象5テストファイルを実行し、121件すべて成功しました。URL allowlist、Content-Type/magic bytes、単一ファイル上限、秘密ファイル権限、パス要素検証は確認済みです。

---

## testing-review
テスト品質レビューとして、まずタスク正本・全文の判断基準・既存レポートを読み、変更された契約とテスト計画を特定します。その後、指定17ファイルを全件確認し、必要な対象テストだけを実行して根拠を固めます。編集は行いません。
正本では、PR本文・通常コメント・レビュー本文・review threadコメントの4入力から画像を抽出し、検証済みダウンロード、task保存、`order.md`参照、`takt add --pr`とpipeline `--pr`の両経路を保証することが変更契約です。現時点で指定された実験レビューのReport Directoryには既存レポートがなく、テスト計画との突合材料は実装済みテストと上位実行履歴から確認します。
実装済みテストは、計画上の主要正常系とpipelineのworkflow失敗を押さえています。一方、テスト作成レポート自身が未カバーと記録した「add保存例外後」と「対話実行例外後」のcleanupについて、最終実装後もテスト追加がないことを確認しました。共通化した画像形式判定の既存分岐と、run context配置の既存テストも照合して、この不足が別レイヤーで補われていないか確認します。
同一familyの走査を完了しました。対象テスト99件、新規ロジック22件、関連既存32件、分類契約19件はいずれも成功しましたが、成功しているテストは内部production境界を分断しており、計画にも明記された結合未確認と例外時cleanup未確認が最終テストへ残っています。この2件をブロッキングfindingとしてまとめます。
## 判定: REJECT

### 指摘

1. `TR-001`（new、blocking）— PR画像の公開経路を保証する結合テストがありません。

   [pipelineExecution.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/pipelineExecution.test.ts:29) は、画像準備、task spec生成、run context解決をすべてモックしています。[addTask.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/addTask.test.ts:315) も準備済み`TaskAttachment`を直接返しており、実際の抽出・一時保存・永続化を結合していません。既存`taskSpecContext.test.ts`も下位境界単体の検証です。

   外部GitHub取得だけをモックし、実際の`preparePrReviewAttachments`、attachment store、task保存／task spec stagingを通して、画像ファイルと書き換え済み`order.md`を観測する分類済みITを追加してください。

2. `TR-002`（new、blocking）— PR画像取得後に後続処理が例外終了するcleanup経路が未検証です。

   [addTask.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/addTask.test.ts:301) は保存成功とworkflow選択取消だけを検証しています。[cli-routing-pr-resolve.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/cli-routing-pr-resolve.test.ts:370) もPR所有者について成功・取消のみです。同ファイルの一般的な実行例外テストではPR入力がなく、`cleanupSourceAttachments`は検証されません。

   `saveTaskFile()`、`selectAndExecuteTask()`または`saveTaskFromInteractive()`が例外を投げるPR画像付きケースを追加し、一時画像cleanupが1回実行され、元の例外と永続状態が適切に保たれることを確認してください。

### 検証結果

対象・関連テスト171件と分類契約19件はすべて成功しました。テスト命名、AAA構造、モック状態の初期化には追加のブロッキング問題はありません。