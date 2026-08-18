# テスト作成レポート

## 完了契約-テスト対応表
| 契約ID | 由来 | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|------|----------------|-----------|--------|------|--------------|
| `PRIMG-EXTRACT` | 計画 | PR本文・通常コメント・review summary・threadコメントのMarkdown画像/HTML `<img>`を検出し、`[Image #N]`へ置換した新しい`PrReviewData`を返す。コード領域・外部URL・非HTTPSは非検出。重複URLは1回取得・同一プレースホルダーへ集約。既存`[Image #N]`と衝突しない採番。入力は不変 | 実行時（抽出関数） | `prReviewImageAttachments.test.ts` | 作成 | — |
| `PRIMG-VALIDATE` | 計画 | 認証トークン付きで取得し、Content-Type・magic bytes・サイズ（10MiB）を検証してPNG/JPEG/GIF/WebPの`StoredImageAttachment[]`をprivate一時ファイルで生成。不一致・超過・取得失敗はPR入力を失敗させ、途中生成ファイルを解放 | 実行時（ダウンロード関数） | `prReviewImageAttachments.integration.test.ts` | 作成 | — |
| `PRIMG-ADD` | 計画 | `takt add --pr`で画像を`saveTaskFile()`へ渡し、`.takt/tasks/<slug>/attachments/`へ保存・`order.md`に添付節生成。本文画像のみのPRも保存。workflowキャンセル・解決失敗時に一時画像を解放 | CLI（add） | `addTask.test.ts` | 作成 | — |
| `PRIMG-DIRECT` | 計画 | 直接`takt --pr`でPR画像を`InteractiveSeedInput.attachments`へ渡し、interactive result経由でexecute/save_taskへ伝播。キャンセル・例外時に一時画像を解放。後続貼り付け画像と番号衝突しない | CLI（routing） | `cli-routing-pr-resolve.test.ts`、`imageAttachments.test.ts` | 作成 | — |
| `PRIMG-PIPELINE` | 計画 | pipeline `--pr`でattachment付きtask specを生成し、`executeTask()`へ一致する`taskSpec`と`reportDirName`を渡す。実行失敗・早期returnを含む全終了経路で一時task specとダウンロード領域を解放 | CLI（pipeline） | `pipelineExecution.test.ts` | 作成 | — |
| `PRIMG-MAINTAIN` | 計画 | 画像なしPRの整形・branch/base branch・PR context、空コメントPRの従来拒否、GitLab等の非対応providerで画像取得を強制しない | CLI（add/routing/pipeline） | 既存テストの回帰（`addTask.test.ts`、`cli-routing-pr-resolve.test.ts`、`pipelineExecution.test.ts`、`github-provider.test.ts`） | 既存 | — |
| `PRIMG-QUALITY` | 計画 | 新規ロジックの単体テスト追加、`npm run build`/`lint`/`test`成功 | 品質ゲート | `imageFormat.test.ts`、`prReviewImageAttachments.test.ts`、`prReviewImageAttachments.integration.test.ts` | 作成 | 実装前のため品質ゲート全体の成功は未確認 |

## 検証境界（外部境界または環境依存境界を持つ契約のみ）
| 契約ID | モックで確認した範囲 | 実連携範囲 | テスト環境 / HOME / 設定の分離 | 未確認理由 |
|--------|----------------------|------------|--------------------------------|------------|
| `PRIMG-VALIDATE` | `getToken`と`fetch`をtest doubleに置換し、認証ヘッダ付与・Content-Type不一致・magic不一致・サイズ超過・途中失敗時清掃を実一時ファイルで検証 | 実`gh auth token`・実HTTP取得は未実行 | `mkdtemp`による一時領域分離、`afterEach`で削除 | 実GitHub API・実`gh`資格情報は外部依存のため未実行 |
| `PRIMG-ADD` | `fetchPrReviewComments`/`resolvePrReviewImageAttachments`/`formatPrReviewAsTask`をモックし、実ファイル保存・添付節・清掃を検証 | 実PR取得・実画像ダウンロードは未実行 | `mkdtemp`による一時領域分離 | 実GitHub連携は外部依存のため未実行 |
| `PRIMG-PIPELINE` | `fetchPrReviewComments`/`resolvePrReviewImageAttachments`/`executeTask`をモックし、`taskSpec`/`reportDirName`の一致・清掃を検証 | 実run contextへの画像複製は既存`stageTaskSpecForExecution()`契約に委譲 | モックによる分離 | 実workflow実行は外部依存のため未実行 |

## 危険分岐・識別テスト
| 契約ID | 分岐 | 失敗させたい誤実装 | 拒否する入力 / 状態とassertion | テスト | 未カバー理由 |
|--------|------|--------------------|--------------------------------|--------|--------------|
| `PRIMG-EXTRACT` | コード領域の非検出 | コードフェンス/インラインコード内の画像記法を実画像として取得する | フェンス内・インラインコード内の文字列が`references`に含まれず、本文が不変であること | `prReviewImageAttachments.test.ts` | — |
| `PRIMG-EXTRACT` | 外部URL・非HTTPSの非検出 | 任意外部URLや`http://`を取得する | `https://example.com/image.png`・`http://github.com/...`が`references`に含まれないこと | `prReviewImageAttachments.test.ts` | — |
| `PRIMG-EXTRACT` | 既存プレースホルダー衝突 | 既存`[Image #1]`と新規画像が同じ番号になる | 既存`[Image #1]`がある本文で新規画像が`[Image #2]`になること | `prReviewImageAttachments.test.ts` | — |
| `PRIMG-EXTRACT` | 重複URL | 同一URLを複数回取得し別番号を割る | 同一URLの全出現が同じ`[Image #1]`へ置換され`references`が1件であること | `prReviewImageAttachments.test.ts` | — |
| `PRIMG-VALIDATE` | Content-Type不一致 | Content-Typeを検証せず保存する | `text/plain`応答がrejectされること | `prReviewImageAttachments.integration.test.ts` | — |
| `PRIMG-VALIDATE` | magic不一致 | magic bytesを検証せず保存する | `image/png`宣言で`text`データがrejectされること | `prReviewImageAttachments.integration.test.ts` | — |
| `PRIMG-VALIDATE` | サイズ超過 | Content-Length/実測byte数の上限を適用しない | 10MiB超の応答がrejectされること | `prReviewImageAttachments.integration.test.ts` | — |
| `PRIMG-VALIDATE` | 途中失敗時清掃 | 失敗時に既存一時ファイルを残す | 2件目失敗後に一時領域が空であること | `prReviewImageAttachments.integration.test.ts` | — |
| `PRIMG-ADD` | 本文画像のみのPR | 画像があるのにコメントなしとして拒否する | コメント/レビュー空でも保存され`pr_number`が記録されること | `addTask.test.ts` | — |
| `PRIMG-ADD` | キャンセル/失敗時清掃 | workflowキャンセル・解決失敗で一時画像を残す | キャンセル時に`cleanup`が1回呼ばれ、解決失敗時にエラー出力されること | `addTask.test.ts` | — |
| `PRIMG-DIRECT` | 採番衝突 | PR画像と後続貼り付け画像が同じ番号になる | 初期`[Image #3]`のstoreで次が`[Image #4]`になること | `imageAttachments.test.ts` | — |
| `PRIMG-PIPELINE` | 実行失敗時清掃 | 実行失敗で一時task spec/画像を残す | 失敗時に`cleanup`が1回呼ばれexit code 3になること | `pipelineExecution.test.ts` | — |

## 影響経路テスト（該当する契約のみ）
| 契約ID | 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|--------|------|----------|----------|--------------|--------|--------------|
| `PRIMG-ADD` | `addTask()` → `resolvePrReviewImageAttachments()` → `formatPrReviewAsTask()` → `saveTaskFile()` → `prepareTaskSpecDirectory()` → `promoteTaskAttachments()` | PR取得・画像解決 | 保存taskディレクトリ・`order.md` | 置換済みPRが整形され、attachmentsが保存・添付節生成される | `addTask.test.ts` | — |
| `PRIMG-DIRECT` | `resolvePrInput()` → `InteractiveSeedInput.attachments` → interactive result → `selectAndExecuteTask()`/`saveTaskFromInteractive()` | PR画像解決 | 対話AI・直接実行task spec・保存task | seed attachmentsがinteractiveへ渡り、全actionで清掃される | `cli-routing-pr-resolve.test.ts` | — |
| `PRIMG-PIPELINE` | `resolveTaskContent()` → `prepareTaskSpecDirectory()` → `resolveTaskSpecForExecution()` → `executeTask()` | PR画像解決 | workflow実行 | `taskSpec`と`reportDirName`が一致し、画像がrun contextへstageされる | `pipelineExecution.test.ts` | — |

## 連続実行・所有権・並行性（該当する場合）
| 契約ID | 実行シーケンスまたは交差 | 実際の上位入口 | 観測する不変条件 | テスト | 未カバー理由 |
|--------|--------------------------|----------------|------------------|--------|--------------|
| `PRIMG-ADD` | 画像解決→保存→正常終了 / workflowキャンセル / 解決失敗 | `takt add --pr` | 全終了経路で一時画像が解放される | `addTask.test.ts` | — |
| `PRIMG-DIRECT` | 画像解決→interactive→execute / save_task / cancel / 例外 | `takt --pr` | 全action・例外で一時画像が解放される | `cli-routing-pr-resolve.test.ts` | — |
| `PRIMG-PIPELINE` | 画像解決→task spec生成→実行成功 / 実行失敗 | `takt --pipeline --pr` | 実行失敗を含む全終了経路で一時task specと画像が解放される | `pipelineExecution.test.ts` | — |

## 否定契約
| 契約ID | 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------|----------------|----------|--------|--------------|
| `PRIMG-EXTRACT` | コード領域・外部URL・非HTTPSの画像を取得する | `references`に含まれず本文が不変であること | `prReviewImageAttachments.test.ts` | — |
| `PRIMG-VALIDATE` | 認証情報をログ・例外へ露出する | 認証ヘッダが`Bearer gh-token`で付与されること（露出しないことの代理） | `prReviewImageAttachments.integration.test.ts` | ログ出力の非露出は実装後に確認が必要 |
| `PRIMG-MAINTAIN` | 非対応provider（GitLab等）へ画像取得を強制する | 既存providerテストの回帰でcapability非対応を維持 | `github-provider.test.ts` | — |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `src/__tests__/imageFormat.test.ts` | 単体 | 3 describe / 12 it | PNG/JPEG/GIF/WebPのmagic bytes判定、MIME→拡張子変換、10MiB上限 |
| `src/__tests__/prReviewImageAttachments.test.ts` | 単体 | 1 describe / 15 it | 抽出・分類・採番（本文/コメント/thread、Markdown/HTML、コード領域・外部URL・非HTTPSの非検出、重複集約、衝突回避、入力不変） |
| `src/__tests__/prReviewImageAttachments.integration.test.ts` | 統合（light IT） | 1 describe / 6 it | 認証付き取得・Content-Type/magic/サイズ検証・途中失敗時清掃・認証ヘッダ付与 |
| `src/__tests__/imageAttachments.test.ts` | 単体（更新） | +1 it | 非連番の初期attachment後の採番 |
| `src/__tests__/github-provider.test.ts` | 単体（更新） | +1 it | `resolvePrReviewImageAttachments` capabilityの委譲 |
| `src/__tests__/addTask.test.ts` | 統合（更新） | +4 it | PR画像保存・添付節生成・本文画像のみのPR・キャンセル/失敗時清掃 |
| `src/__tests__/cli-routing-pr-resolve.test.ts` | 単体（更新） | +3 it | seed attachments伝播・キャンセル/例外時清掃 |
| `src/__tests__/pipelineExecution.test.ts` | 単体（更新） | +2 it | attachment付きtask spec実行・実行失敗時清掃 |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| 実GitHub API・実`gh auth token`・実HTTP取得 | 外部依存のためtest doubleで代替 | 実装後の手動確認またはE2E |
| 実run contextへの画像複製 | 既存`stageTaskSpecForExecution()`契約に委譲 | 実装後のpipeline実行確認 |
| 認証情報のログ非露出 | 実装前のため観測不能 | 実装後のコードレビュー |
| `npm run build`/`lint`/`test`/`test:it`/`test:e2e:mock`の全体成功 | プロダクションコード未実装のため | 実装ステップ後の品質ゲート実行 |

## 実行結果（参考）
実装前のためテスト失敗・import エラーは想定内。

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 167 | 既存テストの回帰（imageAttachments 54、addTask 17、cli-routing/pipeline 76、releaseVerificationWiring 20） |
| Fail / Import Error（想定内） | 12 | 未実装モジュール起因（imageFormat 12、prReviewImageAttachments 15、integration 6、imageAttachments 1、github-provider 1、addTask 4、cli-routing 3、pipeline 2 のうち新規分） |
| Error（要対応） | 0 | — |

## 備考（判断がある場合のみ）
- 新規ITは`*.integration.test.ts`命名とし、heavy parallel glob（`src/__tests__/**/*.integration.test.ts`）に分類されることを`releaseVerificationWiring.test.ts`の分類契約で確認した。
- `addTask.test.ts`・`github-provider.test.ts`・`imageAttachments.test.ts`は`auditedIntegrationBoundaryTestFiles`に既に分類されており、heavy IT gateで実行される。
- `cli-routing-pr-resolve.test.ts`・`pipelineExecution.test.ts`はunit gateで実行される。
- テストが参照する新規プロダクションモジュール（`src/shared/utils/imageFormat.ts`、`src/infra/github/prReviewImageAttachments.ts`）とcapability（`resolvePrReviewImageAttachments`）は未実装のため、全新規テストはimportエラーまたは未実装動作で失敗することを確認した。これはtest-first工程の期待どおりの状態である。
- `package-lock.json`は`npm install`による無関係なintegrity差分を検出しrevert済み。