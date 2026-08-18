# 修正レポート

## サマリー

retry時の画像採番について、`order.md`に記載されていない既存`attachments/image-N.*`も予約対象へ含めるよう修正した。既存`image-1.png`・`image-3.png`が存在する状態で、新規画像を`image-2.png`・`image-4.png`として重複なく保存できることを実ファイルで確認した。

対話経路は、`InteractiveSeedInput → runConversationLoop → attachment store → inline image paste`を通る回帰テストを追加し、source contextと初期添付の予約値が後続pasteへ伝播することを確認した。また、PR画像データフローテストを、元の一時添付ではなく保存済み`task_dir`からrun contextへstageする実経路へ修正した。

Companionの`must_fix` 2件は解消済み。ビルド、lint、fast unit、light integration、分類契約、差分検査はすべて成功した。

## 修正単位

| 修正単位 | 対象 finding | 契約の正本 | 実施内容・反映先 | 状態 |
|----------|--------------|------------|-----------------|------|
| `image-attachment-index-precision` | `ARCH-NEW-src-features-tasks-attachments-L31`、`CODE-NEW-imageAttachmentIndex-L37`、`AI-NEW-IMAGE-INDEX-PRECISION-31`、`ai-antipattern-review-companion-1`、`ai-antipattern-review-companion-2` | `context/task/order.md`のPR画像保存、既存`TaskAttachment`形式、pipeline・retry・対話・保存済みtaskからrun contextへの経路、および任意長番号を衝突なく扱う受入条件 | 共通assignerの入力を参照配列へ統一。retryで実在するルート画像fileNameを予約。対話実経路テストと保存済みtaskのstageテストを補完。関連unitのmanifestテストダブルを実契約へ整合 | 完了 |

## 完了義務

| 修正単位 | 義務ID | 種別 | 対象 finding | 不変条件と対象経路 | 違反を検出する反例・観測点 | 修正前または差し戻し時の結果 | 実装根拠 | 修正後の証拠 | 状態 |
|----------|--------|------|--------------|--------------------|------------------------------|--------------------------------|----------|--------------|------|
| `image-attachment-index-precision` | `IAIP-01` | 振る舞い修正 | 当初3 finding | 任意長のplaceholder・fileNameを精度損失なく予約し、正の通常10進番号を割り当てる | `9007199254740991`、`9007199254740992`、400桁値、疎な`#1`・`image-3.png`、同一バッチ2画像 | `number`採番では精度損失、重複、`Infinity`生成が可能だった | `createImageAttachmentIndexAllocator`と参照配列を受ける`createImageAttachmentIndexAssigner` | PR・retry・対話の対象テスト成功。新規番号は`#2/#4`または`#5/#6` | 完了 |
| `image-attachment-index-precision` | `IAIP-02` | 利用側移行 | `ARCH-NEW-src-features-tasks-attachments-L31`、`CODE-NEW-imageAttachmentIndex-L37` | PR処理単位でassignerを共有し、異なるURLへ異なる番号、同一URLへ同一placeholderを割り当てる | 境界番号を含む本文、異なる2 URL、同一URL再参照 | 旧数値採番と手動加算が存在した | `prReviewAttachments.ts`が`[taskContent]`を共通assignerへ渡す | `prReviewAttachments.test.ts`の31件成功 | 完了 |
| `image-attachment-index-precision` | `IAIP-03` | 利用側移行 | `ARCH-NEW-src-features-tasks-attachments-L31`、`CODE-NEW-imageAttachmentIndex-L37` | retryで本文、実在fileName、同一バッチ割当と衝突せず、既存添付コピーと新規保存を維持する | `order.md`に画像参照なし、実ディレクトリに`image-1.png`・`image-3.png`、新規画像2件 | 新規画像も`image-1.png`となりdestination重複エラーが発生した | `resolveTaskAttachmentManifest`からルートattachment pathを取得し、本文とともにassignerへ渡す | `image-2.png`・`image-4.png`の保存、4ファイルの内容、cleanupを実ファイルで確認 | 完了 |
| `image-attachment-index-precision` | `IAIP-04` | 旧経路削除 | 当初3 finding、`ai-antipattern-review-companion-1` | 旧最大値helper、単発assigner、件数採番、手動数値加算を残さない | 旧シンボル、`attachments.length + 1`、`Number(rawIndex)`、旧局所変数を検索 | 旧経路が精度欠陥の原因だった | PR・retry・対話ストアを共通allocatorへ統一 | 最終検索で旧採番経路なし。全assigner呼び出しが参照配列を使用 | 完了 |
| `image-attachment-index-precision` | `IAIP-05` | 既存契約保存 | 当初3 finding、`ai-antipattern-review-companion-2` | extension、`TaskAttachment`形式、validator、保存、既存添付コピー、run-context stage、cleanupを維持する | 本文未記載の既存fileName、保存済み`task_dir`からのresolve・stage、実ファイル内容 | retryはdestination重複で失敗。旧データフローテストは元の一時添付から別task specを生成していた | retryのmanifest予約と、保存済み`task_dir`を使う`pr-image-dataflow.integration.test.ts` | retry保存成功。保存済み画像と参照がrun contextへstageされる1件のIT成功 | 完了 |
| `image-attachment-index-precision` | `IAIP-06` | 利用側移行 | `ai-antipattern-review-companion-1` | 対話開始時のsource contextと初期添付番号を予約し、後続pasteと衝突しない | source contextに`#1`・`image-3`、初期添付に`#2/#4`、inline paste 2画像 | store直接テストではproducer・伝播・consumerの配線切れを検出できなかった | `runConversationLoop`へ`InteractiveSeedInput`を渡し、実stdin image pasteを処理する回帰テスト | paste画像が`#5/#6`・`image-5.png/image-6.png`となり、内容とcleanupも確認 | 完了 |
| `image-attachment-index-precision` | `IAIP-07` | 既存契約保存 | 全finding | 未使用コード、逆方向依存、同義重複、空白不整合を導入しない | import・export・helper参照、旧経路、依存方向、差分を検索 | 該当なし | 共通allocatorはshared、assignerとmanifestはtasks所有者に配置 | 未使用参照・逆方向import・同義採番なし。lint・`git diff --check`成功 | 完了 |

## 受入条件

| finding ID | 受入条件 | 証拠 | 状態 |
|------------|----------|------|------|
| `ARCH-NEW-src-features-tasks-attachments-L31` | 任意長番号を損失なく予約し、既存placeholder・fileName・同一バッチと衝突しない | PR・retry・対話実経路で`#2/#4`または`#5/#6`を確認 | 完了 |
| `CODE-NEW-imageAttachmentIndex-L37` | 異なる画像が異なるplaceholder・fileNameとして保存され、destination重複を起こさない | 本文未記載の既存`image-1.png/image-3.png`を含むretry保存テスト成功 | 完了 |
| `AI-NEW-IMAGE-INDEX-PRECISION-31` | 安全整数上限、上限超過、400桁値で`Infinity`・指数表記・重複を生成しない | 任意長識別子を含むPR・retry対象テスト成功 | 完了 |
| `ai-antipattern-review-companion-1` | PR・retry双方が共通assignerへ参照配列を渡す | 現行コード検索と型契約テスト成功。Companion最終状態`resolved` | 完了 |
| `ai-antipattern-review-companion-2` | 保存済みtask attachmentを実際のresolve・stage経路でrun contextへ復元する | `pr-image-dataflow.integration.test.ts`が保存済み`task_dir`を使用して成功。Companion最終状態`resolved` | 完了 |

## 差し戻し後の証拠修正

| 修正単位 | 義務ID | verifier が確認した不足 | 前回の証拠が検出できなかった理由 | 修正した反例・観測点 | 同じ証明手段から再開・再確認した義務 |
|----------|--------|--------------------------|----------------------------------|----------------------|----------------------------------------|
| `image-attachment-index-precision` | `IAIP-03`、`IAIP-05` | retryが本文未記載の既存画像fileNameを予約せずdestination重複になる | 既存テストが`order.md`と実ファイルの番号を常に同期させた不完全な反例だった | 本文に画像参照を置かず、実`image-1.png/image-3.png`と新規2画像を組み合わせ、保存先・内容・order.md・cleanupを観測 | `IAIP-01`、`IAIP-03`、`IAIP-04`、`IAIP-05`、`IAIP-07` |
| `image-attachment-index-precision` | `IAIP-06` | 対話のsource context伝播を実経路で証明していない | consumer単体テストをproducer・伝播・consumer全体の証拠として過大評価していた | `runConversationLoop`へseedを渡し、実stdin pasteから`#5/#6`、実ファイル、cleanupを観測 | `IAIP-01`、`IAIP-04`、`IAIP-05`、`IAIP-06`、`IAIP-07` |
| `image-attachment-index-precision` | `IAIP-05` | PR画像データフローテストが保存済みtaskをrun contextへ復元していない | 保存直後の一時添付から別task specを作り、保存・読込境界を迂回していた | `tasks.yaml`の保存済み`task_dir`を`resolveTaskSpecForExecution`と`stageTaskSpecForExecution`へ渡すよう変更 | `IAIP-02`、`IAIP-05`、`IAIP-07` |
| `image-attachment-index-precision` | `IAIP-07` | 全unit実行でmanifest境界のテストダブル不整合が6件露出 | `existsSync=true`を全パスへ返しながら、新しい直接依存だけ実装のまま残した不完全なテストダブルだった | task action unitで`resolveTaskAttachmentManifest`を空manifestとして明示的に差し替え、関連104件と全unitを再実行 | `IAIP-03`、`IAIP-05`、`IAIP-07` |

## 品質ゲート

| 種別 | 結果 | 証拠 |
|------|------|------|
| PR・retry・対話対象テスト | 成功 | `npm test -- src/__tests__/retryTaskSpecAttachments.test.ts src/__tests__/conversationLoop-resume.test.ts src/__tests__/prReviewAttachments.test.ts`：3ファイル、62件成功 |
| 保存済みtaskデータフローIT | 成功 | `npm test -- src/__tests__/pr-image-dataflow.integration.test.ts`：1件成功 |
| 関連task action unit | 成功 | `npm test -- src/__tests__/taskRetryActions.test.ts src/__tests__/taskInstructionActions.test.ts`：104件成功 |
| テスト分類契約 | 成功 | `npm test -- src/__tests__/releaseVerificationWiring.test.ts`：19件成功 |
| ビルド | 成功 | `npm run build` |
| Lint | 成功 | `npm run lint`。テストダブル修正後にも再実行 |
| Fast unit gate | 成功 | `npm test`：379ファイル、6,059件成功 |
| Light integration gate | 成功 | `npm run test:it`：159ファイル、2,357件成功 |
| Companion | 成功 | `must_fix` 2件とも最終状態`resolved` |
| セルフスキャン | 成功 | 旧採番、未使用参照、同義重複、逆方向依存なし |
| 差分検査 | 成功 | `git diff --check` |

## 未完了義務

- なし。