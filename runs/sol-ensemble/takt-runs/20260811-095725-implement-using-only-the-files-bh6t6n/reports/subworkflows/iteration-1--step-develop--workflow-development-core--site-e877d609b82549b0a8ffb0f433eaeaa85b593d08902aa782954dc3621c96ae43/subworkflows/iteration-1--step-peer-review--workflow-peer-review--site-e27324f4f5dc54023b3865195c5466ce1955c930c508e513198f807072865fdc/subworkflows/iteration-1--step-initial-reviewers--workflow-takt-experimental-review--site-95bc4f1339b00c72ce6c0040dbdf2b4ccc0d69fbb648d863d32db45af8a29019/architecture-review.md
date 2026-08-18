# アーキテクチャレビュー

## 結果: REJECT

## サマリー

PR本文のみの画像が `takt add --pr` で処理されない配線漏れを含む、ブロッキング指摘4件を確認した。共有層の責務境界、画像検証、一時資産の失敗時契約にも修正が必要である。

## 確認した観点

- [x] 構造・設計
- [x] コード品質
- [x] 変更スコープ
- [x] テストカバレッジ
- [x] デッドコード
- [x] 呼び出しチェーン検証

## 問題系列の完了走査

| family_tag / 変更契約 | 不変条件・根本原因 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|-------------------|------------------|----------------------|------------------------------------------|----------------------------|------------|------|
| `pr-image-entry-routing` | PR本文・通常コメント・review summary・threadの画像が全PR入口で準備処理へ到達する | `src/infra/git/format.ts:197`、`src/features/tasks/prReviewAttachments.ts:38` | add、対話CLI、pipelineを走査 | addのみ画像準備前の早期終了を確認 | `addTask.test.ts:345`が旧挙動を固定。pipelineには本文画像のみのfixtureあり | なし | `ARCH-NEW-src-features-tasks-add-index-L194` |
| `image-magic-validation` | Content-Typeだけでなく各形式の完全なmagic bytesを確認する | `src/shared/utils/imageMimeType.ts:16` | PR downloaderとinline pasteの両消費先を確認 | 未対応形式・不一致・サイズ超過経路を確認 | `github-pr-image-download.test.ts:15`が4バイトだけのPNGを正常扱い | 実private GitHub通信は未確認 | `ARCH-NEW-src-shared-utils-imageMimeType-L17` |
| `pipeline-transient-resource-cleanup` | cleanup失敗がworkflowの元結果・例外を上書きしない | `src/features/tasks/attachments.ts:110`、`src/infra/task/enqueueService.ts:160` | pipelineの一時task spec生成、run context解決、削除を確認 | workflow成功・false・例外後の`finally`を確認 | workflow false時のcleanup呼出テストはあるが、cleanup自体の失敗テストはない | なし | `ARCH-NEW-src-features-pipeline-steps-L411` |
| `shared-boundary-ownership` | shared層はprovider・feature固有の規則や観測名を所有しない | `src/shared/utils/githubAttachmentUrl.ts:1`、`src/shared/utils/imageAttachmentStore.ts:23` | tasks、pipeline、interactive、GitHub infraからの参照を確認 | PR取得失敗・store cleanup失敗経路を確認 | shared storeの部分mockとGitHub downloader mockを確認 | なし | `ARCH-NEW-src-shared-utils-githubAttachmentUrl-L1` |

## 今回の指摘（new）

| # | finding_id | family_tag | スコープ | 場所 | 問題 | 修正案 |
|---|------------|------------|---------|------|------|--------|
| 1 | `ARCH-NEW-src-features-tasks-add-index-L194` | `pr-image-entry-routing` | スコープ内 | `src/features/tasks/add/index.ts:194`、`src/__tests__/addTask.test.ts:345` | `reviews`と`comments`が空だと画像準備前に終了するため、PR本文だけに画像がある明示要件を満たさない。対話CLIとpipelineには同じ制限がない。 | 早期終了を削除するかPR本文も含めて判定し、本文画像のみのPRがtask attachmentとして保存されるテストへ旧テストを置換する。 |
| 2 | `ARCH-NEW-src-shared-utils-imageMimeType-L17` | `image-magic-validation` | スコープ内 | `src/shared/utils/imageMimeType.ts:17`、`src/__tests__/github-pr-image-download.test.ts:15` | 先頭4バイトが`89 50 4e 47`ならPNGと判定し、4バイトだけのデータも正常画像として受理する。要求されたmagic bytes検証として不十分である。 | PNGの完全な8バイトシグネチャを検証し、4バイトだけのプレフィックスを拒否するテストを追加する。共有判定を使うPR取得とinline pasteのfixtureも整合させる。 |
| 3 | `ARCH-NEW-src-features-pipeline-steps-L411` | `pipeline-transient-resource-cleanup` | スコープ内 | `src/features/pipeline/steps.ts:411`、`src/infra/task/enqueueService.ts:160` | `finally`から例外を投げ得る`fs.rmSync`を直接呼ぶため、cleanup例外がworkflowの`false`や実行例外を上書きし、pipelineの終了コード契約を壊す。 | 元の結果・例外を保持してcleanupを試行する境界を設ける。workflow失敗とcleanup失敗が連続した場合に、元のworkflow失敗が維持されるテストを追加する。 |
| 4 | `ARCH-NEW-src-shared-utils-githubAttachmentUrl-L1` | `shared-boundary-ownership` | スコープ内 | `src/shared/utils/githubAttachmentUrl.ts:1`、`src/shared/utils/imageAttachmentStore.ts:34,58`、`src/features/tasks/prReviewAttachments.ts:3` | GitHub固有のURL規則が汎用shared層に置かれている。また、共有化したstoreが`pasted`というfeature固有エラーと`interactive`ログ分類を保持し、tasks／pipeline利用時の責務と観測名が一致しない。 | GitHub URL判定を`infra/github`へ移し、shared storeの型・エラー・ログを画像添付一般の契約へ変更する。GitHub固有関数はパッケージの公開APIへ露出させず内部利用に限定する。 |

## 継続指摘（persists）

なし。

## 解消済み（resolved）

なし。

## 再開指摘（reopened）

なし。

## 検証証跡

- ビルド: 実装履歴の`implementation-report.md`で`npm run build`成功を確認。レビューでは再実行していない。
- テスト: `npm test -- src/__tests__/addTask.test.ts src/__tests__/prReviewAttachments.test.ts src/__tests__/github-pr-image-download.test.ts`を実行し、3ファイル・40件成功。
- 動作確認: 定義・参照検索によりadd、対話CLI、pipeline、task spec、run context、cleanupの呼び出しチェーンを確認。テスト成功の一部は、本文のみPRの拒否と4バイトPNG受理という誤った契約を固定しているため承認根拠にはならない。

## 再走査証跡（2回目以降のレビューで必須）

初回レビューのため非適用。