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

- [Image #1]: `.takt/runs/20260817-062934-implement-using-only-the-files-8myiea/context/task/attachments/image-1.png`
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

GitHub PR の本文、通常コメント、review summary、review thread コメントから許可された画像記法を抽出し、検証済みの `TaskAttachment` として以下の終端へ届ける。

- `takt add --pr`: `.takt/tasks/<slug>/attachments/` と `order.md`
- 通常の `takt --pr`: interactive seed、保存、直接実行
- pipeline の `--pr`: 実行 run context の task spec

### 分解した要件

| # | 要件 | 変更要否 | 種別 | 由来・導出根拠 | 備考 |
|---|---|---|---|---|---|
| 1 | PR body から画像 URL を抽出する | 要 | 明示 | `context/task/order.md:11`, `43` | |
| 2 | 通常コメントから画像 URL を抽出する | 要 | 明示 | `context/task/order.md:11`, `43` | |
| 3 | review summary から画像 URL を抽出する | 要 | 明示 | `context/task/order.md:43` | |
| 4 | review thread コメントから画像 URL を抽出する | 要 | 明示 | `context/task/order.md:11`, `43` | |
| 5 | Markdown image syntax を対象にする | 要 | 明示 | `context/task/order.md:25-30`, `44` | |
| 6 | HTML `<img src>` を対象にする | 要 | 明示 | `context/task/order.md:30-31`, `44` | |
| 7 | PNG/JPEG/GIF/WebP 以外を保存しない | 要 | 明示 | `context/task/order.md:35` | |
| 8 | Content-Type と magic bytes を検証する | 要 | 明示 | `context/task/order.md:36` | |
| 9 | 画像サイズに上限を設ける | 要 | 明示 | `context/task/order.md:37` | |
| 10 | GitHub attachment URL 以外を無制限に取得しない | 要 | 明示 | `context/task/order.md:38-39` | |
| 11 | private repository では認証済み `gh` 経由を優先する | 要 | 明示 | `context/task/order.md:38` | `gh api` または同等の認証済み手段を許容 |
| 12 | 画像を `TaskAttachment[]` として既存保存経路へ渡す | 要 | 明示 | `context/task/order.md:7`, `45-46` | |
| 13 | `.takt/tasks/<slug>/attachments/` に保存する | 要 | 明示 | `context/task/order.md:13` | |
| 14 | `order.md` に既存 attachment 形式を追記する | 要 | 明示 | `context/task/order.md:14-20` | |
| 15 | 本文中の画像参照を `[Image #N]` で参照可能にする | 要 | 明示 | `context/task/order.md:22` | |
| 16 | 通常の `--pr` 経路へ attachment を配線する | 要 | 直接導出 | 本文で画像参照可能にするため、取得元から interactive・保存・実行まで値を伝播させる必要がある | |
| 17 | pipeline の `--pr` でも attachment を参照可能にする | 要 | 明示 | `context/task/order.md:23`, `47` | |
| 18 | 既存の task attachment 保存・manifest・run-context staging を維持する | 不要 | 維持 | `src/features/tasks/attachments.ts:35-53,266-280`、`src/features/tasks/execute/taskSpecContext.ts:57-104` | 新規保存方式は追加しない |
| 19 | 新規ロジックへ単体テストを追加する | 要 | 明示 | `context/task/order.md:52` | |
| 20 | build、lint、unit test を成功させる | 要 | 明示 | `context/task/order.md:53` | |

### 参照資料の調査結果

指定された実装参照は `src/infra/github/pr.ts` です。現在の `fetchPrReviewComments()` は `gh pr view` と GraphQL から PR 本文、通常コメント、review、thread コメントを集約していますが、画像 URL の抽出・ダウンロードは行っていません（`src/infra/github/pr.ts:421-457`）。

既存の attachment 機構は既に以下を提供しています。

- `order.md` の添付画像節生成（`src/features/tasks/attachments.ts:35-53`）
- attachment の検証・コピー（`src/features/tasks/attachments.ts:80-108`）
- task spec 作成（`src/features/tasks/attachments.ts:266-280`）
- run context への staging と manifest 検証（`src/features/tasks/execute/taskSpecContext.ts:57-104`）

したがって、今回の変更範囲は PR 画像の抽出・取得と、既存保存経路への配線に限定します。

### スコープ

変更対象:

- `PrReviewData` の attachment 情報
- GitHub PR 画像の抽出・許可判定・ダウンロード・検証
- PR formatter の placeholder 置換
- `add --pr` の attachment 保存
- 通常の `--pr` の interactive seed / execute / save_task 配線
- pipeline の attachment 付き task spec 配線
- 上記の単体テスト

変更対象外:

- GitLab MR の画像取得
- system-step の PR metadata 取得
- PR 作成、merge、close
- issue/task の非 PR 経路
- 外部 URL 全般のダウンロード対応
- 既存 attachment の保存・manifest仕様

### 検討したアプローチ

| アプローチ | 採否 | 理由 |
|---|---|---|
| `PrReviewData` に optional attachment 情報を追加する | 採用 | 3つの入口で同じ取得結果を使え、契約の重複を避けられる |
| GitHub 固有の抽出・ダウンロードを `src/infra/github/pr-attachments.ts` に分離する | 採用 | provider 固有の外部 I/O を GitHub infra 層に閉じ込められる |
| `fetchPrReviewComments()` に常時画像取得を追加する | 不採用 | system-step など既存利用側に不要な外部 I/O と一時ファイルを発生させる |
| `includeAttachments` を opt-in オプションとして追加する | 採用 | `add --pr`、通常 `--pr`、pipeline のみ画像取得を有効にし、既存利用側を維持できる |
| 任意 URL を `fetch()` で取得する | 不採用 | 外部 URL の無制限取得となり、安全性要件に反する |
| task attachment 保存処理を新規実装する | 不採用 | 既存の `prepareTaskSpecDirectory()` と `promoteTaskAttachments()` で要求を満たせる |
| pipeline 用に永続 task を追加する | 不採用 | pipeline は直実行経路であり、既存の一時 task spec と run context を利用する |

### 実装アプローチ

1. `src/infra/git/types.ts` に `PrReviewAttachment` と `FetchPrReviewOptions` を追加する。
2. `src/infra/github/pr-attachments.ts` に以下を実装する。
   - PR 本文群からの画像構文抽出
   - code fence・inline code・外部 URL の除外
   - GitHub attachment URL の allowlist
   - URL の重複排除と順序付き採番
   - 認証済み `gh api` によるバイナリ取得
   - Content-Type、magic bytes、サイズ、拡張子の検証
   - private な一時ファイルの生成
   - 冪等な cleanup
3. `src/infra/github/pr.ts` で `includeAttachments: true` の場合だけ downloader を呼び、`PrReviewData` に結果を設定する。
4. `src/infra/git/format.ts` で attachment の `sourceUrl` を placeholder に置換する。
5. `src/features/tasks/add/index.ts` で attachment を `saveTaskFile()` に渡し、保存後・失敗時・キャンセル時に cleanup する。
6. `src/app/cli/routing-inputs.ts` と `src/app/cli/routing.ts` で通常 `--pr` の interactive seed、execute、save_task に attachment を配線する。
7. `src/features/pipeline/steps.ts` で attachment 付き task spec を作成し、`executeTask()` に `taskSpec` と一致する `reportDirName` を渡す。
8. pipeline の一時 task spec と PR 取得用一時ファイルを、正常終了・失敗・キャンセルの全経路で cleanup する。

## 完了契約

| 契約ID | 要求・維持事項 | 由来 | 成立する振る舞い | 拒否すべき誤実装 | 実装箇所 | 完了証拠 |
|---|---|---|---|---|---|---|
| `PR-IMG-1` | PR の4種類の本文から対象画像を抽出し、形式・Content-Type・magic bytes・サイズを検証する | 要件1-11、`context/task/order.md:11`, `25-45` | 許可された GitHub attachment URL のみが検証済み画像として取得される | 任意の外部 URL を取得する、Content-Type または magic bytes の片方だけを確認する | `src/infra/github/pr-attachments.ts`, `src/infra/github/pr.ts` | `src/__tests__/github-pr-attachments.test.ts`, `src/__tests__/github-pr.test.ts` |
| `PR-ATT-1` | 検証済み画像を既存 task attachment 経路へ渡し、task directory と `order.md` を生成する | 要件12-14、`context/task/order.md:7`, `13-20`, `45-46` | `image-1.png` が `.takt/tasks/<slug>/attachments/` に存在し、`order.md` に対応行がある | attachment を取得するだけで保存しない、または `order.md` だけを書いてファイルを配置しない | `src/features/tasks/add/index.ts`, 既存 `src/features/tasks/attachments.ts` | `src/__tests__/addTask.test.ts` |
| `PR-REF-1` | 元本文内の画像参照を placeholder として利用可能にする | 要件15、`context/task/order.md:22` | Markdown / HTML の画像参照が `[Image #N]` に置換され、保存後の attachment 行と一致する | URL だけを置換し、Markdown 構文内に無効な参照を残す | `src/infra/git/format.ts` | `src/__tests__/git-format.test.ts`、`src/__tests__/addTask.test.ts` |
| `PR-ROUTE-1` | 通常の `takt --pr` で画像を interactive seed から execute/save_task まで渡す | 要件16、背景 `context/task/order.md:5`, 期待動作 `:22` | 会話中および選択後の実行・保存で同じ placeholder と画像を参照できる | 取得結果を source context にだけ含め、実行・保存へ渡さない | `src/app/cli/routing-inputs.ts`, `src/app/cli/routing.ts` | `src/__tests__/cli-routing-pr-resolve.test.ts` |
| `PR-PIPE-1` | pipeline の `--pr` に attachment 付き task spec を導入する | 要件17、`context/task/order.md:23`, `47` | pipeline の run context に `order.md` と画像ファイルが配置され、agent が参照できる | pipeline では task text だけを渡し、画像を run context に配置しない | `src/features/pipeline/steps.ts` | `src/__tests__/pipelineExecution.test.ts` または `src/__tests__/pipeline-steps.test.ts` |
| `PR-KEEP-1` | 既存の attachment 保存、manifest、symlink 検証を維持する | 要件18、既存契約 `src/features/tasks/attachments.ts:35-53,80-108,184-249` | 既存の task attachment と PR attachment が同じ検証・staging 経路を通る | PR だけ別の直接コピー処理を実装する、既存の symlink / collision 検証を迂回する | 既存機構を再利用 | 既存 attachment テストおよび追加された add/pipeline テスト |
| `PR-QUAL-1` | 新規ロジックの単体テストと build/lint/unit gate を成功させる | 要件19-20、`context/task/order.md:50-53` | 対象テスト、`npm run build`、`npm run lint`、`npm test` が成功する | テストを skip する、広域テスト成功だけで個別契約を証明する | 各実装・テストファイル | 対象テストと各コマンドの実行結果 |

## 要求シナリオ

```gherkin
Scenario: [SCN-PR-IMG-1-P1] PRの4種類の本文から対応画像を抽出する
  Given PR bodyに`![screenshot](https://github.com/user-attachments/assets/a)`、通常コメントに`![image](https://github.com/org/repo/assets/b)`、review summaryに`<img src="https://github.com/user-attachments/assets/c" />`、review threadに`![thread](https://github.com/user-attachments/assets/d)`がある
  When `takt add --pr 456`でPRを取得する
  Then 4件の画像が抽出され、Content-Typeとmagic bytesを検証済みのattachmentとして保存処理へ渡される

Scenario: [SCN-PR-IMG-1-N1] 非対象文脈と外部URLを取得しない
  Given コメントにcode fence内の`![x](https://github.com/user-attachments/assets/a)`、inline codeの`![x](https://github.com/user-attachments/assets/b)`、外部URLの`![x](https://example.com/x.png)`、閉じていない`![x](https://github.com/user-attachments/assets/c)`がある
  When `takt add --pr 456`でPRを取得する
  Then それらのURLはダウンロードされず、未検証のattachmentも生成されない

Scenario: [SCN-PR-ATT-1-P1] 重複URLを一つの連番付きattachmentにする
  Given PR bodyと通常コメントに同じ`https://github.com/user-attachments/assets/a`があり、別の画像`https://github.com/user-attachments/assets/b`もある
  When attachmentへ変換する
  Then `a`は`[Image #1]`と`image-1.png`、`b`は`[Image #2]`と`image-2.png`に対応する

Scenario: [SCN-PR-ATT-1-N1] 既存のplaceholder名前空間と衝突させない
  Given PR画像が`[Image #1]`として初期化され、同じ会話中にユーザーが追加画像を貼り付ける
  When 通常の`takt --pr 456`でinteractive結果を実行する
  Then PR画像は`[Image #1]`を保持し、ユーザー画像は`[Image #2]`以降になり、重複placeholderが発生しない
```

### 影響経路

| 契約ID | 定義・生成 | 変換・保存・復元 | 消費・出力・補助入口 | 状態・所有権 | 現行利用側の移行 | 明示された支援 |
|---|---|---|---|---|---|---|
| `PR-IMG-1` | `PrReviewData`、GitHub `gh pr view`、GraphQL thread response | `pr-attachments.ts` で抽出・allowlist・検証・一時保存 | formatter、add、通常 `--pr`、pipeline | GitHub provider が一時ファイルと cleanup を所有 | `includeAttachments: true` の入口だけ新経路へ移行 | GitHub PR attachment のみ |
| `PR-ATT-1` | `PrReviewAttachment` の placeholder/fileName/tempPath | `saveTaskFile()` → `prepareTaskSpecDirectory()` → `promoteTaskAttachments()` | `.takt/tasks/<slug>/order.md` と `attachments/` | task attachment 機構が永続 task spec を所有 | `add --pr` の既存保存呼び出しへ attachment を追加 | `add --pr` |
| `PR-ROUTE-1` | `resolvePrInput()` の PR source | interactive seed → interactive result → `selectAndExecuteTask()` / `saveTaskFromInteractive()` | interactive provider、task spec、task 保存 | route が PR 一時ファイル cleanup を所有 | 通常 `--pr` の呼び出し元を更新 | 通常 `takt --pr` |
| `PR-PIPE-1` | `resolveTaskContent()` の PR source | 一時 task spec → `resolveTaskSpecForExecution()` → run context staging | pipeline の agent 実行 | pipeline が一時 task spec cleanup を所有、run context は既存実行所有 | `runWorkflow()` に attachment/taskSpec を追加 | pipeline `--pr` |

## 到達経路・起動条件

| 項目 | 内容 |
|---|---|
| 利用者が到達する入口 | `takt add --pr <number>`、通常の `takt --pr <number>`、pipeline の `--pr` |
| 更新が必要な呼び出し元・配線 | `src/infra/github/pr.ts`、`src/features/tasks/add/index.ts`、`src/app/cli/routing-inputs.ts`、`src/app/cli/routing.ts`、`src/features/pipeline/steps.ts` |
| 起動条件 | GitHub PR の取得が成功し、対象本文に許可された GitHub attachment URL が存在すること。`gh` の認証済み利用を優先する |
| 未対応項目 | GitLab MR 画像、任意外部 URL、system-step の attachment 配信は対象外 |

## 実装ガイドライン

- `src/infra/github/pr.ts:421-457` の既存 PR 集約順を維持し、画像抽出対象も PR body → comments → reviews の順に固定する。
- provider 固有の `gh` 呼び出しと認証・レスポンス解析は `src/infra/github` に閉じ込める。
- `PrReviewData` は shared 型を参照し、infra 層から `features/tasks` へ依存しない。
- `src/features/tasks/attachments.ts:35-53,80-108,266-280` を再利用し、保存・symlink・collision・manifest 検証を迂回しない。
- `includeAttachments` の配線漏れがないよう、明示的に有効化する全呼び出し元を更新する。
- system-step の `fetchPrReviewComments()` は既定値のまま画像取得を有効化しない。
- `gh api` の引数は配列で渡し、URLを shell command 文字列へ連結しない。
- Content-Type と magic bytes の不一致、サイズ超過、許可外 URL を有効な attachment として扱わない。
- code fence、inline code、閉じていない構文を画像対象として解釈しない。
- 同一 URL の重複取得を避け、placeholder と fileName の採番を一つの生成処理で行う。
- 画像の一時ファイルは正常終了・取得失敗・キャンセル・`process.exit()` 前の失敗経路を含めて cleanup する。
- テストでは実ネットワークを呼ばず、`gh` のバイナリレスポンスとヘッダーを mock する。
- 既存のユーザー貼り付け画像を PR attachment で上書きせず、PR画像を初期 attachment として扱って後続番号を割り当てる。

## スコープ外

| 項目 | 除外理由 |
|---|---|
| 任意の外部画像 URL | `context/task/order.md:39` の無制限取得禁止 |
| GitLab MR の画像対応 | 要求ソースが GitHub attachment と `src/infra/github/pr.ts` を指定しているため |
| system-step の PR context への画像配信 | 要求された入口ではなく、既存 metadata 契約を維持するため |
| PR 作成・merge・close | 画像取得・task attachment 契約と関係しないため |
| 画像変換、リサイズ、OCR | 要求されていないため |
| 永続 task への backfill / migration | 既存データ移行は要求されていないため |

## 確認事項

なし。