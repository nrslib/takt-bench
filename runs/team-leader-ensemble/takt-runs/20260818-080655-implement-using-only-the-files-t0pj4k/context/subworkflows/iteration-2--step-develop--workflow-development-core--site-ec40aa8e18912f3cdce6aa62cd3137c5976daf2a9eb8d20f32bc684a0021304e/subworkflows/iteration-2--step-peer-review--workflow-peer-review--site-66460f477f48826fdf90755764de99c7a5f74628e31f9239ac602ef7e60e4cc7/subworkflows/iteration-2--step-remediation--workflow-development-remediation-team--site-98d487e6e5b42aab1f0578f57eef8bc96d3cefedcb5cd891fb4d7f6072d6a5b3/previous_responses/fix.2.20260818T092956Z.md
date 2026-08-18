## decomposition

---

{
  "parts": [
    {
      "id": "image-contract-implementation",
      "title": "画像抽出・placeholder採番・一時資源cleanupの統合修正",
      "instruction": "担当ファイルは次の4件のみ: src/shared/utils/imageUrls.ts、src/features/tasks/add/index.ts、src/__tests__/imageUrls.test.ts、src/__tests__/addTask.test.ts。同じ不変条件を共有するproducer・利用側・回帰テストを分断しないため、このpartで一括して扱う。参照専用は、.takt/runs/20260818-080655-implement-using-only-the-files-t0pj4k/context/task/order.md、Report Directory内に存在する最新のfix-plan.md、fix-verification.md、review-resolution.md、fix-report.md、および修正計画で明示された既存consumerとする。修正計画の範囲を超えるファイルや契約は変更しない。実装内容: (1) extractImageUrls()でMarkdown、HTML double quote、HTML single quoteの候補を位置情報付きで統合し、本文初出順を保持してからURL重複を初出1件へ排除する。plain URLは抽出しない。(2) addTask()とdownloadImage()で、画像取得・検証・保存が成功した画像だけを成功順の1-based placeholder `[Image #1]`以降へ対応付け、失敗画像が番号を消費しないようにする。本文、order.md、保存済みattachment consumerの既存契約と公開境界は維持する。(3) downloadImage()の取得失敗・形式検証失敗時、およびaddTask()の保存成功・保存失敗・workflow cancel時に、取得用一時資源だけを現行Node runtimeで有効なrecursive removal APIにより回収する。永続task attachmentは保持し、元の取得・検証・保存エラーと個別画像失敗後の継続処理を隠さない。(4) 旧recursive rmdir経路、旧placeholder生成経路、未移行consumer、直書きの重複実装が残らないことを確認する。(5) imageUrls.test.tsとaddTask.test.tsに、混在記法の順序、plain URL除外、重複排除、複数成功、先行失敗後の採番、PNG/JPEG/GIF/WebP、magic bytes拒否、取得失敗、検証失敗、保存成功・失敗、cancel時cleanupと永続attachment保持を、既存の実入口と観測可能な結果で追加または修正する。テスト・lint・buildの実行はこのpartでは行わず、全修正完了後の後続feedback batchに委ねる。完了基準: 4ファイルの実装・テスト変更が修正計画の2 familyと全受入条件を覆い、既存の公開API・保存形式・consumerを壊さず、編集後セルフスキャンで未使用の引数・変数・関数・export・import・型、旧経路、片側更新を解消または未該当と確認できること。"
    }
  ]
}

---

## image-contract-implementation: 画像抽出・placeholder採番・一時資源cleanupの統合修正
