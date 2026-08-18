# 実装完了証跡

## 完了契約

| 契約ID | 由来 | 上流で確立した完了義務 | 実装結果 | 実装箇所 | 反例と観測結果 | 証拠 | 状態 |
|---|---|---|---|---|---|---|---|
| `PR-IMG-1` | 計画 | PR body、通常コメント、review summary、review threadから画像を抽出し、URL・Content-Type・magic bytes・サイズを検証する | 未実装 | 未実装 | attachment配列が`[]`。不正Content-Type・magic bytes・サイズ超過でも`toThrow()`に到達しなかった | 正常系: 4件抽出を期待したが0件; 失敗経路: 3種の不正応答が例外化されなかった; 境界状態: code fence・inline code・外部URL・未閉鎖構文の除外テストは成功; assertion: attachment配列と例外発生を観測; コマンド: `npm test -- src/__tests__/github-pr-attachments.integration.test.ts` | 未完了 |
| `PR-ATT-1` | 計画 | 検証済み画像を既存task attachment経路へ渡し、task directory、`attachments/`、`order.md`を生成する | 未実装 | 未実装 | `add --pr`のfetch呼び出しが`(456, cwd)`のままで、`{ includeAttachments: true }`が渡されなかった | 正常系: PR attachment保存テストが未実装配線で失敗; 失敗経路: fetch引数不足を検出; 境界状態: 既存の一般attachment保存テストは成功; assertion: fetch引数とtask保存結果を観測; コマンド: `npm test -- src/__tests__/addTask.test.ts` | 未完了 |
| `PR-REF-1` | 計画 | 元本文内のMarkdown・HTML画像参照を`[Image #N]`へ置換する | 未実装 | 未実装 | formatter出力に元URLが残り、`[Image #1]`・`[Image #2]`が生成されなかった | 正常系: Markdown/HTML置換テストが失敗; 失敗経路: raw URL残存とplaceholder欠落を観測; 境界状態: 重複URLの番号期待も失敗; assertion:出力本文のplaceholderとURLを直接観測; コマンド: `npm test -- src/__tests__/git-format.test.ts` | 未完了 |
| `PR-ROUTE-1` | 計画 | 通常の`--pr`でattachmentをinteractive seedからexecute/save_taskまで渡す | 未実装 | 未実装 | PR fetchが`(456, undefined)`のみで呼ばれ、`{ includeAttachments: true }`が渡されなかった | 正常系: interactive seedへのattachment伝播を期待したテストが失敗; 失敗経路: fetchオプション欠落を観測; 境界状態: 既存image storeの初期attachment後の`[Image #2]`採番は成功; assertion: fetch引数、seed、placeholderを観測; コマンド: `npm test -- src/__tests__/cli-routing-pr-resolve.test.ts`、`npm test -- src/__tests__/imageAttachments.test.ts` | 未完了 |
| `PR-PIPE-1` | 計画 | pipelineの`--pr`でattachment付きtask specを作成し、run contextへ渡す | 未実装 | 未実装 | pipeline fetchが`(456, cwd)`のみで呼ばれ、`executeTask`受領時の`taskSpec`が`undefined`だった | 正常系: task spec、manifest、画像配置を期待したテストが失敗; 失敗経路: taskSpec未生成を観測; 境界状態: task contentへのattachment伝播テストもfetchオプション不足で失敗; assertion: `taskSpec`、manifest、orderContentを観測; コマンド: `npm test -- src/__tests__/pipeline-steps.test.ts`、`npm test -- src/__tests__/pipeline-pr-attachments.integration.test.ts`、`npm test -- src/__tests__/pipelineExecution.test.ts` | 未完了 |
| `PR-KEEP-1` | 計画 | 既存のattachment保存、manifest、symlink検証、run-context stagingを維持する | 既存経路は未変更。ただしPR経路との統合は未実装 | `src/features/tasks/attachments.ts`は未変更 | 既存の一般attachmentテストは成功したが、PR attachmentを既存経路へ渡す追加テストは未実装配線で失敗 | 正常系: `imageAttachments.test.ts`の既存経路は成功; 失敗経路: `addTask`・pipelineのPR経路は未接続; 境界状態: 既存保存・manifest契約を確認; assertion: 既存attachment保存結果とPR経路の引数不足を観測; コマンド: `npm test -- src/__tests__/imageAttachments.test.ts`、`npm test -- src/__tests__/addTask.test.ts` | 未完了 |
| `PR-QUAL-1` | 計画 | 新規ロジックのテスト、build、lint、unit gateを成功させる | build・lint・型契約は成功したが、追加テストは未実装動作を検出して失敗 | 未実装 | 追加テスト16件が未実装箇所で失敗。import errorや分類漏れは発生していない | 正常系: build、lint、型契約、分類契約は成功; 失敗経路: 追加テスト16件が失敗; 境界状態: `releaseVerificationWiring.test.ts`は17件成功; assertion:各テストの不足引数、空attachment、raw URL、undefined taskSpecを観測; コマンド: `npm run build`、`npm run lint`、`npm run test:type-contracts`、`npm test -- src/__tests__/releaseVerificationWiring.test.ts` | 未完了 |

## 影響経路の確認

| 契約ID | 確認した生成元・同種分岐・補助入口・消費元 | 移行・保持・旧経路 | 該当する不変条件と連続シナリオ |
|---|---|---|---|
| `PR-IMG-1` | `src/infra/github/pr.ts`のPR body、comments、reviews、GraphQL review threads、formatter | 既存`fetchPrReviewComments(prNumber, cwd)`は保持。画像取得opt-inへの移行は未実装 | PR取得→画像抽出→検証→一時保存。除外・不正応答・重複の確認テストを実行: `npm test -- src/__tests__/github-pr-attachments.integration.test.ts` |
| `PR-ATT-1` | `addTask`→`formatPrReviewAsTask`→`saveTaskFile`→既存task attachment処理 | 既存保存経路は保持。`add --pr`からattachmentを渡す移行は未実装 | PR取得→task保存→`order.md`/画像配置。fetchオプション不足を確認: `npm test -- src/__tests__/addTask.test.ts` |
| `PR-REF-1` | `formatPrReviewAsTask`とPR body、comments、reviews | 既存formatter出力構造は保持。画像URL置換は未実装 | PR本文生成→placeholder置換→task consumer。raw URL残存を確認: `npm test -- src/__tests__/git-format.test.ts` |
| `PR-ROUTE-1` | `resolvePrInput`、通常CLI routing、interactive mode、保存・実行入口 | 既存routeは保持。attachment seed配線は未実装 | PR取得→interactive seed→execute/save。fetch引数不足を確認: `npm test -- src/__tests__/cli-routing-pr-resolve.test.ts` |
| `PR-PIPE-1` | `resolveTaskContent`、`runWorkflow`、`executeTask`、task spec/run context | 既存pipeline task text経路は保持。attachment付きtask specは未実装 | PR取得→task content→task spec→agent実行。`taskSpec === undefined`を確認: `npm test -- src/__tests__/pipeline-pr-attachments.integration.test.ts` |
| `PR-KEEP-1` | `src/features/tasks/attachments.ts`、既存保存・manifest・stagingテスト | 既存経路は変更なし。PR経路は未接続 | 既存attachmentの保存・採番・manifest契約を確認: `npm test -- src/__tests__/imageAttachments.test.ts` |
| `PR-QUAL-1` | build、lint、型契約、テスト分類契約、追加テスト | 品質ゲート自体は実行。追加テスト全成功には未到達 | build/lint/type/classificationは成功、実装契約テストは失敗: 上記各コマンド |

## 品質ゲート

| 種別 | 実行内容 | 結果 |
|---|---|---|
| ビルド | `npm run build` | 成功 |
| 静的検査 | `npm run lint` | 成功 |
| 型契約 | `npm run test:type-contracts` | 成功 |
| テスト分類 | `npm test -- src/__tests__/releaseVerificationWiring.test.ts` | 成功 |
| 実装契約テスト | PR画像・formatter・add・routing・pipelineの対象テスト | 失敗。production未実装による期待失敗 |

## 未確認範囲

| 項目 | 理由 | 決定的な代替検証 | 残るリスク |
|---|---|---|---|
| GitHub画像の実取得、認証済み`gh`、private repository | productionの画像取得処理が未実装 | `gh`応答とバイナリをmockした統合テストを作成済み | 認証・HTTPヘッダー解析・実URL形式の不整合 |
| `add --pr`での永続task保存 | attachment配線が未実装 | `addTask.test.ts`でfetch引数と保存結果を検証するテストを作成 | `attachments/`、`order.md`、cleanupの未達 |
| 通常`--pr`のinteractive execute/save_task終端 | route seed以降の実終端が未実装 | route seedとimage storeのテストを作成 | 実interactive保存・実行でattachmentが欠落するリスク |
| pipeline run contextでのagent消費 | task spec配線が未実装 | taskSpec、manifest、実ファイルを検証する統合テストを作成 | agent実行時に画像を参照できないリスク |
| 取得失敗・キャンセル・部分失敗時のcleanup | production cleanup処理が未実装 | cleanupを含むテスト構造のみ準備 | 一時ファイルやtask specの残留 |
| 全体unit gate | 追加テストが未実装動作を検出している | targeted testと型・Lint・buildを実行 | implement後に全テストを再実行する必要がある |