# AI生成コードレビュー

## 結果: REJECT

## サマリー
PR画像の検出・保存と直前の修正2件は成立しているが、interactive `--pr` の異常終了時に一時画像が残る問題を1件確認した。

## 検証した項目
| 観点 | 結果 | 備考 |
|------|------|------|
| 仮定の妥当性 | ❌ | `process.exit()`でも外側の`finally`が実行される前提が誤っている |
| API/ライブラリの実在 | ✅ | `mdast-util-from-markdown`、`parse5`、child-process関連APIの実在と利用を確認 |
| コンテキスト適合 | ❌ | 既存の`exitOnFailure: false`契約を利用せず、attachment所有スコープ内からhard exitしている |
| スコープ | ✅ | open findings、その修正箇所、PR attachmentの3入口と直接影響するcleanup経路に限定して確認 |

## 非finding化した懸念
| 項目 | 場所 | 分類 | finding化しない根拠 |
|------|------|------|---------------------|
| `formatPrReviewAsTask()`の残存 | `src/infra/git/format.ts:325` | no_issue_after_verification | 置換対象の旧経路ではなく、既存の文字列整形契約として維持することが確定修正計画で明示され、attachment処理の3入口は`formatPrReviewTask()`へ移行済み |
| inline `<pre>`内画像の誤検出 | `src/features/tasks/prReviewAttachments.ts:74` | no_issue_after_verification | Markdown断片全体のHTML状態とsource offsetを解析し、`preRanges`内のHTML・Markdown画像を除外している。対象反例テストも成功 |
| E2E attemptの環境伝播・cleanup | `scripts/run-e2e-mock-shards.mjs:155` | no_issue_after_verification | 本番とheavy ITが共通attempt executorを使用し、実childへのcwd・env伝播と正常・spawn失敗時cleanupを確認 |

## 問題系列の完了走査
| family_tag / 変更契約 | 不変条件・根本原因 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|-------------------|------------------|----------------------|------------------------------------------|----------------------------|------------|------|
| `pr-review-markdown-fragment-isolation` | PR本文と各コメントを独立したMarkdownとして解析し、順序・重複排除・採番をtask全体で共有する | `src/infra/git/format.ts:199-326`、`src/features/tasks/prReviewAttachments.ts:74-184` | add、interactive、pipelineの3入口とtask/run-context保存を確認 | 未閉鎖fence、inline/nested `<pre>`、download失敗cleanupを確認 | `prReviewAttachments.test.ts`、`pr-image-dataflow.integration.test.ts` | なし | 問題なし |
| `e2e-runner-attempt-boundary` | 各attemptが独立環境を取得し、実childへ伝播して成功・起動失敗の双方で解放する | `scripts/run-e2e-mock-shards.mjs:155-250`、`scripts/teed-command.mjs:14-72` | 初回とbirpc再測定が同じexecutorを利用 | 正常終了、ENOENT、再測定、空shardを確認 | `it-e2e-mock-runner-attempt.test.ts`、`e2eMockRunner.test.ts` | なし | 問題なし |
| `pr-attachment-cleanup-hard-exit` | PR画像の一時store取得後は、全ての正常・失敗経路でcleanupしてからプロセスを終了する | cleanup ownerは`src/app/cli/routing.ts:117-129`で保持され、解放は同`:342-346`の`finally`のみ | interactive execute/save_taskへPR attachmentを伝播 | workflow失敗時の`selectAndExecuteTask()`、PR解決後エラー、head branch欠落が`process.exit()`し、外側の`finally`を迂回 | `cli-routing-pr-resolve.test.ts:420-440`は本番関数をrejectするmockへ置換し、同`:491-510`は`process.exit()`をthrowするmockへ置換している | なし | `AI-NEW-pr-attachment-cleanup-hard-exit-L307` |

## 今回の指摘（new）
| # | finding_id | family_tag | カテゴリ | 場所 | 問題 | 修正案 |
|---|------------|------------|---------|------|------|--------|
| 1 | AI-NEW-pr-attachment-cleanup-hard-exit-L307 | pr-attachment-cleanup-hard-exit | テストダブルによる見かけ上の保証／副作用cleanup漏れ | `src/app/cli/routing.ts:307` | PR画像の一時storeは外側の`finally`で削除されるが、実際の`selectAndExecuteTask()`はworkflow失敗時に`src/features/tasks/execute/selectAndExecute.ts:215`で`process.exit(1)`する。さらに`routing.ts:148`と`:321`にもstore取得後のhard exitがあり、いずれも`finally`を実行せず、private PR画像を一時ディレクトリに残す。実cleanup helperを使った子プロセス検証でも、終了コード7の後に`attachments/image-1.png`が残った。現在のテストは依存をrejectするmock、または`process.exit()`をthrowするmockへ置換するため、本番との差異を隠している | attachment所有スコープではhard exitせず、execute経路へ`exitOnFailure: false`を渡して例外で巻き戻す。`:148`と`:321`もcleanup後に最上位層で終了コードへ変換できるエラー／戻り値へ変更する。通常workflow失敗、PR解決後エラー、head branch欠落について、実プロセス終了後に一時画像が残らない回帰テストを追加する |

## 継続指摘（persists）
| # | finding_id | family_tag | 前回根拠 | 今回根拠 | 問題 | 修正案 |
|---|------------|------------|----------|----------|------|--------|
| なし | - | - | - | - | - | - |

## 解消済み（resolved）
| finding_id | 解消根拠 |
|------------|----------|
| CODE-NEW-pr-review-fragment-isolation-L92 | `formatPrReviewTask()`が本文単位の範囲を生成し、`preparePrReviewAttachments()`が断片ごとに解析する。対象unitとdataflow ITが成功 |
| TEST-NEW-e2e-runner-attempt-boundary-L31 | 実child processを使うheavy ITでcwd・隔離env・attempt分離・正常／spawn失敗cleanup・再測定を確認 |
| ai-antipattern-review-companion-2 | inlineおよびnested inline `<pre>`内画像を保持し、閉じタグ後の画像だけをattachment化する反例が成功 |

## 再開指摘（reopened）
| # | finding_id | family_tag | 解消根拠（前回） | 再発根拠 | 問題 | 修正案 |
|---|------------|------------|----------------|---------|------|--------|
| なし | - | - | - | - | - | - |

## 再走査証跡（2回目以降のレビューで必須）
| 照合した Policy/Knowledge の章 | 差分側の根拠（`file:line` または「該当なし」） |
|-------------------------------|---------------------------------------------|
| 状態整合性・副作用の解放 | `src/app/cli/routing.ts:117-148,299-346`、`src/features/tasks/execute/selectAndExecute.ts:211-215` |
| テストダブルによる見かけ上の修正検出 | `src/__tests__/cli-routing-pr-resolve.test.ts:420-440,491-510` |
| 呼び出しチェーン検証 | addは`src/features/tasks/add/index.ts:203-236`、interactiveは`src/app/cli/routing-inputs.ts:55-84`から`routing.ts`、pipelineは`src/features/pipeline/steps.ts:222-248`から`execute.ts:34-92`まで確認 |
| 契約置換・旧経路削除 | 本番3入口は`formatPrReviewTask()`へ移行済み。`formatPrReviewAsTask()`は既存公開文字列契約としてのみ残存 |
| フォールバック・デッドコード | 修正family内に未根拠のlegacy fallback、未使用の旧attachment解析経路、空catchなし |
| 振る舞い保証 | 対象unit 4 files・147件、E2E runner unit 7件、変更heavy IT 3件が成功。hard-exit再現では終了後も一時画像が残存 |