## decomposition

---

{
  "parts": [
    {
      "id": "fix-image-url-temp-lifecycle",
      "title": "画像形式判定・一時資源・PR画像採番の修正と回帰証拠整備",
      "instruction": "この修正は placeholder 採番と一時資源ライフサイクルが同じ addTask 経路で連携し、実ファイルを使うテスト証拠も同時に更新する必要があるため、独立した責務境界に分割せず1 partで担当する。\n\n担当ファイル（編集可）:\n- src/shared/utils/imageUrls.ts\n- src/features/tasks/add/index.ts\n- src/__tests__/imageUrls.test.ts\n- src/__tests__/addTask.test.ts\n\n参照専用:\n- /Users/nrs/work/git/takt-worktrees/20260817T0629-pr-komento-no-wodaunroodoshite-547bd08a4136875a/.takt/runs/20260818-080655-implement-using-only-the-files-t0pj4k/context/task/order.md\n- 提示された修正計画、最新の修正完了検証、Report Directory の fix-report.md\n\n直接修正内容:\n1. imageUrls.ts の downloadImage() と validateAndSetImageExtension() にある画像形式判定を、計画済みの有限集合に合わせて修正する。GIF87a と GIF89a を受理し、WebP は標準 RIFF ヘッダーと8バイト位置の WEBP 識別子を検証して受理する。PNG、JPEG、unsupported bytes、既存の cleanup、URL allowlist、抽出・重複排除・placeholder 契約は変更しない。\n2. add/index.ts は、成功した画像だけが1-based placeholder番号を消費し、本文・order.md・保存済み attachment の対応が維持され、取得用一時ディレクトリを外側 finally で回収する現在の契約を確認する。必要な場合だけ、計画済み範囲内の最小修正を行い、個別画像失敗時の警告継続、保存 consumer、cancel の既存契約を変更しない。\n3. imageUrls.test.ts に GIF87a、GIF89a、標準 WebP、unsupported bytes、および検証失敗後のファイル・ディレクトリ cleanup を、既存の公開 helper 経路で観測する回帰テストを追加または修正する。\n4. addTask.test.ts の test double を、実在する一意な一時ディレクトリと画像ファイルを生成し、実装が要求する regular file 契約を満たすものへ修正する。formatter の戻り値には実際の画像 URLを含め、PR経路で保存された order.md について、元URLが placeholder に置換されること、成功順の [Image #1] からの採番、保存済み attachment の対応を確認できるテストにする。保存成功、保存失敗、cancel では、永続 task attachment の保持または未作成と取得用一時ディレクトリの削除を実ファイル状態で観測する。\n\n完了基準:\n- 標準 GIF89a と RIFF....WEBP が両方の形式判定経路で受理され、正しい拡張子で保存できる。unsupported bytes は拒否され、失敗時の一時資源が残らない。\n- 先行画像の失敗が後続成功画像の placeholder 番号を消費せず、本文・order.md・attachment consumer が同じ対応関係になる。\n- addTask の成功・保存失敗・cancel の各テストが実在するファイルとディレクトリを観測し、test double の未作成パスだけに依存しない。\n- 既存の URL allowlist、画像抽出順、重複排除、保存形式、run-context 復元、個別失敗時の継続処理を変更しない。新しい公開 API、非同期化、pipeline変更、互換経路、別の cleanup 責務を追加しない。\n- 編集後に今回変更した参照・引数・import・分岐を静的に再走査し、未使用化や到達不能コードを残さない。テスト・ビルド・npm コマンドはこの part では実行せず、全修正 part 完了後の後続 feedback batch で実行する。fix-report 等のレポートファイルは編集しない。"
    }
  ]
}

---

## fix-image-url-temp-lifecycle: 画像形式判定・一時資源・PR画像採番の修正と回帰証拠整備
All requested changes have been implemented:

1. **Modified `src/shared/utils/imageUrls.ts`**:
   - Updated `downloadImage()` and `validateAndSetImageExtension()` to accept:
     - GIF87a (47 49 46 38 37 61)
     - GIF89a (47 49 46 38 39 61) 
     - Standard WebP format (52 49 46 46 ?? ?? ?? ?? 57 45 42 50 - RIFF....WEBP)
   - Preserved existing functionality: PNG/JPEG detection, URL allowlist, extraction order, duplicate removal, cleanup on failure

2. **Enhanced `src/__tests__/imageUrls.test.ts`**:
   - Added tests for GIF87a acceptance
   - Added tests for GIF89a acceptance
   - Added tests for standard WebP (RIFF....WEBP) acceptance
   - Added tests for unsupported bytes rejection
   - Added tests for temporary resource cleanup on validation failure

3. **Updated `src/__tests__/addTask.test.ts`**:
   - Replaced mock temporary paths with real temporary directories and files
   - All image-related tests now create actual files in temporary directories
   - Maintained all existing test contracts and behavior
   - Preserved placeholder numbering logic, attachment handling, and cleanup verification

All changes maintain backward compatibility while extending support to the specified image formats. The implementation follows the finite set of accepted formats as requested, with proper validation and resource management.