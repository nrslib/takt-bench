要求を実装計画へ落とし込むため、まず正本の `order.md` と指定された参照資料・Knowledge・Policyを末尾まで確認し、その後に現行コードの入口から終端までを追跡します。このステップではソースやテストを変更しません。
`context/task` には正本の `order.md` だけが存在し、指定された参照資料はありません。要求は、PR本文・通常コメント・review threadからGitHub画像URLを抽出し、形式・Content-Type・magic bytes・サイズを検証して認証済み取得を優先し、既存のtask attachmentおよびpipeline経路へ接続することです。続けて、適用制約の全文と実コードの実在経路を確認します。
Knowledge/Policyの全文確認が完了しました。今回適用する制約は、外部入力を境界で正規化してから処理すること、抽出・取得・検証・保存を責務分離すること、既存のattachment契約を変更対象外として維持すること、そして生成したattachmentが保存後にpipelineの終端consumerまで届くことです。次に、PR取得・task生成・保存・pipeline直実行の実コードを追跡します。
## 調査結果

実装・テスト・コミットは行っていません。参照した要求正本は `context/task/order.md` のみで、追加の参照資料は指定されていませんでした。Knowledge と Policy は全文確認済みです。

現在の実装では、GitHub PR の本文・コメント・レビューコメントは取得できますが、画像 URL の抽出、ダウンロード、添付配線は未実装です。

主な既存経路は以下です。

- GitHub PR取得: `src/infra/github/pr.ts:421-458`
- PRデータ型: `src/infra/git/types.ts:109-141`
- `takt add --pr`: `src/features/tasks/add/index.ts:172-214`
- 直接 `takt --pr`: `src/app/cli/routing-inputs.ts:50-70`、`src/app/cli/routing.ts:118-140,197-338`
- Pipeline `--pr`: `src/features/pipeline/steps.ts:213-229`、`src/features/pipeline/execute.ts:32-60`
- タスク添付保存: `src/features/tasks/attachments.ts:35-108,266-296`
- 実行時タスク仕様のステージング: `src/features/tasks/execute/selectAndExecute.ts:121-195`、`src/features/tasks/execute/taskSpecContext.ts:57-105`

## 要求・完了契約

以下の契約IDは、この計画内での追跡用ラベルです。

| ID | 契約 | 由来 |
|---|---|---|
| C1 | GitHub PR本文・通常コメント・レビューコメント中の対象画像記法から、許可されたGitHub添付URLだけを抽出し、Content-Type・magic bytes・サイズを検証してローカル添付へ変換する | `order.md` の対象箇所・安全要件 |
| C2 | 生成した添付と `[Image #n]` 参照が `takt add --pr`、直接 `takt --pr`、Pipeline `--pr` の各入口から後続処理へ渡る | `order.md` の3入口指定 |
| C3 | `takt add --pr` では既存のタスク添付形式で `.takt/tasks/<slug>/attachments/` と `order.md` に保存される | `order.md` の保存形式指定 |
| C4 | 直接 `takt --pr` では既存のInteractive画像添付経路へ渡され、Pipeline `--pr` では実行用task spec/run contextから参照できる | `order.md` の直接実行・Pipeline要件からの不可欠な導出 |
| P1 | 既存の手動画像添付、GitLab PR取得、画像を含まないPR処理、既存のPR整形結果を維持する | 変更対象外の既存コード契約 |

「PRコメントが存在しない場合に `takt add --pr` が失敗する」既存条件は `src/features/tasks/add/index.ts:193-196` にあり、`order.md` はこの条件の変更を指定していません。そのため、この計画では維持します。

## 契約ファミリと実在経路

### Family: GitHub PR画像参照から実行可能なローカル添付まで

不変条件は「対象GitHub画像URLが、検証済みのローカル画像と対応する `[Image #n]` 参照になり、各PR入口の終端consumerへ届くこと」です。

#### `participates`

1. `src/infra/github/pr.ts` または専用のGitHub画像取得モジュール  
   GitHub PRデータをproducerとして、本文・通常コメント・レビューコメントを走査する。

2. URL抽出・正規化・検証  
   Markdown画像記法 `![alt](URL)` と HTML `<img src="URL">` を対象とし、以下のGitHub添付URLに限定する。

   - `https://github.com/user-attachments/assets/...`
   - `https://github.com/<org>/<repo>/assets/...`

3. 認証付き取得・バイナリ検証  
   既存の `gh api` 利用パターン `src/infra/git/paginated-api.ts:52-69` を参考に、認証済みGitHub経路で取得する。PNG/JPEG/GIF/WebPについて、Content-Type、magic bytes、サイズを検証する。

4. 一時保存・識別子付与  
   URLを重複排除し、出現順に `[Image #1]`、`image-1.png` のように対応付ける。本文・コメント内の対象URLは対応するプレースホルダーへ置換する。

5. `takt add --pr`  
   `saveTaskFile` に添付を渡し、既存の `prepareTaskSpecDirectory` 経由で保存する。

6. 直接 `takt --pr`  
   `resolvePrInput` から `InteractiveSeedInput.attachments` へ渡し、既存のInteractive画像添付処理を利用する。

7. Pipeline `--pr`  
   `TaskContent` に添付を保持し、既存のタスク仕様作成・run contextステージング経路へ接続する。

8. 終端consumer  
   - `add`: `.takt/tasks/<slug>/order.md` と添付ファイル
   - 直接実行: Interactiveの画像添付入力
   - Pipeline: 実行用run context内の `order.md` と画像ファイル

#### `preserved`

- `src/features/tasks/attachments.ts` の既存保存・検証・コピー契約
- `src/shared/utils/imageAttachmentReferences.ts` のファイル名・拡張子・正規ファイル検証
- `src/features/interactive/inlineImagePaste.ts` およびInteractive画像添付の既存動作
- GitLabの `PrReviewData` 取得経路
- `SystemStepPrReviewData` とシステムステップ経路
- 画像を含まないPRの既存処理
- `formatPrReviewAsTask` の一般的な整形責務。画像URLを整形前に置換すれば変更不要

#### `outside`

- 任意の外部URLのダウンロード
- Issueや通常のInteractive入力に含まれる画像URL
- PR作成・更新・push経路
- 既存のシステムステップへ画像添付機能を拡張すること
- 旧形式のupcaster、backfill、移行処理

## 実装方針

### 1. GitHub専用の明示的な添付取得能力を追加する

既存の `fetchPrReviewComments` は、システムステップやGitLab経路も利用しています。また、取得時に一時ファイルを生成すると、それらの呼び出し元が所有・削除できない問題が発生します。

そのため、通常の `fetchPrReviewComments` は維持し、GitHubの3入口だけが利用する明示的な添付付き取得能力を追加します。

候補構成:

- `src/infra/github/pr.ts` に隣接する専用モジュールを追加
- GitHub providerにオプショナルな添付付きPR取得能力を追加
- `GitProvider`にはGitLab互換性を維持できる任意プロパティとして接続
- 3入口では添付付き能力を使用し、未提供のproviderは従来のPR取得へフォールバック

これは後方互換のための旧契約維持ではなく、対象範囲をGitHub PR画像処理に限定して既存のsecondary経路を汚染しないための設計判断です。

### 2. Markdown/HTMLの対象領域を限定して走査する

実装時は、単純なURL検索ではなく、対象記法と非対象領域を区別します。

対象:

- `![image](https://github.com/user-attachments/assets/...)`
- `<img src="https://github.com/org/repo/assets/...">`
- HTML属性のシングルクォート・ダブルクォート
- URLのquery/fragmentを許容する場合は、許可ホスト・パス判定後に正規化

対象外:

- bare URL
- 通常のMarkdownリンク `[text](URL)`
- GitHub以外のURL
- インラインコード内
- fenced code block内
- ` ``` ` と `~~~` の両方のフェンス
- 閉じていないコードフェンス内

既存依存関係にはMarkdownパーサーがないため、小さな状態付きスキャナを追加する設計が適切です。コードフェンスやリテラル領域を誤ってダウンロードしないことを直接テストします。

### 3. 画像検証ロジックを既存実装と共有する

`src/features/interactive/inlineImagePaste.ts:45-110` に既存のmagic-byte判定があります。PR取得側で同じ形式判定を複製せず、共通の判定関数へ抽出して既存処理も利用する方針です。

対応形式:

- PNG
- JPEG
- GIF
- WebP

ダウンロード時は次を検証します。

- HTTPSかつGitHub添付URLのallowlistに一致
- 認証済みGitHub経路で取得
- Content-Typeが対応形式
- magic bytesが対応形式
- ファイルサイズが上限以下
- 保存先がprivateな一時領域
- 部分ファイルや検証失敗ファイルを残さない

サイズ上限の具体値は既存の10 MiB制限を設計上の初期値として再利用しますが、これは新しい要求契約ではなく、実装上の安全制限として扱います。

### 4. 添付の所有者とcleanupを明示する

添付一時ファイルは、生成した入口が所有します。

- `add --pr`: 保存成功後または失敗時にcleanup
- 直接 `takt --pr`: workflow選択、キャンセル、Interactive実行、保存失敗を含む入口全体でcleanup
- Pipeline `--pr`: PR取得からpipeline完了・失敗までcleanup
- 途中の複数画像取得失敗時は、既に取得したファイルもcleanup
- `process.exit()` が使われる経路では、`finally` だけに依存せず、終了前cleanup可能な既存経路を確認する

Interactive内部のsession store cleanupは独自のtmpディレクトリだけを対象にするため、PR取得側の一時ファイルを自動的には削除できません。

### 5. Pipelineは既存のtask spec経路へ接続する

Pipelineでは単にプロンプトへファイル名を追加するのではなく、既存の以下の経路を利用します。

1. `prepareTaskSpecDirectory(projectCwd, task, attachments)`
2. `generateExecutionReportDir`
3. `resolveTaskSpecForExecution`
4. `executeTask({ taskSpec, ... })`
5. `stageTaskSpecForExecution`
6. run context内の `order.md` と添付ファイルをagentへ提示
7. pipeline終了時に一時task specをcleanup

これにより、保存済みタスクとPipeline実行で添付形式を分岐させません。

## 変更対象と維持対象

### 変更対象

- `src/infra/git/types.ts`
  - 添付付きPRデータ、またはGitHub専用取得能力の型を追加
- `src/infra/github/pr.ts`
  - 画像抽出・取得・置換処理を接続
- GitHub providerの公開能力
- `src/features/tasks/add/index.ts`
  - PR添付を `saveTaskFile` へ渡し、cleanupを所有
- `src/app/cli/routing-inputs.ts`
  - 添付付きPR入力を返す
- `src/app/cli/routing.ts`
  - `InteractiveSeedInput.attachments` への配線と全経路cleanup
- `src/features/pipeline/steps.ts`
  - `TaskContent.attachments` とtask spec作成への配線
- `src/features/pipeline/execute.ts`
  - Pipeline全体の添付所有・cleanup
- 必要に応じて共通magic-byte判定ユーティリティ
- GitHub PR画像、add、routing、pipelineのテスト

### 変更不要

- `src/features/tasks/attachments.ts`
  - 既に添付セクション、保存、検証、コピーを実装済み
- `src/features/tasks/execute/taskSpecContext.ts`
  - 既存のtask spec/run context転送が添付に対応済み
- `src/infra/git/format.ts`
  - 整形前に本文・コメントを置換すれば既存formatterを維持可能
- GitLab provider
  - GitHub専用機能のため
- システムステップのPRデータ型・同期経路
  - 要求範囲外であり、一時ファイル所有者も存在しないため
- Providerの通常画像入力処理
  - 直接実行は既存のInteractive添付経路、Pipelineはファイル参照経路を利用するため

## 要求シナリオ

### 構造化入力

C1に該当します。

- 正例: PR本文にMarkdown画像、通常コメントにHTML画像、レビューコメントに同一URLがある場合、URLは一度だけ取得され、出現順のプレースホルダーへ置換される。
- 正例: `![x](...)`、`<img src="...">`、属性の引用符違いを対象にする。
- 負例: bare URL、通常のMarkdownリンク、GitHub以外のURLは取得しない。
- 負例: inline code、` ``` ` fenced code、`~~~` fenced code、閉じていないフェンス内の同じ文字列は取得しない。
- 負例: Content-Typeとmagic bytesが不一致、またはサイズ超過の場合は添付化せず、部分ファイルを残さない。

### 識別子生成

C1/C3に該当します。

- 正例: 2枚の異なる画像は `image-1.*`、`image-2.*` と `[Image #1]`、`[Image #2]` に対応する。
- 正例: 同一URLが複数箇所に出ても1ファイル・1プレースホルダーに統合される。
- 負例: 既存ファイルと同名になる場合に既存ファイルを上書きせず、衝突を回避または拒否する。
- 負例: 取得失敗・検証失敗した画像について、番号だけを消費した孤立参照を生成しない。

## 完了証拠

各契約を次の直接テストへ対応付けます。

| 契約 | 直接証拠 |
|---|---|
| C1 | GitHub PR画像取得テスト。Markdown/HTML、重複、allowlist、コード領域除外、Content-Type、magic bytes、サイズ、cleanupを個別検証 |
| C2 | `addTask.test.ts`、`cli-routing-pr-resolve.test.ts`、`pipelineExecution.test.ts` で各入口から添付が渡ることを検証 |
| C3 | 実ファイルを使い、`order.md` の `## 添付画像`、相対パス、添付ファイルの存在を検証 |
| C4 | 直接実行ではInteractive seedへの添付配線、Pipelineではtask spec/run context内の `order.md` と画像ファイルを検証 |
| P1 | 既存の `saveTaskFile.test.ts`、`imageAttachments.test.ts`、GitLab/システム経路の既存テストを維持して実行 |

最終確認コマンド:

```bash
npm run build
npm run lint
npm test
```

Integration testを変更した場合は、リポジトリ規約に従い対象テストと `src/__tests__/releaseVerificationWiring.test.ts` を個別実行し、必要に応じて `npm run test:it` も実行します。