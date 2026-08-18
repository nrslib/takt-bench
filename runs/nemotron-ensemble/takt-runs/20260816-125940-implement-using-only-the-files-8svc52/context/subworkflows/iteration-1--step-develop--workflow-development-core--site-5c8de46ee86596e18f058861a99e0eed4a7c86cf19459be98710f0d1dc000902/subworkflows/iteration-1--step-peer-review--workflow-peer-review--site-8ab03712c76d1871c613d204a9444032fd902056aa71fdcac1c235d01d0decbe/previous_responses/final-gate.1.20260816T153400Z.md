## 要件充足判定

### 1. 要求シナリオの検証

| シナリオ | Given / When / Then の対応 | 判定 |
| :--- | :--- | :--- |
| **PR本文・コメントからの画像抽出と保存** | `src/infra/github/pr.ts:438-457` および `src/infra/gitlab/pr.ts:242-255` で本文・通常コメント・review threadから画像URLを抽出 $\rightarrow$ `src/features/pipeline/steps.ts:229-235` で `downloadImageAsAttachment` を呼び出し $\rightarrow$ `src/features/tasks/attachments.ts:29-62` で一時ファイルに保存し `TaskAttachment` を生成。 | **充足** |
| **`.takt/tasks/<slug>/attachments/` への配置** | `src/features/tasks/attachments.ts:349-371` (`saveImageAttachments`) で `attachments/` ディレクトリを作成し、一時ファイルをコピー。 | **充足** |
| **`order.md` への添付画像セクション追記** | `src/features/tasks/attachments.ts:373-389` で `## 添付画像` セクションを構築し、`order.md` に書き込み。 | **充足** |
| **本文内画像参照の置換/補足** | `src/features/tasks/attachments.ts:105-123` (`normalizeTaskAttachmentReferences`) で本文内の絶対パスを相対パスに置換。 | **充足** |
| **pipeline `--pr` 経路での参照** | `src/features/pipeline/steps.ts:218-245` (`resolveTaskContent`) で PR 指定時に画像をダウンロードし `TaskContent.attachments` に含めて後続へ渡す実装が追加されている。 | **充足** |
| **安全性・制約（形式・サイズ・認証）** | `src/features/tasks/attachments.ts:40` で `validateAndDownloadImage` を呼び出し、内部でContent-Type/magic bytes検証およびサイズ上限チェック、`gh` 認証経由の取得を行っている（`src/infra/github/image-downloader.ts` 側で実装）。 | **充足** |

### 2. 前段 finding の解消状態
最新のレビュー裁定において「修正対象なし」と判定されており、未解消の finding は存在しません。

### 3. 再発台帳の引き継ぎ
指示に従い、現在の `review-resolution.md` （レビュー裁定）の記載を無変更で引き継ぎます。

| 修正単位 | family ID | 不変条件の名前 | 担当箇所 | 今回の検証回数 | 前回の検証回数 | 前回経路 | 今回経路 | 同一不変条件・再発判定 | 累積 `incomplete` 回数 | 別経路での再発が確認済みか | 強制点候補 | 記録の完全性 |
|----------|-----------|------------------|----------|------------------|------------------|----------|------------------------------------------------------|------------------------|-------------------------|--------------------|------------|--------------|
| `image-download-logic` | `image-download-logic` | 画像のダウンロードから `TaskAttachment` 生成までのフローが統一されていること | `src/features/tasks/attachments.ts` | 0 | なし | なし | 共通関数経由でのダウンロード→保存→TaskAttachment生成フロー | 判定できない（初回） | 0 | 未確認 | `src/features/tasks/attachments.ts` に `downloadImageAsAttachment` 等の共通関数を定義し、全入口からこの関数のみを呼び出す。 | 完全 |
| `gitlab-support` | `gitlab-support` | GitLab MR の画像も整合的に抽出・保存されること | `src/infra/gitlab/pr.ts` | 0 | なし | なし | `fetchMrReviewComments` $\rightarrow$ `downloadImageAsAttachment` $\rightarrow$ 保存 フロー | 判定できない（初回） | 0 | 未確認 | バリデーションをプロバイダー非依存に拡張し、GitLab プロバイダーから共通保存関数を呼び出す。 | 完全 |
| `image-lifecycle` | `image-lifecycle` | 一時ファイルは一意に生成され、処理後に確実に消去されること | `src/features/pipeline/steps.ts` | 0 | なし | なし | ユニークパス作成→`promoteTaskAttachments`→`unlink` フロー | 判定できない（初回） | 0 | 未確認 | `os.tmpdir()` と UUID 等を用いた一意なパス生成および `finally` ブロックでの `fs.unlink` 実装。 | 完全 |
| `image-io-performance` | `image-io-performance` | 大容量ファイルの I/O がイベントループをブロッキングしないこと | `src/features/tasks/attachments.ts` | 0 | なし | なし | `fs.promises.copyFile` $\rightarrow$ terminal フロー | 判定できない（初回） | 0 | 未確認 | `fs.promises` API への完全な移行（`writeFileSync` $\rightarrow$ `writeFile` 等）。 | 完全 |
| `image-download-observability` | `image-download-observability` | 画像ダウンロード失敗時に、原因を特定可能なエラーまたは警告がユーザーに通知されること | `src/features/pipeline/steps.ts` | 0 | なし | なし | `resolveTaskContent` $\rightarrow$ `catch` $\rightarrow$ `ui.warn` $\rightarrow$ terminal フロー | 判定できない（初回） | 0 | 未確認 | 不要: 既存の担当箇所で直接修正。`null` 返却を廃し、UI 通知関数を呼び出す。 | 完全 |

## 最終判定
**APPROVE**