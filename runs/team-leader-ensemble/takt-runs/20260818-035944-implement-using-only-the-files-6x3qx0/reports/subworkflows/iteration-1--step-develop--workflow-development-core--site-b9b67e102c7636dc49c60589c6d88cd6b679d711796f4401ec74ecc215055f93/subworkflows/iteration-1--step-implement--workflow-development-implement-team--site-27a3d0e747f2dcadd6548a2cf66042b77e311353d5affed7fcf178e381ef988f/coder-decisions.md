# 決定ログ

## 1. PR画像取得を`includeAttachments`の明示指定時だけ有効化する

- **背景**: 既存のsystem-stepや通常のPR metadata取得では、不要な画像取得や一時ファイル生成を発生させない必要がある。
- **検討した選択肢**: 常時取得 / 呼び出し元ごとの独自実装 / `includeAttachments`によるopt-in。
- **理由**: 既存利用側の動作を維持しつつ、`add --pr`、通常の`--pr`、pipelineだけで画像取得を有効化できるため。

## 2. GitHub固有の画像抽出・取得処理を専用モジュールへ分離する

- **背景**: URL抽出、allowlist、認証済み`gh`取得、Content-Type、magic bytes、サイズ検証はGitHub固有の責務である。
- **検討した選択肢**: `pr.ts`へ直接追加 / shared層へ追加 / `src/infra/github/pr-attachments.ts`へ分離。
- **理由**: provider固有の外部I/OをGitHub infra層に閉じ込め、既存のprovider-neutral formatterやtask層への依存方向を維持できるため。

## 3. 既存のtask attachment保存経路を再利用する

- **背景**: task directory、`order.md`、manifest、symlink検証、run context stagingは既存機構で提供されている。
- **検討した選択肢**: PR専用の直接コピー処理 / 新しい永続化形式 / `saveTaskFile()`と`prepareTaskSpecDirectory()`の再利用。
- **理由**: 保存形式と検証契約を重複させず、PR画像も既存attachmentと同じライフサイクルで扱えるため。

## 4. 画像参照を`[Image #N]`へ置換し、URLを重複排除して順序付き採番する

- **背景**: task本文からローカルattachmentを参照可能にし、同一URLの重複保存やユーザー貼り付け画像との番号衝突を防ぐ必要がある。
- **検討した選択肢**: URLを本文に残す / 出現ごとに採番 / URL単位で重複排除して既存attachment番号空間へ接続。
- **理由**: formatterと既存image attachment storeの参照契約を統一し、PR画像を初期attachmentとして後続画像を`[Image #2]`以降へ続けられるため。

## 5. `add --pr`、通常の`--pr`、pipelineへ同じattachment情報を伝播させる

- **背景**: 画像取得だけでなく、保存・interactive実行・pipeline run contextまで到達しなければ要求を満たさない。
- **検討した選択肢**: `add --pr`だけ対応 / 各入口で個別取得 / 共通のPR取得結果から各終端へ配線。
- **理由**: 同じ`PrReviewData`とattachment契約を共有し、入口ごとの挙動差や配線漏れを防げるため。

## 6. 外部境界を持つ画像取得・pipeline転送テストを統合テストとして分類する

- **背景**: `gh`応答のモックだけでなく、一時ファイル保存やtask specへの実ファイル配置を検証する必要がある。
- **検討した選択肢**: 既存単体テストへ混在 / filesystemモックで隠す / `.integration.test.ts`へ分離。
- **理由**: 実ファイル境界を明示的に統合テストとして扱い、既存のテスト分類契約を維持するため。