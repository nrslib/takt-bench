# テスト作成レポート

## 要件-テスト対応表
| 要件ID | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|----------------|-----------|--------|------|--------------|
| `PRIMG-01` | PR 本文内の Markdown image / HTML img から GitHub 添付画像 URL を抽出し、本文内参照を `[Image #n]` に置換する | PR review data 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| `PRIMG-02` | 通常コメント内の画像 URL を抽出し、該当コメント本文を `[Image #n]` 参照に置換する | PR review data 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| `PRIMG-03` | review summary / review thread コメント内の画像 URL を抽出し、該当本文を `[Image #n]` 参照に置換する | PR review data 正規化 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| `PRIMG-04` | Markdown image syntax と HTML `<img src="...">` を同じ文書出現順で attachment 化する | URL 抽出 helper | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| `PRIMG-05` | GitHub attachment URL 以外は取得対象にせず、外部 URL へ送信しない | ダウンロード前 URL フィルタ | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| `PRIMG-06` | redirect 後 URL も GitHub attachment URL として検証し、偽装 host を拒否する | ダウンロード後 response URL 検証 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| `PRIMG-07` | PNG/JPEG/GIF/WebP の Content-Type と magic bytes を検証する | 画像データ検証 helper | `src/__tests__/prReviewImageAttachments.test.ts`, `src/__tests__/imageData.test.ts` | 作成 | |
| `PRIMG-08` | GIF magic bytes 判定で `GIF87a` / `GIF89a` 以外を GIF と誤判定しない | 画像データ検証 helper | `src/__tests__/imageData.test.ts` | 作成 | |
| `PRIMG-09` | サイズ上限超過を attachment として受け入れず、body 読み込み前に拒否する | ダウンロード検証 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| `PRIMG-10` | `TaskAttachment[]` は既存 attachment 契約の `placeholder/tempPath/fileName` のみを返す | TaskAttachment builder | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| `PRIMG-11` | 一時ディレクトリは固定 `.takt/tmp/image-attachments` ではなく、一意な作業領域を使う | 一時ファイル作成 | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| `PRIMG-12` | ダウンロード途中で失敗した場合、作成済み一時ファイルを cleanup する | 部分失敗 cleanup | `src/__tests__/prReviewImageAttachments.test.ts` | 作成 | |
| `PRIMG-13` | `takt add --pr` は書き換え済み `PrReviewData` を `formatPrReviewAsTask()` に渡し、attachment を `saveTaskFile()` に渡す | CLI add 永続化境界 | `src/__tests__/addTask.test.ts` | 作成 | |
| `PRIMG-14` | PR 本文に画像がある場合、コメント・review が空でも PR task として保存できる | CLI add 永続化境界 | `src/__tests__/addTask.test.ts` | 作成 | |
| `PRIMG-15` | PR に画像 attachment がない場合は空 attachments 配列を interactive seed に渡さない | CLI routing / interactive seed | `src/__tests__/cli-routing-pr-resolve.test.ts` | 作成 | |
| `PRIMG-16` | `takt --pr` の interactive seed に PR 画像 attachment と書き換え済み本文が伝搬する | CLI routing / interactive seed | `src/__tests__/cli-routing-pr-resolve.test.ts` | 作成 | |
| `PRIMG-17` | interactive result 側に初期 attachment が含まれる場合、PR attachment を二重追加しない | CLI routing / execute handoff | `src/__tests__/cli-routing-pr-resolve.test.ts` | 作成 | |
| `PRIMG-18` | pipeline の `--pr` 経路では attachment 付き task spec を prepare/stage して実行 prompt に渡す | pipeline resolve → prepare → stage → execute | `src/__tests__/pipelineExecution.test.ts` | 作成 | |
| `PRIMG-19` | PR attachment helper 追加後も既存 cwd 伝搬契約を壊さない | git cwd propagation | `src/__tests__/git-cwd-propagation.test.ts` | 作成 | |

## 危険分岐テスト
| 分岐 | 失敗させたい誤実装 | テスト | 未カバー理由 |
|------|--------------------|--------|--------------|
| 不正 URL | `https://example.com/...` を取得しに行く | `src/__tests__/prReviewImageAttachments.test.ts` | |
| redirect 偽装 | `response.url.startsWith('https://github.com')` だけで許可する | `src/__tests__/prReviewImageAttachments.test.ts` | |
| 抽出順の崩れ | Markdown image を全件先に処理し、HTML img の placeholder 番号が本文出現順からずれる | `src/__tests__/prReviewImageAttachments.test.ts` | |
| magic bytes 境界 | `87a` を含むだけの非 GIF を GIF と判定する | `src/__tests__/imageData.test.ts` | |
| attachment 契約逸脱 | `TaskAttachment` に `sourceUrl` など未定義フィールドを混ぜる | `src/__tests__/prReviewImageAttachments.test.ts` | |
| 一時ディレクトリ衝突 | 固定 `.takt/tmp/image-attachments` を使い回す | `src/__tests__/prReviewImageAttachments.test.ts` | |
| 部分失敗 | 2枚目の検証失敗後に1枚目の一時ファイルが残る | `src/__tests__/prReviewImageAttachments.test.ts` | |
| 空値伝搬 | 画像がない PR でも `attachments: []` を interactive seed に混ぜる | `src/__tests__/cli-routing-pr-resolve.test.ts` | |
| 二重追加 | interactive result の attachments と PR 初期 attachments を重複連結する | `src/__tests__/cli-routing-pr-resolve.test.ts` | |
| pipeline 伝搬漏れ | `resolveTaskContent()` の attachments を `executeTask()` まで渡さない | `src/__tests__/pipelineExecution.test.ts` | |

## 横断経路テスト
| 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|------|----------|----------|--------------|--------|--------------|
| `takt add --pr` | `preparePrReviewImageAttachments()` | `formatPrReviewAsTask()` / `saveTaskFile()` | 書き換え済み PR data と attachments が保存境界へ渡る | `src/__tests__/addTask.test.ts` | |
| `takt --pr` interactive | `resolvePrInput()` | `interactiveMode()` / `quietMode()` / `personaMode()` | sourceContext と initial attachments が seed に入る | `src/__tests__/cli-routing-pr-resolve.test.ts` | |
| `takt --pr` execute | interactive result | `selectAndExecuteTask()` | 初期 attachment が二重追加されない | `src/__tests__/cli-routing-pr-resolve.test.ts` | |
| pipeline `--pr` | `resolveTaskContent()` | `prepareTaskSpecDirectory()` / `stageTaskSpecForExecution()` / `executeTask()` | attachment 付き task spec として実行される | `src/__tests__/pipelineExecution.test.ts` | |
| cwd propagation | CLI cwd | PR attachment helper | helper 追加後も cwd が明示的に渡る | `src/__tests__/git-cwd-propagation.test.ts` | |

## 否定契約
| 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------------|----------|--------|--------------|
| GitHub attachment 以外の外部 URL を取得する | token / fetch mock が呼ばれないことと本文が保持されることを確認 | `src/__tests__/prReviewImageAttachments.test.ts` | |
| redirect 後の非 attachment URL を許可する | 偽装 URL で reject することを確認 | `src/__tests__/prReviewImageAttachments.test.ts` | |
| `TaskAttachment` に契約外フィールドを混ぜる | attachment の key が `placeholder/tempPath/fileName` のみであることを確認 | `src/__tests__/prReviewImageAttachments.test.ts` | |
| 空 attachment を seed/options に載せる | interactive seed が `sourceContext` のみであることを確認 | `src/__tests__/cli-routing-pr-resolve.test.ts` | |
| PR attachment を execute 経路で二重追加する | `selectAndExecuteTask()` に渡る attachments が1件だけであることを確認 | `src/__tests__/cli-routing-pr-resolve.test.ts` | |
| pipeline で attachments を文字列 task のみに落として実行する | `prepareTaskSpecDirectory()` と `stageTaskSpecForExecution()` の呼び出しを確認 | `src/__tests__/pipelineExecution.test.ts` | |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `src/__tests__/prReviewImageAttachments.test.ts` | 単体 | 関連10件 | PR 画像 URL 抽出、取得制限、本文置換、attachment 生成、cleanup |
| `src/__tests__/imageData.test.ts` | 単体 | 関連1件 | magic bytes 境界判定 |
| `src/__tests__/addTask.test.ts` | 統合 | 関連8件 | `add --pr` 保存経路への attachment 伝搬 |
| `src/__tests__/cli-routing-pr-resolve.test.ts` | 統合 | 関連5件 | `takt --pr` interactive / execute 経路への attachment 伝搬 |
| `src/__tests__/pipelineExecution.test.ts` | 統合 | 関連1件 | pipeline `--pr` で attachment 付き task spec を stage する経路 |
| `src/__tests__/git-cwd-propagation.test.ts` | 統合 | 関連2件 | PR attachment helper 追加後の cwd 伝搬維持 |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| 実際の GitHub private image を `gh` 認証で取得する E2E | ローカル認証状態と外部 GitHub 実体に依存し、単体/統合テストの安定性を損なうため、fetch / token を契約 mock で固定した | 実装後に手動または専用 E2E 環境で private repository の画像取得を確認 |
| `npm run build` / `npm run lint` / 全体 `npm test` の成功 | write_tests 段階では実装前の失敗が想定されるため、対象テストのみ実行した | implement 後に品質要件として全コマンドを実行 |

## 実行結果（参考）
実装前のためテスト失敗・import エラーは想定内。

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 113 | 対象6ファイルの部分実行結果 |
| Fail / Import Error（想定内） | 7 | 現行実装との契約差分起因。空 attachments 伝搬、二重追加、pipeline staging 未配線、画像抽出順、契約外 `sourceUrl`、redirect 判定、一時ディレクトリ cleanup |
| Error（要対応） | 0 | 対象実行では、実装後も残る import パスミス等は確認されていない |

実行コマンド:

```text
npm test -- --run src/__tests__/prReviewImageAttachments.test.ts src/__tests__/imageData.test.ts src/__tests__/addTask.test.ts src/__tests__/cli-routing-pr-resolve.test.ts src/__tests__/pipelineExecution.test.ts src/__tests__/git-cwd-propagation.test.ts
```

差分確認:

```text
git diff --check -- src/__tests__/addTask.test.ts src/__tests__/cli-routing-pr-resolve.test.ts src/__tests__/prReviewImageAttachments.test.ts src/__tests__/imageData.test.ts src/__tests__/pipelineExecution.test.ts src/__tests__/git-cwd-propagation.test.ts
```

結果: 成功。

## 備考（判断がある場合のみ）
- 今回はテストファイルのみ作成・更新し、プロダクションコードは変更していない。
- `src/__tests__/pipelineExecution.test.ts` は、`resolveTaskContent()` で attachments を返すだけの弱いテストではなく、`prepareTaskSpecDirectory()`、`stageTaskSpecForExecution()`、`executeTask()` までの横断経路を固定した。
- `src/__tests__/cli-routing-pr-resolve.test.ts` は、PR context の存在確認と空 attachments 禁止を分離し、同じ失敗条件が複数テストを汚染しないようにした。

## Disputed Findings
- findingId: `F-0001`
- reason: 現在のコードには画像 URL 抽出、GitHub 認証付き取得、Content-Type / size / magic bytes 検証の中核処理が存在するため、「Core image downloading logic is missing」という finding は現状と一致しない。残っている問題は中核処理の欠落ではなく、書き換え済み PR data の返却契約、pipeline の task spec staging、redirect URL の厳格化、一時ディレクトリ cleanup、attachment 二重追加である。
- evidence:
  - `src/features/tasks/prReviewImageAttachments.ts:50` 画像 URL 抽出
  - `src/features/tasks/prReviewImageAttachments.ts:76` 画像ダウンロード処理
  - `src/features/tasks/prReviewImageAttachments.ts:84` `gh auth token` 利用
  - `src/features/tasks/prReviewImageAttachments.ts:89` 認証付き fetch
  - `src/features/tasks/prReviewImageAttachments.ts:107` Content-Type 検証
  - `src/features/tasks/prReviewImageAttachments.ts:110` サイズ上限検証
  - `src/features/tasks/prReviewImageAttachments.ts:113` 画像データ検証
  - `src/features/tasks/prReviewImageAttachments.ts:199` `TaskAttachment[]` 生成
  - `src/features/tasks/add/index.ts:199` `add --pr` 経路の呼び出し
  - `src/app/cli/routing-inputs.ts:71` `takt --pr` 経路の呼び出し
  - `src/features/pipeline/steps.ts:163` pipeline PR 入力経路の呼び出し