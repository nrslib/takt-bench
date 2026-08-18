# アーキテクチャレビュー

## 結果: REJECT

## サマリー

既存画像番号との衝突回避を共通化した採番処理に、安全整数境界の未検証を確認した。通常ケースの各経路とMarkdown走査修正は成立しているが、外部入力中の巨大な画像番号により無効または重複したattachmentが生成されるため差し戻す。

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
| `pr-image-placeholder-index-collision` | 生成する画像番号は有限な安全正整数であり、placeholderとfileNameが画像ごとに一意である | `src/features/tasks/attachments.ts:31-55`、`src/shared/utils/imageAttachmentReferences.ts:7,32-39` | `src/features/tasks/prReviewAttachments.ts:560-591`、`src/features/tasks/retryTaskSpecAttachments.ts:47-87`、task保存・pipeline task spec生成を確認 | PR add、対話CLI、pipeline、retryの生成・保存失敗経路を確認 | `src/__tests__/prReviewAttachments.test.ts:112-126`は通常の`[Image #1]`だけを検証。安全整数境界と複数画像のfixtureはない | なし | `ARCH-NEW-src-features-tasks-attachments-L31` |
| `markdown-literal-scan-complexity` | 行ごとに本文prefixを再構築せず、画像なし本文を線形に走査する | `src/features/tasks/prReviewAttachments.ts:395-521` | add、対話CLI、pipelineが同じ準備関数を利用 | 画像なし・literal・コードフェンス・リスト継続を確認 | 30,000行の画像なし本文を含む30件のunit test | なし | 問題なし |
| `pr-image-dataflow` | 抽出した画像と参照がtask保存からrun contextまで同じ番号で維持される | downloader、attachment store、task spec resolverを確認 | add、対話CLI、pipeline、run context stagingを確認 | 取得失敗、保存失敗、workflow失敗、cleanup失敗を確認 | unit、light IT、heavy ITの対象テストを確認 | 実private repository通信は未確認 | 問題なし |

## 今回の指摘（new）

| # | finding_id | family_tag | スコープ | 場所 | 問題 | 修正案 |
|---|------------|------------|---------|------|------|--------|
| 1 | `ARCH-NEW-src-features-tasks-attachments-L31` | `pr-image-placeholder-index-collision` | スコープ内 | `src/features/tasks/attachments.ts:31-55`、`src/features/tasks/prReviewAttachments.ts:564-575`、`src/features/tasks/retryTaskSpecAttachments.ts:52-58` | 外部本文から抽出した任意桁数の番号を未検証で`Number`へ変換し、最大値へ加算している。`[Image #9007199254740991]`の後では2つの新規画像がともに`[Image #9007199254740992]`／`image-9007199254740992.png`となる。さらに400桁の番号では`[Image #Infinity]`を生成し、既存validatorが拒否する。このためPR add・pipeline・retryで保存失敗または参照衝突が発生する。 | 採番所有者で`Number.isSafeInteger(index) && index > 0`を不変条件として検証する。既存番号を安全な正整数の集合として解析し、巨大値に引きずられず未使用の安全な番号を割り当てる。`Number.MAX_SAFE_INTEGER`、400桁の番号、異なる2画像を含むPR・retry双方の回帰テストを追加する。 |

## 継続指摘（persists）

なし。

## 解消済み（resolved）

| finding_id | 解消根拠 |
|------------|----------|
| `ARCH-NEW-src-features-tasks-add-index-L194` | `src/features/tasks/add/index.ts:194-205`でPR本文も空判定へ含め、本文だけのPRを画像準備処理へ渡している |
| `ARCH-NEW-src-shared-utils-imageMimeType-L17` | `src/shared/utils/imageMimeType.ts:16-29`でPNGの完全な8バイト署名を検証している |
| `ARCH-NEW-src-features-pipeline-steps-L411` | `src/features/pipeline/steps.ts:411-418`でcleanup例外を元のworkflow結果・例外から分離している |
| `ARCH-NEW-src-shared-utils-githubAttachmentUrl-L1` | GitHub固有URL判定は`src/infra/github/attachmentUrl.ts`、汎用storeは`src/shared/utils/imageAttachmentStore.ts`が所有している |

## 再開指摘（reopened）

なし。

## 検証証跡

- ビルド: レビューでは`npm run build`を再実行していない。対象テスト実行時のTypeScript型契約検査はすべて成功。
- テスト: PR attachment・retry対象33件、PRデータフローIT・分類契約20件、add・CLI routing・pipeline・downloader対象126件が成功。
- 動作確認: 現行の採番helperとvalidatorを実行し、400桁番号から`[Image #Infinity]`が生成されvalidatorに拒否されること、`9007199254740991`の次の2番号が同一になることを確認。`git diff --check`は成功。

## 再走査証跡（2回目以降のレビューで必須）

| 照合した Policy/Knowledge の章 | 差分側の根拠（`file:line` または「該当なし」） |
|-------------------------------|---------------------------------------------|
| 契約影響経路・呼び出しチェーン | `src/features/tasks/attachments.ts:31-55`、`src/features/tasks/prReviewAttachments.ts:547-591`、`src/features/tasks/retryTaskSpecAttachments.ts:47-87` |
| 関連フィールドのクロスバリデーション | 生成側`src/features/tasks/attachments.ts:31-55`と消費側validator `src/shared/utils/imageAttachmentReferences.ts:7,32-39`が不整合 |
| 共通helperの契約一貫性 | PRとretryが同じ採番helperを利用しており、双方で安全整数境界が未処理 |
| 副作用・状態変更の失敗時整合性 | add・pipelineのcleanupは成立。無効または重複したfileNameにより保存境界で失敗する経路を確認 |
| 欠陥クラス再走査 | 採番helperの定義と全参照を検索し、PR・retry以外に同じ未検証変換を再構築する実装がないことを確認 |
| テストレイヤーと実行ゲート | `scripts/test-classification.mjs`、`src/__tests__/pr-image-dataflow.integration.test.ts`、対象unit/light/heavyテストの分類と実行成功を確認 |