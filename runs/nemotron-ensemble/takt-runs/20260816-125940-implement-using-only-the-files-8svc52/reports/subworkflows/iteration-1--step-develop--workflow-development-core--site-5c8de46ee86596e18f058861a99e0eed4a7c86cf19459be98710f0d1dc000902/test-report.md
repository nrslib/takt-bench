# テスト作成レポート

## 完了契約-テスト対応表
| 契約ID | 由来 | 観測可能な契約 | 入口/経路 | テスト | 結果 | 未カバー理由 |
|--------|------|----------------|-----------|--------|------|--------------|
| C1 | order.md の対象箇所・安全要件 | GitHub PR本文・通常コメント・レビューコメント中の対象画像記法から、許可されたGitHub添付URLだけを抽出し、Content-Type・magic bytes・サイズを検証してローカル添付へ変換する | CLI → WorkflowEngine → Runner → RuleEvaluator → 次の step | src/__tests__/pr-image-attachments.test.ts: extractImageUrls, validateAndDownloadImage, fetchPrReviewComments with images | 作成 | 実装前のためテスト失敗は想定内 |
| C2 | order.md の3入口指定 | 生成した添付と `[Image #n]` 参照が `takt add --pr`、直接 `takt --pr`、Pipeline `--pr` の各入口から後続処理へ渡る | takt add --pr: src/features/tasks/add/index.ts<br>直接 takt --pr: src/app/cli/routing-inputs.ts, src/app/cli/routing.ts<br>Pipeline --pr: src/features/pipeline/steps.ts, src/features/pipeline/execute.ts | src/__tests__/pr-image-attachments.test.ts: takt add --pr with images, takt --pr with images, pipeline --pr with images | 作成 | 実装前のためテスト失敗は想定内 |
| C3 | order.md の保存形式指定 | `takt add --pr` では既存のタスク添付形式で `.takt/tasks/<slug>/attachments/` と `order.md` に保存される | src/features/tasks/attachments.ts: prepareTaskSpecDirectory, promoteTaskAttachments, buildTaskOrderContent | src/__tests__/pr-image-attachments.test.ts: saveImageAttachments | 作成 | 実装前のためテスト失敗は想定内 |
| C4 | order.md の直接実行・Pipeline要件からの不可欠な導出 | 直接 `takt --pr` では既存のInteractive画像添付経路へ渡され、Pipeline `--pr` では実行用task spec/run contextから参照できる | src/features/tasks/execute/selectAndExecute.ts: selectAndExecute<br>src/features/tasks/execute/taskSpecContext.ts: taskSpecContext | src/__tests__/pr-image-attachments.test.ts: takt --pr with images, pipeline --pr with images | 作成 | 実装前のためテスト失敗は想定内 |
| P1 | 変更対象外の既存コード契約 | 既存の手動画像添付、GitLab PR取得、画像を含まないPR処理、既存のPR整形結果を維持する | 既存のタスク添付仕組み、GitLabプロバイダー、画像を含まないPRの処理フロー | 既存のテストスイート（未変更） | 既存 | 変更対象外のためテスト作成不要 |

## 検証境界（外部境界または環境依存境界を持つ契約のみ）
| 契約ID | モックで確認した範囲 | 実連携範囲 | テスト環境 / HOME / 設定の分離 | 未確認理由 |
|--------|----------------------|------------|--------------------------------|------------|
| C1 | extractImageUrls: 文字列からURL抽出のロジック<br>validateAndDownloadImage: GitHub API呼び出しとレスポンス解析のロジック | GitHub APIへの実際の呼び出し（認証付き・未認証）<br>実際の画像ダウンロードとフォーマット検証 | vi.mock で github API 呼び出しをモック<br>fs モジュールをモックしてファイルシステム操作をシミュレート | 実際のネットワーク通信とGitHub APIのレスポンス形式の変化は未確認 |
| C2 | タスク添付保存とorder.md更新のロジック | 実際のファイルシステムへの書き込みとタスクスペックディレクトリの準備 | fs モジュールをモックしてディレクトリ作成・ファイルコピーをシミュレート | 実際のファイルシステム権限やディスクスペースの制約は未確認 |
| C3 | taskDir 配下のattachmentsディレクトリ作成とファイルコピー、order.md更新 | 実際のファイルシステムへの永続化とタスクスペックの準備 | 一時ディレクトリを使用してファイルシステム操作をシミュレート | 実際のプロジェクトディレクトリ構造と.taktディレクトリの扱いは未確認 |
| C4 | task spec/run contextへの添付情報の受け渡し | 実際のタスク実行時の添付参照とパイプライン実行時の挙動 | task spec context のモックと添付マニフェストの検証をシミュレート | 実際のタスク実行エンジンとパイプラインステップの連携は未確認 |

## 危険分岐・識別テスト
| 契約ID | 分岐 | 失敗させたい誤実装 | 拒否する入力 / 状態とassertion | テスト | 未カバー理由 |
|--------|------|--------------------|--------------------------------|--------|--------------|
| C1 | URL抽出の欠落・不正値 | Markdown画像構文を正しく解析せず、HTML imgタグを抽出できない実装 | 入力: '![alt](url) <img src="url2" />' → 期待: ['url', 'url2']<br>入力: 'no images' → 期待: [] | src/__tests__/pr-image-attachments.test.ts: extractImageUrls | 作成 |
| C1 | Content-Type検証の欠如 | 非画像ファイル（text/plain等）を画像としてダウンロードしてしまう実装 | 入力: 'https://github.com/user-attachments/assets/123/image.png' で content-type:text/plain → エラー: 'Unsupported image type: text/plain' | src/__tests__/pr-image-attachments.test.ts: validateAndDownloadImage (should reject invalid content types) | 作成 |
| C1 | サイズ検証の欠如 | サイズ上限を超える画像をダウンロードしてしまう実装 | 入力: 'https://github.com/user-attachments/assets/123/image.png' で size:10485761 (10MB+1) → エラー: 'Image size exceeds limit' | src/__tests__/pr-image-attachments.test.ts: validateAndDownloadImage (should reject images exceeding size limit) | 作成 |
| C1 | ダウンロード失敗のハンドリング欠如 | ネットワークエラー時例外を適切に投げず、nullや空バッファを返す実装 | 入力: 'https://github.com/user-attachments/assets/123/image.png' で ghコマンドがエラーを投げる → エラー: 'Failed to download image' | src/__tests__/pr-image-attachments.test.ts: validateAndDownloadImage (should handle download failures) | 作成 |
| C2 | 添付保存の欠如 | PRの画像を抽出・ダウンロードしてもタスク添付として保存しない実装 | 状態: PRに画像あり → アサーション: taskDir/attachments/ ディレクトリが作成され、画像ファイルがコピーされ、order.mdに追記されること | src/__tests__/pr-image-attachments.test.ts: takt add --pr with images, takt --pr with images, pipeline --pr with images | 作成 |
| C3 | order.md更新の欠如 | 添付ファイルは保存されるがorder.mdに追記しない実装 | 状態: 添付保存後 → アサーション: order.mdに '## 添付画像' セクションと '[Image #n]: `attachments/image-n.png`' 行が存在すること | src/__tests__/pr-image-attachments.test.ts: saveImageAttachments (should save attachments and update order.md) | 作成 |
| C4 | 添付情報のコンテキスト伝搬欠如 | task spec/run contextに添付情報が含まれず、パイプライン実行時に参照できない実装 | 状態: takt --prまたはpipeline --pr実行後 → アサーション: task spec contextに添付マニフェストが含まれ、実行時に添付を参照できること | src/__tests__/pr-image-attachments.test.ts: takt --pr with images, pipeline --pr with images | 作成 |

## 影響経路テスト（該当する契約のみ）
| 契約ID | 経路 | 生成側 | 消費側 | 保証する契約 | テスト | 未カバー理由 |
|--------|------|----------|----------|--------------|--------|--------------|
| C1 | PR本文・コメント・レビュー → URL抽出 → バリデーション・ダウンロード → TaskAttachment[] へ変換 | fetchPrReviewComments (GitHub PR取得)<br>extractImageUrls (URL抽出)<br>validateAndDownloadImage (バリデーション・ダウンロード) | saveTaskFile / prepareTaskSpecDirectory (タスク添付保存) | 添付ファイルが正しく保存され、order.mdに追記されること | src/__tests__/pr-image-attachments.test.ts: fetchPrReviewComments with images → validateAndDownloadImage → saveImageAttachments | 作成 |
| C2 | TaskAttachment[] → task spec/run context → 後続処理（タスク実行・パイプライン実行） | saveTaskFile / prepareTaskSpecDirectory (添付保存)<br>promoteTaskAttachments (タスクスペックディレクトリ準備) | タスク実行エンジン<br>パイプライン実行エンジン | 添付ファイルがタスク実行時に参照でき、パイプライン実行時に参照できること | src/__tests__/pr-image-attachments.test.ts: saveImageAttachments → takt add --pr with images / takt --pr with images / pipeline --pr with images | 作成 |
| C3 | TaskAttachment[] → .takt/tasks/<slug>/attachments/ への保存 → order.md 追記 | promoteTaskAttachments (ファイルコピー)<br>buildTaskOrderContent (order.md生成) | タスク管理システム<br>タスク表示・参照機能 | 添付ファイルが指定ディレクトリに保存され、order.mdに相対パスで参照されること | src/__tests__/pr-image-attachments.test.ts: saveImageAttachments | 作成 |
| C4 | task spec/run context → タスク実行・パイプライン実行での添付参照 | taskSpecContext (タスクスペック準備)<br>selectAndExecute (タスク実行) | タスク実行エンジン<br>パイプライン実行エンジン | 添付ファイルがタスク実行時のワークディレクトリに存在し、参照できること | src/__tests__/pr-image-attachments.test.ts: takt --pr with images, pipeline --pr with images | 作成 |

## 連続実行・所有権・並行性（該当する場合）
| 契約ID | 実行シーケンスまたは交差 | 実際の上位入口 | 観測する不変条件 | テスト | 未カバー理由 |
|--------|--------------------------|----------------|------------------|--------|--------------|
| C1-C4 | PR取得 → 画像抽出・ダウンロード → 添付保存 → order.md更新 → タスク実行・パイプライン実行 | takt add --pr <number><br>takt --pr <number><br>pipeline --pr <number> | 添付ファイルがタスクライフサイクル全体で保持され、実行環境で利用可能であること | src/__tests__/pr-image-attachments.test.ts: 全てのシナリオテスト | 作成 |

## 否定契約
| 契約ID | 禁止する挙動 | 観測方法 | テスト | 未カバー理由 |
|--------|----------------|----------|--------|--------------|
| C1 | 非GitHub添付URLのダウンロード許可 | GitHub添付URL以外（例: 外部ドメイン）を指定した際のエラー発生 | 入力: 'https://example.com/image.png' → エラー: 'Only GitHub attachment URLs are allowed' | src/__tests__/pr-image-attachments.test.ts: validateAndDownloadImage (should reject non-GitHub attachment URLs) | 作成 |
| C1 | サイズ制限無視での巨大画像ダウンロード | サイズ上限（10MB）を超える画像を指定した際のエラー発生 | 入力: サイズ>10MB の画像URL → エラー: 'Image size exceeds limit' | src/__tests__/pr-image-attachments.test.ts: validateAndDownloadImage (should reject images exceeding size limit) | 作成 |
| C1 | サポート外フォーマットのダウンロード許可 | サポート外フォーマット（text/plain等）を指定した際のエラー発生 | 入力: content-type:text/plain の画像URL → エラー: 'Unsupported image type: text/plain' | src/__tests__/pr-image-attachments.test.ts: validateAndDownloadImage (should reject invalid content types) | 作成 |
| C2 | 既存の手動添付・GitLab PR・画像なしPRの動作変更 | 既存の動作が変わっていないことを確認 | 既存のテストスイートがパスすること | 既存のテストスイート（未変更） | 変更対象外のためテスト作成不要 |

## 作成テスト
| ファイル | 種別 | テスト数 | 概要 |
|---------|------|---------|------|
| src/__tests__/pr-image-attachments.test.ts | 単体テスト | 24 | PR画像抽出・バリデーション・ダウンロード・添付保存・3つの入口（takt add --pr、takt --pr、pipeline --pr）での統合動作をテスト |

## 未カバー項目
| 要件/分岐 | 未カバー理由 | 後続で必要な確認 |
|-----------|--------------|------------------|
| 実際のGitHub API認証フロー | テストではghコマンドのモックを使用し、実際の認証トークンの扱いは確認していない | 実装後に実際の認証が必要なシナリオでテスト |
| 実際のファイルシステムでの権限エラー | テストではfsモジュールをモックしており、実際の権限エラーはシミュレートしていない | 実装後にファイルシステム権限エラーのハンドリングをテスト |
| 並行実行時の添付保存競合 | テストでは逐次実行を前提としており、同時に同じタスクに複数のプロセスが添付を保存するシナリオはカバーしていない | 実装後にロック機構や競合回避の必要性を検討 |
| 領域外のURL（GitHub添付URL以外）からのダウンロード試行 | テストではエラーになることを確認しているが、実際のネットワークタイムアウトやDNSエラーはカバーしていない | 実装後にネットワークエラーのハンドリングをテスト |

## 実行結果（参考）
実装前のためテスト失敗・import エラーは想定内。

| 状態 | 件数 | 備考 |
|------|------|------|
| Pass | 0 | 実装前のため全テスト未パス（想定内） |
| Fail / Import Error（想定内） | 24 | 未実装モジュール起因（抽出・ダウンロード・保存ロジックが未実装） |
| Error（要対応） | 0 | なし |

## 備考（判断がある場合のみ）
- テストは実装前に作成するため、実装後の成功を前提として設計している
- モックの粒度を調整し、外部依存（GitHub API、ファイルシステム）を適切に分離している
- 既存のタスク添付仕組みを変更しないことを前提とし、拡張点のみをテスト対象としている
- 画像プレースホルダーの置換処理（[Image #n] への変換）は、既存の normalizeTaskAttachmentReferences 関数を利用するため、テストでは間接的にカバーしている
</test>