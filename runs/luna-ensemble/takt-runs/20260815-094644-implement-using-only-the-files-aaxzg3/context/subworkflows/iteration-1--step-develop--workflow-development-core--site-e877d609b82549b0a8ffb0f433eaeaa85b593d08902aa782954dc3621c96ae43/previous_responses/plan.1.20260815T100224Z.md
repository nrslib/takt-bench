タスク指示書を正本として、まず指定された参照資料を特定・読了します。その後、Knowledge／Policy と現行コードを照合し、変更契約・影響経路・直接検証できるテスト計画まで整理します。この段階ではファイル編集は行いません。あわせて、実装計画の品質基準を確認するため `coding` スキルを適用します。
参照資料の指定は `order.md` 内に独立した「参照資料」セクションとしては存在せず、実装方針案として `src/infra/github/pr.ts` が明示されています。要求の正本は `context/task/order.md` のみであることを固定し、これから既存の PR 取得・task attachment・`add --pr`・pipeline `--pr` の実経路を追います。外部取得境界なので、URL 制限・認証取得・Content-Type／magic bytes・サイズ上限も同じ契約 family として確認します。
現行構造では、PR 取得結果は `PrReviewData`、本文生成は `formatPrReviewAsTask()`、永続化／実行時の画像配置は既存の `TaskAttachment[]` と task spec が担当しています。したがって画像 URL の抽出・認証付き取得・検証は PR 入力境界で一度だけ行い、`add`・対話型 `--pr`・pipeline `--pr` は同じ結果を既存 attachment 経路へ渡す設計が最小かつ配線漏れを防げます。現在、pipeline だけは task spec を使わず本文を直接 `executeTask()` に渡しているため、ここが主な追加配線箇所です。
調査上、既存の `src/infra/github/pr.ts` 自体をダウンロード責務へ広げると、画像を必要としない system sync／PR context 取得まで副作用が及びます。そこで同ファイルは PR メタデータの producer として保持し、取得済み `PrReviewData` を task 化する CLI 境界に共通の画像準備処理を置く方針にします。これにより GitLab と system effect は変更対象外のまま維持できます。なお、`gh api` は公式上 API v3 の endpoint path 用なので、添付の通常 URL 取得は `gh auth token` で得た認証情報をログへ出さず Node の HTTP 取得へ渡す方式を採用候補とします。
## 調査結果

要求の正本は `context/task/order.md` のみです。独立した「参照資料」セクションはなく、実装方針案として `src/infra/github/pr.ts` が指定されています。Report Directory に過去レポートはありませんでした。作業ツリーにも既存差分はありません。

現行経路は次のとおりです。

- `takt add --pr`: `src/features/tasks/add/index.ts:172`
- 対話型 `takt --pr`: `src/app/cli/routing-inputs.ts:50` → `src/app/cli/routing.ts:118`
- pipeline `--pr`: `src/features/pipeline/steps.ts:213`
- PR 本文の整形: `src/infra/git/format.ts:197`
- attachment の保存と `order.md` 追記: `src/features/tasks/attachments.ts:35`
- 実行コンテキストへの attachment 配置: `src/features/tasks/execute/taskSpecContext.ts:57`

`src/infra/github/pr.ts:421` は PR メタデータの producer として維持します。ここへダウンロード副作用を追加すると、画像を必要としない system sync／PR context 取得にも影響するためです。

## 要件と変更要否

| ID | 要件 | 由来 | 判定 |
|---|---|---|---|
| R1 | PR body、conversation comments、review summaries、review thread comments の対象画像を検出する | `order.md` 期待動作・実装方針案 | 変更要 |
| R2 | Markdown image と HTML `<img src>` を対象とし、本文から `[Image #N]` で参照可能にする | `order.md` 対象記法・期待動作 | 変更要 |
| R3 | PNG/JPEG/GIF/WebP のみを扱い、Content-Type、magic bytes、サイズ上限を検証する | `order.md` 安全性・制約 | 変更要 |
| R4 | GitHub attachment URL のみに取得を限定し、private repository 用に認証済み `gh` の資格情報を使う | `order.md` 安全性・制約 | 変更要 |
| R5 | `takt add --pr` で `.takt/tasks/<slug>/attachments/` と `order.md` に保存する | `order.md` 期待動作 | 変更要 |
| R6 | 対話型 `takt --pr` と pipeline `--pr` の実行時にも attachment 付き task spec を使う | 背景・pipeline 期待動作 | 変更要 |
| R7 | 新規ロジックに単体テストを追加し、build、lint、test を成功させる | `order.md` 品質要件 | 変更要 |
| R8 | PR body に対象画像がある場合、通常コメントがなくても `add --pr` で画像タスクを作成できる | R1 と R5 が成立するために不可欠 | 変更要 |
| M1 | 対象画像のない `add --pr` では、レビューコメントなしを従来どおり拒否する | `src/features/tasks/add/index.ts:193` | 維持 |
| M2 | Issue、直接 task、GitLab、system sync／system PR context の動作を変更しない | 現行の独立経路 | 維持 |
| M3 | PR の head/base branch、source、PR number の保存・実行契約を維持する | `src/features/tasks/add/index.ts:205`、`src/features/pipeline/steps.ts:225` | 維持 |

## 完了契約と contract family

### CF-1: PR 画像参照の task attachment 化

- 不変条件: 対象となる PR 本文中の画像参照が、同じ画像を指す `[Image #N]` とローカル attachment に結び付く。
- 担当箇所: 新設する共通 PR task 準備処理。
- 変更理由: PR 由来 task で画像を利用可能にする。

実在経路:

```text
src/infra/github/pr.ts
  → PrReviewData
  → 共通 PR task 準備処理
  → formatPrReviewAsTask()
  ├─ add --pr → saveTaskFile() → prepareTaskSpecDirectory()
  │            → .takt/tasks/<slug>/attachments + order.md
  ├─ 対話型 --pr → InteractiveSeedInput.attachments
  │               → saveTaskFromInteractive() / selectAndExecuteTask()
  └─ pipeline --pr → attachment 付き transient task spec
                    → resolveTaskSpecForExecution()
                    → executeTask()
                    → run context attachment
```

分類:

- `participates`: PR body、conversation comments、review summaries、review thread comments、add／対話型／pipeline の3入口。
- `preserved`: 対象画像のない PR、Issue／直接 task、GitLab PR。
- `outside`: system sync、system enqueue の `payload.task`、branch-only PR context。

直接証拠:

- C1: 全対象フィールドの画像が attachment と placeholder に対応する単体テスト。
- C2: `add --pr` の task directory、画像ファイル、`order.md` を直接確認するテスト。
- C3: 対話型 seed と pipeline の `executeTask({ taskSpec })` まで attachment が届くテスト。

### CF-2: 認証付き取得と画像検証

- 不変条件: 許可された GitHub attachment URL 以外へは取得せず、保存されるデータはサイズ内かつ Content-Type と magic bytes が一致する対応画像である。
- 担当箇所: GitHub PR 画像 downloader と共有画像検証処理。
- 変更理由: 外部入力を安全にローカルファイル化する。

経路:

```text
抽出 URL
  → HTTPS / github.com / 許可 path 検証
  → gh auth token による認証情報解決
  → HTTP response
  → status / Content-Length / streaming size / Content-Type / magic bytes
  → private temp file
  → TaskAttachment
```

分類:

- `participates`: `github.com/user-attachments/assets/...`、`github.com/<owner>/<repo>/assets/...`。
- `preserved`: 対応外 Content-Type の画像は元参照を保持し attachment 化しない。
- `outside`: 任意の外部ホスト、HTTP URL、通常リンク、reference-style image。

`gh api` は公式上 GitHub API v3 endpoint path 用なので、通常の attachment URL は `gh auth token` で得たトークンをログへ出さず Node の HTTP クライアントへ渡します。[GitHub CLI `gh api` 仕様](https://cli.github.com/manual/gh_api)

直接証拠:

- C4: 各対応形式の Content-Type／magic 一致。
- C5: mismatch、サイズ超過、非成功応答では保存せず失敗する。
- C6: 外部 URL では認証取得も HTTP 呼び出しも発生しない。

### CF-3: attachment 識別子の一意性

- 不変条件: 新しい `[Image #N]` と `image-N.ext` が、元本文、同一バッチ内の生成物、対話中に追加される画像と衝突しない。
- 担当箇所: 共有 attachment index allocator。
- 変更理由: PR 本文が既存 placeholder を含み得るため。

経路:

```text
PR 全本文・既存 attachment
  → 使用済み index 集合
  → 空いている正の安全整数
  → placeholder + filename
  → order.md / prompt attachment lookup
```

直接証拠:

- C7: 既存 `[Image #1]` と `attachments/image-2.png` がある入力で、新規画像が別 index を得る。
- C8: 同じ URL の再登場は同じ attachment を再利用し、別ファイルを生成しない。

## 設計方針

1. `src/infra/github/pr-image-attachments.ts` を新設する。

   - 各 `PrReviewData` 本文を個別に解析し、コード領域を壊さず対象画像を抽出する。
   - 元オブジェクトは変更せず、本文を置換した新しい `PrReviewData` を返す。
   - 同一 URL は一度だけ順次取得する。
   - URL allowlist、認証取得、レスポンス検証、temp attachment 作成を所有する。

2. `src/infra/git/index.ts` に共通 PR task 準備入口を置く。

   - 選択中 provider が GitHub の場合だけ GitHub downloader を呼ぶ。
   - GitLab は従来どおり `formatPrReviewAsTask()` のみを行う。
   - `{ task, attachments, cleanupAttachments }` を返し、3つの CLI 入口が同じ処理を使う。

3. 共有画像検証を整理する。

   - `src/features/interactive/inlineImagePaste.ts:45` にある magic bytes 判定と 10 MiB 上限を共有モジュールへ移す。
   - PNG/JPEG/GIF/WebP の MIME、拡張子、magic bytes を1か所で管理する。
   - Content-Length がなくても読み取り中に 10 MiB を超えた時点で停止する。
   - 対応 MIME なのに magic が違う場合は fail-fast する。

4. attachment index allocator を共有する。

   - 元本文全体と既存 attachment から使用済み番号を収集する。
   - `attachments.length + 1` には依存しない。
   - `src/features/interactive/imageAttachments.ts:139` も同じ allocator を使い、PR seed 後の画像貼り付けとの衝突を防ぐ。

5. `add --pr` を配線する。

   - `src/features/tasks/add/index.ts:180` の取得後に共通 PR task 準備処理を呼ぶ。
   - attachment を `saveTaskFile()` へ渡す。
   - コメントなし判定は「コメントも対象 attachment もない場合」に限定する。
   - workflow 選択キャンセル、保存失敗、成功の全経路で temp attachment を解放する。

6. 対話型 `--pr` を配線する。

   - `src/app/cli/routing-inputs.ts:50` の戻り値へ attachments と cleanup ownership を追加する。
   - `src/app/cli/routing.ts:204` の `InteractiveSeedInput` に attachments を渡す。
   - workflow／mode キャンセル、実行、保存、例外で cleanup する。
   - `process.exit()` を通る head branch 欠落経路では、`finally` に依存せず exit 前に cleanup する。

7. pipeline `--pr` を attachment 付き task spec にする。

   - `src/features/pipeline/steps.ts:34` の `TaskContent` に attachments と cleanup ownership を追加する。
   - `resolveTaskContent()` を非同期化し、共通 PR task 準備処理を使う。
   - `runWorkflow()` では既存 `prepareTaskSpecDirectory()`、`resolveTaskSpecForExecution()` を利用し、`taskSpec.taskPrompt`、`taskSpec`、一致する `reportDirName` を `executeTask()` へ渡す。
   - 成功、workflow 失敗、環境準備失敗、例外で transient task spec と download temp directory を解放する。

## 要求シナリオ

### 構造化入力: 正例

```gherkin
Scenario: 各 PR 本文領域の GitHub 画像を attachment 化する
  Given PR body に ![body](https://github.com/user-attachments/assets/a) がある
  And conversation comment に <img src="https://github.com/user-attachments/assets/b" /> がある
  And review summary と review thread に GitHub Markdown image がある
  When PR task を準備する
  Then 各一意 URL が検証済み TaskAttachment になる
  And task 本文から対応する [Image #N] を参照できる
```

対象変種:

- Markdown destination の通常表記、`<...>` 表記、任意 title。
- HTML `src` の二重引用符、単一引用符、引用符なし。
- blockquote 内の実画像。

### 構造化入力: 負例

```gherkin
Scenario: リテラル領域や未対応記法を取得しない
  Given backtick fence と tilde fence 内に同じ Markdown image 文字列がある
  And blockquote 内の fenced code と閉じ忘れ fence に画像文字列がある
  And inline code、エスケープ済み !、HTML comment 内に画像文字列がある
  And reference-style image と外部ホスト画像がある
  When PR task を準備する
  Then HTTP 取得は発生しない
  And 元本文は保持される
```

### 識別子生成: 衝突回避

```gherkin
Scenario: 既存 attachment 名前空間と衝突しない
  Given PR 本文に [Image #1] と attachments/image-2.png が既にある
  And 新しい対象画像が2件ある
  When attachment index を割り当てる
  Then 新しい placeholder と filename は既存値および相互に重複しない
```

### 安全境界

```gherkin
Scenario: 宣言形式と実データが一致しない画像を拒否する
  Given GitHub attachment URL が Content-Type image/png を返す
  But magic bytes は JPEG である
  When PR task を準備する
  Then task 作成または pipeline 実行を開始しない
  And 部分的に作成した temp attachment を削除する
```

## テスト計画

- 新規単体テスト

  - Markdown／HTML 抽出、コード領域除外、URL allowlist、重複排除、本文参照化。
  - MIME／magic／サイズ検証。
  - identifier collision。
  - 途中失敗時 cleanup。

- 既存テスト更新

  - `src/__tests__/addTask.test.ts`: 実ファイルが task attachment にコピーされ、`order.md` に列挙されること。body-only image を許可し、画像なし・コメントなしは従来どおり拒否。
  - `src/__tests__/cli-routing-pr-resolve.test.ts`: PR attachment が全 interactive mode の seed と execute/save 経路へ届き、キャンセル・例外・exit 前に cleanup されること。
  - `src/__tests__/pipelineExecution.test.ts`: attachment 付き PR が transient task spec を経由して `executeTask()` へ届き、成功・失敗で cleanup されること。
  - `src/__tests__/taskSpecContext.test.ts`: run context の attachment path とコピー契約を回帰確認。
  - 必要に応じて `src/__tests__/inlineImagePaste.test.ts`: 共有化後も既存 paste 検証が維持されること。

- 実行コマンド

  - 新規・変更テストの対象実行
  - `npm test -- src/__tests__/releaseVerificationWiring.test.ts`
  - `npm run build`
  - `npm run lint`
  - `npm test`
  - `npm run test:it`
  - `npm run test:e2e:mock`

## Coder 向け注意事項

- `formatPrReviewAsTask()` 後の一括正規表現ではなく、各 raw body を個別に解析すること。既存 formatter は author prefix を本文先頭へ付けるため、fenced code の文脈を失う可能性があります。
- URL、認証、画像データをログへ出さないこと。
- shell 文字列を組み立てず、`execFile` 系の引数配列を使うこと。
- `Promise.all` で無制限に取得せず、順次取得と streaming size limit を使うこと。
- Content-Type のみ、拡張子のみ、magic bytes のみで形式を確定しないこと。
- 外部 URL を通常の `fetch` fallback で取得しないこと。
- 失敗画像を黙って欠落させたまま成功扱いしないこと。
- `src/infra/github/pr.ts`、system effect、GitLab の既存契約へ不要な attachment 副作用を追加しないこと。
- temporary file の cleanup を `finally` だけに委ねず、既存の `process.exit()` 経路を明示的に処理すること。

Policy は対象外契約の保持と主操作の終端追跡を適用します。デザイン参照ポリシーはデザイン資料がないため非適用です。Coding／Architecture のうち、外部入力検証、provider 境界、フェーズ分離、配線完全性、Fail Fast、cleanup 完全性を本計画へ反映しています。