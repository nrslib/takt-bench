問題を「任意長の画像添付番号に関する修正計画が、PR・retry・対話の全経路で実装・検証されているかの独立確認」と整理しました。まず正本の `order.md`、指定された Policy／Knowledge、最新レポートを全文確認し、その後に差分・実コード・対象テストを義務ごとに照合します。ソース編集は行いません。
正本と全 Policy／Knowledge を読了しました。今回適用する基準は、任意長の番号予約、全利用側の一元移行、旧採番経路の削除、保存・検証・cleanup 契約の維持、そして反例を直接観測する回帰テストです。次に、元 finding の最新記録と現在差分を再取得して、修正レポートの自己申告から独立して確認します。
実装照合では、共通 allocator が入力番号を文字列集合として保持し、候補だけを `BigInt` で進めること、PR・retry・対話が同じ責務へ移行したことを確認しました。ここから対象テストを実行しつつ、特に retry の「コピー済み実ファイル名」と本文予約がずれる反例まで確認します。これは保存時の重複エラーを直接左右するためです。
対象 55 テストと分類契約 19 テストは成功しました。ただし、retry の本文に記載されていない既存 `attachments/image-1.png` を置く反例では、現在ソースの実行が `Task attachment destination already exists` で失敗しました。採番側が `order.md` だけを予約元にし、後で丸ごとコピーする実ディレクトリの fileName を予約していないためです。残りの義務も確認し、同種の証拠漏れを横展開しています。
# 結果: incomplete

修正計画自体は有効ですが、次の不足を確認しました。

1. retry が実ディレクトリ内の既存 fileName を予約していません。  
   [retryTaskSpecAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/retryTaskSpecAttachments.ts:34) は `order.md` の本文だけから採番し、その後 [attachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/attachments.ts:274) が既存 `attachments/` を丸ごとコピーします。  
   `order.md` に参照がなく、実ファイルとして `attachments/image-1.png` が存在する状態で新規画像を追加すると、新規画像も `image-1.png` になり、現在ソースの実行で次のエラーを再現しました。

   ```text
   Task attachment destination already exists: .../attachments/image-1.png
   ```

   source task の実在する画像 fileName も allocator へ渡し、本文と実ファイルの状態が異なる反例を retry テストへ追加する必要があります。

2. 対話経路の配線を壊せる回帰テストがありません。  
   [conversationLoop.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/interactive/conversationLoop.ts:143) と [quietMode.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/interactive/quietMode.ts:62) の配線は静的には確認できました。しかし、追加されたテストは [imageAttachments.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/imageAttachments.test.ts:78) で store に `reservedContent` を直接渡しており、`InteractiveSeedInput → conversationLoop → store → paste` の経路を通りません。呼び出し側から `sourceContext` の伝播を削除してもこのテストは成功します。

修正報告の retry テストは、実ファイル `image-1.png`／`image-3.png` と同じ番号を `order.md` にも記載していたため、本文だけを予約する欠陥を検出できませんでした。対話テストも consumer を直接構築したため、producer・伝播の配線漏れを検出できません。

確認結果:

- 対象55テスト: 成功
- 分類契約19テスト: 成功
- `git diff --check`: 成功
- 任意長番号、安全整数境界、PR経路、旧数値採番削除: 成立
- 環境要因による未確認事項: なし

同じ修正計画の範囲内で対応可能なため、`plan_invalid` ではありません。