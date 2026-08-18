# タスク計画

## 元の要求

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

- [Image #1]: `.takt/runs/20260815-094644-implement-using-only-the-files-aaxzg3/context/task/attachments/image-1.png`
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

## 分析結果

### 目的

GitHub PR 由来の task について、PR 本文・通常コメント・レビュー本文に埋め込まれた対応画像を安全に取得し、既存の task attachment 機構を通じて保存・実行コンテキストへ渡す。`takt add --pr`、対話型 `takt --pr`、pipeline `--pr` の全入口で同じ画像参照を利用可能にする。

### 分解した要件

| # | 要件 | 変更要否 | 種別 | 由来・導出根拠 | 備考 |
|---|------|----------|------|----------------|------|
| 1 | PR body 内の対象画像参照を検出する | 要 | 明示 | `order.md`「期待する挙動」「参考」 | `PrReviewData.body` |
| 2 | conversation comments 内の対象画像参照を検出する | 要 | 明示 | `order.md`「通常コメント」「参考」 | `PrReviewData.comments[].body` |
| 3 | review summaries 内の対象画像参照を検出する | 要 | 明示 | `order.md`「参考」 | path を持たない review body |
| 4 | review thread comments 内の対象画像参照を検出する | 要 | 明示 | `order.md`「期待する挙動」「参考」 | active、outdated、resolved を含む `reviews[].body` |
| 5 | Markdown image syntax を画像参照として扱う | 要 | 明示 | `order.md`「対象とする画像記法」「参考」 | 実際の画像構文のみ |
| 6 | HTML `<img src="...">` を画像参照として扱う | 要 | 明示 | `order.md`「対象とする画像記法」「参考」 | `src` 属性を対象とする |
| 7 | 対応画像をローカルへダウンロードする | 要 | 明示 | `order.md`「期待する挙動」 | GitHub attachment URL に限定 |
| 8 | PNG を対応形式とする | 要 | 明示 | `order.md`「安全性・制約」 | Content-Type と magic の一致が必要 |
| 9 | JPEG を対応形式とする | 要 | 明示 | `order.md`「安全性・制約」 | `.jpg` または既存規約に合う拡張子を使う |
| 10 | GIF を対応形式とする | 要 | 明示 | `order.md`「安全性・制約」 | Content-Type と magic の一致が必要 |
| 11 | WebP を対応形式とする | 要 | 明示 | `order.md`「安全性・制約」 | RIFF/WEBP magic を確認する |
| 12 | HTTP Content-Type を検証する | 要 | 明示 | `order.md`「安全性・制約」 | 対応 MIME 以外を attachment 化しない |
| 13 | 画像の magic bytes を検証する | 要 | 明示 | `order.md`「安全性・制約」 | Content-Type との不一致を拒否する |
| 14 | ダウンロードサイズに上限を設ける | 要 | 明示 | `order.md`「安全性・制約」 | 既存 inline image の 10 MiB 契約を再利用する設計 |
| 15 | `gh api`、認証済み `gh` 経由、または同等の認証済み取得を使用する | 要 | 明示 | `order.md`「安全性・制約」 | 許容集合を維持し、採用方式は設計判断とする |
| 16 | 任意の外部 URL を取得せず、GitHub attachment URL に取得対象を限定する | 要 | 明示 | `order.md`「安全性・制約」 | HTTPS、host、path を取得前に確認する |
| 17 | 画像を `TaskAttachment[]` として既存保存処理へ渡す | 要 | 明示 | `order.md`「背景」「参考」 | 既存 attachment 形式を再利用する |
| 18 | `takt add --pr` で `.takt/tasks/<slug>/attachments/` に画像を保存する | 要 | 明示 | `order.md`「期待する挙動」 | `saveTaskFile()` を利用する |
| 19 | `order.md` に既存 attachment 形式で画像一覧を追記する | 要 | 明示 | `order.md`「期待する挙動」 | `buildTaskOrderContent()` の既存形式を維持する |
| 20 | 元本文からローカル画像を参照できるよう、置換、補足、または同等の仕組みで `[Image #N]` と対応付ける | 要 | 明示 | `order.md`「置換または補足」 | 置換だけを要件として固定しない |
| 21 | pipeline `--pr` で attachment 付き task spec を実行に渡す | 要 | 明示 | `order.md`「pipeline」「参考」 | URL文字列だけを prompt に残す実装は不可 |
| 22 | 対話型 `takt --pr` でも取得済み画像を source context と後続 execute/save に渡す | 要 | 直接導出 | 背景で `takt --pr` が対象とされ、画像をローカル利用可能にする目的上不可欠 | `InteractiveSeedInput.attachments` を利用可能 |
| 23 | PR body に対象画像がある場合、通常コメントがなくてもその body 画像を処理対象にできる | 要 | 直接導出 | 要件1と `takt add --pr` の保存要件を同時に成立させるため | 現行のコメントなし判定との境界を調整 |
| 24 | 同一 URL の複数出現を同じ attachment として参照できる | 要 | 直接導出 | 同じ画像を各出現箇所から一意に参照し、同一処理内の重複 filename を避けるため | URL単位の重複排除 |
| 25 | 途中失敗時に部分的な一時画像や task spec を残さない | 要 | 直接導出 | ダウンロードと保存を伴う主操作が失敗時にも安全に終端するため | 正常、失敗、キャンセルを対象 |
| 26 | 新規画像処理に単体テストを追加する | 要 | 明示 | `order.md`「品質要件」 | 純粋な抽出・検証ロジックを直接検証 |
| 27 | `npm run build` が成功する | 要 | 明示 | `order.md`「品質要件」 | TypeScript と build assets |
| 28 | `npm run lint` が成功する | 要 | 明示 | `order.md`「品質要件」 | `src/` 全体 |
| 29 | `npm test` が成功する | 要 | 明示 | `order.md`「品質要件」 | unit と分類済み対象 |
| 30 | 対象画像がなくレビューコメントもない `takt add --pr` は従来どおり task を作成しない | 不要 — `src/features/tasks/add/index.ts:193` | 維持 | 変更対象外の既存 `add --pr` 契約 | body に対象画像がある入力とは分離する |
| 31 | PR head/base branch、source、PR number の保存契約を維持する | 不要 — `src/features/tasks/add/index.ts:205`、`src/features/pipeline/steps.ts:225` | 維持 | 変更対象外の既存 PR task 契約 | 画像配線と競合しない |
| 32 | Issue と直接 task の入力経路を変更しない | 不要 — `src/features/pipeline/steps.ts:231`、`src/features/tasks/add/index.ts:217` | 維持 | 変更対象外の既存入口 | PR 入力に限定する |
| 33 | GitLab の merge request 取得経路を変更しない | 不要 — `src/infra/gitlab/GitLabProvider.ts:31` | 維持 | 要求が GitHub attachment URL と認証済み `gh` に限定されるため | GitHub固有処理を漏らさない |
| 34 | system sync や branch-only PR context 取得で画像ダウンロードを起動しない | 不要 — `src/infra/workflow/system/system-sync-effects.ts:42`、`src/infra/workflow/system/DefaultSystemStepServices.ts:111` | 維持 | 変更対象外の既存 PR metadata consumer | `fetchPrReviewComments()` 自体へ副作用を追加しない |

### 参照資料の調査結果（参照資料がある場合）

独立した「参照資料」セクションはない。実装方針案で `src/infra/github/pr.ts` が指定されている。

`src/infra/github/pr.ts:421` の `fetchPrReviewComments()` は、`gh pr view` と GraphQL review threads から `PrReviewData` を生成する。PR body、conversation comments、review summaries、review thread comments は既に `PrReviewData` に集約されており、参照資料の意図はこの取得結果を画像抽出の入力にすることと判断する。

現行との差異は以下のとおり。

- `PrReviewData` は本文文字列を保持するが attachment 情報は持たない。
- `src/infra/git/format.ts:197` は本文を task Markdown に整形するだけで、画像参照を変換しない。
- `src/features/tasks/add/index.ts:198` は整形済み文字列だけを `saveTaskFile()` へ渡している。
- `src/features/pipeline/steps.ts:223` は整形済み文字列を作り、`src/features/pipeline/steps.ts:355` で task spec を使わず直接 `executeTask()` へ渡している。
- `src/features/tasks/attachments.ts:35` 以降には、`TaskAttachment[]` から `order.md` の「添付画像」節を生成し、画像を task directory へコピーする既存機構がある。
- `src/features/tasks/execute/taskSpecContext.ts:57` 以降には、task attachment を run context へコピーして実行用パスへ書き換える既存機構がある。

`fetchPrReviewComments()` 自体へダウンロード副作用を追加すると、system sync や branch context 取得でも不要な外部 I/O と一時ファイルが発生する。このため、参照資料は producer として利用するが、画像準備は CLI の PR task 化境界に限定する。

### スコープ

変更対象:

- GitHub PR 本文中の画像構文を分類・抽出する純粋処理。
- GitHub attachment URL の認証付きダウンロード、サイズ制限、Content-Type／magic 検証、一時ファイル所有。
- `PrReviewData` を attachment 付き task input へ変換する共通入口。
- `takt add --pr` から `saveTaskFile()` までの attachment 配線。
- 対話型 `takt --pr` から interactive seed、execute、save までの attachment 配線。
- pipeline `--pr` から transient task spec、run context、`executeTask()` までの attachment 配線。
- attachment identifier の衝突回避。
- 正常、失敗、キャンセル時の一時ファイル cleanup。
- 上記を直接検証する unit、既存 integration、CLI routing テスト。

信頼境界:

- PR comment body は外部入力。
- URL は取得前に HTTPS、host、path を検証する。
- HTTP response body は信頼せず、status、Content-Length、実読込サイズ、Content-Type、magic bytes を検証する。
- `gh` の認証情報は downloader が所有し、task本文、ログ、例外、テスト出力へ含めない。
- 画像の永続化所有者は既存 task attachment 機構、一時ダウンロードの解放所有者は新しい PR task 準備結果とする。

### 検討したアプローチ（設計判断がある場合）

| アプローチ | 採否 | 理由 |
|-----------|------|------|
| `src/infra/github/pr.ts` の `fetchPrReviewComments()` 内で常に画像も取得する | 不採用 | system sync、system PR context、GitLab共通契約など、画像不要の consumer に副作用と cleanup ownership を漏らす |
| `formatPrReviewAsTask()` の出力全体へ単純な正規表現を適用する | 不採用 | formatter が author prefix を本文へ付けるため、元コメント内の fenced code 文脈を正確に分類できない |
| `PrReviewData` の各 body を個別に分類・変換し、その後に既存 formatter を使う | 採用 | PR body、各 comment、各 review の Markdown 文脈を保持し、既存表示構造も維持できる |
| 画像参照の抽出とダウンロード I/O を同じ巨大関数にまとめる | 不採用 | 構造化入力の分類と外部 I/O／検証は変更理由とテスト境界が異なる |
| 画像参照 parser と GitHub downloader を分離し、共通 PR task 準備処理で結合する | 採用 | 純粋な分類を単体テストでき、認証・HTTP・一時ファイルを GitHub 境界へ閉じ込められる |
| `gh api` だけに方式を固定する | 不採用 | 要求は `gh api`、認証済み `gh`、同等方式を許容している |
| `gh auth token` で認証情報を取得し、Node HTTP API で通常 attachment URL を取得する | 採用 | 通常 URL の response header と streaming body を直接検証でき、認証済み `gh` を利用できる |
| pipeline では URL を本文に残したまま実行する | 不採用 | ローカル attachment として同等に参照できるという要求を満たさない |
| pipeline 専用の attachment コピー処理を複製する | 不採用 | `prepareTaskSpecDirectory()` と `resolveTaskSpecForExecution()` が既に同じ不変条件を所有している |
| pipeline も既存の attachment 付き task spec を作り `executeTask()` へ渡す | 採用 | add／対話型実行と同じ保存・run context 契約を利用できる |

### 実装アプローチ

1. GitHub PR 画像参照 parser を追加する。

   - `PrReviewData.body`、`comments[].body`、`reviews[].body` をそれぞれ独立した Markdown 入力として解析する。
   - Markdown image と HTML `<img src>` の source span、URL、出現順を返す。
   - backtick／tilde fenced code、閉じ忘れ fence、inline code、escaped image marker、HTML comment 内は対象外とする。
   - reference-style image、通常リンク、外部 URL は対象外とする。
   - 同一 URL は1件の download candidate に正規化する。

2. GitHub attachment downloader を追加する。

   - URL を `URL` として解析し、HTTPS、`github.com`、許可された attachment path を取得前に検証する。
   - 対象 URL が0件なら `gh` の認証情報取得も HTTP 呼び出しも行わない。
   - 認証情報は1バッチにつき一度だけ解決し、ログへ出さない。
   - 各画像を順次取得する。
   - response status、Content-Length、streaming中の実サイズを検証する。
   - 対応 Content-Type と magic bytes が一致した場合だけ verified MIME から拡張子を決定する。
   - 一時ディレクトリは private mode で作り、`StoredImageAttachment`／`TaskAttachment` と cleanup owner を返す。
   - 途中失敗時は、その時点までの一時ファイルを削除して例外を伝播する。

3. 画像形式の正本を共有化する。

   - `src/features/interactive/inlineImagePaste.ts:9` と `:45` にある 10 MiB 上限および magic 判定を共有画像データモジュールへ移す。
   - inline paste と PR downloader が同じ PNG/JPEG/GIF/WebP 判定を使用する。
   - 置換後に新たに未使用となる旧ローカル定数・関数だけを削除する。

4. identifier allocator を追加する。

   - 元の PR task 本文に存在する `[Image #N]` と `attachments/image-N.<ext>` を収集する。
   - 同一バッチ内で生成済みの番号も同じ集合へ加える。
   - 使用済み番号より後の、または衝突しない正の安全整数を割り当てる。
   - `src/features/interactive/imageAttachments.ts:139` の `attachments.length + 1` も、初期 attachment の実 placeholder 番号を考慮する方式へ更新する。

5. provider-neutral な PR task 準備入口を追加する。

   - 現在選択済みの git provider が GitHub の場合だけ GitHub画像処理へ委譲する。
   - GitLab では従来の `formatPrReviewAsTask()` だけを使用する。
   - 戻り値は PR metadata、task本文、attachments、cleanup ownership をまとめる。
   - 呼び出し側で formatter、downloader、番号割当を再実装しない。

6. `takt add --pr` を更新する。

   - `src/features/tasks/add/index.ts:180` の PR 取得後に共通 PR task 準備入口を呼ぶ。
   - `src/features/tasks/add/index.ts:193` の拒否条件を、review/comment がなく、かつ対象 attachment もない場合に限定する。
   - `src/features/tasks/add/index.ts:212` で attachments を `saveTaskFile()` へ渡す。
   - workflow 選択キャンセル、保存成功、保存失敗のすべてで download temp を解放する。
   - 既存の branch、baseBranch、autoPr、source、prNumber を維持する。

7. 対話型 `takt --pr` を更新する。

   - `src/app/cli/routing-inputs.ts:50` の戻り値へ attachments と cleanup ownership を追加する。
   - `src/app/cli/routing.ts:204` の `InteractiveSeedInput` に attachments を渡す。
   - interactive result が初期 PR attachment と対話中に追加された attachment を保持し、execute／saveへ渡す既存経路を利用する。
   - workflow 選択キャンセル、mode 選択キャンセル、action cancel、execute、save、例外を cleanup 対象とする。
   - `process.exit()` を使う既存 head branch 欠落経路では、`finally` だけに依存せず exit 前に明示 cleanup する。

8. pipeline `--pr` を更新する。

   - `src/features/pipeline/steps.ts:34` の `TaskContent` に attachments と cleanup ownership を追加する。
   - `resolveTaskContent()` を非同期化し、PR経路のみ共通 PR task 準備入口を使う。
   - attachment がある場合は `prepareTaskSpecDirectory()` と `resolveTaskSpecForExecution()` で transient task spec を準備する。
   - `src/features/pipeline/steps.ts:355` で `taskSpec.taskPrompt`、`taskSpec`、一致する `reportDirName` を `executeTask()` へ渡す。
   - workflow終了後に transient task directory を削除する。run context 側のコピーは既存 lifecycle に従う。
   - 環境準備失敗、workflow失敗、成功、例外で download temp を解放する。

9. テストを追加・更新する。

   - parser、URL分類、重複排除、identifier、Content-Type／magic／size を新規単体テストで直接検証する。
   - add、routing、pipeline の各終端を既存テストで検証する。
   - filesystem を使う既存 integration test を変更するため、分類契約テストも実行する。

### 完了契約

| 契約ID | 要求・維持事項 | 由来 | 成立する振る舞い | 拒否すべき誤実装 | 実装箇所 | 完了証拠 |
|--------|----------------|------|------------------|--------------------|----------|----------|
| `PRIMG-01` | PR body、conversation comments、review summaries、review thread comments の実画像構文を attachment 参照へ変換する | 要件1〜6、20、24 | `SCN-PRIMG-01-P1` | `SCN-PRIMG-01-N1` | 新規 GitHub PR image parser、共通 PR task 準備処理 | 新規 unit test で各 body 種別、Markdown、HTML、重複 URL、非対象文脈を直接確認 |
| `PRIMG-02` | GitHub attachment URL だけを認証付きで取得し、対応形式、サイズ、Content-Type、magic bytes を検証する | 要件7〜16 | 許可 URL の PNG/JPEG/GIF/WebP が verified MIME に対応する attachment となる | 外部 host を取得する、サイズ超過を全読込する、Content-Type と magic が不一致でも保存する | 新規 GitHub downloader、共有 image data validator | mocked HTTP response を用いた unit test で各形式、外部 URL 非取得、mismatch、oversize、HTTP失敗を直接確認 |
| `PRIMG-03` | `takt add --pr` が画像を task directory と `order.md` に保存する | 要件17〜20、23、維持30〜31 | body またはコメントに対象画像があれば `.takt/tasks/<slug>/attachments/image-N.ext` と「添付画像」節が作られる | formatter に placeholder を入れるだけで `saveTaskFile()` に attachments を渡さない | `src/features/tasks/add/index.ts`、`src/features/tasks/attachments.ts` | `src/__tests__/addTask.test.ts` で task directory、画像内容、`order.md`、body-only image、画像なし拒否を確認 |
| `PRIMG-04` | 対話型 `takt --pr` と pipeline `--pr` が attachment 付き task spec を最終 consumer へ渡す | 要件21〜22、維持31〜32 | 対話型 seed／execute／save と pipeline `executeTask({ taskSpec })` が同じ attachment を参照する | pipeline task本文に元URLだけを残す、mockへ直接 attachments を設定して入口配線を通さない | `src/app/cli/routing-inputs.ts`、`src/app/cli/routing.ts`、`src/features/pipeline/steps.ts`、task spec preparation helper | `src/__tests__/cli-routing-pr-resolve.test.ts`、`src/__tests__/pipelineExecution.test.ts`、`src/__tests__/taskSpecContext.test.ts` |
| `PRIMG-05` | 生成する placeholder と filename が既存本文、既存 attachment、同一バッチの生成物と衝突しない | 要件20、24 | `SCN-PRIMG-05-P1` | `SCN-PRIMG-05-N1` | 共有 attachment index allocator、`src/features/interactive/imageAttachments.ts` | 新規 unit test と interactive initial attachment 回帰テスト |
| `PRIMG-06` | 一時画像と transient task spec の所有者を明確にし、正常、失敗、キャンセルで解放する | 要件25 | add、対話型、pipeline の各終端で一時 download directory が削除される | `finally` だけに依存して `process.exit()` 経路に一時画像を残す、途中失敗時に部分ファイルを残す | PR task 準備結果、add／routing／pipeline lifecycle | cleanup spy と一時 directory の存在確認を用いた unit／integration test |
| `PRIMG-07` | GitLab、Issue、直接 task、system PR metadata consumer の既存動作を維持する | 維持32〜34 | 非GitHub provider と非PR入口では画像 downloader が起動せず、既存 task本文とmetadataを返す | `fetchPrReviewComments()` 自体へ常時ダウンロードを追加する | provider-neutral PR task 準備入口、既存 `src/infra/github/pr.ts` はmetadata producerとして維持 | GitLab provider、issue/direct pipeline、system services の既存テストと `npm test` |
| `PRIMG-08` | 新規単体テストを追加し build、lint、test を成功させる | 要件26〜29 | 対象テストと指定3コマンドが成功する | 広い suite の成功だけで各契約の直接証拠を省略する | 新規／既存テスト、build対象 | targeted tests、`npm run build`、`npm run lint`、`npm test` の実行結果 |

### 要求シナリオ（条件付き）

~~~gherkin
Scenario: [SCN-PRIMG-01-P1] 実画像構文を各 PR 本文領域から attachment 参照へ変換する
  Given PR body に `![body](https://github.com/user-attachments/assets/a)`、conversation comment に `<img src="https://github.com/user-attachments/assets/b" />`、review summary と review thread に同形式の画像がある
  When PR task を準備する
  Then 4領域の一意な対象URLに対応する `[Image #N]` と `TaskAttachment` が得られる

Scenario: [SCN-PRIMG-01-N1] リテラル領域と未対応画像記法を取得対象にしない
  Given backtick fence、tilde fence、blockquote内のfence、閉じ忘れfence、inline code、escaped `\![x](...)`、HTML comment 内に GitHub画像文字列がある
  When PR task を準備する
  Then それらの文字列に対するHTTP取得もplaceholder生成も行われない

Scenario: [SCN-PRIMG-05-P1] 空いている attachment 番号を割り当てる
  Given 元本文に `[Image #1]` と `attachments/image-2.png` があり、新しい対象画像が2件ある
  When attachment identifier を生成する
  Then 新しいplaceholderとfilenameは既存値および相互に重複しない

Scenario: [SCN-PRIMG-05-N1] 同じ URL の再出現で別 identifier を生成しない
  Given PR body と review thread の両方に `![same](https://github.com/user-attachments/assets/same)` がある
  When attachment identifier を生成する
  Then 両参照は同じ `[Image #N]` を使い、`image-N.ext` は1ファイルだけ生成される
~~~

### 影響経路（該当する契約のみ）

| 契約ID | 定義・生成 | 変換・保存・復元 | 消費・出力・補助入口 | 状態・所有権 | 現行利用側の移行 | 明示された支援 |
|--------|------------|------------------|---------------------|-------------|------------------|------------------|
| `PRIMG-01` | `src/infra/github/pr.ts` → `PrReviewData`、新規 parser | 各 raw body を非破壊変換 → `formatPrReviewAsTask()` | add、対話型、pipeline の task本文 | parser は副作用なし、prepared result が変換結果を所有 | `formatPrReviewAsTask()` を直接呼ぶ3入口を共通準備入口へ移行 | なし |
| `PRIMG-02` | 新規 URL policy、共有 image data validator | 認証取得 → HTTP response → size/MIME/magic検証 → private temp file | `TaskAttachment` producer | downloader が token と temp directory を所有し、cleanupを移譲 | GitHub PR task 準備だけが利用 | private repository画像への認証済み取得 |
| `PRIMG-03` | 共通 PR task 準備結果 | `saveTaskFile()` → `prepareTaskSpecDirectory()` → `promoteTaskAttachments()` | `.takt/tasks/<slug>/order.md` と `attachments/` | 永続化後は task directory が所有、一時元は解放 | `src/features/tasks/add/index.ts:198` の文字列のみの経路を移行 | なし |
| `PRIMG-04` | 共通 PR task 準備結果 | 対話型: seed→result→save/execute、pipeline: transient spec→resolved spec→run context | provider prompt、workflow実行、run context order | 対話型 store／pipeline transient spec が実行中の所有権を持つ | `src/app/cli/routing-inputs.ts:66`、`src/features/pipeline/steps.ts:223` を移行 | なし |
| `PRIMG-05` | 元本文・既存 attachment の番号集合 | index allocator → placeholder／filename | `buildTaskOrderContent()`、`resolveReferencedImageAttachments()` | 1 preparation batch が番号集合を所有 | interactive initial attachment の採番もallocatorへ移行 | なし |
| `PRIMG-06` | download temp と transient task spec の生成点 | try/catch/finally、キャンセル、exit前cleanup | add結果、interactive action、pipeline exit code | prepared result が cleanup owner、永続／run context コピー後に解放 | 3入口それぞれに所有権移譲を配線 | なし |
| `PRIMG-07` | GitLab provider、Issue/direct task、system PR metadata取得 | 現行formatter／metadata経路を維持 | 既存consumer | GitHub PR task preparation 外では新規状態なし | 移行なし | なし |

Contract family 分類:

- Family A「PR画像を attachment-backed task として終端consumerへ届ける」
  - `participates`: PR body、conversation comments、review summaries、review threads、add、対話型、pipeline。
  - `preserved`: 対象画像のない PR。
  - `outside`: Issue、直接 task、system sync、branch-only PR context。
- Family B「GitHub外部入力を検証済み画像へ変換する」
  - `participates`: 許可された GitHub attachment URL、対応 Content-Type、対応 magic。
  - `preserved`: 対応外形式の元本文参照。
  - `outside`: 任意の外部host、GitLab attachment。
- Family C「attachment identifier の一意性」
  - `participates`: 元本文の `[Image #N]`、既存 `image-N.ext`、同一バッチ、新しい interactive attachment。
  - `preserved`: identifier に一致しない通常本文。
  - `outside`: PR番号、task slug、run slug。

### 到達経路・起動条件（利用者向け機能の追加/変更がある場合）

| 項目 | 内容 |
|------|------|
| 利用者が到達する入口 | `takt add --pr <number>`、対話型 `takt --pr <number>`、`takt --pipeline --pr <number> --workflow <workflow>` |
| 更新が必要な呼び出し元・配線 | `src/features/tasks/add/index.ts`、`src/app/cli/routing-inputs.ts`、`src/app/cli/routing.ts`、`src/features/pipeline/steps.ts`、`src/features/pipeline/execute.ts` |
| 起動条件 | PR入力が選択され、git provider が GitHub で、本文に許可された HTTPS GitHub attachment image syntax があること。`gh` が利用可能かつ認証済みであること |
| 未対応項目 | なし。GitLab、任意外部host、SVGなどの未対応形式は明示的にスコープ外 |

## 実装ガイドライン（設計が必要な場合のみ）

- `src/infra/github/pr.ts:421` は PR metadata producer として維持し、画像取得副作用を直接追加しない。
- PR画像の分類は `src/infra/git/format.ts:197` による整形前の各 raw body で行う。
- Markdown parser は少なくとも backtick／tilde fence、閉じ忘れ fence、inline code、escape、HTML comment を区別する。モジュールスコープの `/g` 正規表現を `test()` と `replace()` で共有しない。
- 入力 `PrReviewData` とその配列を直接変更せず、変換済みコピーを返す。
- URL は取得前に `URL` で正規化し、HTTPS、host、path を検証する。任意外部URLへの fallbackを追加しない。
- 認証情報、Authorization header、画像本文、private URL query をログや例外へ含めない。
- shell経由のコマンド文字列を使わず、`execFile` 系へ引数配列を渡す。
- response全体を無制限に `arrayBuffer()` へ読み込まず、Content-Length とstreaming中の実サイズの両方を検証する。
- 画像形式は Content-Type とmagic bytesの両方で決定し、URL拡張子だけを信用しない。
- verified MIME から filename拡張子を決め、PNG/JPEG/GIF/WebPの対応表を1か所に置く。
- 同じURLは一度だけ取得し、全出現箇所を同じplaceholderへ対応付ける。
- `src/features/tasks/attachments.ts:35` の既存「添付画像」形式と `:88` の保存処理を再利用し、別形式を追加しない。
- pipeline は `src/features/tasks/execute/taskSpecContext.ts:57` の既存 task spec 解決を通す。テストだけで attachments を直接 `executeTask()` mockへ設定して配線済みと扱わない。
- download temp、prepared task spec、run context copy の所有者を混同しない。正常、例外、ユーザーキャンセル、既存 `process.exit()` 経路を列挙してcleanupする。
- `process.exit()` は `finally` を実行しないため、該当経路ではexit前の明示cleanupを行う。
- 新しい image data validator へ移した結果、今回新たに未使用となる旧定数・旧helperだけを削除する。既存re-exportや外部利用可能なaliasは未使用検索だけで削除しない。
- `src/__tests__/addTask.test.ts` は実filesystemを使う分類済みintegration testであるため、変更後に対象実行し、`src/__tests__/releaseVerificationWiring.test.ts` も単体実行する。
- 実装完了時は新規unit test、変更したtarget test、`npm run build`、`npm run lint`、`npm test`、`npm run test:it` を実行する。CLI挙動とtask spec実行を変更するため `npm run test:e2e:mock` も実行する。

## スコープ外（項目がある場合のみ）

| 項目 | 除外理由 |
|------|---------|
| GitLab merge request 内画像のダウンロード | 要求は GitHub attachment URL と認証済み `gh` に限定されている |
| GitHub以外の任意外部host | `order.md` が無制限な外部URL取得を禁止している |
| SVG、BMP、TIFF、AVIF | 初期対応形式は PNG/JPEG/GIF/WebP と明示されている |
| reference-style Markdown image、CSS background image、HTML `srcset` | 対象記法として指定されていない |
| 画像変換、圧縮、リサイズ | ダウンロードと検証のみが要求されている |
| system sync／system effect のPR metadata取得での画像処理 | task attachment を消費する経路ではなく、変更対象外の既存契約 |
| 強制終了不能な `SIGKILL` 後の即時cleanup保証 | プロセス内cleanupを実行できない終端。通常終了、失敗、キャンセル、明示exitは対象とする |

## 確認事項（あれば）

なし。