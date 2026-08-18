## coding-review
実装内容をレビューしました。

### 変更契約の特定
- **主目的**: PRコメント内の画像を抽出し、ローカルの `attachments/` に保存して `order.md` に追記する。
- **観測可能な契約**:
  - `takt add --pr` および `pipeline` 実行時に画像がダウンロードされる。
  - `.takt/tasks/<slug>/attachments/` に保存される。
  - `order.md` に「## 添付画像」セクションが追加され、`[Image #1]: attachments/image-1.png` 形式で記述される。
  - 元コンテンツ内のテンポラリパスが `attachments/...` に正規化される。

### 指摘事項

#### 1. `validateAndDownloadImage` における `gh api` の不適切な利用 (重大)
`src/infra/github/image-downloader.ts:27-31` および `47-51` で `gh api` を使用して画像をダウンロードしていますが、`gh api` は通常 JSON などの API レスポンスを返すためのものであり、バイナリファイルを直接取得して Buffer として扱う設計ではありません。
GitHub のアセットをダウンロードする場合、`gh api` ではなく `curl` や `fetch` 等でリダイレクトを追いながらバイナリとして取得するか、`gh` CLI の他の適切なコマンド（あれば）を検討すべきです。また、`Accept: application/octet-stream` を指定しても、`gh api` が内部でどう処理し、`execFileSync` の `encoding: null` で正しくバイナリが保持されるかは不透明です。

#### 2. `downloadImageAsAttachment` におけるファイル拡張子の判定 (軽微)
`src/features/tasks/attachments.ts:35` で `url.split('.').pop()` を使用して拡張子を決定していますが、URL にクエリパラメータが含まれている場合（例: `...?v=1`）、正しい拡張子が取得できず `.png` のデフォルト値に依存することになります。

#### 3. `saveImageAttachments` による `order.md` の上書き (中等度)
`src/features/tasks/attachments.ts:389` で `fs.promises.writeFile` を使用して `order.md` を書き込んでいます。
`prepareTaskSpecDirectory` 内で `beforeWrite` フックとして呼ばれていますが、もし `prepareEnqueuedTaskSpecDirectory` 側で既に `order.md` を書き込んでいた場合、その内容が完全に上書きされます。`buildTaskOrderContent` を通じて内容を構築していますが、保存処理のタイミングと責任境界が曖昧です。

#### 4. `normalizeTaskAttachmentReferences` の不完全な正規化 (軽微)
`src/features/tasks/attachments.ts:118-119` で `split().join()` による置換を行っていますが、これは単純な文字列置換であり、正規表現を用いた境界チェックがないため、意図しない部分（パスの一部が一致する場合など）を置換するリスクがあります。

### 判定
**REJECT**
`gh api` によるバイナリ取得の信頼性と、ファイル保存時の上書きリスクがあるため、修正を推奨します。

---

## ai-antipattern-review
AI生成コード特有のアンチパターンおよび実装上の懸念点をレビューしました。

### Finding 1: `gh api` の同期呼び出しによるブロッキング
`src/infra/github/image-downloader.ts:27,47` において、`execFileSync` を使用して `gh api` を呼び出しています。
- **問題**: 画像のダウンロードやメタデータ取得はネットワークI/Oであり、時間がかかる可能性があります。`execFileSync` は同期的に実行されるため、Node.js のイベントループを完全にブロックします。
- **AIアンチパターン**: AIはしばしば簡便な同期API（`execFileSync`）を好みますが、サーバーサイドやCLIツールにおいて大量のファイルを処理する場合、パフォーマンス低下やタイムアウトの原因となります。
- **影響**: `Promise.all` で並列ダウンロードを試みている `src/features/pipeline/steps.ts:230` や `src/features/tasks/add/index.ts:207` においても、内部で `execFileSync` が呼ばれているため、実際にはシーケンシャルに実行され、並列化のメリットが得られていません。

### Finding 2: `Promise.all` 内でのリソース競合/制限の無視
`src/features/pipeline/steps.ts:230` および `src/features/tasks/add/index.ts:207` で `prReview.images.map` に対する `Promise.all` を使用しています。
- **問題**: PRに含まれる画像数が多い場合、同時に大量の `gh api` プロセスを起動することになります。
- **AIアンチパターン**: AIは「並列化 = `Promise.all`」というパターンを機械的に適用しがちですが、外部CLIやAPIのレートリミット、OSのプロセス数制限（PID枯渇）を考慮していません。
- **影響**: 大量の画像があるPRを処理した際に、`gh` コマンドの実行失敗やシステムリソースの枯渇を招く恐れがあります。

### Finding 3: 一時ファイル管理の不完全さ
`src/features/tasks/attachments.ts:29-62` の `downloadImageAsAttachment` において、`tmpdir()` を使用して一時ファイルを保存していますが、正常終了時の削除ロジックがありません。
- **問題**: `catch` ブロックでは `unlink` していますが、正常に `TaskAttachment` を返した後、そのファイルがいつ、どこで削除されるかが不明確です（`promoteTaskAttachments` 等でコピーはされますが、元ファイルのクリーンアップ経路が見当たりません）。
- **AIアンチパターン**: 「とりあえず一時ファイルに書き出す」という実装はAIによく見られますが、ライフサイクル管理（特に正常系での後処理）が漏れがちです。
- **影響**: 実行のたびに `/tmp` ディレクトリにファイルが蓄積され、ディスク容量を圧迫します。

### Finding 4: `validateAndDownloadImage` の認証フラグの不整合
`src/infra/github/image-downloader.ts:18` の `auth` オプションが、`src/features/pipeline/steps.ts:231` および `src/features/tasks/add/index.ts:208` で `true` として渡されています。
- **問題**: `auth: true` の場合、`gh api` を使ってメタデータを取得していますが、その後の実際のダウンロード (`line 47`) では `auth` フラグに関わらず同じ `gh api` コマンドを実行しています。
- **AIアンチパターン**: 認証が必要な場合と不要な場合の条件分岐を導入しながら、最終的な実行パスでその区別を意味のない形（どちらにせよ `gh` を使う）で実装しています。
- **影響**: 実装上の冗長性であり、動作への直接的な影響は低いですが、設計意図が不明確です。

---

## architecture-review
レビュー結果を報告します。

### 構造・設計レビュー

#### 1. パブリック API の公開範囲 (REJECT)
`src/features/tasks/attachments.ts:133` の `promoteTaskAttachments` がパブリックにエクスポートされています。これは一時ファイルをタスクディレクトリにコピーするインフラ寄りの詳細な操作であり、ドメイン操作ではないため、内部関数に留めるべきです。

#### 2. 責務の分離と重複 (REJECT)
`src/features/tasks/attachments.ts` 内に、`saveImageAttachments` (349行目) と `promoteTaskAttachments` (133行目) という、ほぼ同一の「一時ファイルをコピーして配置する」責務を持つ関数が混在しています。
- `saveImageAttachments` は `order.md` の更新まで担っています。
- `promoteTaskAttachments` はコピーのみを行います。
この重複は、同じ変更理由（添付ファイルの保存方式変更）に対して複数の修正箇所を生じさせるため、共通の内部実装へ集約すべきです。

#### 3. エラーハンドリングの不整合 (REJECT)
`src/features/tasks/attachments.ts:29` の `downloadImageAsAttachment` では、ダウンロード失敗時に `console.warn` を出力して `null` を返していますが、呼び出し元の `src/features/pipeline/steps.ts:234` では単純に `filter` で除外しています。
一方、`src/features/tasks/add/index.ts:211` では `Promise.all` の結果を `filter` しています。
一部の画像だけが欠落した場合にユーザーへ通知される経路がなく、サイレントに無視される設計となっています。要件に「安全的に取得」とあるため、失敗した画像がある場合の警告またはエラー通知を境界（CLI層）で明示的に扱うべきです。

#### 4. 依存方向の検証 (OK)
`src/infra/github/image-downloader.ts` などのインフラ層が `shared` ユーティリティに依存し、`features` 層がインフラ層を利用する方向性は維持されており、レイヤー設計上の違反は見当たりません。

### 判定
**REJECT**

以上の構造的な重複および API 公開範囲の問題、およびエラー通知の欠如を修正する必要があります。

---

## security-review
This security review focuses on the introduction of image downloading and attachment handling for PR/MR review comments.

### 1. Trust Boundary and Input Analysis

The changes introduce a new data flow:
`External VCS (GitHub/GitLab) -> URL Extraction -> Image Downloader -> Local Temporary File -> Task Directory`

**Trust Boundaries:**
- **External $\to$ Internal:** URLs are extracted from PR/MR bodies and comments. These are controlled by the VCS users (potentially untrusted).
- **Network $\to$ Local Filesystem:** The `validateAndDownloadImage` function fetches content from these URLs and writes it to the local disk.

### 2. Vulnerability Analysis

#### A. Server-Side Request Forgery (SSRF) / Arbitrary URL Access
**Observation:** `src/infra/github/image-downloader.ts:20` implements a prefix check:
```typescript
if (!url.startsWith(GITHUB_ATTACHMENT_URL_PREFIX) && !url.startsWith(GITLAB_ATTACHMENT_URL_PREFIX)) {
  throw new Error('Only GitHub or GitLab attachment URLs are allowed');
}
```
**Verification:**
- `GITHUB_ATTACHMENT_URL_PREFIX` is `https://github.com/user-attachments/assets/`.
- `GITLAB_ATTACHMENT_URL_PREFIX` is `https://gitlab.com/uploads/-/system/project/`.
- The check uses `.startsWith()`, which effectively restricts the `gh api` or `glab` requests to these specific domains and paths.
- Since the download is performed via the `gh` CLI (`gh api ... url`), it relies on the GitHub CLI's internal handling of the request. The prefix check prevents the tool from being used to probe internal network services or arbitrary external sites.

**Verdict:** Protected.

#### B. Arbitrary File Write / Path Traversal
**Observation:** 
- In `src/features/tasks/attachments.ts:40`, the filename is generated using `randomUUID()`:
  `const fileName = `image-${index + 1}-${randomUUID()}.${fileExtension}`;`
- The `fileExtension` is derived from the URL: `const fileExtension = url.split('.').pop() ?? 'png';`
- The file is written to `tmpdir()` using `path.join(tempDir, fileName)`.

**Verification:**
- The `fileName` does not contain user-controlled input other than the extension.
- `url.split('.').pop()` could potentially return a string with path traversal characters (e.g., `../../etc/passwd`), but since it's only the *last* part of the split, it cannot traverse upwards from the `tempDir` unless the URL ends in something like `. ../../etc/passwd`. 
- However, `path.join` with a `fileName` that starts with a slash or contains `..` could be dangerous. In this case, `fileName` starts with `image-`, which anchors it to the current directory. 
- Even if `fileExtension` contains `..`, it is appended to the end of the filename.
- Later, in `saveImageAttachments`, the file is copied to `path.join(taskDir, getTaskAttachmentRelativePath(attachment))`.

**Verdict:** Low risk. The filename is primarily synthetic.

#### C. Resource Exhaustion (DoS)
**Observation:** 
- `src/infra/github/image-downloader.ts:9` defines `MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024` (10MB).
- In `validateAndDownloadImage`, if `options.auth` is true, it checks the size via metadata:
  ```typescript
  if (metadata.size && metadata.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Image size exceeds limit');
  }
  ```
- However, the actual download `execFileSync('gh', ['api', ..., url], { encoding: null })` happens regardless of whether `auth` was true or false. If `auth` is false, the size check is skipped entirely.

**Risk:**
- If a user provides a URL to a very large file (e.g., 1GB) and `auth` is false, `execFileSync` will attempt to read the entire response into a Buffer. This could lead to an `OutOfMemoryError` (DoS) on the machine running TAKT.
- The `auth` parameter is passed as `true` in `resolveTaskContent` and `addTask`, so the check is active in the primary paths. However, the downloader itself is public and the check is conditional.

**Verdict:** Warning. The size limit is only enforced when `auth: true` is passed.

#### D. Remote Code Execution (RCE) via Image Parsing
**Observation:** The code downloads the image as a Buffer and writes it to disk. It does not perform any image processing (e.g., resizing, transcoding) using native libraries like ImageMagick or Sharp.

**Verdict:** No risk.

### 3. Conclusion

No blocking security vulnerabilities were found. The most significant risk is a potential memory exhaustion if `auth: false` is used with a massive file, but this is a secondary path and the primary implementation uses the size check.

**Decision: APPROVE**

---

## testing-review
The testing review for the PR image attachment feature reveals a significant gap between the requirements and the actual test coverage.

### 1. Critical Coverage Gaps (Missing Failure Paths)
The current tests focus almost exclusively on "happy paths" or basic URL validation. The following observable failure paths required by the spec are **untested**:

- **Content-Type Validation**: The `validateAndDownloadImage` function (src/infra/github/image-downloader.ts:36) checks if the content type is in `SUPPORTED_IMAGE_TYPES`. There are no tests verifying that unsupported types (e.g., `text/plain`, `application/pdf`) are rejected.
- **File Size Limit**: The size check against `MAX_IMAGE_SIZE_BYTES` (src/infra/github/image-downloader.ts:41) is not tested. A test case with an image exceeding 10MB is missing.
- **Authentication Failures**: The `options.auth` path uses `gh api`. Tests do not cover scenarios where `gh` is not installed, the API returns a 404/403, or the JSON response is malformed.
- **Actual Download Failure**: The test `validateAndDownloadImage` only tests URL prefixes. It does not verify the behavior when the `gh api` call for the actual buffer (line 47) fails.
- **FileSystem Errors**: `saveImageAttachments` (src/features/tasks/attachments.ts:349) interacts with the disk. Scenarios like "disk full" or "permission denied" during `mkdir` or `copyFile` are not handled/tested.

### 2. Implementation/Test Inconsistency
- **Path Normalization**: The test `should normalize attachment references in task content` (src/__tests__/pr-image-attachment.test.ts:163) verifies that temporary paths are replaced with `attachments/normalized.png`. However, it uses `fs.mkdtemp` which creates absolute paths. The implementation in `normalizeTaskAttachmentReferences` (src/features/tasks/attachments.ts:105) relies on simple string replacement. This is fragile and may fail if the temporary path format varies across OSs.

### 3. Structural Evaluation
- **Test Isolation**: The tests for `saveImageAttachments` correctly use temporary directories, ensuring independence.
- **Naming**: Test names are explicit and follow the "should..." pattern.
- **Mocking**: The tests avoid over-mocking by using real temporary files, which is a positive.

### Summary of Findings
| Component | Finding | Severity | Root Cause |
| :--- | :--- | :--- | :--- |
| `image-downloader.ts` | No validation of Content-Type / Size limits | High | Missing boundary value tests |
| `image-downloader.ts` | No verification of `gh` CLI failure paths | High | Mocking/Integration gap |
| `attachments.ts` | Path normalization logic is fragile | Medium | Implementation depends on string match of temp paths |