## decomposition

---

{
  "parts": [
    {
      "id": "part-image-urls",
      "title": "画像URL抽出順と取得処理のcleanup修正",
      "instruction": "担当ファイル: src/shared/utils/imageUrls.ts。参照専用: .takt/runs/20260818-080655-implement-using-only-the-files-t0pj4k/context/task/order.md、Report Directory にある最新の fix-verification.md、および提示された fix-retry の Knowledge / Policy。fix-plan.md と fix-report.md は存在しない前提で補完しない。直接修正内容: 1) extractImageUrls() の Markdown、HTML double quote、HTML single quote の各記法を本文上の出現位置順に統合抽出し、混在入力でも初出順を維持する。2) imageUrls.ts 内の downloadImage() と validateAndSetImageExtension() に残る fs.rmdirSync(..., { recursive: true }) を現行 Node.js >=24.15.0 で使用可能な cleanup API へ置換する。取得失敗・magic bytes検証失敗時に元の例外を隠さず一時ディレクトリを回収する既存契約を維持する。成功件数ベースの決定的placeholder採番、URL重複排除、公開API、無関係な利用側は変更しない。同じ不変条件 PR-IMG-PLACEHOLDER-1 と PR-IMG-TEMP-LIFECYCLE-1 の既存担当箇所・family IDを維持し、新しいfindingやfamilyを作らない。完了基準: imageUrls.ts のみを編集し、混在記法の本文初出順抽出と両cleanup経路の現行Node.js契約適合をコード上で満たすこと。テスト・ビルド・検証レポートの生成はこのpartでは実施せず、全修正part完了後のfeedback batchへ委ねる。"
    },
    {
      "id": "part-add-cleanup",
      "title": "addTask外側cleanupの現行API移行",
      "instruction": "担当ファイル: src/features/tasks/add/index.ts。参照専用: .takt/runs/20260818-080655-implement-using-only-the-files-t0pj4k/context/task/order.md、Report Directory にある最新の fix-verification.md、および提示された fix-retry の Knowledge / Policy。fix-plan.md と fix-report.md は存在しない前提で補完しない。直接修正内容: addTask() の外側 finally に残る fs.rmdirSync(..., { recursive: true }) を現行 Node.js >=24.15.0 で使用可能な cleanup API へ置換し、saveTaskFile() 成功、保存失敗、workflow cancel の各経路で取得用一時ディレクトリを回収しつつ永続化済みattachmentを保持する契約を維持する。downloadImage() や validateAndSetImageExtension() の実装、画像URL抽出順、placeholder採番、公開APIは変更しない。同じ不変条件 PR-IMG-TEMP-LIFECYCLE-1 の既存担当箇所・family IDを維持し、新しいfindingやfamilyを作らない。完了基準: add/index.ts のみを編集し、成功・失敗・cancelの外側cleanupが現行Node.js契約に適合し、元の主操作の例外やcancel結果をcleanup失敗で不適切に隠さないことをコード上で満たす。テスト・ビルド・検証レポートの生成はこのpartでは実施せず、全修正part完了後のfeedback batchへ委ねる。"
    }
  ]
}

---

## part-add-cleanup: addTask外側cleanupの現行API移行
Replaced fs.rmdirSync with fs.rmSync in the cleanup section of addTask() function.

---

## part-image-urls: 画像URL抽出順と取得処理のcleanup修正
[ERROR] OpenCode exact tool outcome repeated 12 consecutive times for tool "todowrite"