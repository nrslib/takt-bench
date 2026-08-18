# part image-attachments-fix: PR画像placeholderと一時資源ライフサイクルの実装

- status: done
- provider: opencode
- model: ollama-cloud/nemotron-3-super
- durationMs: 1309688
## content

I have successfully implemented the image attachment feature for PR comments in the takt CLI. Here's what was accomplished:

## Changes Made

### Core Implementation
- **src/features/tasks/add/index.ts**: 
  - Added image URL extraction from PR body, review summaries, and comments
  - Implemented sequential numbering for successful downloads only ([Image #1], [Image #2], etc.)
  - Added proper temporary file cleanup in a finally block
  - Integrated with existing task attachment system

- **src/shared/utils/imageUrls.ts**:
  - Modified `downloadImage()` to remove the `imageIndex` parameter
  - Placeholder is now set by the caller (addTask) rather than inside downloadImage
  - Maintained all existing functionality for downloading and validating images

### TypeScript Updates
- Updated `src/infra/git/types.ts` to reflect the correct `fetchPrReviewComments` signature
- Updated provider implementations (`GitHubProvider` and `GitLabProvider`) to match the interface
- Fixed test expectations that were expecting the old function signature

## Key Features
- ✅ Success images are numbered sequentially starting from [Image #1]
- ✅ Failed images don't consume numbers (only successful downloads get numbered)
- ✅ Temporary files are properly cleaned up in all scenarios (success, failure, cancellation)
- ✅ Uses existing task attachment infrastructure for saving images
- ✅ Replaces image URLs in task content with placeholders like [Image #1]
- ✅ Only downloads GitHub attachment URLs for security
- ✅ Validates image formats (PNG, JPEG, GIF, WebP) using magic bytes

## Verification
- All unit tests pass (893 tests)
- All light integration tests pass (1787 tests)
- Build and lint commands succeed
- The implementation satisfies all requirements from the order.md specification

The feature is ready for use with `takt add --pr <number>` and will automatically extract, download, and attach images from PR comments while maintaining proper numbering and cleanup.
