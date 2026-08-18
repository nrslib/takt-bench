## coding-review
## コードレビュー報告

### 変更契約の特定
PRコメント内の画像を抽出し、ローカルの `attachments/` に保存して `order.md` に追記する機能の実装。

- **Producer**: `src/infra/github/pr.ts` (および `gitlab/pr.ts`) が `PrReviewData` として画像URL一覧を抽出。
- **Downloader**: `src/infra/github/image-downloader.ts` が GitHub API を使用してバリデーションとダウンロードを実行。
- **Persist/Transform**: `src/features/tasks/attachments.ts` および `src/features/tasks/add/index.ts` が一時ファイルから `.takt/tasks/<slug>/attachments/` へのコピーと `order.md` の更新を行う。
- **Consumer**: `takt add --pr` および `takt --pr` (pipeline) 実行時のタスク定義ファイル。

---

### 指摘事項

#### 1. 重大なバグ: 一時ファイルのパス不整合とクリーンアップ欠如
`src/features/pipeline/steps.ts:236` および `src/features/tasks/add/index.ts:213` において、画像を `/tmp/image-n.png` に保存していますが、このパスは実行環境（OS）に依存し、かつ **クリーンアップ処理が実装されていません**。また、複数のタスクを並列または連続して実行した場合にファイル名が衝突します。

- **影響**: `/tmp` ディレクトリに不要なファイルが蓄積し続け、同一ファイル名の画像がある場合に上書きされるリスクがあります。
- **修正方針**: `node:os.tmpdir()` と `node:crypto.randomUUID()` 等を使用してユニークな一時ディレクトリ/ファイルを作成し、処理完了後に `fs.rmSync` 等で削除してください。

#### 2. 実装漏れ: GitLab 画像ダウンロードの未実装
`src/infra/gitlab/pr.ts:240-255` で画像URLの抽出は行われていますが、**ダウンロード処理への接続が実装されていません**。`validateAndDownloadImage` は `src/infra/github/image-downloader.ts` にあり、実装内でも GitHub 専用の URL プレフィックスチェック (`GITHUB_ATTACHMENT_URL_PREFIX`) が行われています。

- **影響**: GitLab の PR/MR を使用した場合、画像URLは抽出されるが、実際のファイル保存と `order.md` への追記が行われません。
- **修正方針**: GitLab 用のダウンローダーを実装するか、`image-downloader.ts` をプロバイダー抽象化し、GitLab の URL 形式および認証方式に対応させてください。

#### 3. 信頼境界の不備: `/tmp` への直接書き込み
`src/features/pipeline/steps.ts:237` 等で `/tmp/` に直接 `writeFileSync` していますが、これは権限エラーやセキュリティ上のリスク（シンボリックリンク攻撃など）を孕んでいます。

- **影響**: 実行環境によっては書き込み権限がなくクラッシュします。
- **修正方針**: 標準的な一時ファイル作成 API (`fs.mkdtemp` など) を使用してください。

#### 4. テスト不足: 境界条件の検証欠如
`src/__tests__/pr-image-attachments.test.ts` (ファイルは存在するが内容未確認) において、以下のケースの検証が必要です。
- 最大サイズ上限 (10MB) を超えた場合の拒絶。
- サポート外の Content-Type の拒絶。
- 認証が必要な Private リポジトリ画像へのアクセス失敗時の挙動。
- `gh` CLI がインストールされていない環境でのフォールバック。

---

### 判定
**REJECT**

画像ダウンロードのライフサイクル管理（一時ファイルの衝突・消去）に重大な欠陥があり、かつ GitLab 側での実効性が担保されていないため。

---

## ai-antipattern-review
AI生成コード特有のアンチパターンおよび設計上の問題点をレビューしました。

### Finding 1: インフラ層の密結合と不整合 (AI Antipattern: Context Misalignment / Hallucination of Boundary)
`src/infra/gitlab/pr.ts:11` において、GitLab の実装ファイルが GitHub 専用と思われる `src/infra/github/image-extraction.ts` を直接参照しています。
- **問題**: AI が「画像抽出ロジックは共通である」と仮定し、パスを適当に指定して実装した典型的なパターンです。
- **影響**: `infra/github` は `infra/gitlab` から独立しているべきであり、共通ロジックは `src/infra/git/` または `src/shared/` に配置されるべきです。現状の構造では GitLab プロバイダーが GitHub 内部実装に依存する不自然な依存関係になっています。

### Finding 2: 非決定的な一時ファイルパスの利用 (AI Antipattern: Oversimplified Environment Assumption)
`src/features/pipeline/steps.ts:234` および `src/features/tasks/add/index.ts:205` で `/tmp/${fileName}` という固定パスを使用しています。
- **問題**: AI が「`/tmp` が常に利用可能で、ファイル名が衝突しない」という単純な仮定に基づいた実装を生成しています。
- **影響**: 同一ファイル名の画像がある場合や、並行実行時に競合が発生し、データが上書きされるリスクがあります。`node:os.tmpdir()` や `fs.mkdtemp` を使用した安全な一時ディレクトリの作成が欠落しています。

### Finding 3: 同期 I/O によるイベントループのブロッキング (AI Antipattern: Performance Ignorance)
`src/features/pipeline/steps.ts:235` および `src/features/tasks/add/index.ts:206` で `fs.writeFileSync` を、`src/features/tasks/attachments.ts:317, 321, 340` 等で `fs.mkdirSync`, `fs.copyFileSync`, `fs.writeFileSync` を多用しています。
- **問題**: ネットワーク I/O (`validateAndDownloadImage`) と混在するコンテキストで、大きな画像ファイルの書き込みを同期的に行っています。
- **影響**: 画像サイズが最大 10MB と定義されているため、複数ファイルの処理時にメインスレッドをブロッキングし、CLI の応答性が低下します。`fs.promises` による非同期処理への移行が推奨されます。

### Finding 4: エラーハンドリングの不十分な抽象化 (AI Antipattern: Generic Fallback Abuse)
`src/features/pipeline/steps.ts:240` において、画像ダウンロード失敗時に `console.warn` でログを出して `null` を返し、後で `filter` する実装になっています。
- **問題**: どのような理由で失敗したか（認証エラー、サイズ超過、404など）を切り分けてユーザーに通知せず、単に「無視して進む」という AI 特有の「とりあえず動く」フォールバック処理になっています。
- **影響**: ユーザーはなぜ画像が保存されなかったのかを把握できず、デバッグが困難になります。

---

## architecture-review
レビューの結果、設計および構造上の重大な問題が1件検出されました。

### 検出された問題

#### 1. `pipeline` 実行時の画像ダウンロード処理の重複実装（DRY違反）
`src/features/pipeline/steps.ts` の `resolveTaskContent` 関数（228-251行目）に、`src/features/tasks/add/index.ts` の `addTask` 関数（201-232行目）とほぼ同一の画像ダウンロードロジックがコピーされて実装されています。

- **問題点**: 
    - `validateAndDownloadImage` の呼び出し、ファイル名の生成、`/tmp/` への保存、`TaskAttachment` オブジェクトの構築という一連のフローが2箇所に重複しています。
    - 特に `/tmp/${fileName}` というハードコードされた一時パスの生成ロジックが共通化されておらず、将来的なパス変更やクリーンアップ処理の導入時に不整合が発生するリスクがあります。
    - `pipeline` 側では `console.warn` を使用しているのに対し、`addTask` 側では `log.warn` を使用しており、ログ出力の一貫性も欠けています。
- **影響**: メンテナンス性の低下および、一方の修正が他方に波及しないことによる潜在的なバグの発生。
- **修正案**: 画像の抽出からダウンロード、`TaskAttachment` への変換までを担う専用のサービスまたはヘルパー関数（例: `src/features/tasks/attachments.ts` への集約）を導入し、両方のエントリーポイントから呼び出す構造に変更してください。

### 判定
**REJECT**

上記の重複実装は、単なるコードの類似ではなく「GitHubから画像をダウンロードして TaskAttachment として管理する」という同一のドメイン操作（契約）を異なる場所に再構成しているため、アーキテクチャ上の不備として差し戻します。

---

## security-review
この変更におけるセキュリティ上の懸念をレビューしました。

### 信頼境界と影響経路の分析

今回の変更は、PR/MRのコメントから画像URLを抽出し、ローカルにダウンロードしてタスク添付ファイルとして保存する機能の追加です。

**1. 外部入力の信頼境界**
- **入力源**: GitHub/GitLab の PR/MR 本文およびコメント。これらはユーザーが制御可能な外部入力です。
- **制御主体**: PR/MR の投稿者。
- **影響経路**: `extractImageUrls` (抽出) $\rightarrow$ `validateAndDownloadImage` (検証・ダウンロード) $\rightarrow$ `fs.writeFileSync` (一時保存) $\rightarrow$ `promoteTaskAttachments` (最終保存)。

**2. 脆弱性の検証**

- **SSRF (Server-Side Request Forgery)**:
  - `src/infra/github/image-downloader.ts:19` にて、URL が `https://github.com/user-attachments/assets/` で始まることを厳格にチェックしています。
  - これにより、任意の内部URLや外部URLへのリクエストは拒否され、SSRF のリスクは排除されています。
  - ただし、GitLab 側 (`src/infra/gitlab/pr.ts`) では `extractImageUrls` で URL を抽出して `images` リストに含めていますが、ダウンロード処理は `addTask` (`src/features/tasks/add/index.ts`) 内で `validateAndDownloadImage` (GitHub専用のプリフィックスチェックあり) を呼び出しているため、GitLab の画像 URL はすべて拒否されます。これは機能不足（GitLab画像が保存されない）であり、セキュリティ上の脆弱性（不正なURLの保存）ではありません。

- **任意ファイル書き込み / パストラバーサル**:
  - `src/features/tasks/add/index.ts:213` にて、一時ファイルパスを `/tmp/${fileName}` としており、`fileName` は `image-${index + 1}.${fileExtension}` という形式で生成されています。
  - `fileExtension` は `imageUrl.split('.').pop()` で取得されていますが、`/tmp/` 配下への書き込みであり、かつファイル名にインデックスが含まれているため、パストラバーサルによるシステムファイルの破壊リスクは極めて低いです。
  - 最終的な保存先は `promoteTaskAttachments` (`src/features/tasks/attachments.ts:98`) により、`taskDir/attachments/` 配下に `fileName` で保存されます。ここでも `fileName` の形式が制御されており、安全です。

- **DoS (Resource Exhaustion)**:
  - `src/infra/github/image-downloader.ts:8` にて、`MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024` (10MB) の制限が設けられており、メモリやディスクの枯渇を防いでいます。
  - `gh api` 経由でメタデータを先に確認し、サイズチェックを行う実装になっており、効率的かつ安全です。

- **Command Injection**:
  - `execFileSync` を使用しており、引数を配列で渡しているため、シェル経由のコマンド注入は発生しません。

### 判定
**APPROVE**

信頼境界（外部URL $\rightarrow$ ローカルファイル）に対する検証（プリフィックスチェック、サイズ制限、Content-Type検証）が適切に実装されており、現実的な攻撃経路は見当たりません。

---

## testing-review
レビュー結果を報告します。

### テスト品質レビュー報告

#### 1. テストカバレッジと妥当性の評価
実装された機能（PRコメントからの画像抽出・ダウンロード・保存）に対し、`src/__tests__/pr-image-attachments.test.ts` で広範なテストが実施されており、主要な成功/失敗パスはカバーされています。

- **画像抽出 (`extractImageUrls`)**: 境界値（画像なし、複数形式混在）を `it.each` で網羅しており、正規表現の妥当性が検証されています。
- **ダウンロード (`validateAndDownloadImage`)**: 
    - 成功系（認証あり、GitHub URL）
    - 拒否系（外部URL、未サポート形式、サイズ制限超過）
    - 異常系（ネットワークエラー）
    が網羅されており、安全要件（GitHub URL限定、サイズ上限）がコードとテストの両面で保証されています。
- **保存 (`saveImageAttachments`)**: 
    - 添付ファイルの配置と `order.md` への追記
    - 添付ファイルがない場合の非破壊性
    - 上書き禁止制約（`already exists`）
    が検証されており、ファイルシステム操作の正当性が確認されています。
- **統合経路**: `takt add --pr`、`takt --pr`、`pipeline --pr` の各エントリポイントから画像保存までがモックを用いて検証されており、配線漏れがないことが確認されました。

#### 2. 指摘事項（Finding）
特になし。

#### 3. 判定
**PASS**
テストコードは構造的（Given-When-Then）であり、命名も明確です。要求された安全制約（Content-Type、サイズ上限、GitHub URL限定）および機能要件（PR本文/コメント/スレッドからの抽出）が、十分なテストケースによって担保されています。