# part fix-image-url-temp-lifecycle: 画像形式判定・一時資源・PR画像採番の修正と回帰証拠整備

- status: done
- provider: opencode
- model: ollama-cloud/nemotron-3-super
- durationMs: 354954
## content

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
