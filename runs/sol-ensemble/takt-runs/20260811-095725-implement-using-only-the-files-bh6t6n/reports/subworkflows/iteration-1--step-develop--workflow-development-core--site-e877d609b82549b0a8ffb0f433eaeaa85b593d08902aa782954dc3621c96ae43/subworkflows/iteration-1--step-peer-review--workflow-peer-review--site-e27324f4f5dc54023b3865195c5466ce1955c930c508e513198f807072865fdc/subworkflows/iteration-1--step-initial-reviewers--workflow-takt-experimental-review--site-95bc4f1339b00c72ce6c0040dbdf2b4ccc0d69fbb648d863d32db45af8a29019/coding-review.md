# コーディングレビュー

## 結果: REJECT

## サマリー

PR画像の抽出・保存・各CLI経路への伝播は実装されていますが、認証トークンのホスト混線、PNG署名の不完全な検証、Markdownコード例の誤取得を確認しました。いずれも今回追加された信頼境界または観測可能な本文変換に直接影響するため差し戻します。

## 契約入口チェック

| 入口・経路 | 元要件 | 実装根拠 | テスト根拠 | 判定 | 例外・未確認の根拠 |
|-----------|--------|----------|------------|------|-------------------|
| `takt add --pr` | PR画像をtask attachmentsへ保存する | `src/features/tasks/add/index.ts:196` | `src/__tests__/addTask.test.ts:298` | ⚠️ | 保存・cleanupは確認済みだが、共通取得・抽出処理にfinding 1〜3あり |
| 対話CLI `takt --pr` | 初期入力、実行、保存へ画像を伝播する | `src/app/cli/routing-inputs.ts:52`, `src/app/cli/routing.ts:123` | `src/__tests__/cli-routing-pr-resolve.test.ts:367` | ⚠️ | 伝播は確認済みだが、共通取得・抽出処理にfinding 1〜3あり |
| pipeline `--pr` | attachment付きtask specを実行する | `src/features/pipeline/steps.ts:219`, `src/features/pipeline/steps.ts:353` | `src/__tests__/pipelineExecution.test.ts:1429` | ⚠️ | task spec配線は確認済みだが、共通取得・抽出処理にfinding 1〜3あり |
| GitHub認証境界 | private repository画像を認証付きで取得する | `src/infra/github/prImageDownload.ts:38` | `src/__tests__/github-pr-image-download.test.ts:43` | ❌ | URL送信先とトークン取得ホストが一致しない |
| MIME・magic bytes検証 | PNG/JPEG/GIF/WebPをContent-Typeとmagic bytesで検証する | `src/shared/utils/imageMimeType.ts:16`, `src/infra/github/prImageDownload.ts:100` | `src/__tests__/github-pr-image-download.test.ts:14` | ❌ | PNGの8バイト署名を検証していない |
| PR本文変換 | 実際の画像参照を`[Image #N]`へ置換する | `src/features/tasks/prReviewAttachments.ts:21` | `src/__tests__/prReviewAttachments.test.ts:59` | ❌ | コードフェンス内の非画像記法も取得・置換する |
| attachment出力 | `order.md`と`attachments/image-N.ext`を生成する | `src/features/tasks/attachments.ts:35`, `src/features/tasks/attachments.ts:88` | `src/__tests__/addTask.test.ts:298` | ✅ | なし |

## 非finding化した懸念

| 項目 | 場所 | 分類 | finding化しない根拠 |
|------|------|------|---------------------|
| 部分ダウンロード後の一時画像cleanup | `src/features/tasks/prReviewAttachments.ts:56` | no_issue_after_verification | 後続取得失敗時に共通cleanupを通し、元の取得例外を維持するテストがある |
| add・pipeline・対話CLIの正常終了／取消時cleanup | `src/features/tasks/add/index.ts:205`, `src/features/pipeline/execute.ts:42`, `src/app/cli/routing.ts:120` | no_issue_after_verification | 各所有期間を`finally`が覆い、対象テストでcleanup 1回を確認している |
| 任意外部ホストの取得 | `src/shared/utils/githubAttachmentUrl.ts:1` | no_issue_after_verification | HTTPSの`github.com` attachmentパスへ開始URLを限定し、認証・fetch前の拒否テストがある |
| pipelineの一時task spec削除 | `src/features/pipeline/steps.ts:371` | no_issue_after_verification | `executeTask`完了・失敗後に`cleanupPreparedTaskSpec`を実行する経路とテストを確認した |

## 問題系列の完了走査

| family_tag / 変更契約 | 不変条件・根本原因 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|-------------------|------------------|----------------------|------------------------------------------|----------------------------|------------|------|
| `github-auth-host-binding` | 認証トークンの対象ホストとHTTP送信先を一致させる | `githubAttachmentUrl.ts:9`, `prImageDownload.ts:38` | add、routing、pipelineの全PR画像取得 | `gh auth token`失敗は各入口へ伝播 | downloaderテストはホスト未指定の引数を期待 | 実GitHub通信は未実施。ただし合成Enterpriseトークンで混線を決定的に再現 | CODE-NEW-prImageDownload-L39 |
| `image-magic-validation` | 対応形式の正式なmagic bytesを満たすデータだけを保存する | `imageMimeType.ts:16`, `prImageDownload.ts:100` | PRダウンロードと既存inline pasteが同じhelperを利用 | 不一致時は保存前に例外 | PNG fixture自体が4バイトのみ | 実デコーダによる完全画像検証は元要件外 | CODE-NEW-imageMimeType-L17 |
| `markdown-image-semantics` | Markdown上で画像として解釈される参照だけを取得・置換する | `prReviewAttachments.ts:21` | 整形後のPR本文、review summary、thread、通常コメントから全3入口へ再注入 | 後続取得失敗時cleanupは確認済み | 通常のMarkdown／HTML画像、重複URL、外部URLのみテスト | コードフェンス、inline code、HTMLコメントのテストなし | CODE-NEW-prReviewAttachments-L22 |
| `pr-attachment-propagation` | 同じattachmentを保存・interactive・pipeline末端まで維持する | `add/index.ts:196`, `routing-inputs.ts:52`, `pipeline/steps.ts:219` | task保存、interactive result、task spec、run context | 成功・取消・workflow失敗時cleanupを確認 | add、routing、pipelineテスト | 実private GitHubとのE2Eは未確認 | 問題なし |
| `download-resource-lifecycle` | HTTP拒否、サイズ超過、部分取得後に通信・一時資源を解放する | `prImageDownload.ts:19`, `prReviewAttachments.ts:68` | 保存前のresponseと保存後のtemp store | HTTP失敗、Content-Length不正、stream超過、cleanup失敗を確認 | `ReadableStream`とcancel失敗test double | reader自体の実ネットワーク障害は未確認 | 問題なし |

## 今回の指摘（new）

| # | finding_id | family_tag | 重大度 | 場所 | 問題 | 影響 | 修正案 |
|---|------------|------------|--------|------|------|------|--------|
| 1 | CODE-NEW-prImageDownload-L39 | github-auth-host-binding | High | `src/infra/github/prImageDownload.ts:39` | URLは`github.com`に固定されている一方、`gh auth token`へ`--hostname`を渡していない。GitHub CLIは未指定時にデフォルトホストを選択する。[GitHub CLI公式仕様](https://cli.github.com/manual/gh_auth_token) | `GH_HOST`がEnterpriseを指す環境で、Enterprise用トークンが`github.com`宛てのAuthorizationヘッダーへ送信される。合成トークンによる外部通信なしの実行で再現済み | `gh auth token --hostname github.com`を使用する。`GH_HOST`がEnterpriseでもgithub.com用資格情報だけが使われるテストを追加する |
| 2 | CODE-NEW-imageMimeType-L17 | image-magic-validation | High | `src/shared/utils/imageMimeType.ts:17` | PNGを先頭4バイトだけで判定している。PNG署名は`89 50 4E 47 0D 0A 1A 0A`の8バイトである。[W3C PNG仕様](https://www.w3.org/TR/png-3/#5PNG-file-signature) | `89 50 4E 47 00 00 00 00`を`image/png`として受理することを再現した。明示されたmagic bytes検証を迂回し、非PNGデータを`.png`として保存できる | 8バイトすべてを比較する。4バイトだけの既存fixtureを完全な署名へ直し、不完全な署名を拒否する回帰テストを追加する |
| 3 | CODE-NEW-prReviewAttachments-L22 | markdown-image-semantics | Medium | `src/features/tasks/prReviewAttachments.ts:22` | Markdown構造を考慮せず全文へ正規表現を適用するため、コードフェンス内の画像記法も実画像として扱う | コード例を含むPRコメントで不要な認証付きダウンロードが発生し、原文が`[Image #N]`へ破壊的に変更される。コードフェンス入力が1 attachmentへ変換されることを再現済み | Markdown parserを利用するか、少なくともコードフェンス、inline code、HTMLコメントを走査対象から除外する。各非画像コンテキストの回帰テストを追加する |

## 継続指摘（persists）

なし。

## 解消済み（resolved）

なし。

## 再開指摘（reopened）

なし。

## 検証証跡

- 差分確認: 指定された変更対象17ファイルについて、変更差分、新規ファイル、呼び出し元、保存先、cleanup経路を確認
- ビルド: レビューではフルビルド未実行。対象テスト実行時のTypeScript type-contract検査は成功
- テスト:
  - `npm test -- src/__tests__/github-pr-image-download.test.ts src/__tests__/prReviewAttachments.test.ts` — 22件成功
  - `npm test -- src/__tests__/addTask.test.ts src/__tests__/cli-routing-pr-resolve.test.ts src/__tests__/pipelineExecution.test.ts` — 99件成功
- 決定的再現:
  - Enterprise合成トークンが`github.com`向けAuthorizationへ入ることを確認
  - 不完全なPNG署名が`image/png`として受理されることを確認
  - コードフェンス内の画像例が取得され、`[Image #1]`へ置換されることを確認

## 再走査証跡（2回目以降のレビューで必須）

初回レビューのため継続finding照合は非該当。ただし、確認済み各familyについて同じ定義・利用経路を完了走査した。

| 照合した Policy/Knowledge の章 | 差分側の根拠（`file:line` または「該当なし」） |
|-------------------------------|---------------------------------------------|
| 機密情報の扱い・変更した信頼境界 | `src/infra/github/prImageDownload.ts:38`, `src/shared/utils/githubAttachmentUrl.ts:9` |
| 契約影響経路・呼び出しチェーン | `src/features/tasks/add/index.ts:196`, `src/app/cli/routing-inputs.ts:52`, `src/features/pipeline/steps.ts:219` |
| 外部契約検証 | `src/infra/github/prImageDownload.ts:117`, `src/__tests__/github-pr-image-download.test.ts:43` |
| 共通helperの契約一貫性 | `src/shared/utils/imageMimeType.ts:16`, `src/features/interactive/inlineImagePaste.ts:89`, `src/infra/github/prImageDownload.ts:107` |
| 副作用・状態変更の正常／失敗／後片付け | `src/features/tasks/prReviewAttachments.ts:56`, `src/features/pipeline/steps.ts:371`, `src/features/pipeline/execute.ts:42` |
| パーサー・本文変換境界 | `src/features/tasks/prReviewAttachments.ts:21`, `src/__tests__/prReviewAttachments.test.ts:59` |