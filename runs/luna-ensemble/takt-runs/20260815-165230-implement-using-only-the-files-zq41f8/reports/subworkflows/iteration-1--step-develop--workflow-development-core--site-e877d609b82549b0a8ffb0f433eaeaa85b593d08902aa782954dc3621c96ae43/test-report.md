# テスト作成レポート

## 完了契約-テスト対応表

| 契約ID | 由来 | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|------|----------------|-----------|--------|------|--------------|
| PRIMG-01 | 計画 | PR本文、会話コメント、レビュー概要、レビューコメントからMarkdown/HTML画像を抽出し、重複を除いて順序を保持する | PR取得 → 画像抽出 | `src/__tests__/github-pr-images.test.ts` の画像抽出テスト | 作成 | 実装前のため未実証 |
| PRIMG-02 | 計画 | GitHub添付URLのみ許可し、Content-Type、magic bytes、サイズ上限を検証する | URL検証 → ペイロード検証 | `src/__tests__/github-pr-images.test.ts` のURL・ペイロード検証テスト | 作成 | 実GitHub通信は未確認 |
| PRIMG-03 | 計画 | `add --pr` で添付画像をtaskディレクトリと `order.md` に保存する | CLI → task永続化 | `src/__tests__/addTask.test.ts` のPR添付保存テスト | 作成 | 実装前のため未実証 |
| PRIMG-04 | 計画 | 対話型 `--pr` と pipeline `--pr` が添付情報を末端処理へ伝搬する | PR解決 → seed/task content | `src/__tests__/cli-routing-pr-resolve.test.ts`、`src/__tests__/pipelineExecution.test.ts` | 作成 | 実装前のため未実証 |
| PRIMG-05 | 計画 | 既存の画像番号と衝突せず、同一URLを重複登録しない | 画像抽出・添付保存 | `src/__tests__/github-pr-images.test.ts`、`src/__tests__/imageAttachments.test.ts` | 作成 | 実装前のため未実証 |
| PRIMG-06 | 計画 | 成功・キャンセル時に一時ダウンロードを削除する | PR添付処理 → 終端 cleanup | `src/__tests__/addTask.test.ts` の成功・キャンセルcleanupテスト | 作成 | キャンセルテスト追加後の再実行は未実施 |
| PRIMG-07 | 計画 | GitLab、issue/direct入力、system metadataの既存経路を維持する | 既存CLI・system経路 | 既存テスト群を維持 | 既存 | 今回の変更対象外 |
| PRIMG-08 | 計画 | lint、型契約、release wiringを通過する | 検証ゲート | `releaseVerificationWiring.test.ts`、`npm run lint` | 既存 / Pass | なし |

## 検証境界

| 契約ID | モックで確認した範囲 | 実連携範囲 | テスト環境 / HOME / 設定の分離 | 未確認理由 |
|--------|----------------------|------------|--------------------------------|------------|
| PRIMG-01 | 各PR領域、Markdown/HTML、コードフェンス、コメント、外部URLの抽出結果 | 実GitHub PR取得は未確認 | PRレビューfixtureを使用 | 実API接続を行っていない |
| PRIMG-02 | URL許可判定、Content-Typeとmagic bytesの一致、サイズ上限 | 実HTTPダウンロードは未確認 | メモリ上のペイロードを使用 | 認証・ネットワーク応答は未確認 |
| PRIMG-03 | task保存、`order.md`追記、添付コピー、一時ファイル削除 | ローカルファイルシステムのテスト範囲 | テスト用一時ワークスペースを使用 | 実装未完了 |
| PRIMG-04 | interactive seedとpipeline task contentへの添付伝搬 | 実workflow実行末端は未確認 | PR取得をモック | 実装未完了 |
| PRIMG-06 | 成功・キャンセル時の一時ファイル削除要求 | 実装後の終端処理は未確認 | テスト用一時ファイルを使用 | キャンセルテストの再実行未実施 |

## 危険分岐・識別テスト

| 契約ID | 分岐 | 失敗させたい誤実装 | 拒否する入力 / 状態とassertion | テスト | 未カバー理由 |
|--------|------|--------------------|--------------------------------|--------|--------------|
| PRIMG-01 | コードフェンス・HTMLコメント・エスケープ | コード例やコメント内の画像を抽出する | fenced code、HTML comment、escaped markerを入力し、抽出結果が空であることをassert | `github-pr-images.test.ts` | 実装前のため未実証 |
| PRIMG-01 | 対象外URL | GitHub以外の画像リンクを添付化する | 外部ホストURLを入力し、抽出結果に含まれないことをassert | `github-pr-images.test.ts` | 実装前のため未実証 |
| PRIMG-02 | Content-Type・magic bytes不一致 | ヘッダーだけを信頼して不正形式を保存する | PNGヘッダーにJPEG bytes等を入力し、検証エラーをassert | `github-pr-images.test.ts` | 実装前のため未実証 |
| PRIMG-05 | 既存番号との衝突 | `attachments.length + 1` で既存ファイルを上書き・拒否する | `image-2.png` が存在する状態で新規保存し、`Image #3` / `image-3.png` をassert | `imageAttachments.test.ts` | 実装前のため未実証 |
| PRIMG-05 | 同一URLの重複 | 同じURLに複数の添付識別子を割り当てる | 同一URLを複数領域に入力し、URLが1件だけになることをassert | `github-pr-images.test.ts` | 実装前のため未実証 |
| PRIMG-04 | 経路間の添付欠落 | PR本文だけを伝搬し、添付情報を落とす | interactive seedおよびpipeline task contentに添付が含まれることをassert | `cli-routing-pr-resolve.test.ts`、`pipelineExecution.test.ts` | 実装前のため未実証 |
| PRIMG-06 | キャンセル終端 | キャンセル後に一時ファイルを残す | workflow選択をキャンセルし、一時ファイルが存在しないことをassert | `addTask.test.ts` | 追加後の再実行未実施 |

## 影響経路テスト

| 契約ID | 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|--------|------|----------|----------|--------------|--------|--------------|
| PRIMG-03 | PR取得 → 添付準備 → task保存 → `order.md` / taskディレクトリ | PR添付情報 | task保存処理 | 添付が永続化されること | `addTask.test.ts` | 実装前のため未実証 |
| PRIMG-04 | PR解決 → interactive seed → 対話実行 | `resolvePrInput` | interactive routing | seedへ添付が伝搬すること | `cli-routing-pr-resolve.test.ts` | 実装前のため未実証 |
| PRIMG-04 | PR解決 → pipeline task content → workflow実行 | `resolveTaskContent` | pipeline実行 | task contentへ添付が伝搬すること | `pipelineExecution.test.ts` | 実装前のため未実証 |
| PRIMG-06 | 一時ダウンロード → 成功/キャンセル終端 | 添付取得処理 | cleanup処理 | 終端時に一時ファイルを削除すること | `addTask.test.ts` | キャンセルテストの再実行未実施 |

## 連続実行・所有権・並行性

| 契約ID | 実行シーケンスまたは交差 | 実際の上位入口 | 観測する不変条件 | テスト | 未カバー理由 |
|--------|--------------------------|----------------|------------------|--------|--------------|
| PRIMG-05 | 既存添付あり → 新規添付保存 | `add --pr` 相当の添付保存 | 既存番号を再利用せず、次の空き番号を使う | `imageAttachments.test.ts` | 実装前のため未実証 |

## 否定契約

| 契約ID | 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------|----------------|----------|--------|--------------|
| PRIMG-01 | コード、HTMLコメント、通常リンク、外部画像を添付化しない | 抽出結果に含まれないことをassert | `github-pr-images.test.ts` | 実装前のため未実証 |
| PRIMG-02 | 不許可URL、形式不一致、サイズ超過の画像を保存しない | 検証結果が拒否になることをassert | `github-pr-images.test.ts` | 実装前のため未実証 |
| PRIMG-05 | 既存画像番号を再利用しない | 新規添付の番号とファイル名をassert | `imageAttachments.test.ts` | 実装前のため未実証 |
| PRIMG-06 | キャンセル後に一時ファイルを残さない | cleanup後のファイル不存在をassert | `addTask.test.ts` | テスト追加後の再実行未実施 |

## 作成テスト

| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| `src/__tests__/github-pr-images.test.ts` | 単体 | 5 | 抽出、重複排除、URL許可、ペイロード検証 |
| `src/__tests__/imageAttachments.test.ts` | 統合 | 1 | 添付番号衝突回避 |
| `src/__tests__/addTask.test.ts` | 統合 | 2 | PR添付の保存とキャンセルcleanup |
| `src/__tests__/cli-routing-pr-resolve.test.ts` | 単体 | 1 | interactive seedへの添付伝搬 |
| `src/__tests__/pipelineExecution.test.ts` | 単体 | 1 | pipeline task contentへの添付伝搬 |

## 未カバー項目

| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| GitHub APIからの認証付き実ダウンロード | 外部ネットワーク境界のためモックで代替 | 実装後に認証・HTTP応答を確認 |
| ダウンロード失敗・リトライ | 今回の最小契約に含めていない | 実装・レビューで確認 |
| pipelineからworkflow末端consumerまでの実実行 | 現在はtask content伝搬境界をテスト | 実装後に統合テストで確認 |
| GitLab・system metadata経路 | PR画像契約のoutside/preserved経路 | 既存テストの維持を確認 |
| キャンセルcleanupテストの実行結果 | テスト追加後に対象スイートを再実行していない | implement段階で再実行 |

## 実行結果（参考）

実装前のため、未実装プロダクション動作による失敗を想定内として扱う。

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 76 | 対象テスト実行時に通過した既存テスト |
| Pass | 17 | `releaseVerificationWiring.test.ts` |
| Pass | 1 | `npm run lint` |
| Fail / Import Error（想定内） | 5 | 未実装のPR画像モジュール、添付伝搬、番号衝突、保存経路による失敗 |
| Error（要対応） | 0 | 既存パスミス等は確認されていない |

## 備考

- プロダクションコードは変更していない。
- `SCN-PRIMG-01-P1` はPR本文・会話コメント・レビュー概要・レビューコメントの画像抽出テストに対応する。
- `SCN-PRIMG-01-N1` はコード、コメント、エスケープ、通常リンク、外部URL、コードフェンスの除外テストに対応する。
- `SCN-PRIMG-05-P1` は既存画像番号を避ける添付番号割り当てテストに対応する。
- `SCN-PRIMG-05-N1` は同一URLの重複排除テストに対応する。
- 編集後のセルフスキャンとして、編集テスト内のシナリオID、TODO/FIXME、`console.log`、`.skip`、`.only`、未使用importを検索し、該当なしを確認した。`git diff --check` も通過した。