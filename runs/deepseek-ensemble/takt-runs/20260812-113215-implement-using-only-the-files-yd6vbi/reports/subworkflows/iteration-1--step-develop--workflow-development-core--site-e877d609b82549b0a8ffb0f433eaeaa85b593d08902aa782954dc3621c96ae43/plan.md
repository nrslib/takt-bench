# タスク計画

## 元の要求

~~~~text
PR コメント内の画像をダウンロードして task attachments に配置する機能を実装してください。

## 背景

現状、`takt add --pr` や `takt --pr` では PR 本文・通常コメント・review thread の本文は取得されるが、コメント内に貼られた PNG などの画像はローカルの `attachments/` に保存されない。

既存の task attachment 仕組みはあるため、PR コメント中の画像 URL を抽出して `TaskAttachment[]` として渡せば、`.takt/tasks/<slug>/attachments/` 配下に配置できるはず。

## 期待する挙動

- `takt add --pr <number>` 実行時に、PR 本文・通常コメント・review thread コメント内の画像 URL を検出する
- 対応画像をローカルにダウンロードする
- `.takt/tasks/<slug>/attachments/` に `image-1.png` などとして保存する
- `order.md` に既存 attachment 形式で追記する

```md
## 添付画像

- [Image #1]: `.takt/runs/20260812-080454-implement-using-only-the-files-djn29j/context/task/attachments/image-1.png`
```

- 元コメント本文内の画像参照も、可能なら `[Image #1]` のように参照できる形に置換または補足する
- pipeline の `--pr` 経路でも同等に画像を参照できること

対象とする画像記法の例:

```md
![screenshot](https://github.com/user-attachments/assets/...)
![image](https://github.com/org/repo/assets/...)
<img src="https://github.com/user-attachments/assets/..." />
```

## 安全性・制約

- 対応形式はまず PNG/JPEG/GIF/WebP
- Content-Type と magic bytes を検証する
- サイズ上限を設ける
- GitHub の private repository 画像に対応するため、`gh api` または認証済み `gh` 経由の取得を優先する
- 外部 URL を無制限に取得しない。GitHub attachment URL から始めるのが安全

## 参考（実装方針案）

- PR 取得後の `PrReviewData` から画像 URL を抽出する（PR body / conversation comments / review summaries / review thread comments）
- Markdown image syntax と HTML `<img src="...">` を対象にする
- ダウンロードした画像を `TaskAttachment[]` に変換する
- `saveTaskFile()` / `prepareTaskSpecDirectory()` に渡す
- pipeline 直実行時も attachment 付き task spec を使う経路を追加する
- PR 取得の既存実装は `src/infra/github/pr.ts` にある

## 品質要件

- 既存のテスト規約に従い、新規ロジックには単体テストを追加する
- `npm run build`、`npm run lint`、`npm test` が全て成功すること
~~~~

## 分析結果

### 目的

GitHub PRの本文・通常コメント・review threadコメントに埋め込まれた画像を、安全に取得して既存のtask attachment経路へ渡し、保存タスクと直接実行の両方でエージェントが画像を参照できるようにする。

指定されたReport Directoryには既存レポートがなく、今回が初回計画である。

### 分解した要件

| # | 要件 | 変更要否 | 種別 | 由来・導出根拠 | 備考 |
|---|------|----------|------|----------------|------|
| 1 | PR本文から画像参照を検出する | 要 | 明示 | `order.md`「期待する挙動」 | `PrReviewData.body`が対象 |
| 2 | 通常のconversation commentから画像参照を検出する | 要 | 明示 | `order.md`「期待する挙動」 | `PrReviewData.comments[].body`が対象 |
| 3 | review threadコメントから画像参照を検出する | 要 | 明示 | `order.md`「期待する挙動」 | `PrReviewData.reviews[]`のうちthread stateを持つ本文が対象 |
| 4 | Markdown画像記法を対象にする | 要 | 明示 | `order.md`「対象とする画像記法の例」「参考」 | `![alt](URL)` |
| 5 | HTML `<img src="...">` 記法を対象にする | 要 | 明示 | `order.md`「対象とする画像記法の例」「参考」 | 引用符付き`src`を対象に含める |
| 6 | 検出した画像をローカルへダウンロードする | 要 | 明示 | `order.md`「期待する挙動」 | 外部I/Oを伴う |
| 7 | PNGを受け入れる | 要 | 明示 | `order.md`「安全性・制約」 | Content-Typeと実データの一致が必要 |
| 8 | JPEGを受け入れる | 要 | 明示 | `order.md`「安全性・制約」 | `.jpg`を保存拡張子として使用可能 |
| 9 | GIFを受け入れる | 要 | 明示 | `order.md`「安全性・制約」 | GIF87a/GIF89aを判定 |
| 10 | WebPを受け入れる | 要 | 明示 | `order.md`「安全性・制約」 | RIFF/WEBPを判定 |
| 11 | レスポンスのContent-Typeを検証する | 要 | 明示 | `order.md`「安全性・制約」 | 対応画像MIME以外を拒否 |
| 12 | magic bytesを検証する | 要 | 明示 | `order.md`「安全性・制約」 | 拡張子やURLだけを信頼しない |
| 13 | ダウンロードサイズに上限を設ける | 要 | 明示 | `order.md`「安全性・制約」 | 具体値は設計判断 |
| 14 | private repository画像に対応するため、`gh api`、認証済み`gh`、または同等の認証済みGitHub取得経路を優先する | 要 | 明示 | `order.md`「安全性・制約」 | 列挙方式だけに狭めない |
| 15 | 任意の外部URLを無制限に取得せず、GitHub attachment URLへ限定して開始する | 要 | 明示 | `order.md`「安全性・制約」 | URL検証とredirect検証が必要 |
| 16 | 元本文の画像記法をプレースホルダーへ置換または補足する | 要 | 明示 | `order.md`「期待する挙動」 | 許容集合は置換または補足。採用案は置換 |
| 17 | `takt add --pr`から画像添付を保存経路へ渡す | 要 | 明示 | `order.md`「期待する挙動」「参考」 | 現行は`saveTaskFile()`へattachmentsを渡していない（`src/features/tasks/add/index.ts:172`） |
| 18 | task attachmentを`.takt/tasks/<slug>/attachments/`へ保存する既存機構 | 不要 — `src/features/tasks/attachments.ts:88`で既に実装済み | 明示 | `order.md`「期待する挙動」 | 新規保存機構を重複実装しない |
| 19 | `order.md`へ既存形式の添付節を追記する既存機構 | 不要 — `src/features/tasks/attachments.ts:35`で既に実装済み | 明示 | `order.md`「期待する挙動」 | `buildTaskOrderContent()`を再利用する |
| 20 | task attachmentをrun contextへ複製して実行時パスへ書き換える既存機構 | 不要 — `src/features/tasks/execute/taskSpecContext.ts:28`、`src/features/tasks/attachments.ts:284`で既に実装済み | 明示 | `order.md`の添付形式例、pipeline参照要求 | attachment付きtask specを作れば既存経路が消費する |
| 21 | 直接`--pr`経路で画像を対話モードと最終実行・保存処理へ渡す | 要 | 明示 | `order.md`「背景」の`takt --pr` | `InteractiveSeedInput.attachments`は既存（`src/features/interactive/interactive.ts:198`） |
| 22 | pipeline `--pr`経路でattachment付きtask specを実行する | 要 | 明示 | `order.md`「期待する挙動」「参考」 | 現行は本文を直接`executeTask()`へ渡す（`src/features/pipeline/steps.ts:334`） |
| 23 | PR本文に画像がある場合、通常コメントとreviewが空でも`add --pr`で画像を保存できる | 要 | 直接導出 | 要件1と17を成立させるため。現行の空コメント拒否は`src/features/tasks/add/index.ts:193` | 画像もない従来の空コメントPRは維持対象 |
| 24 | 画像がないPRの本文整形、branch、base branch、PR contextを維持する | 要 | 維持 | `src/infra/git/format.ts:197`、`src/features/tasks/add/index.ts:205`、`src/features/pipeline/steps.ts:96` | 変更対象外の既存PR契約 |
| 25 | GitHub画像取得に対応しないVCS providerで、任意URL取得や偽の互換実装を追加しない | 要 | 維持 | `src/infra/git/index.ts:34`、`src/infra/gitlab/GitLabProvider.ts:14` | GitLabの既存PR取得を維持 |
| 26 | 新規ロジックへ単体テストを追加する | 要 | 明示 | `order.md`「品質要件」 | 抽出・分類・形式判定を直接検証 |
| 27 | `npm run build`、`npm run lint`、`npm test`を成功させる | 要 | 明示 | `order.md`「品質要件」 | 完了時の必須ゲート |

### 参照資料の調査結果

参照資料として指定された`src/infra/github/pr.ts`では、`gh pr view --json`からPR本文・通常コメント・review summaryを取得し、GraphQLからreview threadコメントを取得して`PrReviewData`へ統合している（`src/infra/github/pr.ts:108`、`:127`、`:314`、`:421`）。

現行実装との差異は以下のとおり。

- `PrReviewData`は本文を保持するが画像attachmentを表現しない（`src/infra/git/types.ts:120`）。
- `fetchPrReviewComments()`はテキスト取得のみで、画像URL抽出、画像取得、Content-Type検証、magic bytes検証、一時ファイル管理を行わない（`src/infra/github/pr.ts:421`）。
- `formatPrReviewAsTask()`はPR本文、review、conversation commentを文字列として連結するだけである（`src/infra/git/format.ts:197`）。
- 既存attachment基盤は`StoredImageAttachment`の`placeholder`、`tempPath`、`fileName`を受け取れば、保存・添付節生成・run context複製を行える（`src/shared/types/image-attachments.ts:1`、`src/features/tasks/attachments.ts:35`）。
- pipelineではattachment付きtask specを作らず、整形済み本文を直接実行している（`src/features/pipeline/steps.ts:213`、`:355`）。

「参考（実装方針案）」は設計候補として扱う。PR本文・通常コメント・review threadコメントは明示対象とし、review summaryは同じ`PrReviewData.reviews`内に存在するため抽出処理を共通適用する設計を採るが、独立した受入要件にはしない。

### スコープ

変更対象:

- GitHub PR本文からの画像参照抽出・本文置換
- 認証済み画像取得、URL・redirect・MIME・magic bytes・サイズ検証
- 検証済み画像のprivateな一時保存と解放
- Git providerの任意画像解決capability
- `takt add --pr`へのattachments配線
- 直接`takt --pr`のinteractive seed、実行、保存、キャンセルへの配線
- pipeline `--pr`でのattachment付きtask spec生成と実行
- PR画像と対話中に追加された画像のプレースホルダー採番
- 対象処理の単体テスト、必要な軽量統合テスト、既存入口テスト

維持対象:

- 画像を含まないPRの整形結果
- PR head/base branchとPR context
- 画像もコメントもないPRに対する既存`add --pr`エラー
- 通常タスク、Issue入力、GitLab入力
- 既存のtask attachment保存形式
- 既存の対話画像貼り付け機能

信頼境界・副作用:

- PR本文は外部の非信頼文字列である。
- 画像URLとredirect先はネットワーク境界で検証する。
- GitHub認証情報は取得処理だけが使用し、ログ・エラー・task本文へ出力しない。
- 一時画像の所有者はPR画像解決結果とし、保存・実行・キャンセル・失敗後に解放する。
- 永続化所有者は既存のtask attachment機構、run context複製所有者は既存task spec実行機構とする。

### 検討したアプローチ

| アプローチ | 採否 | 理由 |
|-----------|------|------|
| `fetchPrReviewComments()`自体が常に画像を取得する | 不採用 | system workflowなど画像を必要としない既存利用側へネットワーク・一時ファイル副作用を追加し、解放責務も不明確になる |
| `PrReviewData`へ常設のattachmentフィールドを追加する | 不採用 | provider-neutralなテキスト取得契約とGitHub固有I/Oを混在させる |
| `GitProvider`へ任意のPR画像解決capabilityを追加し、GitHubだけが実装する | 採用 | GitHub固有処理をprovider境界に閉じ、GitLabへ偽の互換実装を要求せず、既存テストダブルも必要以上に変更しない |
| 全入力で独自Markdown ASTを構築する | 不採用 | 対象記法に対して過大。依存パッケージも現行にない |
| コード領域を識別する小さなscannerと対象記法parserを組み合わせる | 採用 | タスク本文内のコード例を誤取得せず、対象記法に必要な構造だけを扱える |
| URL拡張子から画像形式を決める | 不採用 | GitHub attachment URLは拡張子を持たない場合があり、Content-Typeとmagic bytes検証要求を満たさない |
| `gh auth token`で認証情報を得て、制限付きHTTP取得を行う | 採用 | 認証済み`gh`を利用しつつ、Content-Type、ストリームサイズ、redirect先を実装側で検証できる |
| pipelineで本文へ一時ファイルパスだけを追加する | 不採用 | run contextへ画像が複製されず、一時ファイル解放後に参照不能になる |
| pipelineで既存`prepareTaskSpecDirectory()`を利用する | 採用 | 保存済みタスクと同じattachment形式・run context複製契約を再利用できる |

### 実装アプローチ

1. 共通の画像形式契約を整理する。

   - `src/shared/utils/imageFormat.ts`を追加し、PNG/JPEG/GIF/WebPのmagic bytes判定、MIMEから拡張子への変換、共通サイズ上限を所有させる。
   - `src/features/interactive/inlineImagePaste.ts`と`src/features/interactive/imageAttachments.ts`の既存判定を共通関数へ移す。
   - 既存の`MAX_INLINE_IMAGE_BYTES`という観測可能なexportは維持し、共通上限定数を参照させる。

2. PR画像解決契約を追加する。

   - `src/infra/git/types.ts`に、置換済み`PrReviewData`、`StoredImageAttachment[]`、冪等なcleanupを返す結果型と、任意のprovider capabilityを定義する。
   - `src/infra/github/prReviewImageAttachments.ts`を追加し、本文走査、URL重複排除、プレースホルダー採番、認証付き取得、検証、一時保存を担当させる。
   - `src/infra/github/GitHubProvider.ts`からこのcapabilityへ委譲する。
   - GitLabには空結果を返す別名実装を追加しない。

3. 構造化入力を分類する。

   - PR本文・comment本文を不変のまま走査し、fenced code、inline code、HTML commentを非対象領域として分離する。
   - 対象領域だけでMarkdown画像とHTML`img`を解析する。
   - 初期URLはHTTPSかつ明示されたGitHub attachment URL形式に限定する。
   - redirectは手動追跡し、回数上限と許可されたGitHub管理下の画像配信先を検証する。
   - 同一URLは一度だけ取得し、全出現箇所を同じプレースホルダーへ置換する。

4. 識別子を衝突なく生成する。

   - 対象`PrReviewData`全体に既に存在する`[Image #N]`を収集する。
   - 既存番号と同一処理内の生成済み番号を避け、`image-N.<ext>`と`[Image #N]`を同じ番号で生成する。
   - 対話モードの画像storeも、初期attachmentsの最大番号を基に次番号を決め、PR画像と後続貼り付け画像の衝突を防ぐ。

5. 画像取得を安全に行う。

   - `gh auth token`から得た資格情報をHTTP Authorizationへ使用する。
   - Content-Lengthによる事前判定と、読み取り済みbyte数による実測判定の両方を行う。
   - 上限には既存インライン画像上限と同じ10 MiBを採用する。
   - Content-Typeとmagic bytesが同じ対応形式を示す場合だけ保存する。
   - 認証情報をログや例外へ含めない。
   - 対象として認識したGitHub attachmentの取得・検証失敗は黙って無視せず、処理を失敗させる。
   - 任意外部URLや非対象記法は取得せず、本文を維持する。
   - 途中失敗時はその処理で作成済みの一時領域を削除する。

6. 各入口へ配線する。

   - `src/features/tasks/add/index.ts`: PR取得後に画像を解決し、置換済みPRを整形してattachmentsを`saveTaskFile()`へ渡す。画像がある場合はコメント配列が空でも保存する。workflowキャンセル・保存失敗を含めcleanupする。
   - `src/app/cli/routing-inputs.ts`: `resolvePrInput()`の結果へattachmentsとcleanup所有権を追加する。
   - `src/app/cli/routing.ts`: PR attachmentsを`InteractiveSeedInput.attachments`へ渡し、execute・save_task・cancel・モード選択キャンセル・例外の終了後にcleanupする。
   - `src/features/pipeline/steps.ts`、`src/features/pipeline/execute.ts`: PR attachmentsを保持する`TaskContent`を非同期で解決し、execution context決定後に既存`prepareTaskSpecDirectory()`と`resolveTaskSpecForExecution()`でattachment付きtask specを生成する。`executeTask()`へ一致する`taskSpec`と`reportDirName`を渡し、全終了経路で一時task specとダウンロード領域をcleanupする。

7. テストを追加・更新する。

   - 純粋な抽出・分類・採番・形式判定は単体テストで検証する。
   - 認証取得、HTTP応答、実ファイル保存、サイズ超過、途中失敗時cleanupは外部I/Oをtest doubleへ置き換えた軽量統合テストで検証する。
   - add、直接CLI、pipelineの既存テストでproducerからconsumerまでの配線を直接観測する。

### 完了契約

| 契約ID | 要求・維持事項 | 由来 | 成立する振る舞い | 拒否すべき誤実装 | 実装箇所 | 完了証拠 |
|--------|----------------|------|------------------|--------------------|----------|----------|
| `PRIMG-EXTRACT` | PR本文・通常コメント・review thread本文の対象記法を検出し、画像参照をプレースホルダーへ置換または補足する | 要件1〜5、16 | `SCN-PRIMG-EXTRACT-P1`、`SCN-PRIMG-EXTRACT-P2` | `SCN-PRIMG-EXTRACT-N1`、`SCN-PRIMG-EXTRACT-N2` | `src/infra/github/prReviewImageAttachments.ts`、`src/infra/git/types.ts` | parser単体テストで各本文種別、各記法、正負文脈、重複URL、採番を直接確認 |
| `PRIMG-VALIDATE` | PNG/JPEG/GIF/WebPだけを、Content-Type・magic bytes・サイズ・URLを検証して認証付きで取得する | 要件6〜15 | 許可GitHub attachmentから各対応形式を取得し、検証済み拡張子でprivate一時ファイルを生成する | 任意外部URL取得、MIME不一致、magic不一致、上限超過、未検証redirect、token露出 | `src/infra/github/prReviewImageAttachments.ts`、`src/shared/utils/imageFormat.ts` | 各形式の単体テストと、HTTP/test doubleを使った取得・拒否・cleanupの軽量統合テスト |
| `PRIMG-ADD` | `takt add --pr`で画像をtask attachmentsとして保存し、既存形式の添付節を生成する | 要件17〜19、23 | `.takt/tasks/<slug>/attachments/image-N.<ext>`と`order.md`の添付節が生成され、本文画像のみのPRも保存される | attachmentを取得しても`saveTaskFile()`へ渡さない、本文画像だけのPRをコメントなしとして拒否する | `src/features/tasks/add/index.ts`、既存`src/features/tasks/attachments.ts` | `src/__tests__/addTask.test.ts`で実ファイル、`order.md`、task metadata、cleanupを確認 |
| `PRIMG-DIRECT` | 直接`takt --pr`で画像を対話モード、実行、保存へ渡す | 要件21 | source context内のプレースホルダーと初期attachmentsがinteractive seedへ渡り、execute/save_taskでtask specへ流れる | 画像本文だけを渡す、モード選択キャンセルや例外で一時画像を残す、後続貼り付け画像と番号衝突する | `src/app/cli/routing-inputs.ts`、`src/app/cli/routing.ts`、`src/features/interactive/imageAttachments.ts` | `src/__tests__/cli-routing-pr-resolve.test.ts`と`src/__tests__/imageAttachments.test.ts`で全action・cleanup・採番を確認 |
| `PRIMG-PIPELINE` | pipeline `--pr`でattachment付きtask specを使い、run contextから画像を参照できる | 要件20、22 | `order.md`と画像がrun contextのtaskディレクトリへstageされ、実行promptがそのtask specを参照する | 一時ファイルパスだけを本文へ追加する、`taskSpec`と`reportDirName`を不一致にする、終了後も一時task specを残す | `src/features/pipeline/steps.ts`、`src/features/pipeline/execute.ts`、既存`src/features/tasks/execute/taskSpecContext.ts` | `src/__tests__/pipelineExecution.test.ts`で`executeTask()`引数、staged order、画像、cleanupを確認 |
| `PRIMG-MAINTAIN` | 画像なしPR、PR metadata、空コメントPRの従来動作、非対応VCS providerを維持する | 要件24、25 | 画像なしでは従来の整形・branch/base branch・PR contextを維持し、addの画像もコメントもないPRは従来どおり拒否する | 全providerへ画像取得を強制する、GitLabへGitHub URL処理を追加する、既存PR contextを欠落させる | 上記入口ファイル、`src/infra/git/types.ts`、`src/infra/gitlab/GitLabProvider.ts`は原則変更不要 | add、routing、pipeline、GitHub/GitLab provider既存テストの回帰 |
| `PRIMG-QUALITY` | 新規ロジックの単体テストと指定品質ゲートを成功させる | 要件26、27 | 対象テスト、build、lint、unit gateが全て成功する | 広いテスト成功だけで個別契約を未検証のまま完了扱いする | `src/__tests__/`、必要なtest classification | 契約別対象テスト、`npm run build`、`npm run lint`、`npm test`の実行結果 |

### 要求シナリオ（条件付き）

~~~gherkin
Scenario: [SCN-PRIMG-EXTRACT-P1] 対象本文のMarkdown画像をattachment参照へ変換する
  Given PR本文に `![screenshot](https://github.com/user-attachments/assets/abc)` がある
  When PR画像を解決する
  Then 画像は1件取得され、本文の画像記法は `[Image #1]` を含む参照へ変換される

Scenario: [SCN-PRIMG-EXTRACT-N1] コードフェンス内の画像記法例は取得しない
  Given PR本文のコードフェンス内に `![screenshot](https://github.com/user-attachments/assets/abc)` がある
  When PR画像を解決する
  Then 画像は取得されず、コードフェンス内の文字列は変更されない

Scenario: [SCN-PRIMG-EXTRACT-P2] 複数の新規画像へ重複しない識別子を割り当てる
  Given 通常コメントに異なる2つのGitHub attachment URLがある
  When PR画像を解決する
  Then 2件の画像に `[Image #1]` と `[Image #2]` および対応する `image-1.*` と `image-2.*` が割り当てられる

Scenario: [SCN-PRIMG-EXTRACT-N2] 既存プレースホルダーと新規画像の識別子を衝突させない
  Given PR本文に既存の `[Image #1]` と新しい `![new](https://github.com/user-attachments/assets/new)` がある
  When PR画像を解決する
  Then 新しい画像には `[Image #1]` 以外の未使用番号が割り当てられる
~~~

### 影響経路（該当する契約のみ）

| 契約ID | 定義・生成 | 変換・保存・復元 | 消費・出力・補助入口 | 状態・所有権 | 現行利用側の移行 | 明示された支援 |
|--------|------------|------------------|---------------------|-------------|------------------|------------------|
| `PRIMG-EXTRACT` | `PrReviewData`、GitHub画像解決capability | 本文走査、URL重複排除、置換済み`PrReviewData`生成 | `formatPrReviewAsTask()`、add、direct routing、pipeline | 入力は変更せず新しいデータを返す | 3つのPR入口だけが画像解決結果を使用 | なし |
| `PRIMG-VALIDATE` | GitHub attachment URL、認証済みHTTP response | URL検証、redirect検証、byte読み取り、MIME/magic判定、一時保存 | `StoredImageAttachment[]` | PR画像解決結果が一時領域とcleanupを所有 | GitHub PR画像入口のみ | private repository画像取得 |
| `PRIMG-ADD` | `addTask()`のPR分岐 | `saveTaskFile()`→`prepareTaskSpecDirectory()`→`promoteTaskAttachments()` | `.takt/tasks/<slug>/order.md`、`attachments/` | 保存後はtaskディレクトリが永続画像を所有 | 現行`add --pr`をattachment付き入力へ移行 | なし |
| `PRIMG-DIRECT` | `resolvePrInput()` | `InteractiveSeedInput.attachments`→interactive result→`selectAndExecuteTask()`または`saveTaskFromInteractive()` | 対話AI、直接実行task spec、保存task | routingがPR一時画像のcleanupを最後まで所有 | 現行直接`--pr`の各interactive mode/actionを移行 | なし |
| `PRIMG-PIPELINE` | `resolveTaskContent()` | `prepareTaskSpecDirectory()`→`resolveTaskSpecForExecution()`→`stageTaskSpecForExecution()` | workflowのcontext task/orderとattachments | pipelineが一時task specとPR一時画像を所有し、終了後解放 | 現行本文直接実行をattachment付きtask specへ移行 | なし |
| `PRIMG-MAINTAIN` | 既存PR metadataとprovider選択 | 従来のformatter、branch解決、PR context生成 | add、direct、pipeline、GitLab入口 | 既存所有権を変更しない | 画像を含むGitHub PR入口だけを追加経路へ移す | なし |

### 到達経路・起動条件

| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `takt add --pr <number>`、`takt --pr <number>`、`takt --pipeline --pr <number> --workflow <workflow>` |
| 更新が必要な呼び出し元・配線 | `src/features/tasks/add/index.ts`、`src/app/cli/routing-inputs.ts`、`src/app/cli/routing.ts`、`src/features/pipeline/steps.ts`、`src/features/pipeline/execute.ts` |
| 起動条件 | GitHub providerが選択され、PR本文・対象コメントの非コード領域に許可されたGitHub attachment URLを持つMarkdown画像またはHTML画像があること |
| 未対応項目 | なし |

## 実装ガイドライン

- GitHub固有の認証・URL・HTTP処理を`src/infra/github/`外へ漏らさない。
- provider-neutral層は任意capabilityと共有結果型だけを知り、GitLabへ不要なno-op実装を追加しない。
- `PrReviewData`やコメント配列を直接変更せず、置換済みの新しいオブジェクトを返す。
- 入力解釈、画像取得、検証、一時保存を段階分離する。メインのadd/routing/pipeline処理へ正規表現やmagic bytes判定を埋め込まない。
- 既存の画像判定パターンは`src/features/interactive/inlineImagePaste.ts:45`、MIMEから拡張子への変換は`src/features/interactive/imageAttachments.ts:33`を参照し、同じ知識を別実装として複製しない。
- 既存attachment保存パターンは`src/features/tasks/attachments.ts:35`、`:88`、`:266`をそのまま利用する。
- pipelineのtask spec実行パターンは`src/features/tasks/execute/selectAndExecute.ts:121`と`src/features/tasks/execute/taskSpecContext.ts:57`を参照し、`taskSpec.runSlug`と`reportDirName`を一致させる。
- URL文字列をshell commandとして組み立てない。子プロセスを使用する場合は`execFile`系の引数配列で渡す。
- Authorization token、response header全体、PRの生本文をログへ出力しない。
- サイズ上限はContent-Lengthだけでなく、実際に読み取ったbyte数でも強制する。
- redirectを自動追跡して任意ホストへAuthorizationを転送しない。各遷移先を検証してから次の要求を行う。
- 対象画像の取得・検証エラーを空attachmentsへ変換して握りつぶさない。
- cleanupは冪等にし、正常終了、保存失敗、実行失敗、利用者キャンセル、モード選択キャンセルの全経路を覆う。
- task本文中のコードフェンスやインラインコードにある画像記法例を実画像として扱わない。
- `/g`付き正規表現をモジュールスコープで`test()`と共有しない。
- 新規パラメータはproducer、伝播、consumer、テストダブルを同じ変更で更新する。
- 新規軽量統合テストを追加する場合は`src/__tests__/releaseVerificationWiring.test.ts`を単体実行する。
- 対象テスト後、`npm run build`、`npm run lint`、`npm test`、`npm run test:it`を実行する。CLI・pipeline変更の回帰として`npm run test:e2e:mock`も実行する。

## スコープ外

| 項目 | 除外理由 |
|------|---------|
| GitHub attachment URL以外の任意外部画像 | 明示的に無制限取得を禁止されている |
| SVG、BMP、TIFF、動画、文書添付 | 対応形式がPNG/JPEG/GIF/WebPに限定されている |
| PR以外のIssueコメント画像 | 要求された入口はPRであり、Issue画像への拡張要求がない |
| GitLab merge request画像のダウンロード | GitHub attachmentと認証済み`gh`が明示対象である |
| 既存保存済みタスクへのbackfill・migration | 既存データ支援の明示要求がない |
| キャッシュ、並列ダウンロード、設定可能な上限値 | 性能要件・設定追加要求がなく、今回の完了に不要 |
| PR画像のalt文言を保持する独自表示形式 | 要求はプレースホルダーへの置換または補足であり、追加表示契約は指定されていない |