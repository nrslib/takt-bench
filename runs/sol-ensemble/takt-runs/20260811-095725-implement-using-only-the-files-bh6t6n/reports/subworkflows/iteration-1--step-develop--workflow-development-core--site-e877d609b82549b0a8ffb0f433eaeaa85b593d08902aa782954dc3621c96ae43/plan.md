# タスク計画

## 元の要求

```text
Implement using only the files in `.takt/runs/20260811-095725-implement-using-only-the-files-bh6t6n/context/task`.
Primary spec: `.takt/runs/20260811-095725-implement-using-only-the-files-bh6t6n/context/task/order.md`.
Use report files in Report Directory as primary execution history.
Do not rely on previous response or conversation summary.
```

```markdown
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

- [Image #1]: `.takt/runs/20260811-095725-implement-using-only-the-files-bh6t6n/context/task/attachments/image-1.png`
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
```

## 分析結果

### 目的

PR本文・通常コメント・レビュー本文に埋め込まれたGitHub画像を、安全にローカルのtask attachmentへ取り込み、`takt add --pr`、対話型`--pr`、pipelineの`--pr`のいずれでもワークフローから参照できるようにする。

Report Directoryには既存レポートがなく、参照できる過去実行履歴はない。要求の正本は `context/task/order.md` のみである。

### 分解した要件

| # | 要件 | 変更要否 | 種別 | 由来・導出根拠 | 備考 |
|---|------|----------|------|----------------|------|
| 1 | `takt add --pr`でPR本文内の画像記法を検出する | 要 | 明示 | `order.md`「期待する挙動」第1項 | 現行は `src/infra/git/format.ts:202` で本文をそのまま追加する |
| 2 | `takt add --pr`で通常のconversation comment内の画像記法を検出する | 要 | 明示 | `order.md`「期待する挙動」第1項 | 現行は `src/infra/git/format.ts:248` で本文をそのまま追加する |
| 3 | review thread comment内の画像記法を検出する | 要 | 明示 | `order.md`「期待する挙動」第1項 | threadは `src/infra/github/pr.ts:346` で `PrReviewComment` へ変換される |
| 4 | review summary内の画像記法も同じ処理対象にする | 要 | 明示 | `order.md`「参考（実装方針案）」の対象列挙 | summaryとthreadは `src/infra/git/format.ts:214` で同じreviews配列から分類される |
| 5 | Markdown画像記法 `![...](URL)` を処理する | 要 | 明示 | `order.md`「対象とする画像記法の例」 | 通常リンクは対象に含めない |
| 6 | HTML `<img src="...">` 記法を処理する | 要 | 明示 | `order.md`「対象とする画像記法の例」 | `src`以外の属性順序も考慮する |
| 7 | 検出した対応画像をローカルへダウンロードする | 要 | 明示 | `order.md`「期待する挙動」第2項 | 現行のPR取得経路には画像取得処理がない |
| 8 | ダウンロード画像を `.takt/tasks/<slug>/attachments/image-N.<ext>` に保存する | 要 | 明示 | `order.md`「期待する挙動」第3項 | 保存機構自体は `src/features/tasks/attachments.ts:88` に存在するため、PR経路からの配線が必要 |
| 9 | `order.md`へ既存の「添付画像」形式で参照を追記する | 要 | 明示 | `order.md`「期待する挙動」第4項 | 既存生成処理は `src/features/tasks/attachments.ts:35` にある |
| 10 | 元の画像記法をplaceholderへ置換する、または同等にplaceholderで参照できる情報を補足する | 要 | 明示 | `order.md`「置換または補足」 | 許容される複数方式を要件上は維持し、採用方式は設計判断とする |
| 11 | pipelineの`--pr`でもattachment付きtask specを使用する | 要 | 明示 | `order.md`「pipeline の `--pr` 経路でも同等」 | 現行は `src/features/pipeline/steps.ts:223` で通常文字列を作り、同ファイル`:355`で直接実行する |
| 12 | PNGを受け付ける | 要 | 明示 | `order.md`「対応形式」 | Content-Typeとmagicの双方を検証 |
| 13 | JPEGを受け付ける | 要 | 明示 | 同上 | 同上 |
| 14 | GIFを受け付ける | 要 | 明示 | 同上 | 同上 |
| 15 | WebPを受け付ける | 要 | 明示 | 同上 | 同上 |
| 16 | HTTP Content-Typeを検証する | 要 | 明示 | `order.md`「安全性・制約」 | 対応MIME以外は保存しない |
| 17 | 画像データのmagic bytesを検証する | 要 | 明示 | `order.md`「安全性・制約」 | 既存判定は `src/features/interactive/inlineImagePaste.ts:45` にあるが、PR画像取得では未使用 |
| 18 | 画像ごとのサイズ上限を設ける | 要 | 明示 | `order.md`「安全性・制約」 | 上限値自体は要求未指定のため設計判断とする |
| 19 | private repository画像へ認証付きでアクセスする | 要 | 明示 | `order.md`「`gh api` または認証済み `gh` 経由」 | 列挙された方法または同等の認証済み取得方式を許容する |
| 20 | 取得開始URLをGitHub attachment URLへ限定し、任意の外部URLを取得しない | 要 | 明示 | `order.md`「外部 URL を無制限に取得しない」 | 画像記法として検出してもallowlist外は取得しない |
| 21 | 対話型 `takt --pr` の初期コンテキストから実行・保存までattachmentを維持する | 要 | 直接導出 | 通常`--pr`でも画像を参照可能にする明示要求に不可欠 | `InteractiveSeedInput`は `src/features/interactive/interactive.ts:198` で初期attachmentを受け付ける |
| 22 | ダウンロード用一時ファイルを成功・取消・失敗時に解放する | 要 | 直接導出 | ローカルダウンロードという新規副作用を安全に完結させるため不可欠 | 個別returnへcleanupを散在させない |
| 23 | 非画像のPR本文、通常コメント、レビュー分類と出力順を維持する | 要 | 維持 | `src/infra/git/format.ts:197` の観測可能な既存出力契約 | 画像処理のために既存レビュー分類を再実装しない |
| 24 | PR番号、head/base branch、PR contextの既存伝播を維持する | 要 | 維持 | `src/features/tasks/add/index.ts:205`、`src/app/cli/routing.ts:125`、`src/features/pipeline/steps.ts:225` | attachment追加と無関係なPR実行契約 |
| 25 | 新規ロジックへ単体テストを追加する | 要 | 明示 | `order.md`「品質要件」 | URL抽出、検証、置換を直接観測する |
| 26 | `npm run build`を成功させる | 不要 — 実装変更ではなく完了時の検証義務 | 明示 | `order.md`「品質要件」 | 実装後に実行する |
| 27 | `npm run lint`を成功させる | 不要 — 実装変更ではなく完了時の検証義務 | 明示 | 同上 | 実装後に実行する |
| 28 | `npm test`を成功させる | 不要 — 実装変更ではなく完了時の検証義務 | 明示 | 同上 | 実装後に実行する |

### 参照資料の調査結果

タスク指示書に外部の「参照資料」セクションはない。「参考（実装方針案）」として指定された現行コードを確認した。

- `src/infra/github/pr.ts:421` は `gh pr view` とGraphQL review threadsから `PrReviewData` を生成している。画像URLは各body文字列内に保持されるが、画像取得は行わない。
- `src/infra/git/format.ts:197` はPR本文、review summary、thread、conversation commentを最終task文字列へ集約する。
- `src/features/tasks/add/index.ts:180` はPR取得後、`:198`で文字列化し、`:212`でattachmentなしの `saveTaskFile()` を呼ぶ。
- `src/features/tasks/attachments.ts:35` はattachment付き `order.md` を作成し、`:88`でtask directoryへ画像をコピーする。
- `src/features/tasks/execute/taskSpecContext.ts:28` はtask attachmentパスをrun context用に書き換え、`:80`で `.takt/runs/<run>/context/task/attachments` へコピーする。
- `src/features/pipeline/steps.ts:213` のPR pipelineはattachment情報を持たず、`:334`の実行経路もtask specを渡していない。

参考案の意図は、既存attachment保存・run context転送を再実装せず、PR入力から `TaskAttachment[]` への変換と各入口の配線を追加することにある。この意図を維持する。

### スコープ

変更対象:

- PR task文字列からのMarkdown／HTML画像参照抽出
- GitHub attachment URLの認証付き取得と画像検証
- ダウンロード結果の `TaskAttachment[]` 化
- `takt add --pr` の保存配線
- 対話型 `takt --pr` の初期attachment、実行、保存、cleanup配線
- pipeline `--pr` のattachment付きtask spec生成・実行
- 既存magic bytes判定の共通化
- 上記を直接検証するunit／light integration test

維持対象:

- `PrReviewData`の取得・review thread pagination
- PRレビュー分類と非画像テキストの書式
- task attachmentの永続化形式
- run contextへのattachment転送形式
- PR branch、base branch、PR context、trace metadata
- issue入力、直接task入力、非PR pipeline

対象外:

- GitHub Issue本文・Issueコメント画像
- GitLab固有attachment URL
- 一般Webサイトや任意ホストの画像
- SVG、BMP、TIFF等の追加形式
- attachmentサイズ上限の設定項目追加
- 既存PRレビュー取得APIや `PrReviewData` の不要な契約置換

### 検討したアプローチ

| アプローチ | 採否 | 理由 |
|-----------|------|------|
| `PrReviewData`のbody/comments/reviewsを個別に走査して各フィールドを書き換える | 不採用 | `formatPrReviewAsTask()`が行うreview分類を画像処理側で意識する必要があり、生成経路ごとの配線漏れを起こしやすい |
| `formatPrReviewAsTask()`後の最終task文字列を1回走査する | 採用 | PR本文、summary、thread、conversation commentの全てが既に集約されており、既存の分類・順序を維持したまま同一規則を適用できる |
| 元画像記法を残し、別節だけにplaceholderを補足する | 不採用 | 許容方式ではあるが、AIが外部URLとローカル画像のどちらを使うべきか曖昧になる |
| 元画像記法全体を `[Image #N]` へ置換する | 採用 | 要求の許容集合内であり、既存attachment参照契約へ直接接続できる |
| GitHub取得処理を `GitProvider.fetchPrReviewComments()` に組み込む | 不採用 | system stepなど画像を消費しない既存利用側まで一時ファイル副作用を負い、cleanup所有者が不明確になる |
| PR task準備時だけGitHub画像downloaderを呼ぶ | 採用 | 画像を実際に保存・実行する3入口だけが副作用とcleanupを所有できる |
| 各入口でmagic bytes判定を複製する | 不採用 | 既存の貼り付け画像とPR画像で安全性規則が乖離する |
| 既存magic bytes判定をshared helperへ集約する | 採用 | 同じ4形式・同じデータ契約を共有する実在する2経路がある |
| pipelineで画像パスをtask文字列へ直接埋め込む | 不採用 | run contextへのコピーとパス書換えを迂回し、実行資産の消費境界が既存task attachmentと異なる |
| pipelineでも `prepareTaskSpecDirectory()` と `resolveTaskSpecForExecution()` を使う | 採用 | 既存の保存・manifest・run context転送契約をそのまま再利用できる |

### 実装アプローチ

1. 画像形式判定を共有化する。
   - `src/shared/utils/imageFormat.ts` を追加し、PNG/JPEG/GIF/WebPのmagic bytesからMIMEを返す。
   - `src/features/interactive/inlineImagePaste.ts:45` の既存判定を共有helperへ置き換える。
   - 未対応magicは明示エラーとし、フォールバック拡張子を使用しない。

2. GitHub attachment downloaderを追加する。
   - `src/infra/github/prImageDownload.ts` にGitHub固有の認証・HTTP処理を閉じ込める。
   - 開始URLはHTTPS、認証情報なし、`github.com`、かつ `/user-attachments/assets/...` または `/<owner>/<repo>/assets/...` のみに限定する。
   - `gh auth token`等の認証済みgh情報を使用し、認証値をログ・例外へ含めない。
   - Content-Typeを `image/png`、`image/jpeg`、`image/gif`、`image/webp` に限定する。
   - Content-Lengthと実受信バイト数の双方へ上限を適用する。
   - magic bytesとContent-Typeが一致しなければ拒否する。
   - サイズ上限は既存 `MAX_INLINE_IMAGE_BYTES` と同じ10 MiBを採用する。要求にない設定項目は追加しない。

3. PR review task準備処理を追加する。
   - `src/features/tasks/prReviewAttachments.ts` を追加する。
   - `formatPrReviewAsTask(prReview)` の結果からMarkdown画像とHTML `<img>` を出現順に抽出する。
   - allowlist外URLはダウンロード対象にせず、元の本文を維持する。
   - 同一URLは1回だけ取得し、全出現箇所を同一placeholderへ置換する。
   - 既存のimage attachment storeで `image-N.<ext>` と `TaskAttachment[]` を生成する。
   - 加工済みtask文字列、attachments、冪等なcleanup関数を返す。
   - 一件でも対応対象画像の検証・取得に失敗した場合は一時領域を解放して失敗を上位へ伝播する。

4. `takt add --pr`へ配線する。
   - `src/features/tasks/add/index.ts:180` のPR取得後にtask準備処理を呼ぶ。
   - `src/features/tasks/add/index.ts:212` の `saveTaskFile()` へattachmentsを渡す。
   - workflow選択取消、保存失敗、成功を覆う単一の `try/finally` でダウンロード元を解放する。
   - `saveTaskFile()`以降は既存の `prepareTaskSpecDirectory()` が `.takt/tasks/<slug>/attachments` と「添付画像」節を生成する。

5. 対話型 `takt --pr`へ配線する。
   - `src/app/cli/routing-inputs.ts:50` の戻り値へ加工済みsource context、attachments、cleanupを追加する。
   - `src/app/cli/routing.ts:204` の `InteractiveSeedInput` へ初期attachmentsを渡す。
   - 既存の `src/app/cli/routing.ts:298`、`:325` のresult attachment配線を利用して直接実行とtask保存へ伝播する。
   - workflow選択取消やinteractive mode選択取消を含むPR入力の全利用期間を単一の `try/finally` で囲み、初期download storeを解放する。
   - interactive result側の既存cleanupと初期download storeのcleanupを別所有者として両方実行する。

6. pipelineへ配線する。
   - `src/features/pipeline/steps.ts:34` の `TaskContent` へPR attachmentsとcleanup所有情報を追加する。
   - `resolveTaskContent()`を非同期化し、PR時だけPR review task準備処理を呼ぶ。
   - `runWorkflow()`でattachmentsがある場合、`prepareTaskSpecDirectory()`、`generateExecutionReportDir()`、`resolveTaskSpecForExecution()`を用いて `taskSpec` と一致する `reportDirName` を `executeTask()`へ渡す。
   - workflow終了後、transientな `.takt/tasks/<slug>` を削除する。run context側は既存実行成果物として維持する。
   - `src/features/pipeline/execute.ts:40` で非同期解決とdownload cleanupを所有し、準備・Git・workflow・commitの各失敗returnを含む `finally` で解放する。

7. テストを追加・更新する。
   - 抽出・置換とURLallowlistをunit testで直接検証する。
   - HTTPヘッダー、magic、サイズ、認証をmocked fetch／child processでunit testする。
   - add、interactive routing、pipelineのproducerからconsumerまでを既存テストまたはlight integration testで検証する。

### 完了契約

| 契約ID | 要求・維持事項 | 由来 | 成立する振る舞い | 拒否すべき誤実装 | 実装箇所 | 完了証拠 |
|--------|----------------|------|------------------|--------------------|----------|----------|
| `PRIMG-01` | PR本文・通常コメント・review summary・review threadのMarkdown／HTML画像を検出する | 要件1〜6 | `formatPrReviewAsTask()`後の全対象本文にある対応画像記法が漏れなく抽出される | PR本文だけ、またはconversation commentだけを走査する | `src/features/tasks/prReviewAttachments.ts` | 各本文種別と両記法を含むunit test |
| `PRIMG-02` | GitHub attachment画像のみを認証付きで安全に取得する | 要件7、12〜20 | 許可URLの4形式だけがContent-Type・magic・サイズ検証後に返る | 任意URL取得、Content-Typeのみの信用、上限超過後の保存、tokenのログ出力 | `src/infra/github/prImageDownload.ts`、`src/shared/utils/imageFormat.ts` | URL拒否、4形式成功、MIME不一致、magic不一致、サイズ超過、認証headerのunit test |
| `PRIMG-03` | `takt add --pr`で画像とattachment節をtask directoryへ保存する | 要件8、9 | `.takt/tasks/<slug>/attachments/image-N.<ext>` と対応する `order.md` 行が生成される | attachment配列を生成するだけで `saveTaskFile()`へ渡さない | `src/features/tasks/add/index.ts`、既存 `src/features/tasks/attachments.ts` | 実filesystemを使う `addTask.test.ts` |
| `PRIMG-04` | 元画像をplaceholderで参照可能にする | 要件10 | 対応画像記法が `[Image #N]` に置換され、attachment一覧と番号が一致する | URLを削除するだけ、placeholderと保存ファイル番号が不一致 | `src/features/tasks/prReviewAttachments.ts` | 複数画像、重複URL、Markdown／HTML混在unit test |
| `PRIMG-05` | 対話型 `takt --pr`でattachmentを初期入力から実行・保存まで伝播する | 要件21 | interactive seed、execute、save_taskの全経路で同じattachmentが利用可能 | ダウンロードはするがinteractive seedへ渡さない、保存時に落とす | `src/app/cli/routing-inputs.ts`、`src/app/cli/routing.ts` | `cli-routing-pr-resolve.test.ts` の引数・cleanup検証 |
| `PRIMG-06` | pipeline `--pr`でattachment付きtask specを実行する | 要件11 | `executeTask()`がattachment manifestを持つtask specを受け、run contextに画像と書換済み `order.md` がある | temp pathをtask文字列へ直接埋め込む、taskSpecなしで実行する | `src/features/pipeline/steps.ts`、`src/features/pipeline/execute.ts` | pipeline向けlight integration testで実行時ファイルを確認 |
| `PRIMG-07` | 一時画像とtransient task specを全終了経路で解放する | 要件22 | 成功、取消、取得失敗、保存失敗、workflow失敗後に所有する一時領域が残らない | 各return前に個別cleanupを追加して一部経路を漏らす | PR task準備、add、routing、pipelineの各所有境界 | 成功・取消・例外ごとのcleanup test |
| `PRIMG-08` | 非画像PRの既存出力・PR metadata配線を維持する | 要件23、24 | 画像を含まないPRの整形、レビュー分類、branch/base branch、PR contextが変更前と同じ | 画像対応のため `PrReviewData` やreview分類を不要に変更する | 既存formatterと各入口 | `git-format.test.ts`、既存add／routing／pipeline PR test |
| `PRIMG-09` | 指定品質ゲートを通す | 要件25〜28 | 新規unit testが存在し、build・lint・testが成功する | 広いtest成功だけで個別画像契約を未検証にする | `src/__tests__` と既存npm scripts | 対象test、`npm run build`、`npm run lint`、`npm test` の実行結果 |

### 影響経路

| 契約ID | 定義・生成 | 変換・保存・復元 | 消費・出力・補助入口 | 状態・所有権 | 現行利用側の移行 | 明示された支援 |
|--------|------------|------------------|---------------------|-------------|------------------|------------------|
| `PRIMG-01` | `src/infra/github/pr.ts:421` が `PrReviewData` を生成 | `src/infra/git/format.ts:197` が全本文をtask文字列へ統合し、新PR画像準備処理が抽出 | add、interactive routing、pipeline | `PrReviewData`は変更せず、加工済みtask文字列を新規生成 | 3つのPR task入口を共通準備処理へ移す | なし |
| `PRIMG-02` | 画像記法内のURL | GitHub downloaderが認証、取得、MIME・magic・size検証 | attachment storeへの保存 | HTTP response bufferは検証処理が所有し、保存後に解放 | 新規経路のみ | private GitHub repository画像 |
| `PRIMG-03` | PR画像準備処理が `TaskAttachment[]` を生成 | `saveTaskFile()` → `prepareTaskSpecDirectory()` → `promoteTaskAttachments()` | `.takt/tasks/<slug>/order.md` と `attachments/` | 永続task directoryはTaskRunnerが所有、download tempは呼び出し元がcleanup | `addTask()`のPR保存呼び出しをattachment付きへ変更 | なし |
| `PRIMG-04` | 出現順にplaceholderとfileNameを生成 | task本文置換、`buildTaskOrderContent()`で一覧追加 | AIが `[Image #N]` と `order.md` のパスを消費 | placeholderとattachmentの対応は準備結果が所有 | format済みPR文字列を加工済み文字列へ置換 | 置換または補足のうち置換方式を採用 |
| `PRIMG-05` | `resolvePrInput()`がattachment付き初期入力を生成 | `InteractiveSeedInput.attachments` → interactive result attachments | `selectAndExecuteTask()`、`saveTaskFromInteractive()` | download storeとinteractive storeのcleanup所有権を分離 | 対話型PR入口のみ移行 | なし |
| `PRIMG-06` | `resolveTaskContent()`がPR taskとattachmentsを生成 | transient task directory → `ResolvedTaskSpec` → run context staging | `executeTask()`およびworkflow agent | pipelineがdownload tempとtransient task specを所有、run contextは実行成果物 | pipeline PR分岐のみtask spec経路へ移行 | なし |
| `PRIMG-07` | 各準備処理がcleanup関数またはtask directoryを生成 | `try/finally`で所有資源を解放 | add取消、interactive取消、pipeline失敗を含む | 作成者が解放責務を持つ | 新規副作用を持つPR入口のみ | なし |
| `PRIMG-08` | 既存 `PrReviewData`、formatter、PR metadata | 既存branch／base branch／PR context伝播 | add、interactive、pipeline | 既存所有者を変更しない | 画像task生成箇所だけ差し替える | なし |

### 到達経路・起動条件

| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `takt add --pr <number>`、`takt --pr <number>`、`takt --pipeline --pr <number> --workflow <workflow>` |
| 更新が必要な呼び出し元・配線 | `src/features/tasks/add/index.ts`、`src/app/cli/routing-inputs.ts`、`src/app/cli/routing.ts`、`src/features/pipeline/steps.ts`、`src/features/pipeline/execute.ts` |
| 起動条件 | PR入力が選択され、整形済み本文にallowlist対象のGitHub画像記法が存在し、`gh`が認証済みであること |
| 未対応項目 | GitHub Issue画像、GitLab attachment URL、任意外部URL、PNG/JPEG/GIF/WebP以外の形式 |

## 実装ガイドライン

- PR本文の各配列を入口ごとに個別走査せず、`formatPrReviewAsTask()`後の文字列へ共通抽出処理を適用する。
- GitHub固有の認証・HTTPエラー・URLallowlistは `src/infra/github/` 内へ閉じ込め、task保存層へtokenやHTTP responseを漏らさない。
- Content-Type、magic bytes、拡張子のいずれかが矛盾する場合はfail fastとし、推測した形式や汎用バイナリへフォールバックしない。
- サイズはContent-Lengthだけで信用せず、実際の受信ストリームでも上限を検証する。
- 認証token、Authorization header、query内の機密値をログ・例外・test snapshotへ出さない。
- `/g`付き正規表現をモジュールスコープで `test()` と共有しない。抽出には `matchAll()` 等を用い、状態依存を作らない。
- allowlist外画像を無理に取得せず、元テキストを維持する。
- `TaskAttachment`、`buildTaskOrderContent()`、`prepareTaskSpecDirectory()`、`resolveTaskSpecForExecution()`、run context stagingを再実装しない。
- pipelineでローカルtemp pathを直接agent promptへ渡さず、必ずattachment付きtask specを経由する。
- cleanupは個別return直前へ散在させず、資源の全利用期間を覆う `try/finally` に集約する。
- 新規パラメータは、PR task生成元、add保存、interactive seed/result、pipeline task spec、最終 `executeTask()` まで全呼び出しチェーンを確認する。
- 既存のPR branch、base branch、trace metadata、PR context、非画像formatter出力を変更しない。
- 新規unit testに加え、light integration testを追加・変更した場合は `npm test -- src/__tests__/releaseVerificationWiring.test.ts` を単独実行する。
- 最終確認では対象test、`npm run build`、`npm run lint`、`npm test`、`npm run test:it`、CLI経路変更に対する `npm run test:e2e:mock` を実行する。

## スコープ外

| 項目 | 除外理由 |
|------|---------|
| GitHub Issue本文・コメント画像 | 要求はPRの`--pr`経路に限定されている |
| GitLab attachment URL | 要求がGitHub attachment URLと認証済み`gh`を指定している |
| 任意外部URLの取得 | 明示的な安全性制約に反する |
| SVG等の追加形式 | 初期対応形式がPNG/JPEG/GIF/WebPに限定されている |
| サイズ上限のconfig／CLI option追加 | 上限設定の存在は要求されるが、利用者向け設定化は要求されていない |
| `PrReviewData`や`GitProvider`の契約置換 | 最終task文字列の後処理で要求を満たせ、既存利用側へ副作用を広げる必要がない |
| PRレビュー取得paginationの変更 | 画像取り込み不具合の原因ではなく、既存実装で対象本文を取得済みである |