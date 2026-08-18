問題は、mock E2E の4シャード実行後に限定的な bare `onTaskUpdate` RPC timeout だけを1回再測定し、正式コマンドを終了コード0まで通すことです。まず `coding` スキルを適用し、指定された正本・ポリシー・直近レポート・現行コードを照合してから、計画どおり3ファイルに限定して実装と検証を進めます。
指定された正本群の読了を進めています。現時点では、変更対象の責務境界は計画と矛盾せず、既存の birpc 判定を複製せず再利用する方針が適用対象です。これから直近レポートと実コードで、再測定条件・環境隔離・終了状態の実在経路を確認します。
照合の結果、根本原因・責務・実行経路は確定計画と一致しています。実装は、`runTeedCommand` に明示的な `cwd`/`env` 伝播口を追加し、mock E2E runner で各 attempt の隔離環境作成・cleanup・出力収集・限定再測定を所有させます。CI、signal、起動失敗、通常失敗は救済しません。
Companion に新しい `must_fix` が1件追加されました。これは今回の runner 変更とは別ですが、元タスクの添付 index 契約に直接属するため、指示どおり現在コードで独立検証します。妥当なら最小の正規表現境界修正と反例テストを先に閉じ、その後 runner の対象テストへ進みます。
実装と対象テストは完了しました。新規 runner テスト7件、添付 index 反例を含む参照テスト8件、既存 teed-command 重いIT 4件、分類契約19件がすべて成功しています。ここから必須ゲートを順番に実行し、最後に正式な4シャード mock E2E の終了コードを確認します。
必須ゲートは build、lint、全unit、light IT まで成功しています。正式 mock E2E は現在4シャードが進行中で、開始ログだけでは判定せず、全シャードの完了と最終終了コードまで待っています。
正式 mock E2E は、初回 shard 2 で計画どおり bare `onTaskUpdate` timeout を検出し、他の全初回シャード完了後に shard 2 だけを同一構成で1回再測定しました。再測定は28件すべて成功し、正式コマンド全体も終了コード0です。これから差分自体の未使用・依存方向・責務重複を機械走査し、4つの最終JSONと Companion 最終状態を確認します。
## 作業結果

- 修正完了

## 変更内容と受入条件

- [teed-command.mjs](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/scripts/teed-command.mjs:14)
  - 出力転送・収集・終了状態を維持し、`cwd` と `env` を明示的に渡せるよう拡張。
- [run-e2e-mock-shards.mjs](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/scripts/run-e2e-mock-shards.mjs:199)
  - 初回4シャードを並列実行。
  - 全初回完了後、ローカルの限定的 birpc noise のみ1回再測定。
  - CI、通常失敗、別エラー、signal、起動失敗、再測定失敗は失敗を維持。
  - 各attemptで隔離環境を作成・cleanup。
- [e2eMockRunner.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/e2eMockRunner.test.ts:50)
  - 再測定順序、最大1回、同一spec・引数、成功・再失敗・通常失敗・別エラー・CI・signal・起動失敗を検証。
- Companion `must_fix` 追加指摘も修正。
  - [imageAttachmentReferences.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/shared/utils/imageAttachmentReferences.ts:6)で、index予約を `[Image #N]` と `attachments/image-N.ext` に限定。
  - 外部URLや通常ファイル名を誤認しない反例を追加。

## 検証結果と証拠

- `npm run build`: 成功
- `npm run lint`: 成功
- `npm test`: 4シャードすべて成功
- `HOME=/tmp/takt-bench-v3-home npm run test:it`: 159ファイル・2358件成功
- `npm run test:e2e:mock`: 終了コード0
  - 初回 shard 2 の限定timeoutを検出
  - 全初回シャード完了後、shard 2のみ再測定
  - 再測定は28件成功
  - 最終JSONは全4シャード `success: true`、失敗テスト0件
- 対象テスト:
  - runner: 7件成功
  - attachment reference: 8件成功
  - teed-command重いIT: 4件成功
  - image attachment store: 20件成功
  - PR attachment: 33件成功
  - 分類契約: 19件成功
- `git diff --check`: 成功
- 隔離用一時ディレクトリ残存: なし
- セルフスキャン: 未使用コード・逆方向依存・重複したbirpc分類なし。既存分類正本を共有。
- Companionの追加指摘はコードと反例テストで解消済みですが、受信箱の最新エンジン状態はまだ `unresolved` のままです。