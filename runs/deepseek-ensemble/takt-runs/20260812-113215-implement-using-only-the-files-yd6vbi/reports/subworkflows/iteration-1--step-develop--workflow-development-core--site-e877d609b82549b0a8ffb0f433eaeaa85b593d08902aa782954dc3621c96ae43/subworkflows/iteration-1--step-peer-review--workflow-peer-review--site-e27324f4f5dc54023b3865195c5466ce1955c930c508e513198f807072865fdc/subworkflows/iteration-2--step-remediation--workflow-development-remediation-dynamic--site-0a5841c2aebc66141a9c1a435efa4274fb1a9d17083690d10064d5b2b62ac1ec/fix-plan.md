# 修正計画

## 結果: 修正計画確定

## 指摘カバレッジ
| finding ID / 出典 | 修正権限の根拠 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 分類 | 受入条件・修正境界 |
|-------------------|----------------|------|----------------------|-----------------------------|------|----------------------|
| FINAL-NEW-PRIMG-REPO-ASSET-URL | direct_acceptance_criterion_violation | prReviewImageAttachments.ts:58-62 | UNIT-URL-CLASSIFY | `/owner/repo/assets/<id>`形式を抽出不可 → セグメント数3固定判定 → URL構造のバリエーション未考慮 | 構造 | `https://github.com/<owner>/<repo>/assets/<id...>`を抽出可能にし、外部ホスト・無関係URLは拒否。URL分類と単体テストのみ。 |
| FINAL-NEW-PRIMG-STREAM-SIZE-LIMIT | direct_acceptance_criterion_violation | prReviewImageAttachments.ts:294-314 | UNIT-SIZE-LIMIT | 応答全体をメモリ保持後に判定 → `arrayBuffer()`による全読込 → ストリーム制限読込の未実装 | 構造 | `MAX_IMAGE_BYTES`超過時に読込を即座に停止。HTTP本文の制限付き読込と統合テストのみ。 |
| FINAL-NEW-PRIMG-REQUIRED-TEST-EVIDENCE | direct_acceptance_criterion_violation | plan.md, tests | UNIT-TEST-EVIDENCE | シナリオの Given/When/Then と実テストが不一致 → 局所的な関数検証に留まる → エンドツーエンドな振る舞い検証の欠如 | 局所 | P1(置換本文+添付1件)、P2(通常コメント2URLから一意な識別子)、pipeline(実ファイル作成・削除)を観測。最小限の依存注入のみ。 |

## 欠陥 family の最終状態
| 修正単位 | 契約の正本 | 完了対象の全不変条件 | 変更後の責務・正本 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|----------|------------|----------------------|--------------------|--------------------|--------------------------|----------------|
| UNIT-URL-CLASSIFY | 要求シナリオP1/P2 | GitHubアセットURLの特定形式を漏れなく抽出し、外部URLを拒否する | 変更なし | PR本文・コメント・review → URL分類 → 抽出 | SCN-URL-P1, SCN-URL-N1 | なし |
| UNIT-SIZE-LIMIT | 要求仕様 (MAX_IMAGE_BYTES) | メモリへの全展開前にサイズ上限を検知し、即座に停止・清掃する | 変更なし | 認証済みfetch → ストリーム読込(制限付) → MIME/magic検証 → 一時保存 | SCN-SIZE-P1, SCN-SIZE-N1 | なし |
| UNIT-TEST-EVIDENCE | 要求シナリオ P1, P2, Pipeline | シナリオで定義された入力から期待される成果物(置換本文, ファイル)が正しく生成・破棄される | 変更なし | 抽出・取得 $\rightarrow$ attachment生成 $\rightarrow$ task spec $\rightarrow$ executeTask | SCN-TEST-P1, SCN-TEST-P2, SCN-PIPE-P1 | なし |

## 要求シナリオ（条件付き）

Scenario: [SCN-URL-P1] リポジトリアセットURLの抽出
  Given `https://github.com/owner/repo/assets/abc123` を含むPR本文
  When `extractPrReviewImageReferences` を実行
  Then `references` に当該URLが含まれ、本文が `[Image #1]` に置換される

Scenario: [SCN-URL-N1] 形式外GitHubURLの拒否
  Given `https://github.com/owner/repo/issues/123` を含むPR本文
  When `extractPrReviewImageReferences` を実行
  Then `references` が空であり、本文が置換されず維持される

Scenario: [SCN-SIZE-P1] 正常サイズの画像読込
  Given `MAX_IMAGE_BYTES` 未満のボディを返すレスポンス
  When `fetchImageWithRedirects` を実行
  Then 全データが正常に読込られ `Buffer` として返却される

Scenario: [SCN-SIZE-N1] 容量超過時の即時停止
  Given `MAX_IMAGE_BYTES` を超えるストリームボディを返すレスポンス
  When `fetchImageWithRedirects` を実行
  Then 全データを読み切る前に上限超過エラーが投げられ、読込が停止する

Scenario: [SCN-TEST-P1] シナリオP1の完遂
  Given `![shot](https://github.com/user-attachments/assets/abc)` を含むPR本文
  When `resolvePrReviewImageAttachments` を実行
  Then 置換後の本文に `[Image #1]` があり、かつ `attachments` に1件の有効な一時ファイルパスが含まれる

Scenario: [SCN-TEST-P2] シナリオP2の識別子一意性
  Given 異なる2つのGitHubアセットURLを含む通常コメント
  When `resolvePrReviewImageAttachments` を実行
  Then `[Image #1]` と `[Image #2]` の異なる2つの placeholder と、それぞれ異なるファイル名が生成される

Scenario: [SCN-PIPE-P1] Pipeline結合フローの観測
  Given 画像を含むPRから生成された task spec
  When `executeTask` を含む pipeline 実行フローを走らせる
  Then 一時的に画像ファイルが作成され、処理完了後に `cleanup` により物理ファイルが削除される

## 実施順序
| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|------|----------|------|--------|----------|----------------|
| 1 | UNIT-URL-CLASSIFY | 局所修正 | なし | src/infra/github/prReviewImageAttachments.ts:45-63 | `https://github.com/owner/repo/assets/id` が抽出され、テストがパスすること |
| 2 | UNIT-SIZE-LIMIT | 局所修正 | 1 | src/infra/github/prReviewImageAttachments.ts:264-314 | 巨大レスポンス時に `MAX_IMAGE_BYTES` 違反で即座に reject される統合テストの成功 |
| 3 | UNIT-TEST-EVIDENCE | 局所修正 | 2 | src/__tests__/prReviewImageAttachments.test.ts, src/__tests__/core/pipelineExecution.test.ts | SCN-TEST-P1/P2 および SCN-PIPE-P1 の assertion がすべて成功すること |

## 制約適合性
| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 | 品質ゲート |
|----------|--------------|--------------------------|-----------------------------|----------|--------------|
| UNIT-URL-CLASSIFY | 要求シナリオ | パスセグメントのインデックス指定ではなく、`assets` セグメントの存在確認に基づいた判定を採用。 | `prReviewImageAttachments.test.ts` にリポジトリアセットURLの正例/負例を追加。 | 指定形式を網羅しつつ、外部URLを拒否する最小限の変更であるため。 | `npm test` |
| UNIT-SIZE-LIMIT | 要求仕様, Coding Policy | `response.body` (ReadableStream) を `for await` 等で消費しながらカウントする。 `arrayBuffer()` へのフォールバックを廃止。 | Mock fetch を用いた統合テストで、メモリ消費量に関わらず上限で停止することを観測。 | Fail Fast 原則に従い、不正なサイズを早期に検出しメモリを保護するため。 | `npm run test:it` |
| UNIT-TEST-EVIDENCE | 要求シナリオ | モックを最小限にし、`resolvePrReviewImageAttachments` から `executeTask` までのデータフローを実ファイルパスで追跡する。 | `fs.existsSync` による一時ファイルの生存期間 (作成 $\rightarrow$ 削除) の検証。 | 要求シナリオの "Then" (観測点) を直接的に検証する唯一の方法であるため。 | `npm run test:it` |