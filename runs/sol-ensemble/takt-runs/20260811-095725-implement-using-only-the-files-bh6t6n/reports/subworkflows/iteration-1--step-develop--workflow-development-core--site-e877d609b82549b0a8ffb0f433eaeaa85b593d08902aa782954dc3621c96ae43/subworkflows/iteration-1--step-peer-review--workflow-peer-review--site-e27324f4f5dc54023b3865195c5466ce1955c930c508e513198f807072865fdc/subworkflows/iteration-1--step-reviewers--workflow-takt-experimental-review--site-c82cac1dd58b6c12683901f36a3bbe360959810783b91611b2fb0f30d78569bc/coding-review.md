# コーディングレビュー

## 結果: APPROVE

## サマリー

前回の指摘3件を受入条件と現在の実装へ再照合し、すべて解消済みと確認した。PR画像の取得・検証・各CLI経路への伝播・保存・後片付けにも、blocking findingは確認されなかった。

## 契約入口チェック

| 入口・経路 | 元要件 | 実装根拠 | テスト根拠 | 判定 | 例外・未確認の根拠 |
|-----------|--------|----------|------------|------|-------------------|
| `takt add --pr` | PR本文・コメント画像をtask attachmentへ保存する | `src/features/tasks/add/index.ts:194`、`src/features/tasks/add/index.ts:203`、`src/features/tasks/add/index.ts:225` | `src/__tests__/addTask.test.ts:301`、`src/__tests__/addTask.test.ts:332`、`src/__tests__/addTask.test.ts:410` | ✅ | なし |
| 対話CLI `takt --pr` | 初期入力から実行・保存まで画像を維持する | `src/app/cli/routing-inputs.ts:52`、`src/app/cli/routing.ts:117`、`src/app/cli/routing.ts:209`、`src/app/cli/routing.ts:304` | `src/__tests__/cli-routing-pr-resolve.test.ts:370`、`src/__tests__/cli-routing-pr-resolve.test.ts:408`、`src/__tests__/cli-routing-pr-resolve.test.ts:431` | ✅ | なし |
| pipeline `--pr` | attachment付きtask specをworkflowへ渡す | `src/features/pipeline/steps.ts:222`、`src/features/pipeline/steps.ts:353` | `src/__tests__/pipelineExecution.test.ts:1433`、`src/__tests__/pr-image-dataflow.integration.test.ts:45` | ✅ | なし |
| GitHub認証境界 | private repository画像用の認証情報を取得先ホストへ結合する | `src/infra/github/attachmentUrl.ts:1`、`src/infra/github/prImageDownload.ts:41` | `src/__tests__/github-pr-image-download.test.ts:67` | ✅ | 実private repository通信は未実施。ホスト選択とAuthorization伝播は決定的テストで確認 |
| Content-Type・magic bytes・サイズ | PNG/JPEG/GIF/WebPだけを上限内で受理する | `src/shared/utils/imageMimeType.ts:8`、`src/shared/utils/imageMimeType.ts:16`、`src/infra/github/prImageDownload.ts:53`、`src/infra/github/prImageDownload.ts:103` | `src/__tests__/github-pr-image-download.test.ts:44`、`src/__tests__/github-pr-image-download.test.ts:98`、`src/__tests__/github-pr-image-download.test.ts:109`、`src/__tests__/github-pr-image-download.test.ts:132` | ✅ | なし |
| Markdown本文変換 | 実画像だけをplaceholderへ置換し、literal文脈を保持する | `src/features/tasks/prReviewAttachments.ts:435`、`src/features/tasks/prReviewAttachments.ts:481` | `src/__tests__/prReviewAttachments.test.ts:112`、`src/__tests__/prReviewAttachments.test.ts:142`、`src/__tests__/prReviewAttachments.test.ts:185`、`src/__tests__/prReviewAttachments.test.ts:328` | ✅ | なし |

## 非finding化した懸念

| 項目 | 場所 | 分類 | finding化しない根拠 |
|------|------|------|---------------------|
| PR全体の画像件数・累積容量制限 | `src/infra/github/prImageDownload.ts:67` | overreach | 元要件は画像単位のサイズ上限とGitHub attachment URL制限を要求しており、追加の総量制限は要求範囲外 |
| Full mock E2Eのworker通知タイムアウト | 実行履歴の`fix-verification.md` | no_issue_after_verification | 対象spec単独、unit、light IT、変更heavy IT、build、lintは成功しており、現在のコードから実装欠陥を確認できない |

## 解消済み（resolved）

| finding_id | 元の期待結果 | 解消根拠 |
|------------|--------------|----------|
| `CODE-NEW-prImageDownload-L39` | `github.com`向けトークンを明示的に選択する | `src/infra/github/prImageDownload.ts:42`で`gh auth token --hostname github.com`を使用し、Enterpriseホスト環境の回帰テストが成功 |
| `CODE-NEW-imageMimeType-L17` | PNGの正式な8バイト署名を検証し、両consumerで共有する | `src/shared/utils/imageMimeType.ts:17`で8バイトを比較し、PR取得・inline paste双方の不完全署名テストが成功 |
| `CODE-NEW-prReviewAttachments-L22` | コードフェンス、inline code、HTMLコメント内の画像風記法を取得・置換しない | `src/features/tasks/prReviewAttachments.ts:435`以降でliteral範囲を除外し、引用・リスト・インデントを含む対象28件が成功 |

## 検証証跡

- 差分確認: 指定された26ファイルの累積変更、定義・生成・伝播・保存・cleanup経路を確認
- ビルド: 実行履歴で`npm run build`成功。今回の対象実行でもTypeScript型契約検査が成功
- Lint: 実行履歴で`npm run lint`成功
- テスト: 関連9ファイルを対象指定して再実行し、unit 139件、light IT 1件、heavy IT 59件の合計199件が成功
- 分類: `pr-image-dataflow.integration.test.ts`のlight IT登録と分類契約を確認
- 差分整合: `git diff --check`成功。対象26ファイルに末尾空白、skip、未解決TODO、旧GitHub URL helper参照なし

## 再走査証跡（2回目以降のレビューで必須）

| 照合した Policy/Knowledge の章 | 差分側の根拠（`file:line` または「該当なし」） |
|-------------------------------|---------------------------------------------|
| 契約影響経路・呼び出しチェーン | `src/features/tasks/add/index.ts:203`、`src/app/cli/routing-inputs.ts:73`、`src/features/pipeline/steps.ts:232` |
| 外部契約・機密情報の扱い | `src/infra/github/attachmentUrl.ts:3`、`src/infra/github/prImageDownload.ts:41`、`src/infra/github/prImageDownload.ts:120` |
| 共通helperの契約一貫性 | `src/shared/utils/imageMimeType.ts:16`、`src/features/interactive/inlineImagePaste.ts:88`、`src/infra/github/prImageDownload.ts:103` |
| 副作用・状態変更の正常・失敗・後片付け | `src/features/tasks/prReviewAttachments.ts:519`、`src/features/tasks/add/index.ts:211`、`src/features/pipeline/steps.ts:371`、`src/app/cli/routing.ts:281` |
| 契約置換・旧経路削除 | `src/infra/github/attachmentUrl.ts:1`。旧shared URL moduleおよび旧参照は不存在 |
| パーサー・本文変換境界 | `src/features/tasks/prReviewAttachments.ts:296`、`src/features/tasks/prReviewAttachments.ts:354`、`src/features/tasks/prReviewAttachments.ts:405`、`src/features/tasks/prReviewAttachments.ts:435` |
| テストレイヤー・production dataflow | `scripts/test-classification.mjs:363`、`src/__tests__/pr-image-dataflow.integration.test.ts:45` |