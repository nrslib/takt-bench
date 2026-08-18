# 修正計画

## 結果: 修正計画確定

## 指摘カバレッジ

| finding ID / 出典 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 分類 | 受入条件 |
|-------------------|------|----------------------|-----------------------------|------|----------|
| `AI-NEW-TASKS-PR-BODY-194` / `ai-antipattern-review.md` | `src/features/tasks/add/index.ts:194-201`、`src/infra/git/format.ts:197-205` | `pr-body-image-routing` | PR本文画像を保存できない → review/commentが空なら画像準備前に終了する → `add --pr`の入力契約がPR本文を考慮していない | 構造 | review/commentが空でも本文画像を保存し、`order.md`へplaceholderとattachment参照を出力する |
| `ARCH-NEW-src-features-tasks-add-index-L194` / `architecture-review.md` | `src/features/tasks/add/index.ts:194-201`、`src/__tests__/addTask.test.ts:345-357` | `pr-body-image-routing` | 上記と同一の入口・早期終了・受入条件 | 構造 | 上記と同じ。本文も実質的に空のPRは従来どおり拒否する |
| `ARCH-NEW-src-shared-utils-imageMimeType-L17` / `architecture-review.md` | `src/shared/utils/imageMimeType.ts:16-27` | `image-signature-validation` | 非PNGデータをPNGとして受理する → 先頭4バイトだけを比較する → Content-Type照合の正本となる署名検証が不完全 | 局所 | 正式な8バイトPNG署名だけを受理し、4バイトprefixと途中不一致を拒否する |
| `AI-NEW-IMAGE-MAGIC-16` / `ai-antipattern-review.md` | `src/shared/utils/imageMimeType.ts:16-27`、`src/__tests__/github-pr-image-download.test.ts:14-21` | `image-signature-validation` | 不完全な署名と疑似fixtureを正常扱いする → helperとfixtureが同じ4バイト前提 → 共有検証契約が誤って固定されている | 局所 | PR取得とinline pasteの正常fixtureを正式署名へ更新する |
| `CODE-NEW-imageMimeType-L17` / `coding-review.md` | `src/shared/utils/imageMimeType.ts:17`、`src/infra/github/prImageDownload.ts:100-114` | `image-signature-validation` | 上記と同一の共有helper・MIME照合経路 | 局所 | 上記と同じ。WebP強化や画像全体のデコード検証は追加しない |
| `ARCH-NEW-src-features-pipeline-steps-L411` / `architecture-review.md` | `src/features/pipeline/steps.ts:371-415`、`src/infra/task/enqueueService.ts:160-169` | `pipeline-cleanup-result-preservation` | workflow結果・例外がcleanup例外で上書きされる → `finally`からthrow可能な削除を直接実行する → 一時task spec所有者がcleanupをbest-effortとして隔離していない | 局所 | workflowの`false`と実行例外をcleanup失敗後も維持する |
| `ARCH-NEW-src-shared-utils-githubAttachmentUrl-L1` / `architecture-review.md` | `src/shared/utils/githubAttachmentUrl.ts:1-18`、`src/shared/utils/imageAttachmentStore.ts:23-35,54-59` | `shared-image-boundary-ownership` | shared層にGitHub・interactive固有概念が残る → URL規則とstore観測名を共有化時に分離していない → provider境界と汎用storeの所有責務が混在している | 構造 | GitHub URL規則をGitHub infra内部へ移し、shared storeのエラー・ログを画像attachment一般の意味にする |
| `CODE-NEW-prImageDownload-L39` / `coding-review.md` | `src/infra/github/prImageDownload.ts:38-47,117-130`、`src/shared/utils/githubAttachmentUrl.ts:6-18` | `github-auth-host-binding` | Enterprise用トークンをgithub.comへ送れる → `gh auth token`のhostnameが未指定 → 許可URLホストと資格情報選択ホストが同じ正本に結合されていない | 構造 | `github.com`用トークンを明示選択し、`GH_HOST`がEnterpriseでも別ホストの資格情報を送らない |
| `CODE-NEW-prReviewAttachments-L22` / `coding-review.md` | `src/features/tasks/prReviewAttachments.ts:21-35`、`src/__tests__/prReviewAttachments.test.ts:59-125` | `markdown-image-semantics` | コード例などを取得・置換する → 本文全体へ画像正規表現を適用する → Markdown上の画像コンテキストとliteralコンテキストを区別していない | 構造 | 通常のMarkdown画像とHTML画像だけを処理し、コードフェンス、inline code、HTMLコメントは原文保持・取得なしとする |
| `TEST-NEW-pr-image-dataflow-L29` / `testing-review.md` | `src/__tests__/addTask.test.ts:301-329`、`src/__tests__/pipelineExecution.test.ts:1345-1478` | `pr-image-production-dataflow-test` | production配線の欠落を検出できない → store、保存、task spec、resolverを同時にモックしている → 複数本番コンポーネントを横断する契約の観測点がない | 構造 | 実store・保存・stagingを通る軽量ITで画像、保存済み`order.md`、run context参照を観測する |
| `TEST-NEW-pr-image-cleanup-L301` / `testing-review.md` | `src/features/tasks/add/index.ts:199-233`、`src/app/cli/routing.ts:120-147,281-347` | `pr-image-owner-failure-tests` | 保存・実行例外時の所有権契約を検出できない → 正常・取消経路だけをテストしている → 一時PR画像の所有者ごとの代表的失敗経路が未検証 | 構造 | add保存失敗とPR routing実行失敗でcleanupを1回呼び、元例外と永続状態を保持する |

## 欠陥 family の最終状態

| 修正単位 | 契約の正本 | 完了対象の全不変条件 | 変更後の責務・正本 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|----------|------------|----------------------|--------------------|--------------------|--------------------------|----------------|
| `pr-body-image-routing` | `context/task/order.md`のPR本文画像対応、裁定の受入条件 | PR本文・通常コメント・review summary・threadが画像準備へ到達する。addで本文、review、commentがすべて空なら従来の早期終了を維持する | `addTask`がPR本文を含む入力有無を判定し、整形後は既存の共通準備処理へ委譲する | `addTask → formatPrReviewAsTask → preparePrReviewAttachments → saveTaskFile` | 本文画像のみは成立。本文が空白かつreview/commentなしは拒否。本文の通常テキストはtask入力として成立 | コメント件数だけの旧早期終了条件を置換。互換経路は追加しない |
| `image-signature-validation` | 対応形式とmagic bytes検証要求、共有MIME helper | PNGは8バイト完全一致。4バイトのみ、5〜8バイト目不一致、短い入力はPNGにしない。JPEG/GIF/WebPの既存契約は維持 | `inferSupportedImageMimeType`をPR downloaderとinline paste双方の署名正本として維持 | PR fetch、inline paste、MIME一致検査、store保存 | 正式8バイトは成立。4バイトprefixと末尾1バイト不一致は失敗。Content-Type不一致も従来どおり失敗 | 誤った4バイト正常fixtureを正式署名へ移行。WebPの14バイト化は不採用 |
| `pipeline-cleanup-result-preservation` | pipelineのworkflow結果・例外契約、裁定のbest-effort境界 | cleanupを試行するが、workflowのtrue/falseまたは実行例外を変更しない。cleanup失敗は診断可能にする | pipelineの一時task spec所有者が削除失敗を隔離する | `runWorkflow → prepareTaskSpecDirectory → executeTask → cleanupPreparedTaskSpec` | workflow false＋cleanup失敗はfalse。実行例外＋cleanup失敗は元例外。成功＋cleanup失敗も成功結果を維持 | pipelineの`finally`だけを変更。他の既存cleanup利用側、transaction、再試行は対象外 |
| `shared-image-boundary-ownership` | レイヤー依存規則、裁定の責務境界 | GitHub URL規則はGitHub infraが所有する。shared storeはprovider・feature非依存のエラー・ログ名を使う | `src/infra/github/attachmentUrl.ts`がURLと許可ホストを所有し、shared storeは画像attachment保存だけを所有 | GitHub downloader、PR attachment準備、tasks/pipeline/interactiveのstore利用 | GitHub URLはinfra判定へ到達。storeの未対応MIME・cleanup失敗は画像attachment一般として観測 | sharedの旧URL moduleを削除し、2利用側を移行。alias/re-export、他provider対応は追加しない |
| `github-auth-host-binding` | 許可URLホストとGitHub CLI資格情報選択契約 | Authorizationの送信先とtoken選択ホストがともに`github.com`。環境のdefault hostへ依存しない | GitHub attachment境界のホスト定数をURL検証とtoken取得で共有 | URL許可判定 → `gh auth token` → authenticated fetch | `GH_HOST=enterprise.example`でも`--hostname github.com`を使用。非許可URLは認証前に拒否 | hostname未指定のtoken取得を置換。Enterprise URL対応は追加しない |
| `markdown-image-semantics` | 対象画像記法と、画像として解釈される参照だけを置換する契約 | 通常Markdown画像とHTML `<img>`をappearance orderで処理する。コードフェンス、inline code、HTMLコメント内は取得・置換しない。重複URLは1回取得 | `prReviewAttachments`内の構文範囲判定が画像抽出の正本となる | 整形済みPR本文・review summary・thread・通常コメント → 抽出 → download → placeholder | 通常画像は成立。3種のliteralコンテキストは失敗例ではなく原文保持。重複通常画像はplaceholder再利用 | 全文正規表現をliteral範囲除外付き走査へ置換。Markdown parser依存やrendererは追加しない |
| `pr-image-production-dataflow-test` | 3モジュール以上のdataflowに軽量ITを要求するテストポリシー | 外部取得とagent境界以外のstore、永続化、task spec生成、resolver、stagingを本番実装で通す | 新規軽量ITがproduction内部配線の観測所有者となる | `formatPrReviewAsTask → preparePrReviewAttachments → store → saveTaskFile / runWorkflow task spec → run context staging` | 画像bytes、task側参照、run context側参照が一致。内部モジュールの配線欠落時に失敗 | 新規ITをlight分類へ登録。既存unit mockは各局所契約用として維持 |
| `pr-image-owner-failure-tests` | 一時画像所有者のcleanup・元例外・永続状態契約 | add保存所有者とPR routing所有者が後続例外時もcleanupを1回だけ実行する。保存途中の永続状態を増減させず、元例外を維持 | 実装の所有者は現行`finally`のまま。テストが失敗側契約を直接観測 | PR準備 → add保存失敗、PR準備 → interactive execute失敗 | 存在しないattachment sourceによる保存失敗、`selectAndExecuteTask`例外。cleanup自体のOS障害は対象外 | production経路の追加変更なし。代表的失敗テストだけを追加 |
| `pr-image-dataflow-test` | 上記production dataflow契約 | task保存とpipeline stagingの両側で同一placeholder・画像を参照できる | 軽量IT内で一時filesystemを所有し、必ず後片付けする | PR入力から`.takt/tasks`および`.takt/runs/.../context/task`まで | 保存済み`order.md`とstaged `order.md`、双方の画像ファイルを確認 | 重いWorkflowEngine、実GitHub資格情報、Git、child processは使用しない |

## 実施順序

| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|------|----------|------|--------|----------|----------------|
| 1 | `shared-image-boundary-ownership` | 境界変更・利用側移行・旧経路削除 | なし | `src/shared/utils/githubAttachmentUrl.ts`、新規`src/infra/github/attachmentUrl.ts`、`src/infra/github/prImageDownload.ts`、`src/features/tasks/prReviewAttachments.ts`、`src/shared/utils/imageAttachmentStore.ts` | URL判定の全参照がGitHub infraへ移り、旧shared module参照が0件。storeの固有命名が残らない |
| 2 | `github-auth-host-binding` | 境界修正 | 1 | `src/infra/github/attachmentUrl.ts`、`src/infra/github/prImageDownload.ts`、`src/__tests__/github-pr-image-download.test.ts` | `gh auth token --hostname github.com`を確認し、Enterprise default hostのtokenがfetchへ渡らない |
| 3 | `image-signature-validation` | 局所修正・fixture移行 | なし | `src/shared/utils/imageMimeType.ts`、`src/__tests__/github-pr-image-download.test.ts`、`src/__tests__/inlineImagePaste.test.ts`、関連inline paste正常fixture | 正式PNG署名が両入口で成功し、4バイトprefixと途中不一致が失敗する |
| 4 | `markdown-image-semantics` | 構文境界修正 | 1 | `src/features/tasks/prReviewAttachments.ts`、`src/__tests__/prReviewAttachments.test.ts` | 通常画像だけを取得し、コードフェンス、inline code、HTMLコメントがbyte-for-byteで保持される |
| 5 | `pr-body-image-routing` | 入口条件修正 | 4 | `src/features/tasks/add/index.ts`、`src/__tests__/addTask.test.ts` | 本文画像のみのPRが保存され、本文も空のPRは保存されない |
| 6 | `pipeline-cleanup-result-preservation` | 失敗境界修正 | なし | `src/features/pipeline/steps.ts`、`src/__tests__/pipelineExecution.test.ts` | cleanup失敗とworkflow false／実行例外を連続発生させ、元結果・例外を観測する |
| 7 | `pr-image-owner-failure-tests` | 代表的失敗経路テスト追加 | 5 | `src/__tests__/addTask.test.ts`、`src/__tests__/cli-routing-pr-resolve.test.ts` | add保存失敗とPR execute失敗でcleanup 1回、元例外、永続状態不変を確認する |
| 8 | `pr-image-production-dataflow-test` | 軽量IT追加・分類配線 | 1〜5 | 新規`src/__tests__/pr-image-dataflow.integration.test.ts`、`scripts/test-classification.mjs` | 実store・保存・task spec・stagingを通し、画像と2種類の`order.md`参照を確認。light ITへ排他的に分類される |

## 制約適合性

| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 | 品質ゲート |
|----------|--------------|--------------------------|-----------------------------|----------|--------------|
| `pr-body-image-routing` | 元要求のPR本文対応、裁定の修正境界 | 本文のtrim後内容を早期終了条件へ加える。早期終了の無条件削除は不採用 | addの実保存結果、attachment、`order.md`、空本文拒否 | 本文画像を到達可能にしつつ、実質的入力なしの既存契約を保持 | 対象`addTask.test.ts`、`npm test`、`npm run test:it` |
| `image-signature-validation` | magic bytes要求、裁定のPNG限定境界 | PNGの8バイト完全比較を採用。WebP強化とデコーダ追加は裁定外のため不採用 | downloaderとinline pasteで正常、短縮、途中不一致を決定的検証 | 共有helperの全実在consumerへ同一契約が適用される | 対象unit、変更した分類済みfixtureテスト、build、lint |
| `pipeline-cleanup-result-preservation` | cleanup結果保持の受入条件、best-effort許可 | pipeline所有期間の`finally`だけで削除例外を隔離する。共通cleanup API全体の意味変更は不採用 | false戻り値とthrowされたErrorの同一性、cleanup呼出回数 | 元結果を正本とし、cleanupの副作用だけを隔離する | `pipelineExecution.test.ts`、`npm test` |
| `shared-image-boundary-ownership` | レイヤー依存、契約置換ポリシー | GitHub固有moduleをinfraへ移動し現行利用側を一括移行。互換aliasは不採用 | import参照検索、URL許可・拒否テスト、store未対応MIMEテスト | 旧経路を残さず、sharedの汎用責務とGitHub規則を分離 | build、lint、対象unit/IT |
| `github-auth-host-binding` | 認証ホスト一致、機密情報非露出 | URL許可ホストをtoken選択にも使用。default host依存とEnterprise対応拡張は不採用 | 合成tokenと`GH_HOST`を使い、実通信なしで末端Authorizationを観測 | 資格情報と送信先を同じホスト正本へ結合し、tokenを出力しない | `github-pr-image-download.test.ts`、build、lint |
| `markdown-image-semantics` | 対象画像記法、Markdown literal保持 | 対象3コンテキストの範囲だけを除外する小さな走査を採用。新規parser依存は不採用 | download呼出、出力本文、placeholder順序を観測 | 要求された構文判定だけを追加し、Markdown全般へ範囲を広げない | `prReviewAttachments.test.ts`、`npm test` |
| `pr-image-production-dataflow-test` | 軽量IT分類、production配線の受入条件 | 外部GitHub取得とagent実行のみ置換し、内部production componentsを実行。完全engine/E2Eは不採用 | 一時filesystem上のtask attachment、保存済み/staged `order.md`、run context attachment | filesystemと複数component結合だけなので軽量IT。外部資格情報不要で決定的 | 新規IT対象実行、`npm test -- src/__tests__/releaseVerificationWiring.test.ts`、`npm run test:it` |
| `pr-image-owner-failure-tests` | 副作用・失敗経路テストポリシー、裁定の代表経路限定 | add保存失敗とPR execute失敗を追加。OS削除障害の網羅は不採用 | cleanup 1回、元例外、tasks永続状態の前後比較 | 現行所有者の主要失敗側だけを直接反証可能にする | 対象add/routingテスト、変更したheavy ITの対象実行 |
| 全修正単位 | 元タスク品質要件、Repository Guidelines、TAKTテスト実行ポリシー | project scriptsだけを使用し、全heavy ITのローカル実行は要求しない | 完了した各コマンドのexit statusを記録 | 変更したheavy ITは対象実行し、全体はunit・light IT・mock E2Eで確認 | `npm run build`、`npm run lint`、`npm test`、`npm run test:it`、`npm run test:e2e:mock` |

## 再計画事項

- なし。
- 現在の実行環境で実証できない完了条件はない。実private GitHub通信は裁定上の完了条件ではなく、hostname・Authorizationの決定的テストで検証する。
- `SEC-001`のPR全体件数・累積容量制限は裁定済み`overreach`であり、実装、テスト、後続確認へ追加しない。
- WebPの14バイト固定、画像デコーダ、GitHub Enterprise URL対応、Markdown全般のparser、cleanup transaction・rollback・再試行は修正境界外として実装しない。