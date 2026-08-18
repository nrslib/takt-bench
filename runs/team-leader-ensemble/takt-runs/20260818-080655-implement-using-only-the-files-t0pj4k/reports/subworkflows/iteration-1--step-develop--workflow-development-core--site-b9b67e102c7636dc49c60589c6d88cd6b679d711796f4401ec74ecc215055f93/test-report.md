# テスト作成レポート

## 完了契約-テスト対応表

| 契約ID | 由来 | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|---|---|---|---|---|---|---|
| `PR-IMG-1` | 計画 | PR body、通常コメント、review summary、review thread から画像を抽出し、許可URL・Content-Type・magic bytes・サイズを検証する | GitHub PR取得 | `github-pr-attachments.integration.test.ts` / `extracts, validates, and stores images from the PR body, comments, review summary, and review thread` | 作成・未実装で失敗 | — |
| `PR-IMG-1` | 計画 | `SCN-PR-IMG-1-P1` の4経路画像を順序付きattachmentとして観測する | GitHub PR取得 | `src/__tests__/github-pr-attachments.integration.test.ts` / `extracts, validates, and stores images from the PR body, comments, review summary, and review thread` | 作成・未実装で失敗 | — |
| `PR-IMG-1` | 計画 | `SCN-PR-IMG-1-N1` のcode fence、inline code、外部URL、未閉鎖構文を取得しない | GitHub PR取得 | `src/__tests__/github-pr-attachments.integration.test.ts` / `does not download images inside code, malformed image syntax, or non-GitHub URLs` | 作成・成功 | — |
| `PR-ATT-1` | 計画 | 検証済みattachmentを既存保存経路へ渡し、task directory、`attachments/`、`order.md`を生成する | `add --pr` | `addTask.test.ts` / `should save PR image attachments through the existing task attachment path` | 作成・未実装で失敗 | — |
| `PR-ATT-1` | 計画 | `SCN-PR-ATT-1-P1` の重複URLを1件に統合し、別URLを次の番号へ割り当てる | formatter・attachment変換 | `git-format.test.ts` / `deduplicates repeated image sources while preserving attachment numbering`、`github-pr-attachments.integration.test.ts` / `extracts, validates, and stores images from the PR body, comments, review summary, and review thread` | 作成・未実装で失敗 | — |
| `PR-REF-1` | 計画 | Markdown・HTML画像参照を`[Image #N]`へ置換し、raw URLを残さない | PR formatter | `git-format.test.ts` / `replaces Markdown and HTML image sources with their attachment placeholders` | 作成・未実装で失敗 | — |
| `PR-ROUTE-1` | 計画 | `SCN-PR-ATT-1-N1` のPR画像をinteractive seedへ渡し、ユーザー画像の後続番号を保証する | 通常の`--pr` | `cli-routing-pr-resolve.test.ts` / `should resolve PR review comments and pass to interactive mode`、`imageAttachments.test.ts` / `should continue numbering user-pasted images after seeded PR attachments` | 作成・未実装で失敗（一部既存番号処理は成功） | 実interactive実行・保存まではモック境界 |
| `PR-PIPE-1` | 計画 | pipelineのPR取得結果にattachmentを保持する | pipeline task content | `pipeline-steps.test.ts` / `should carry PR image attachments from fetch into pipeline task content` | 作成・未実装で失敗 | — |
| `PR-PIPE-1` | 計画 | pipelineのtask specに`order.md`、manifest、画像ファイルを配置する | pipeline直実行 | `pipeline-pr-attachments.integration.test.ts` / `stages PR image attachments in the task spec before workflow execution` | 作成・未実装で失敗 | 実agent実行まではモック境界 |
| `PR-KEEP-1` | 計画 | 既存のattachment検証・コピー・manifest・staging経路を維持する | task attachment保存・run context | `saveTaskFile.test.ts` / `should promote image attachments and append relative paths to order.md` ほか既存テスト、追加`addTask.test.ts` | 既存・追加作成 | — |
| `PR-QUAL-1` | 計画 | build、lint、型契約、テスト分類契約を満たす | 品質ゲート | `releaseVerificationWiring.test.ts`、`npm run build`、`npm run lint`、`npm run test:type-contracts` | 成功 | — |

## 検証境界

| 契約ID | モックで確認した範囲 | 実連携範囲 | テスト環境 / HOME / 設定の分離 | 未確認理由 |
|---|---|---|---|---|
| `PR-IMG-1` | `gh`のPR/GraphQL応答、HTTPヘッダー、バイナリ内容、許可URL判定 | 実ファイルへの一時保存と読み出し | Vitestの一時ディレクトリ、テスト終了時cleanup | 実GitHub・実認証・実ネットワークは未実行 |
| `PR-ATT-1` | PR取得・formatterをモック | 実task directory、`order.md`、`attachments/`への保存 | OS一時ディレクトリ | 実CLI起動は未実行 |
| `PR-ROUTE-1` | Git provider、interactive mode、workflow選択をモック | routeのPR取得結果からseedへの受け渡し | Vitestモック環境 | 実interactive providerと実保存終端は未実行 |
| `PR-PIPE-1` | PR取得、agent実行、Gitコマンドをモック | 実task specの作成、ファイル配置、manifest確認 | OS一時ディレクトリ | 実agent・実GitHub連携は未実行 |

## 危険分岐・識別テスト

| 契約ID | 分岐 | 失敗させたい誤実装 | 拒否する入力 / 状態とassertion | テスト | 未カバー理由 |
|---|---|---|---|---|---|
| `PR-IMG-1` | URL allowlist | 任意の外部URLを取得する | 外部URLを含む本文、`--include`呼び出し件数が0 | `github-pr-attachments.integration.test.ts` / `does not download images inside code, malformed image syntax, or non-GitHub URLs` | — |
| `PR-IMG-1` | 文脈除外 | code fence・inline code・未閉鎖構文を画像と解釈する | 対象文脈内URL、attachmentが空 | 同上 | — |
| `PR-IMG-1` | レスポンス検証 | Content-Type、magic bytes、サイズのいずれかを省略する | 不一致・不正magic bytes・10MB超、`toThrow()` | `github-pr-attachments.integration.test.ts` / `rejects an image response with an invalid $name` | — |
| `PR-ATT-1` | 重複排除・採番 | 同一URLを複数ファイル・同一番号で保存する | 同一URLと別URL、placeholder/fileNameの順序を検証 | `git-format.test.ts` / `deduplicates repeated image sources while preserving attachment numbering` | — |
| `PR-ROUTE-1` | placeholder衝突 | PR画像とユーザー画像が同じ番号になる | 初期`[Image #1]`後のユーザー画像が`[Image #2]` | `imageAttachments.test.ts` / `should continue numbering user-pasted images after seeded PR attachments` | — |
| `PR-PIPE-1` | 配線欠落 | task textだけ渡し、task specを渡さない | `executeTask`受領時の`taskSpec`、manifest、画像ファイルを検証 | `pipeline-pr-attachments.integration.test.ts` / `stages PR image attachments in the task spec before workflow execution` | — |
| `PR-IMG-1` | opt-in境界 | system-step等の既存取得でも画像取得を常時実行する | 通常呼び出しでattachmentsなし、`--include`なし | `github-pr.test.ts` / `maps PR review metadata and thread comments across the provider boundary` | — |

## 影響経路テスト

| 契約ID | 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|---|---|---|---|---|---|---|
| `PR-IMG-1` | GitHub PR → PR metadata/thread → image extraction/download/validation | `fetchPrReviewComments` | formatter・保存経路 | 検証済みattachmentが順序付きで生成される | `github-pr-attachments.integration.test.ts` | 実GitHub連携は未確認 |
| `PR-REF-1` | `PrReviewData` → formatter → task content | formatter | task order本文 | URLがplaceholderへ置換される | `git-format.test.ts` | — |
| `PR-ATT-1` | PR取得 → formatter → `saveTaskFile` → task spec | `add --pr` | `.takt/tasks/<slug>/order.md`と`attachments/` | 本文・画像・attachment行が同じtaskへ保存される | `addTask.test.ts` | 未実装のため失敗 |
| `PR-ROUTE-1` | PR取得 → interactive seed → interactive結果 → execute/save | `resolvePrInput` | interactive mode | PR attachmentがinteractive入口へ伝播する | `cli-routing-pr-resolve.test.ts` | 実interactive終端は未確認 |
| `PR-PIPE-1` | PR取得 → `resolveTaskContent` → task spec → `executeTask` | pipeline PR入力 | agent task spec | run前にorder、画像、manifestが揃う | `pipeline-steps.test.ts`、`pipeline-pr-attachments.integration.test.ts` | 実agent実行は未確認 |

## 連続実行・所有権・並行性

| 契約ID | 実行シーケンスまたは交差 | 実際の上位入口 | 観測する不変条件 | テスト | 未カバー理由 |
|---|---|---|---|---|---|
| `PR-ROUTE-1` | PR画像初期化 → ユーザー画像追加 | 通常の`--pr`相当のattachment store | placeholder番号が重複しない | `imageAttachments.test.ts` / `should continue numbering user-pasted images after seeded PR attachments` | 実route全体の連続実行は未確認 |
| `PR-ATT-1` | attachment生成 → task保存 → task directory読み出し | `add --pr` | 保存後もorderと画像ファイルが対応する | `addTask.test.ts` / `should save PR image attachments through the existing task attachment path` | 現在はproduction未実装 |
| `PR-PIPE-1` | task spec生成 → executeTask受領 → cleanup | pipeline `--pr` | 実行前のspec配置と終了後cleanup | `pipeline-pr-attachments.integration.test.ts` / `stages PR image attachments in the task spec before workflow execution` | 現在はproduction未実装 |

## 否定契約

| 契約ID | 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|---|---|---|---|---|
| `PR-IMG-1` | 外部URL・コード内URL・未閉鎖構文を取得しない | attachment空、`--include`呼び出しなし | `github-pr-attachments.integration.test.ts` / `does not download images inside code, malformed image syntax, or non-GitHub URLs` | — |
| `PR-IMG-1` | 不正Content-Type・magic bytes・サイズ超過を有効attachmentにしない | `toThrow()` | `github-pr-attachments.integration.test.ts` / `rejects an image response with an invalid $name` | — |
| `PR-REF-1` | task本文に元画像URLを残さない | `not.toContain(url)` | `git-format.test.ts` / `replaces Markdown and HTML image sources with their attachment placeholders` | 現在はproduction未実装 |
| `PR-KEEP-1` | 既存保存・manifest検証を迂回しない | 既存attachment保存テストと追加保存テスト | `saveTaskFile.test.ts`、`addTask.test.ts` | PR固有のsymlink・collision失敗経路は未追加 |

## 作成テスト

| ファイル | 種別 | テスト数 | 概要 |
|---|---|---:|---|
| `src/__tests__/github-pr-attachments.integration.test.ts` | 統合 | 5 | 4経路抽出、重複、除外、Content-Type/magic bytes/サイズ検証 |
| `src/__tests__/pipeline-pr-attachments.integration.test.ts` | 統合 | 1 | pipeline task specへの画像配置とmanifest |
| `src/__tests__/addTask.test.ts` | 統合 | 18 | PR取得オプション、既存task attachment保存経路 |
| `src/__tests__/cli-routing-pr-resolve.test.ts` | 単体 | 25 | PR attachmentのinteractive seed伝播 |
| `src/__tests__/git-format.test.ts` | 単体 | 19 | Markdown/HTML置換、重複番号 |
| `src/__tests__/github-pr.test.ts` | 単体 | 4 | 既存PR取得契約と画像取得opt-in保持 |
| `src/__tests__/imageAttachments.test.ts` | 統合 | 16 | 初期attachment後のユーザー画像採番 |
| `src/__tests__/pipeline-steps.test.ts` | 単体 | 2 | pipeline task contentへのattachment伝播 |
| `src/__tests__/pipelineExecution.test.ts` | 単体 | 51 | 既存pipeline PR経路の取得オプション保持 |

## 未カバー項目

| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|---|---|---|
| 実GitHub API、認証済み`gh`、private repository | テストでは外部境界をモックしているため | 実装後に認証済み`gh`で手動または限定統合確認 |
| PR画像取得失敗時の全cleanup経路 | 取得成功後cleanupの直接assertionを追加していない | 実装後に失敗・キャンセル・部分失敗のcleanupを確認 |
| 通常`--pr`の実interactive execute/save終端 | routeのseed伝播をモック境界で確認しているため | 実装後にinteractive保存・実行まで確認 |
| pipelineの実agent/run context消費 | `executeTask`受領時のtask specまでを確認しているため | 実装後にrun context内の画像をagentが参照できることを確認 |
| PR attachment固有のsymlink・collision拒否 | 既存共通attachmentテストを再利用する契約で、新規重複テストは追加していない | 実装後に既存保存テストと追加経路の組合せを確認 |
| 全体`npm test` | 実装前で、追加テストが未実装動作を検出するため | implement後に全体unit gateを実行 |

## 実行結果（参考）

対象9テストファイルのVitest実行結果です。

| 状態 | 件数 | 備考 |
|---|---:|---|
| Pass | 125 | 141テスト中。既存経路、除外条件、画像番号処理など |
| Fail / Import Error（想定内） | 16 | production未実装によるattachment空、raw URL残存、`includeAttachments`未配線、`taskSpec`未生成 |
| Error（要対応） | 0 | import error、分類漏れ、Lintエラーはなし |

追加確認：

- `npm run build`: 成功
- `npm run lint`: 成功
- `npm run test:type-contracts`: 成功
- `npm test -- src/__tests__/releaseVerificationWiring.test.ts`: 17テスト成功
- `git diff --check`: 成功
- productionファイル、`package-lock.json`の変更なし

## 備考

- 実ファイルを扱うPR画像取得・pipeline転送テストは、テスト分類契約に従い`.integration.test.ts`へ分離した。
- シナリオIDはテストコードへ記載せず、本レポートの契約対応表にのみ記載した。
- 追加テストの失敗は、現在のproductionコードが画像取得・置換・attachment配線・pipeline task specを未実装であることを直接示す期待失敗である。