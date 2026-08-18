# コーディングレビュー

## 結果: REJECT

## サマリー

PR本文・review・通常コメントを連結してから単一のMarkdownとして解析するため、先行する本文の未閉鎖コードフェンスが後続コメントの画像検出を阻害します。`add --pr`、対話CLI、pipelineの全入口に影響するため差し戻します。

## 契約入口チェック

| 入口・経路 | 元要件 | 実装根拠 | テスト根拠 | 判定 | 例外・未確認の根拠 |
|-----------|--------|----------|------------|------|-------------------|
| `takt add --pr` | PR本文・各コメントの画像を検出してtask attachmentへ保存 | `src/features/tasks/add/index.ts:205` | `src/__tests__/addTask.test.ts` | ❌ | 独立した本文間のMarkdown状態隔離がない |
| 対話CLI `--pr` | PR画像を対話seedとattachmentへ伝播 | `src/app/cli/routing-inputs.ts:73` | `src/__tests__/cli-routing-pr-resolve.test.ts` | ❌ | 同じ連結済みMarkdown解析を使用 |
| pipeline `--pr` | attachment付きtask specを実行 | `src/features/pipeline/steps.ts:234` | `src/__tests__/pipelineExecution.test.ts` | ❌ | 同じ連結済みMarkdown解析を使用 |
| 画像取得・検証 | GitHub URL、MIME、magic bytes、サイズを検証 | `src/infra/github/prImageDownload.ts:120` | `src/__tests__/github-pr-image-download.test.ts` | ✅ | なし |
| mock E2E再測定 | 限定的なbirpc noiseだけを最大1回再測定 | `scripts/run-e2e-mock-shards.mjs:177` | `src/__tests__/e2eMockRunner.test.ts:49` | ✅ | 正式E2E成功は修正履歴で確認 |

## 非finding化した懸念

| 項目 | 場所 | 分類 | finding化しない根拠 |
|------|------|------|---------------------|
| コードフェンス・inline code・HTMLコメント内の画像リテラル | `src/features/tasks/prReviewAttachments.ts:91` | no_issue_after_verification | 同一Markdown断片内ではASTが画像ノードだけを処理し、対象テストが成功 |
| 添付番号の誤予約・精度損失 | `src/shared/utils/imageAttachmentReferences.ts:21` | no_issue_after_verification | 外部URL・通常ファイル名を除外し、実attachmentパスとplaceholderを予約するテストが成功 |
| birpc timeoutによる実失敗の誤救済 | `scripts/run-e2e-mock-shards.mjs:177` | no_issue_after_verification | 通常失敗、別エラー、signal、CI、再測定再失敗を救済しないテストが成功 |

## 問題系列の完了走査

| family_tag / 変更契約 | 不変条件・根本原因 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|-------------------|------------------|----------------------|------------------------------------------|----------------------------|------------|------|
| `pr-review-markdown-fragment-isolation` | PR本文・review・通常コメントは独立したMarkdown入力であり、ある本文の構文状態が別本文の画像検出へ影響しない | `src/infra/git/format.ts:197`で連結後、`src/features/tasks/prReviewAttachments.ts:92`で全体を1回解析 | add、対話CLI、pipelineの全入口が同じ処理を使用 | PR本文の未閉鎖フェンス後に画像付き通常コメントを置くとattachment 0件を再現 | 現在のテストは単一連結本文内の構文境界のみ検証 | review summary・threadも同じ連結経路のため同一原因として確認済み | `CODE-NEW-pr-review-fragment-isolation-L92` |
| `image-attachment-index-allocation` | 実attachment参照だけを予約し、最小未使用番号を割り当てる | `src/shared/utils/imageAttachmentReferences.ts:21` | PR、retry、対話storeで共通allocatorを使用 | 任意長番号、疎な番号、既存fileNameを確認 | allocator・PR・retry・storeテスト成功 | なし | 問題なし |
| `mock-e2e-birpc-remeasurement` | 既知noiseだけを全初回完了後に最大1回再測定する | `scripts/run-e2e-mock-shards.mjs:177` | 正式`test:e2e:mock`入口で使用 | 通常失敗、CI、signal、起動失敗、再失敗を確認 | `src/__tests__/e2eMockRunner.test.ts` | なし | 問題なし |

## 今回の指摘（new）

| # | finding_id | family_tag | 重大度 | 場所 | 問題 | 影響 | 修正案 |
|---|------------|------------|--------|------|------|------|--------|
| 1 | `CODE-NEW-pr-review-fragment-isolation-L92` | `pr-review-markdown-fragment-isolation` | Medium | `src/features/tasks/prReviewAttachments.ts:92` | `formatPrReviewAsTask()`で独立したPR本文・review・コメントを連結した後、全体を単一の`fromMarkdown()`へ渡している。PR本文を未閉鎖コードフェンス、後続コメントを画像記法とした再現では`attachments: 0`となり、リモートURLが本文へ残った | 先行する本文・コメントの構文によって後続のreview threadや通常コメントの画像が保存されず、元要件の全コメント種別での画像検出を満たさない。全3入口に共通して発生する | `PrReviewData`の本文・各review・各コメントを独立したMarkdown断片として解析・置換し、URL重複排除とattachment番号割当だけを断片間で共有してから整形する。未閉鎖フェンスを含むPR本文の後に画像付きコメントがある回帰テストを追加する |

## 継続指摘（persists）

なし。

## 解消済み（resolved）

| finding_id | 元の期待結果 | 解消根拠 |
|------------|--------------|----------|
| `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | 最終作業ツリーで正式mock E2Eが終了コード0になる | 修正履歴で全4シャード成功と終了コード0を確認し、runner対象テストも成功 |
| `CODE-NEW-imageAttachmentIndex-L37` | 任意長番号と既存attachmentに衝突しない | `src/shared/utils/imageAttachmentReferences.ts:21`の共通allocatorと対象テストで確認 |
| `AI-NEW-MARKDOWN-LITERAL-SCAN-158` | Markdown literal走査を非線形にしない | `src/features/tasks/prReviewAttachments.ts:92`のAST解析と大規模本文テストで確認 |

## 再開指摘（reopened）

なし。

## 検証証跡

- 差分確認: 提示された変更対象40ファイルについて、直近修正箇所とPR画像の直接影響経路を回帰確認
- ビルド: 修正履歴で`npm run build`成功を確認。このレビューでは型契約検査が成功
- テスト: 対象12ファイル、計232件成功
- 動作再現: PR本文に未閉鎖コードフェンス、後続通常コメントにGitHub画像を指定し、`attachments: 0`かつリモート参照残存を確認
- 差分整合: `git diff --check`成功

## 再走査証跡（2回目以降のレビューで必須）

| 照合した Policy/Knowledge の章 | 差分側の根拠（`file:line` または「該当なし」） |
|-------------------------------|---------------------------------------------|
| 契約影響経路・呼び出しチェーン | `src/features/tasks/add/index.ts:205`、`src/app/cli/routing-inputs.ts:73`、`src/features/pipeline/steps.ts:234` |
| フェーズ分離・Raw入力の正規化 | `src/features/tasks/prReviewAttachments.ts:92`で入力断片の境界を失った後にMarkdown解析 |
| 元要件固定・仕様完全性 | PR本文・review thread・通常コメントすべての画像検出要件に対し、先行断片の構文状態で後続断片が欠落 |
| 振る舞い保証 | 未閉鎖フェンスを含む本文と後続画像コメントの実行でattachment 0件を再現 |
| 欠陥クラス再走査 | `formatPrReviewAsTask(prReview)`を直接`preparePrReviewAttachments()`へ渡す3入口を確認し、すべて同一原因に参加 |
| 共通helperの契約一貫性 | 画像番号allocatorのPR・retry・対話store利用側は対象テストで問題なし |
| 状態整合性・後片付け | download失敗、保存失敗、pipeline・対話終了時cleanupは対象テストで成功 |