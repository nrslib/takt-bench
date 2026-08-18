このステップでは、現在のレビュー裁定に基づき、未充足となっている3つの actionable family に対する修正計画を策定します。

### 1. 根本原因と責務の分析

#### family: GitHub repo asset URL分類 (`FINAL-NEW-PRIMG-REPO-ASSET-URL`)
- **問題**: `/owner/repo/assets/<id>` 形式の GitHub アセット URL が抽出されない。
- **直接原因**: `isAllowedGithubAttachmentUrl` (prReviewImageAttachments.ts:58-62) がパスセグメント数を 3 つに固定して判定している。
- **根本原因**: GitHub のアセット URL 構造のバリエーション（`user-attachments/assets/...` 以外に `owner/repo/assets/...` があること）を考慮した正規化・判定ロジックになっていない。
- **不変条件**: `https://github.com/<owner>/<repo>/assets/<id...>` 形式は許可し、それ以外の外部ホストや無関係な GitHub URL は拒否する。

#### family: ダウンロード容量制御 (`FINAL-NEW-PRIMG-STREAM-SIZE-LIMIT`)
- **問題**: 応答全体をメモリに読み込んだ後に上限判定を行っている。
- **直接原因**: `readResponseBody` (prReviewImageAttachments.ts:305-314) が `arrayBuffer()` 等で全データを読み込み、その後の `validateImageResponse` (prReviewImageAttachments.ts:344-353) でサイズをチェックしている。
- **根本原因**: HTTP ストリームの読み込み制御（制限付き読込）が実装されておらず、メモリ消費量に対する防御策が不十分である。
- **不変条件**: `MAX_IMAGE_BYTES` を超えるデータは、読込中に検知した時点で即座に停止し、メモリへの全展開を避ける。

#### family: 要求シナリオ・pipeline結合証跡 (`FINAL-NEW-PRIMG-REQUIRED-TEST-EVIDENCE`)
- **問題**: 単体テストが要求シナリオ (P1, P2) の受入条件（置換後の本文と取得添付ファイルの同時観測など）を十分に検証しておらず、pipeline 結合テストもモックに依存し実データフローを観測していない。
- **直接原因**: テストケースが「関数が期待した値を返すか」という局所的な検証に留まり、シナリオとしてのエンドツーエンドな振る舞い（Given/When/Then）を検証していない。
- **根本原因**: 実装完了の証跡として、要求シナリオで定義された具体的な観測点（placeholder の一意性、pipeline 経由でのファイル保存・cleanup）がテストコードに反映されていない。
- **不変条件**: 要求シナリオ P1, P2 および pipeline 実行時の実ファイル保存・削除フローが、モックを最小限にした統合テストで実証されること。

---

### 2. 修正計画

#### 修正単位 1: URL 分類ロジックの拡張
- **対象**: `src/infra/github/prReviewImageAttachments.ts`
- **内容**:
    - `isAllowedGithubAttachmentUrl` の判定条件を修正し、`/<owner>/<repo>/assets/<id>` 形式を許可する。
    - セグメント数固定ではなく、`assets` セグメントの有無と位置に基づいた判定に変更する。
- **証拠**:
    - `src/__tests__/prReviewImageAttachments.test.ts` に、`https://github.com/owner/repo/assets/123` 形式の URL が正しく抽出され、置換されるテストケースを追加し、成功することを確認する。

#### 修正単位 2: ストリームベースの容量制限実装
- **対象**: `src/infra/github/prReviewImageAttachments.ts`
- **内容**:
    - `readResponseBody` を、`response.body` (ReadableStream) を消費しながらバイト数をカウントし、`MAX_IMAGE_BYTES` 超過時に即座にエラーを投げる実装に変更する。
    - `validateImageResponse` 内の事後チェックを、ストリーム読込時の事前/途中チェックに統合する。
    - 失敗時に一時ファイルやリソースが適切に清掃されることを保証する。
- **証拠**:
    - `src/__tests__/infra/github/prReviewImageAttachments.integration.test.ts` (再作成) にて、巨大なボディを返す mock fetch を使用し、全データがメモリに載る前に `MAX_IMAGE_BYTES` 違反で reject されることを検証する。

#### 修正単位 3: 要求シナリオおよび Pipeline 結合テストの充足
- **対象**: `src/__tests__/prReviewImageAttachments.test.ts`, `src/__tests__/core/pipelineExecution.test.ts` (または適切な統合テストファイル)
- **内容**:
    - **P1 検証**: 同一テスト内で「置換後の PR 本文」と「生成された `StoredImageAttachment` 1件」を同時に assertion するケースを追加。
    - **P2 検証**: 通常コメントにある 2 つの異なる URL から、それぞれ一意な placeholder とファイル名が生成されることを検証するケースを追加。
    - **Pipeline 検証**: `pipelineExecution` のテストにおいて、モックの戻り値ではなく、実際に `resolvePrReviewImageAttachments` を通じて生成された task spec が `executeTask` に渡され、一時ファイルが作成・削除されるフローを観測する。
- **証拠**:
    - 追加・修正したテストケースがすべてパスすること。特に pipeline テストでは、ファイルシステムの副作用 (作成 $\rightarrow$ 削除) を `fs.existsSync` 等で観測する。

### 3. 依存順と完了条件

**実行順序**:
1. **修正単位 1** (URL 分類) $\rightarrow$ 抽出の正しさを確定。
2. **修正単位 2** (容量制御) $\rightarrow$ ダウンロードの安全性を確定。
3. **修正単位 3** (証跡充足) $\rightarrow$ 全体の結合振る舞いと要求充足を確定。

**完了条件**:
- `npm test` および `npm run test:it` がすべて成功すること。
- 修正単位 1, 2, 3 の受入条件（URL 抽出、ストリーム制限、シナリオ証跡）が、コードおよびテスト結果として提示されること。