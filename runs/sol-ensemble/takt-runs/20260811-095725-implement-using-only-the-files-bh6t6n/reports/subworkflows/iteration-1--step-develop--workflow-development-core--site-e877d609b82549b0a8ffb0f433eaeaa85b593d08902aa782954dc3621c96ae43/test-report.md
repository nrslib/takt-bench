# テスト作成レポート

## 完了契約-テスト対応表

| 契約ID | 由来 | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|------|----------------|-----------|--------|------|--------------|
| `PRIMG-01` | 計画 | PR本文・通常コメント・review summary・review threadのMarkdown／HTML画像を出現順に検出する | 整形済みPR本文 → attachment準備 | `prReviewAttachments.test.ts` | 作成 | |
| `PRIMG-02` | 計画 | GitHub attachment URLだけを認証付きで取得し、PNG/JPEG/GIF/WebPのContent-Type・magic bytes・サイズを検証する | GitHub画像URL → 認証 → HTTP取得 → 検証 | `github-pr-image-download.test.ts` | 作成 | |
| `PRIMG-03` | 計画 | `takt add --pr`が画像をtask directoryへ保存し、`order.md`へattachment参照を追加する | add CLI → PR整形 → attachment保存 → task永続化 | `addTask.test.ts` | 作成 | |
| `PRIMG-04` | 計画 | 元画像記法を番号が一致する`[Image #N]`へ置換する。同一URLは同一placeholderを再利用する | PR task文字列変換 | `prReviewAttachments.test.ts` | 作成 | |
| `PRIMG-05` | 計画 | 対話型`--pr`の初期入力、execute、save_taskへattachmentを伝播する | CLI routing → interactive seed/result → 実行・保存 | `cli-routing-pr-resolve.test.ts` | 作成 | |
| `PRIMG-06` | 計画 | pipeline `--pr`がattachment付きtask specと一致するreport directoryを`executeTask()`へ渡す | pipeline PR入力 → task spec → workflow実行 | `pipelineExecution.test.ts`、既存`taskSpecContext.test.ts` | 作成・既存 | |
| `PRIMG-07` | 計画 | 一時画像とtransient task specを成功・取消・取得失敗・workflow失敗時に解放する | attachment所有者の終了処理 | `prReviewAttachments.test.ts`、`addTask.test.ts`、`cli-routing-pr-resolve.test.ts`、`pipelineExecution.test.ts` | 作成 | add保存処理自体の例外、routing実行処理例外に対するPR画像所有者のcleanupは未作成 |
| `PRIMG-08` | 計画 | 非画像PRの整形、レビュー分類、branch/base branch、PR contextを維持する | formatter、add、routing、pipeline | 既存`git-format.test.ts`、`inlineImagePaste.test.ts`および各変更テスト内の既存ケース | 既存 | |
| `PRIMG-09` | 計画 | 新規単体テストを追加し、指定品質ゲートを通す | build・lint・unit・IT | 全変更テスト | 作成 | 実装前のため新規テストは意図したred状態。全品質ゲートの成功確認は実装後 |

## 検証境界（外部境界または環境依存境界を持つ契約のみ）

| 契約ID | モックで確認した範囲 | 実連携範囲 | テスト環境 / HOME / 設定の分離 | 未確認理由 |
|--------|----------------------|------------|--------------------------------|------------|
| `PRIMG-02` | `gh auth token`呼び出し、Authorization header、HTTP応答、Content-Type、Content-Length、受信データ、HTTP失敗 | 実GitHub通信・private repository認証は未実行 | `child_process`とglobal `fetch`をテストダブル化し、各テスト後にglobalを復元 | 外部APIを単体テストから呼ばないため |
| `PRIMG-03` | GitHub取得と画像準備はモック | `.takt/tasks/<slug>/attachments`と`order.md`は実filesystemで観測 | `mkdtemp`でテストごとの作業ディレクトリを作成し、終了時に削除 | 実GitHub取得との結合は未確認 |
| `PRIMG-05` | Git provider、interactive mode、実行・保存処理をモックし、引数とcleanupを観測 | 実対話セッションは未実行 | 固定テストcwdとリセット済みmock stateを使用 | CLI全体のE2Eは実装後に確認するため |
| `PRIMG-06` | pipelineからtask spec生成・解決・`executeTask()`への引数伝播をモックで確認 | 既存`taskSpecContext.test.ts`で実filesystemへのattachment stagingを確認 | pipeline unitはfilesystem非使用。task spec ITは一時ディレクトリへ分離 | PR取得からrun contextまでを一度に通す結合テストは未作成 |
| `PRIMG-07` | 各所有者のcleanup呼び出し回数を確認 | addの永続task directoryは実filesystemで確認 | addは`mkdtemp`、他はmock stateを`beforeEach`で初期化 | 未実装の一時領域そのものの削除結果は実装後に再確認が必要 |

## 危険分岐・識別テスト

| 契約ID | 分岐 | 失敗させたい誤実装 | 拒否する入力 / 状態とassertion | テスト | 未カバー理由 |
|--------|------|--------------------|--------------------------------|--------|--------------|
| `PRIMG-01` | PR本文種別と画像記法 | PR本文だけ、またはMarkdownだけを走査する | 4セクションにMarkdown／HTMLを配置し、全て出現順のplaceholderになることを完全一致で確認 | `should replace images from every formatted PR section in appearance order` | |
| `PRIMG-02` | 対応画像形式 | Content-Typeだけを信用する | 4形式のContent-Typeとmagic一致を許可し、不一致と未知magicをreject | `github-pr-image-download.test.ts` | |
| `PRIMG-02` | URL allowlist | 任意URLやHTTP URLを取得する | HTTP、外部host、認証情報付きURL、非attachment GitHubパスで認証・fetchが呼ばれないことを確認 | `should reject a non-attachment URL before authentication or download` | |
| `PRIMG-02` | サイズ上限 | Content-Lengthだけ、または受信量だけを検証する | header超過とheaderなし実受信超過を別々にreject | `should reject Content-Length...`、`should reject a streamed body...` | |
| `PRIMG-02` | 機密情報 | 下位HTTPエラーへAuthorization tokenを露出する | tokenを含むHTTP client例外を与え、上位例外にtokenが含まれないことを確認 | `should not expose the GitHub token...` | |
| `PRIMG-04` | 重複URL | 同じ画像を出現回数分取得・保存する | MarkdownとHTMLで同じURLを参照し、download/saveが各1回、placeholderも同一であることを確認 | `should download a repeated image once and reuse its placeholder` | |
| `PRIMG-04` | 対象外画像 | 外部画像を削除または置換する | 外部host画像と通常リンクを含む本文が完全に維持され、downloadされないことを確認 | `should preserve unsupported image URLs without attempting a download` | |
| `PRIMG-05` | early return | workflow選択取消時に初期PR画像を残す | interactive未起動でもPR画像所有者cleanupが1回呼ばれることを確認 | `should cleanup downloaded PR attachments when workflow selection is cancelled` | |
| `PRIMG-06` | task spec配線 | 一時パスを本文へ直接渡す、またはtask specなしで実行する | `executeTask()`の`task`、`taskSpec`、`reportDirName`が解決結果と一致することを確認 | `should execute an attachment-backed task spec for PR images` | |
| `PRIMG-07` | 途中失敗 | 2件目の取得失敗後に1件目を残す | 1件目成功・2件目失敗でstore cleanupが1回呼ばれることを確認 | `should cleanup downloaded images when a later download fails` | |
| `PRIMG-07` | workflow失敗 | pipeline task specと画像一時領域を残す | `executeTask()`がfalseを返した後、両所有者のcleanupを確認 | `should cleanup PR image resources when attachment-backed workflow execution fails` | |

## 影響経路テスト（該当する契約のみ）

| 契約ID | 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|--------|------|----------|----------|--------------|--------|--------------|
| `PRIMG-03` | PR取得 → task変換 → attachment配列 → `saveTaskFile()` → task directory | PR attachment準備処理 | task attachment保存処理 | 画像ファイルと`order.md`参照が同じ番号・ファイル名で保存される | `addTask.test.ts` | |
| `PRIMG-05` | `resolvePrInput()` → interactive seed → interactive result → `selectAndExecuteTask()` | PR入力resolver | 対話実行処理 | 初期attachmentが実行オプションまで維持される | `should pass downloaded PR attachments through interactive execution...` | |
| `PRIMG-05` | `resolvePrInput()` → interactive result → `saveTaskFromInteractive()` | PR入力resolver | task保存処理 | save_taskでattachment配列が失われない | `should pass downloaded PR attachments to save_task` | |
| `PRIMG-06` | PR取得 → attachment準備 → transient task spec → `ResolvedTaskSpec` → `executeTask()` | pipeline task resolver | workflow実行処理 | prompt、manifest、report directoryが同じtask specに基づく | `pipelineExecution.test.ts` | |
| `PRIMG-06` | task spec → run context staging | `resolveTaskSpecForExecution()` | workflow run context | `order.md`のパス書換えと画像コピー | 既存`taskSpecContext.test.ts` | PR入力との単一結合テストではなく、所有境界ごとの証拠 |

## 連続実行・所有権・並行性（該当する場合）

| 契約ID | 実行シーケンスまたは交差 | 実際の上位入口 | 観測する不変条件 | テスト | 未カバー理由 |
|--------|--------------------------|----------------|------------------|--------|--------------|
| `PRIMG-07` | 1件目取得成功 → 2件目取得失敗 → 終了 | PR attachment準備 | 部分生成した一時画像をcleanupする | `prReviewAttachments.test.ts` | |
| `PRIMG-07` | PR画像準備 → workflow選択取消 | `takt add --pr`、対話型`takt --pr` | task未保存・interactive未起動でもcleanupする | `addTask.test.ts`、`cli-routing-pr-resolve.test.ts` | |
| `PRIMG-07` | task spec準備 → workflow失敗 → 終了 | pipeline `--pr` | transient task specとdownload storeを双方cleanupする | `pipelineExecution.test.ts` | |
| `PRIMG-07` | attachment保存成功 → cleanup | `takt add --pr` | 永続化先は残り、一時所有者だけをcleanupする | `addTask.test.ts` | cleanup mockのため実一時ディレクトリ削除は実装後確認 |
| `PRIMG-07` | 並行実行 | 該当なし | 要求に並行性契約がなく、各テストは独立状態を使用 | 未作成 | 契約にない並行性軸を追加しないため |

## 否定契約

| 契約ID | 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------|----------------|----------|--------|--------------|
| `PRIMG-02` | GitHub attachment以外へのHTTPアクセス | 認証・fetch呼び出しが0回であることを観測 | `github-pr-image-download.test.ts` | |
| `PRIMG-02` | MIMEとmagicが矛盾する画像の受理 | Promise rejectionを観測 | `github-pr-image-download.test.ts` | |
| `PRIMG-02` | サイズ上限超過画像の受理 | header超過・実受信超過双方のrejectionを観測 | `github-pr-image-download.test.ts` | |
| `PRIMG-02` | 認証tokenの例外露出 | 捕捉した例外文字列をtoken単位で検査 | `should not expose the GitHub token...` | |
| `PRIMG-04` | 外部画像記法の削除・置換 | 変換前後の本文完全一致とdownload未呼び出しを観測 | `prReviewAttachments.test.ts` | |
| `PRIMG-06` | 一時画像パスを直接workflow本文へ渡す | `executeTask()`が解決済みtask promptとtask specを受けることを観測 | `pipelineExecution.test.ts` | |
| `PRIMG-08` | 非画像PR本文やレビュー分類の変更 | 既存formatter出力のsection・順序・本文を観測 | `git-format.test.ts` | |

## 作成テスト

| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `src/__tests__/prReviewAttachments.test.ts` | 単体 | 4 | 全PRセクションの抽出・置換、重複排除、対象外URL維持、部分失敗cleanup |
| `src/__tests__/github-pr-image-download.test.ts` | 単体 | 14 | 4画像形式、4種の不正URL、MIME/magic、サイズ、HTTP失敗、認証、token非露出 |
| `src/__tests__/addTask.test.ts` | 統合（既存分類: heavy IT） | 2追加 | 実filesystemへの画像・参照保存、取消時cleanup |
| `src/__tests__/cli-routing-pr-resolve.test.ts` | 単体 | 3追加 | interactive seed、execute、save_task、取消時cleanup |
| `src/__tests__/pipelineExecution.test.ts` | 単体 | 2追加 | attachment付きtask spec実行、workflow失敗時cleanup |

## 未カバー項目

| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| 実private GitHub repositoryからの画像取得 | 外部サービスを決定的テストから呼ばないため | 実装後に認証済み`gh`環境で手動または隔離integration確認 |
| GitHubからCDN等への実redirect | redirect先契約と取得実装が未実装であるため | 実装時にredirect後の認証・host・サイズ検証方針とテストを確定 |
| add保存処理の例外後cleanup | 保存失敗を起こす適切な既存境界を今回のテストで構成していない | 実装時に保存依存の失敗テストを追加 |
| routing実行処理例外後の初期PR画像cleanup | 取消経路を代表失敗として作成し、PR初期所有者付きの実行例外は未追加 | 実装時に`selectAndExecuteTask()`例外ケースを追加 |
| PR取得からpipeline run contextまでの単一結合テスト | pipeline配線unitと既存task spec filesystem ITへ分割したため | 実装後、配線漏れリスクが残る場合はlight IT分類を追加 |
| 新規単体テスト本体の実行 | 対象プロダクションモジュールが未作成でimport段階に失敗するため | 実装直後に対象テストを再実行し、fixture・assertion欠陥がないことを確認 |
| `npm run build`、全`npm test`、`npm run test:it`、E2E | test-first工程で意図的にred状態のため | implementステップ完了後に全品質ゲートを実行 |

## 実行結果（参考）

実装前のためテスト失敗・importエラーは想定内。

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 153 | 変更対象テスト内の既存92件、分類契約19件、維持契約29件、task spec IT 13件 |
| Fail / Import Error（想定内） | 9 | 未実装配線によるassertion失敗7件、新規モジュール未作成によるsuite import error 2件 |
| Error（要対応） | 0 | lint成功、分類契約成功、`git diff --check`問題なし |

## 備考（判断がある場合のみ）

- 外部HTTPと`gh`は直接依存のみをテストダブル化し、URL・認証header・レスポンス検証・機密情報非露出を公開された振る舞いとして確認する構成にした。
- pipelineは新規配線をunitで確認し、既存`taskSpecContext.test.ts`の実filesystem検証と組み合わせた。両境界を一括した実連携は未確認として分離した。
- `addTask.test.ts`は既存分類上heavy ITであり、対象実行と`releaseVerificationWiring.test.ts`の単独実行を完了した。
- 編集後セルフスキャンでは、未使用import・mock、依存方向、同一責務の既存実装候補、TODO／skip、対象外ファイル差分を確認した。`npm install`が生じさせた`package-lock.json`差分は除去済みで、最終差分はテストファイルのみである。