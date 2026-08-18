# 修正完了検証

## 結果: verified

## サマリー

`image-attachment-index-precision`の全完了義務を独立に検証した。

任意長の画像番号は数値へ変換されず、予約済み文字列集合と`BigInt`候補により未使用番号が割り当てられる。PR・retry・対話経路は共通allocatorへ移行済みで、本文未記載の既存fileName、同一バッチ、初期添付、source contextとの衝突も回避される。

保存済みtaskからrun contextへの復元、既存添付コピー、実ファイル内容、cleanup、旧採番経路の削除を確認した。対象テスト計292件、型契約、lint、分類契約、差分検査が成功しており、未完了義務はない。

## 修正単位の整合性

| 修正単位 | 対象 finding | 前提・方法・証拠能力の整合性 | 判定 |
|----------|--------------|------------------------------|------|
| `image-attachment-index-precision` | `ARCH-NEW-src-features-tasks-attachments-L31`、`CODE-NEW-imageAttachmentIndex-L37`、`AI-NEW-IMAGE-INDEX-PRECISION-31`、`ai-antipattern-review-companion-1`、`ai-antipattern-review-companion-2` | 任意長番号を文字列として予約し、PR・retry・対話で共通allocatorを共有する方法は、既存placeholder・fileName・同一バッチとの非衝突契約に適合する。境界値、保存副作用、復元経路、cleanupを現在のコードと対象実行で観測可能 | 適合 |

## 完了義務の独立検証

| 修正単位 | 義務ID | 対象 finding | 不変条件と対象経路 | 独立に用いた反例・観測点 | 観測結果 | 証拠 | 判定 |
|----------|--------|--------------|--------------------|----------------------------|----------|------|------|
| `image-attachment-index-precision` | `IAIP-01` | 当初3 finding | 任意長のplaceholder・fileNameを精度損失なく予約し、正の通常10進番号を割り当てる | `9007199254740991`、`9007199254740992`、400桁値、疎な`#1`・`image-3.png`、同一バッチ2画像 | 成立。新規番号は`#2/#4`または`#5/#6`となり、`Infinity`・指数表記・重複を生成しない | `src/shared/utils/imageAttachmentReferences.ts:21-44`、PR・retry・対話対象テスト62件 | 完了 |
| `image-attachment-index-precision` | `IAIP-02` | `ARCH-NEW-src-features-tasks-attachments-L31`、`CODE-NEW-imageAttachmentIndex-L37` | PR処理単位でassignerを共有し、異なるURLへ異なる番号、同一URLへ同一placeholderを割り当てる | 境界番号を含む本文、異なる2 URL、同一URL再参照、後続download失敗 | 成立。異なる画像は`#2/#4`、再参照は`#2`を再利用し、失敗時cleanupも実行される | `src/features/tasks/prReviewAttachments.ts:546-590`、`src/__tests__/prReviewAttachments.test.ts`31件成功 | 完了 |
| `image-attachment-index-precision` | `IAIP-03` | `ARCH-NEW-src-features-tasks-attachments-L31`、`CODE-NEW-imageAttachmentIndex-L37` | retryで本文、既存fileName、同一バッチ割当と衝突せず、既存添付コピーと新規保存を維持する | `order.md`に画像参照なし、実ディレクトリに`image-1.png`・`image-3.png`、新規画像2件 | 成立。既存ファイルを維持し、新規画像を`image-2.png`・`image-4.png`へ保存 | `src/features/tasks/retryTaskSpecAttachments.ts:46-101`、`src/__tests__/retryTaskSpecAttachments.test.ts:83-131` | 完了 |
| `image-attachment-index-precision` | `IAIP-04` | 当初3 finding、`ai-antipattern-review-companion-1` | 旧最大値helper、単発assigner、件数採番、手動数値加算を残さない | 旧シンボル、`Number(rawIndex)`、旧最大値resolver、手動採番を検索 | 成立。productionコードの画像採番は共通allocatorへ統一されている | `rg`による旧経路検索結果なし。現行参照はPR・retry・shared storeの共通allocatorのみ | 完了 |
| `image-attachment-index-precision` | `IAIP-05` | 当初3 finding、`ai-antipattern-review-companion-2` | extension、`TaskAttachment`形式、validator、保存、既存添付コピー、run-context stage、cleanupを維持する | 本文未記載の既存fileName、保存済み`task_dir`からのresolve・stage、実ファイル内容 | 成立。保存済み画像と参照がrun contextへ復元され、既存・新規ファイル内容も維持される | `src/features/tasks/attachments.ts:32-50,206-219,274-317`、`src/features/tasks/execute/taskSpecContext.ts:57-104`、データフローIT 1件成功 | 完了 |
| `image-attachment-index-precision` | `IAIP-06` | `ai-antipattern-review-companion-1` | 対話開始時のsource contextと初期添付番号を予約し、後続pasteと衝突しない | source contextに`#1`・`image-3`、初期添付に`#2/#4`、実stdin pasteで2画像 | 成立。`InteractiveSeedInput → runConversationLoop → store → paste`を通り、paste画像は`#5/#6`となる。実ファイルとcleanupも確認 | `src/features/interactive/conversationLoop.ts:126-146`、`src/__tests__/conversationLoop-resume.test.ts:666-732` | 完了 |
| `image-attachment-index-precision` | `IAIP-07` | 全finding | 未使用コード、逆方向依存、同義重複、空白不整合を導入しない | import・export・helper参照、依存方向、lint、差分検査 | 成立。共通allocatorはsharedに配置され、featuresからsharedへの依存方向を維持 | `npm run lint`成功、`git diff --check`成功、旧経路検索結果なし | 完了 |

## 不成立・未確認事項

なし。

## 環境要因により実証できない後続確認（判定非ブロッキング）

なし。

## 実行証跡

| 対象 | 方法 | 結果 |
|------|------|------|
| PR・retry・対話の採番境界、保存、cleanup | `npm test -- src/__tests__/retryTaskSpecAttachments.test.ts src/__tests__/conversationLoop-resume.test.ts src/__tests__/prReviewAttachments.test.ts` | 成功。3ファイル、62件 |
| 保存済みtaskからrun contextへの復元 | `npm test -- src/__tests__/pr-image-dataflow.integration.test.ts` | 成功。1件 |
| retry・追加指示の利用側契約 | `npm test -- src/__tests__/taskRetryActions.test.ts src/__tests__/taskInstructionActions.test.ts` | 成功。2ファイル、104件 |
| 対話CLIのPR seed・attachment伝播 | `npm test -- src/__tests__/cli-routing-pr-resolve.test.ts` | 成功。29件 |
| pipelineのPR attachment経路 | `npm test -- src/__tests__/pipelineExecution.test.ts` | 成功。56件 |
| `takt add --pr`保存経路 | `npm test -- src/__tests__/addTask.test.ts` | 成功。21件 |
| テスト分類契約 | `npm test -- src/__tests__/releaseVerificationWiring.test.ts` | 成功。19件 |
| 型契約 | 各`npm test -- ...`実行時の`test:type-contracts` | 成功 |
| 静的検査 | `npm run lint` | 成功 |
| 旧採番経路削除 | `rg`で旧helper・数値変換・手動採番を検索 | 成功。該当なし |
| 差分整合 | `git diff --check` | 成功 |