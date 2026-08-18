## coding-review
The implementation effectively achieves the goal of downloading images from PR comments and integrating them into the task attachment system. I have reviewed the changes across the CLI routing, pipeline execution, task addition, and the new GitHub provider logic.

### Findings

#### 1. Potential Memory/Performance Issue in `splitNonCodeSegments`
In `src/infra/github/prReviewImageAttachments.ts:199-257`, the `splitNonCodeSegments` function constructs the `current` segment using string concatenation in a loop (`current += rest[0]`). For very large PR comments, this can lead to $O(N^2)$ complexity due to string immutability in JavaScript.
- **Impact**: Performance degradation on exceptionally large comments.
- **Recommendation**: Use an array to collect characters and `join('')` at the end.

#### 2. Error Handling in `addTask`
In `src/features/tasks/add/index.ts:196-202`, the code catches errors from `resolvePrReviewImageAttachments` and logs them, but continues execution. If image resolution fails, `resolved` remains undefined or the function returns early. While the current flow prevents a crash, the error message `Failed to resolve PR review images` might be confusing if the user expects the task to be created regardless of images.
- **Impact**: Low. The task is not created if images fail to resolve, which is a safe but potentially strict behavior.

#### 3. `executeDefaultAction` Logic Shift
The refactor in `src/app/cli/routing.ts` moved a significant block of logic into a `try-catch` and introduced `confirmedResult = result!`. While logically sound because `result` is assigned in the `switch` block, the use of the non-null assertion operator (`!`) is slightly risky if the `switch` is ever extended without updating the assignment.
- **Impact**: Low.

### Verification against Requirements
- **Image Detection**: Correctly handles Markdown `![]()` and HTML `<img>` tags.
- **Security**: Validates GitHub hostnames, restricts redirects to safe domains, and verifies `Content-Type` vs. magic bytes.
- **Size Limits**: Enforces `MAX_IMAGE_BYTES` (10MB) both via header and actual body length.
- **Authentication**: Uses `gh auth token` for private repository access.
- **Integration**: Correctly wires attachments through `takt add --pr` and `pipeline` execution paths.

**Verdict: APPROVE** (with a minor suggestion for `splitNonCodeSegments` performance).

---

## ai-antipattern-review
今回の変更は、PRコメント内の画像をダウンロードしてtask attachmentsに配置する機能の実装です。AI生成コードに特有のアンチパターン（幻覚API、過剰エンジニアリング、整合性の欠如など）の観点からレビューした結果、以下のfindingを報告します。

### 1. 不適切な型キャストによる潜在的なランタイムエラー
`src/infra/github/prReviewImageAttachments.ts:309` において、`response` を `unknown` 経由で `{ body?: Buffer }` に強制的にキャストしています。

```typescript
309:   const body = (response as unknown as { body?: Buffer }).body;
```

`globalThis.Response` 型には `body` プロパティは存在せず、この実装は特定の非標準的な `fetch` 実装や古いライブラリの挙動に依存している可能性があります。標準的な `fetch` APIでは `response.arrayBuffer()` や `response.blob()` を使用すべきであり、`response.arrayBuffer()` のチェック（306行目）に失敗した場合にこのキャストが実行されるため、多くの場合 `undefined` になり 313行目のエラーを誘発します。AIが「ありそうなプロパティ」を推測してキャストした典型的なパターンです。

### 2. 正規表現による不完全なMarkdown解析
`src/infra/github/prReviewImageAttachments.ts:40, 41` で使用されている正規表現による画像抽出は、Markdownの複雑な構造（例：リンクの中の画像、エスケープされた記号、複雑な属性を持つHTMLタグ）を正しく処理できず、誤抽出や抽出漏れが発生するリスクがあります。

また、`splitNonCodeSegments` (192行目) でコードブロックを除外していますが、これは手製の簡易パーサーであり、入れ子構造や特殊なエスケープに対応していません。

### 3. 一時ディレクトリのクリーンアップ不備
`src/infra/github/prReviewImageAttachments.ts:427` の `resolvePrReviewImageAttachments` 関数では、`downloadPrReviewImageAttachments` から返された `cleanup` 関数を `PrReviewImageResolveResult` として返していますが、この `cleanup` が呼び出される責任が呼び出し側に完全に委ねられています。

`src/features/pipeline/steps.ts:394` や `src/features/tasks/add/index.ts:243` で `finally` ブロックによる呼び出しが実装されていますが、もし `resolved.cleanup` が undefined の状態で呼び出された場合（232行目などのフォールバック経路）のガードが不十分な箇所があり、ランタイムエラーになる可能性があります。

### 4. GitHub認証トークン取得の非効率性
`src/infra/github/prReviewImageAttachments.ts:372` の `getGhAuthToken` は、画像1枚ごとに `gh auth token` コマンドを `execFileSync` で実行しています。

```typescript
394:     for (const reference of references) {
395:       const response = await fetchImageWithRedirects(reference.url, token, deps.fetch);
```

ループの外で一度だけ取得するように `downloadPrReviewImageAttachments` で実装されてはいますが、`deps.getToken` として関数を渡しているため、実装者が誤ってループ内で呼び出す構造になっています。現状は外で呼んでいますが、設計として `token` そのものを渡す方が安全で効率的です。

### 結論
機能的な要件は満たしていますが、`Response` 型への不適切なキャストなど、AIが型定義を無視して「もっともらしい」プロパティを推測して実装した箇所が見受けられます。特に `readResponseBody` の実装は不安定であり、標準的な API への修正を推奨します。

---

## architecture-review
このレビューでは、PRコメント内の画像をダウンロードしてtask attachmentsに配置する機能の設計と実装を検証します。

### 変更契約の特定
- **新契約**: `GitHubProvider.resolvePrReviewImageAttachments` および `src/infra/github/prReviewImageAttachments.ts` による画像抽出・ダウンロード・置換フロー。
- **境界**: 
    - `GitHubProvider` (Infra) $\rightarrow$ `resolvePrReviewImageAttachments` (Infra/Internal)
    - `addTask` / `resolveTaskContent` (Feature/Pipeline) $\rightarrow$ `GitHubProvider`
- **責務**:
    - `prReviewImageAttachments.ts`: 画像URLの抽出、安全なダウンロード、MIMEタイプ検証、プレースホルダー置換。
    - `GitHubProvider`: GitProvider契約の提供。
    - `addTask` / `resolveTaskContent`: 実行フローにおける画像解決のトリガーとクリーンアップ管理。

### 設計レビュー

#### 1. 依存方向とレイヤー設計
- `src/infra/github/prReviewImageAttachments.ts` が `src/shared/utils/imageFormat.ts` や `private-file.ts` に依存しており、依存方向は適切（Infra $\rightarrow$ Shared）。
- `addTask` および `resolveTaskContent` が `GitHubProvider` を介して機能を利用しており、Feature $\rightarrow$ Infra の方向が守られている。

#### 2. 安全性と制約の遵守 (元要件準拠)
- **形式検証**: `detectImageMimeType` (magic bytes) と `declaredContentType` の一致を `validateImageResponse` で検証しており、要件を満たしている。
- **サイズ制限**: `MAX_IMAGE_BYTES` (10MB) をヘッダーと実ボディの両方でチェックしており、安全。
- **認証**: `getGhAuthToken` で `gh auth token` を実行してBearerトークンを付与しており、Privateリポジトリに対応している。
- **URL制限**: `isAllowedGithubAttachmentUrl` および `isAllowedRedirectTarget` により、GitHubドメイン外へのリクエストを制限しており、SSRF対策がなされている。

#### 3. 状態整合性とライフサイクル
- **一時ファイル管理**: `downloadPrReviewImageAttachments` 内で `createTempDownloadDir` を作成し、成功・失敗に関わらず `cleanup` 関数または `catch` ブロックで `fs.rmSync` が呼ばれる設計となっており、リークが防止されている。
- ** pipeline 実行時のクリーンアップ**: `src/features/pipeline/execute.ts:95` で `taskContent.attachmentCleanup?.()` が `finally` ブロックに配置されており、実行後の後始末が保証されている。

#### 4. 呼び出しチェーンの検証
- `addTask` $\rightarrow$ `provider.resolvePrReviewImageAttachments` $\rightarrow$ `saveTaskFile` (attachments渡し) $\rightarrow$ `prepareTaskSpecDirectory` の経路が正しく配線されている。
- `resolveTaskContent` $\rightarrow$ `provider.resolvePrReviewImageAttachments` $\rightarrow$ `runWorkflow` (attachments渡し) $\rightarrow$ `prepareTaskSpecDirectory` の経路も正しく配線されており、pipeline実行時も画像が利用可能。

### Finding

指摘事項はありません。設計は堅牢であり、元要件の安全性・制約およびTAKTのアーキテクチャ原則に準拠しています。

**判定: APPROVE**

---

## security-review
この変更に対するセキュリティレビューの結果を報告します。

### 概要
PRコメント内の画像をダウンロードしてタスク添付ファイルとして保存する機能が実装されました。外部リソース（GitHubの画像）をローカルファイルシステムに書き込むため、SSRF、パストラバーサル、リソース消費攻撃（DoS）が主な攻撃ベクトルとなります。

### セキュリティ分析

#### 1. 信頼境界と入力制御
- **入力点**: PR本文およびコメント内のMarkdown/HTML画像タグ。
- **制御点**: `isAllowedGithubAttachmentUrl` および `isAllowedRedirectTarget`。
- **検証結果**: 
    - ホスト名を `github.com` に限定し、パスの構造（`/user-attachments/assets` 等）を厳格にチェックしているため、任意の外部URLへのリクエスト（SSRF）は防止されています。
    - リダイレクト先も `github.com` または `*.githubusercontent.com` に限定されており、安全です。

#### 2. ファイル操作とパストラバーサル
- **保存先**: `os.tmpdir()` 配下の `takt` ディレクトリおよび、その後 `prepareTaskSpecDirectory` 経由でタスクディレクトリへ配置されます。
- **ファイル名**: `image-${number}.png` の形式で生成されており、ユーザー入力（URL等）をファイル名に使用していません。
- **検証結果**: パストラバーサルの脆弱性は存在しません。また、`writeNewPrivateFileWithMode` によりパーミッション `0o600` で書き込まれており、機密性が確保されています。

#### 3. リソース消費とDoS対策
- **サイズ制限**: `MAX_IMAGE_BYTES` (10MB) による制限が、`Content-Length` ヘッダーおよび実際のボディサイズの両方で検証されています (`validateImageResponse:344-353`)。
- **リダイレクト制限**: `MAX_REDIRECTS` (5回) により、リダイレクトループによるハングアップが防止されています。
- **検証結果**: 妥当な制限が設けられており、リソース枯渇のリスクは低いです。

#### 4. コンテンツ検証（ポリグロット/不正ファイル対策）
- **形式検証**: `Content-Type` の宣言値チェックに加え、`detectImageMimeType` によるマジックバイト検証が行われています。
- **不一致検出**: 宣言された MIME タイプと実際のデータが一致しない場合にエラーを投げる実装となっており、偽装ファイルの混入を防止しています (`validateImageResponse:359-361`)。
- **検証結果**: 堅牢な検証フローが実装されています。

### 結論
本実装は、信頼境界の定義、入力のバリデーション、リソース制限、コンテンツ検証のすべてにおいて防御的な設計がなされており、重大なセキュリティ脆弱性は認められません。

**判定: APPROVE**

---

## testing-review
レビューの結果、テストコードの品質は高く、要件で定義された主要な境界条件と失敗経路が適切に検証されていることを確認しました。

### 検証内容
1.  **画像抽出ロジック (`prReviewImageAttachments.test.ts`)**:
    *   MarkdownおよびHTML形式の抽出、コードブロック内やHTMLコメント内の除外、外部URLの拒否、重複URLのデデュープ、既存プレースホルダーとの衝突回避など、境界条件が網羅的に検証されています。
2.  **ダウンロードと検証 (`prReviewImageAttachments.integration.test.ts`)**:
    *   Content-Typeの不一致、マジックバイトの不整合、サイズ上限超過（10MiB）などの失敗経路が具体的にテストされており、安全性要件を満たしています。
    *   一時ファイルの権限（`0o600`）や、失敗時のクリーンアップ挙動も検証済みです。
3.  **統合フロー (`addTask.test.ts`, `cli-routing-pr-resolve.test.ts`)**:
    *   `takt add --pr` 実行時の画像保存、`order.md` への添付画像セクション追記、および workflow 選択キャンセル時のクリーンアップ等の副作用が検証されています。
    *   `cwd` 伝播の検証 (`git-cwd-propagation.test.ts`) により、worktree 環境での動作保証がなされています。
4.  **フォーマット検証 (`imageFormat.test.ts`)**:
    *   PNG/JPEG/GIF/WebP のマジックバイト判定が個別に検証されており、正確性が担保されています。

### 判定
**APPROVE**
新しい振る舞いに対するテストが不足なく実装されており、副作用のクリーンアップやセキュリティ境界（権限・サイズ制限）の検証も十分です。