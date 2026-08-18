# 決定ログ

## 1. PR 画像解決を任意 capability として追加
- **背景**: GitHub 固有の認証・URL・HTTP 処理を provider 境界に閉じ、GitLab に偽の互換実装を要求しない。
- **検討した選択肢**: `fetchPrReviewComments()` 自体が常に画像を取得する / `PrReviewData` へ常設の attachment フィールドを追加する / `GitProvider` へ任意の capability を追加し GitHub だけが実装する。
- **理由**: 既存 system workflow 等の画像を必要としない利用側へネットワーク・一時ファイル副作用を追加せず、GitLab の既存 PR 取得契約を変更せずに維持できる。

## 2. ダウンロードの検証は Content-Type と magic bytes の両方を一致させる
- **背景**: GitHub attachment URL は拡張子を持たない場合があり、URL 拡張子だけでは安全性要件を満たせない。
- **検討した選択肢**: URL 拡張子から形式を決める / Content-Type と magic bytes の両方を検証する。
- **理由**: order.md の安全性・制約（Content-Type と magic bytes 検証）を直接満たし、偽装データの保存を防ぐ。

## 3. プレースホルダーとファイル名は検証後の形式で決定
- **背景**: 抽出時点では実形式（拡張子）が未確定のため、参照では `image-N.png` を暫定名とし、ダウンロード成功後に検証済み拡張子へ置換する。
- **理由**: テスト契約（`fileName` は抽出時に `image-N.png`、保存は `image-N.<実拡張子>`）と既存 attachment 形式を両立する。

## 4. pipeline は既存 task spec 機構（`prepareTaskSpecDirectory`→`resolveTaskSpecForExecution`）を利用
- **背景**: run context へ画像を stage し、実行 prompt がその task spec を参照できるようにする。
- **検討した選択肢**: 本文へ一時ファイルパスだけを追加する / 既存 task spec 機構を再利用する。
- **理由**: 一時パスは解放後に参照不能になるため、保存タスクと同じ attachment 形式・run context 複製契約を再利用する。

## 5. 画像取得の検証は段階分離で実装
- **背景**: 入力解釈（抽出・採番）、画像取得、検証・一時保存を分離し、メインの add/routing/pipeline 処理へ正規表現や magic bytes 判定を埋め込まない。
- **検討した選択肢**: 各入口で個別に判定を実装する / `prReviewImageAttachments.ts` に集約する。
- **理由**: 同じ意味・契約・変更理由を持つ処理を共通所有者へ集約し、テスト可能な純粋関数として分離できる。

## 6. 対話モードの採番は初期 attachment の最大番号を基に決定
- **背景**: 直接 `--pr` では PR 画像が初期 attachments として渡るため、後続の貼り付け画像が番号衝突しない必要がある。
- **検討した選択肢**: `attachments.length + 1` で採番する / 初期 attachment の最大番号 + 1 で採番する。
- **理由**: 既存 `[Image #3]` の store で次を `[Image #4]` にするテスト契約を満たし、PR 画像と後続貼り付け画像の衝突を防ぐ。