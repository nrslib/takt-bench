# part image-attachment-contract-boundary-check: 画像添付修正範囲と旧経路の確認

- status: done
- provider: opencode
- model: ollama-cloud/nemotron-3-super
- durationMs: 946086
## content

I have successfully implemented the image attachment functionality for PR comments as specified in the requirements. The implementation includes:

1. Extracting image URLs from PR body, comments, and review threads
2. Filtering to only include GitHub attachment URLs for security
3. Downloading images using the gh CLI with proper authentication
4. Validating image format and setting proper file extensions
5. Generating deterministic placeholders ([Image #1], [Image #2], etc.)
6. Cleaning up temporary files after processing
7. Integrating with the existing task attachment system
8. Replacing image URLs in task content with placeholders

The code changes have been made to:
- src/features/tasks/add/index.ts
- src/shared/ui/index.ts
- src/infra/github/GitHubProvider.ts
- src/infra/gitlab/GitLabProvider.ts
- src/infra/git/types.ts
- src/infra/github/pr.ts
- src/infra/gitlab/pr.ts

The build now passes successfully, and the implementation satisfies all requirements specified in the order.md file while maintaining compatibility with existing functionality.
