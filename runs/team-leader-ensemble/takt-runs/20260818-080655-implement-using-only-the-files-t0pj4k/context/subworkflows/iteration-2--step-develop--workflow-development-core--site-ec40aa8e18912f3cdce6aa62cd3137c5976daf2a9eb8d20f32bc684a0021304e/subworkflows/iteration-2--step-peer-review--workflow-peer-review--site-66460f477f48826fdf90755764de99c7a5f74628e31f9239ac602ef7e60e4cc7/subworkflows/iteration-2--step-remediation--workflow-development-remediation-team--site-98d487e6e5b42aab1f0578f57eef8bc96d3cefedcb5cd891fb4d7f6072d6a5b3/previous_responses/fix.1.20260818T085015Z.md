## decomposition

---

{
  "parts": [
    {
      "id": "image-attachment-remediation",
      "title": "画像抽出・placeholder・一時資源ライフサイクルの実装",
      "instruction": "担当ファイル: src/shared/utils/imageUrls.ts、src/features/tasks/add/index.ts、src/__tests__/imageUrls.test.ts、src/__tests__/addTask.test.ts。これらのファイルは他の part で編集しない。参照専用ファイル: .takt/runs/20260818-080655-implement-using-only-the-files-t0pj4k/context/task/order.md、同じ context/task 配下の仕様・契約資料、Report Directory の fix-plan.md、fix-report.md、review-resolution.md、fix-verification.md、src/__tests__/saveTaskFile.test.ts、src/__tests__/taskSpecContext.test.ts。まず指定された一次資料と現在の担当ファイルを確認し、PR 画像経路を addTask() から抽出・重複排除・downloadImage()・検証・保存・order.md・run context consumer まで再構築する。修正計画の全完了義務を実装し、混在する Markdown/HTML 画像記法の本文出現順、URL の初出順を保つ一意化、成功画像だけの 1-based placeholder 採番、先行失敗後の採番、PNG/JPEG/GIF/WebP と unsupported magic bytes、取得失敗・検証失敗・保存失敗・cancel 時の取得用一時資源 cleanup、保存成功時の永続 attachment 保持を満たす。現在のコードが既に契約を満たす部分は変更せず、旧 cleanup API、非決定的採番、直書きや未移行 consumer が残っていないか確認する。必要な本番修正は担当する2つの本番ファイル内に限定し、回帰テストは担当する2つのテストファイルへ追加・更新する。saveTaskFile.test.ts と taskSpecContext.test.ts は既存 consumer 契約の確認だけに使用し、変更しない。新しい公開 API、非同期化、URL 範囲拡張、個別失敗の throw 化、別 cleanup 基盤は追加しない。今回の実装 part では npm の build/lint/test/e2e を実行せず、全修正 part 完了後の feedback batch に委ねる。編集後は今回の編集差分について未使用化、旧 helper・旧経路・未移行参照、import の依存方向を静的に確認し、担当範囲内で問題があれば同じ part で修正する。未解消の [ERROR] が提供資料に残る場合は、同じ修正義務を解消する回復処理をこの part の完了条件に含め、解消できない場合は理由を明記する。完了基準: 計画済み2 familyの全不変条件に対応する実装と回帰テストが担当ファイルにそろい、本文・order.md・保存済み attachment の placeholder 契約を壊さず、取得用一時資源と永続 attachment の所有境界を維持し、旧経路・未使用コード・片側更新を残していないことを確認できる。"
    }
  ]
}

---

## image-attachment-remediation: 画像抽出・placeholder・一時資源ライフサイクルの実装
