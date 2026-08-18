# テストレビュー

## 結果: REJECT

## サマリー

再測定ロジックの主要分岐は検証されていますが、production attempt の `cwd`・隔離環境・cleanup がテストダブルの外に残っています。新設された境界に永続的な回帰テストがないため、1件を指摘します。

## 確認した観点

| 観点 | 結果 | 備考 |
|------|------|------|
| テストカバレッジ | ❌ | production attempt の環境伝播・cleanupが未検証 |
| テスト構造（Given-When-Then） | ✅ | Arrange-Act-Assertが明確 |
| テスト命名 | ✅ | 条件と期待結果を判別可能 |
| テスト独立性・再現性 | ✅ | runner unitは決定的なtest doubleを使用 |
| モック・フィクスチャ | ❌ | `runAttempt`の差し替えにより本番境界を通らない |
| テスト戦略（ユニット/統合/E2E） | ❌ | 新しいprocess・filesystem境界に対応する回帰ITがない |
| 契約入力位置（body/query/path） | ✅ | 今回のrunner変更には非適用。PR画像URLのpath契約は既存テストで確認済み |

## 問題系列の完了走査

| family_tag / 変更契約 | 不変条件・根本原因 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|-------------------|------------------|----------------------|------------------------------------------|----------------------------|------------|------|
| `e2e-runner-attempt-boundary` | 各attemptが専用cwd・HOME・XDG・TMPDIRを受け、成功・失敗後にcleanupされる | `scripts/run-e2e-mock-shards.mjs:138-157`、`scripts/teed-command.mjs:14-19` | `runCli()`から`runShardAttempt()`、`runTeedCommand()`へ伝播 | 初回並列、限定noise再測定、通常失敗、signal、起動失敗の終了判定は確認済み | `e2eMockRunner.test.ts`は全ケースで`runAttempt`を差し替え。`it-teed-command.test.ts`は第3引数を未使用 | production attemptの環境伝播と成功・起動失敗後のcleanup | `TEST-NEW-e2e-runner-attempt-boundary-L31` |
| `pr-image-markdown-ast` | Markdown画像だけを処理し、リテラルを保持して参照形式を解決する | `prReviewAttachments.test.ts` | PR本文の置換とattachment生成 | raw HTML、参照形式、download失敗を確認 | 外部download/storeのみを差し替え | 実private GitHub通信 | 問題なし |
| `image-index-allocation` | 無関係なURL・通常ファイルを予約せず、実添付パスとplaceholderだけを予約する | `imageAttachmentReferences.test.ts` | 共通allocatorの採番結果を確認 | 許可側と除外側を同一ケースで確認 | モック不使用 | なし | 問題なし |

## 今回の指摘（new）

| # | finding_id | family_tag | カテゴリ | 場所 | 問題 | 修正案 |
|---|------------|------------|---------|------|------|--------|
| 1 | `TEST-NEW-e2e-runner-attempt-boundary-L31` | `e2e-runner-attempt-boundary` | カバレッジ・テスト戦略 | `src/__tests__/e2eMockRunner.test.ts:49-181`、`src/__tests__/it-teed-command.test.ts:31-84` | runner unitは`runAttempt`を常に差し替えるため、実際の`runShardAttempt()`が設定する`cwd`・隔離HOME/XDG/TMPDIR・cleanupを通らない。既存teed-commandテストも新設された第3引数を使用しておらず、修正レポートの「cwd・env伝播をrunnerテストで検証済み」という証跡と一致しない | `runTeedCommand()`へ一時cwdと専用envを渡し、子processから両方を観測するheavy ITを追加する。さらにproduction attemptについて、初回・再測定で個別の隔離環境が使われ、成功時と代表的な起動失敗時の双方で一時ディレクトリがcleanupされることを検証する |

## 継続指摘（persists）

なし。

## 解消済み（resolved）

なし。

## 再開指摘（reopened）

なし。

## 検証証跡

- ビルド: 独立した`npm run build`は未実行。対象テストに先行するTypeScript型契約検査は成功
- テスト: `e2eMockRunner.test.ts` 7件、`it-teed-command.test.ts` 4件、`prReviewAttachments.test.ts` 33件、`imageAttachmentReferences.test.ts` 8件が成功
- 動作確認: 再測定順序、再測定失敗、通常失敗、別エラー、CI、signal、起動失敗の非救済を確認。production attemptがtest doubleにより未到達であることを実コードとテスト参照から確認

## 未確認範囲

| 項目 | 理由 | 判定への影響 |
|------|------|--------------|
| production attemptの隔離環境・cleanup | 対象テストが`runAttempt`を差し替え、既存process ITも新しいoptionsを使用しない | REJECT理由 |
| 実private GitHub repositoryからの画像取得 | 外部資格情報とGitHubサービスが必要。URL・形式・サイズ境界は決定的テストで確認済み | 単独ではAPPROVE可 |