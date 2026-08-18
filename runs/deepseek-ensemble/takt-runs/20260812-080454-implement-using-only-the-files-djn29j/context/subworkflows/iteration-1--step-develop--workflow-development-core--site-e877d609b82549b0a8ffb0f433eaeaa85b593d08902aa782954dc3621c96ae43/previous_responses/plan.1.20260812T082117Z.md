問題を、指定されたタスク資料だけを要求の正本として分析し、現行コードとの対応関係と検証可能な実装計画に落とします。まず必須の参照資料を特定し、あわせて実装計画に適用される `coding` スキルの指針を確認します。今回は計画ステップなので、ファイル編集は行いません。
指定資料の正本は `context/task/order.md` で、要件は PR 本文・通常コメント・review thread コメントから GitHub 画像を安全に取得し、既存 task attachment 経路へ流すことです。次に、指示書が挙げる既存 PR 実装、attachment の所有箇所、`add --pr` と pipeline `--pr` の入口を実コードで追跡します。 `coding` スキルの規律は、不要な互換処理や暗黙フォールバックを増やさず、実在する配線を端から端まで確認する点に反映します。
現行経路では、`add --pr` は取得した本文をそのまま保存し、pipeline `--pr` は task spec を作らず本文だけを `executeTask()` に渡しています。一方、既存 attachment 基盤は一時画像を `TaskAttachment[]` として受け、`order.md` の添付節生成、永続化、run context への複製まで既に担当しています。したがって新規処理の中心は、GitHub 境界での「抽出・認証付き取得・検証・一時保存」と、3つの入口（add、直接 `--pr`、pipeline）への配線です。
調査上の重要な境界リスクは2点です。本文中の記法はコードフェンスやインラインコード内では画像ではないため、構造化入力として正負を分けます。また `[Image #N]` は既存本文と名前空間を共有するため、既存番号との衝突を避け、同一 URL は同じ番号へ集約します。画像取得・検証に失敗した場合は黙って省略せず、その PR 入力全体を失敗させ、途中生成した一時ファイルを必ず解放する方針です。
## 調査結果

要求の正本は `context/task/order.md` のみです。指定されたレポートディレクトリは空で、既存差分もありません。参照先として示された `src/infra/github/pr.ts` は確認済みです。

現状は次のとおりです。

- `PrReviewData` は PR 本文、通常コメント、review summary、review thread コメントを保持しています（`src/infra/git/types.ts:109`、`src/infra/github/pr.ts:421`）。
- `formatPrReviewAsTask()` はそれらを task 本文へ整形しますが、画像処理はありません（`src/infra/git/format.ts:197`）。
- 既存 attachment 基盤は、添付節生成、`.takt/tasks/<slug>/attachments/` への保存、run context への複製まで実装済みです（`src/features/tasks/attachments.ts:35`、`:88`、`:266`）。
- `add --pr` は attachments を渡していません（`src/features/tasks/add/index.ts:172`）。
- pipeline `--pr` は本文を直接 `executeTask()` に渡しており、attachment 付き task spec を作っていません（`src/features/pipeline/steps.ts:213`、`:334`）。
- 直接 `takt --pr` は既存の `InteractiveSeedInput.attachments` を利用できますが、PR 画像を生成していません（`src/app/cli/routing-inputs.ts:50`、`src/features/interactive/interactive.ts:198`）。

## 完了契約

| ID | 完了条件 | 由来 |
|---|---|---|
| C1 | PR 本文、通常コメント、review thread コメントにある Markdown画像・HTML `<img>` の承認済みGitHub attachment URLを検出し、PNG/JPEG/GIF/WebPの `TaskAttachment[]` を生成する | `order.md:10-40` |
| C2 | `takt add --pr` で画像を task attachments に保存し、`order.md` に既存形式の添付節を生成する | `order.md:11-23` |
| C3 | 直接 `takt --pr` と pipeline `--pr` の実行時、画像が task spec/run context を通じてエージェントから参照可能になる | `order.md:3-5,24-25,42-48` |
| C4 | 認証済み `gh` の資格情報を利用し、URL、Content-Type、magic bytes、サイズを検証する。承認済み画像の取得・検証失敗は黙って省略しない | `order.md:35-40` |
| C5 | 画像を含まないPR、GitLab経路、既存のPR整形・branch/base branch・PR context、通常の対話添付動作を維持する | 現行コードの変更対象外契約 |
| C6 | 新規ロジックを直接検証するテストを追加し、指定された品質ゲートを通す | `order.md:50-52` |

## 要求シナリオ

C1は構造化入力、C1/C3は識別子生成に該当します。

- 対象: `![shot](https://github.com/user-attachments/assets/abc)` はダウンロードされ、本文が `[Image #1]` に置換される。
- 非対象: コードフェンスまたはインラインコード内の同じ文字列は例示テキストとして残り、取得しない。
- 対象: `<img src="https://github.com/org/repo/assets/abc" />` は添付へ変換する。
- 非対象: HTMLコメント内の `<img>` や `https://example.com/image.png` は取得しない。
- 衝突: 本文に既存の `[Image #1]` がある場合、新規画像には未使用番号を割り当てる。
- 重複: 同一URLが複数本文に現れる場合は一度だけ取得し、同じプレースホルダーへ置換する。

## 設計

GitHub固有処理を application/CLI 層へ漏らさないため、Git provider の追加 capability として実装します。既存の `fetchPrReviewComments()` は変更せず、system workflowなど画像を必要としない既存利用側へダウンロード副作用を追加しません。

画像処理は次の段階に分けます。

1. `PrReviewData` の本文フィールドを不変なまま走査する。
2. コード領域を除外し、対象記法と安全なGitHub URLだけを分類する。
3. 既存 `[Image #N]` を考慮して番号を割り当て、本文の複製を生成する。
4. `gh auth token --hostname github.com` で資格情報を取得する。
5. HTTPS・許可ホスト・リダイレクト回数・タイムアウトを制限して取得する。
6. Content-Lengthとストリーム実測の双方で10 MiB上限を適用する。
7. Content-Typeとmagic bytesが同じPNG/JPEG/GIF/WebPを示すことを確認し、検証済みMIMEから拡張子を決める。
8. private modeの一時ファイルへ保存し、解放関数とともに返す。

承認済みURLの画像が不正、過大、取得不能の場合はPR入力を失敗させます。任意の外部画像URLは取得せず、元本文を維持します。

## 実装計画

1. 画像形式の共通判定を追加する。

   - `src/shared/utils/imageFormat.ts` を追加し、magic bytes判定、MIME型、拡張子変換を集約する。
   - `src/features/interactive/inlineImagePaste.ts` と `src/features/interactive/imageAttachments.ts` を同じ判定へ移行し、既存動作を維持する。

2. GitHub PR画像の解決処理を追加する。

   - `src/infra/github/prReviewImageAttachments.ts` に、構造を考慮した抽出・置換、認証付き取得、サイズ検査、一時保存、失敗時清掃を実装する。
   - `src/infra/git/prReviewImageAttachments.ts` に provider-neutral な capability 契約と呼び出しヘルパーを置く。
   - `src/infra/github/GitHubProvider.ts` からGitHub実装を公開する。GitLabには互換用の偽実装を追加せず、画像 capability 非対応として既存挙動を維持する。

3. `takt add --pr` へ配線する。

   - `src/features/tasks/add/index.ts` でPR取得後に画像を解決し、置換済みデータを `formatPrReviewAsTask()` へ、attachmentsを `saveTaskFile()` へ渡す。
   - 本文画像だけがあり通常コメント・レビューが空の場合も保存可能にする。
   - workflow選択キャンセル、保存失敗、正常終了の全経路でダウンロード用一時領域を解放する。

4. 直接 `takt --pr` へ配線する。

   - `src/app/cli/routing-inputs.ts` の戻り値へattachmentsと解放所有権を追加する。
   - `src/app/cli/routing.ts` で全interactive modeのseedへattachmentsを渡し、実行・保存・キャンセル・例外の全経路を覆う `finally` でPR画像を解放する。
   - `src/features/interactive/imageAttachments.ts` は初期attachmentsの最大番号から次番号を選び、PR画像と後から貼り付けた画像の衝突を防ぐ。

5. pipeline `--pr` へ配線する。

   - `src/features/pipeline/steps.ts` の `TaskContent` にattachmentsと清掃所有権を伝播し、PR解決を非同期化する。
   - attachmentsがある場合だけ `prepareTaskSpecDirectory()`、`generateExecutionReportDir()`、`resolveTaskSpecForExecution()` を使用する。
   - `executeTask()` へ一致する `taskSpec` と `reportDirName` を渡し、既存の `stageTaskSpecForExecution()` によりrun contextへ画像を複製させる。
   - `src/features/pipeline/execute.ts` で早期returnや実行失敗を含む全経路の一時task specとダウンロード領域を解放する。

## テスト計画

- 純粋単体テスト

  - Markdown画像、HTML画像、PR本文・通常コメント・review summary・threadコメント。
  - コードフェンス、インラインコード、HTMLコメント、escaped記法の非検出。
  - URL allowlist、重複URL、既存プレースホルダーとの衝突。
  - PNG/JPEG/GIF/WebPのmagic bytes判定。

- 軽い統合テスト

  - 認証トークン取得とHTTP応答をモックし、実一時ファイルでContent-Type不一致、magic不一致、サイズ超過、途中失敗時清掃を確認する。
  - 新規ITは `*.integration.test.ts` とし、分類契約も検証する。

- 既存入口テスト更新

  - `src/__tests__/addTask.test.ts`: 保存画像、添付節、本文画像だけのPR、成功・失敗時清掃。
  - `src/__tests__/cli-routing-pr-resolve.test.ts`: seed attachments、execute/save/cancel/例外時清掃。
  - `src/__tests__/pipelineExecution.test.ts`: attachment付きtask specと一致するreport slug、失敗時清掃。
  - `src/__tests__/imageAttachments.test.ts`: 非連番の初期attachment後の採番。
  - `src/__tests__/github-provider.test.ts`: capabilityの委譲。

検証コマンドは、対象テスト、`releaseVerificationWiring.test.ts`、`npm run build`、`npm run lint`、`npm test`、`npm run test:it`、CLI変更の回帰として `npm run test:e2e:mock` の順で実行します。

この計画ステップではファイル変更を行っていません。