問題を、元要件・要求シナリオ・最新裁定・修正関連レポート・品質ゲート・累積差分の6系統に分けて照合します。まず指定された Policy／Knowledge を全文読了し、次に task と Report Directory の正本を特定して、コードと既存の実行証跡だけで最終裁定します。編集やテスト再実行は行いません。
Policy／Knowledge は指定ソースの EOF まで読了しました。適用対象は、契約置換、変更した副作用の後片付け、要求シナリオの実テスト一致、TAKT の unit・軽い IT・重い IT・E2E ゲート、最終差分のスコープ整合です。Provider、RuleEvaluator、UI など今回の要件経路にない項目は非適用として、一般レビューには広げません。
最新時系列は、既存 remediation の修正検証（11:59 頃）より後に、専門レビュー（12:00 頃）と最新裁定（12:06）があります。したがって古い fix-plan の2項目は検証済みの履歴として照合しつつ、現在の peer-review 完了状態は最新裁定の「修正対象なし」を優先します。ここから累積差分、現在コード、4つの要求シナリオの実テスト宣言と assertion、ゲート実行記録を突き合わせます。
要求シナリオ照合で、計画上の4シナリオのうち `N1` と `N2` は入力・assertion が一致しました。一方、`P1` は抽出関数だけを呼び「ダウンロード1件」を観測しておらず、`P2` は Given が通常コメントなのに実テスト入力が PR 本文です。また、安全要件のサイズ上限について、現在コードは `arrayBuffer()` で全応答を読み込んだ後に上限判定しているため、上限がダウンロード時のメモリ消費を制限していません。いずれも最終裁定に直結するため、入口・利用側・テスト証跡まで限定して追加確認しています。
# 最終裁定: 修正が必要

最新裁定の非修正対象2件は再開しません。ただし、元要件と要求シナリオを現在コード・実テストへ直接照合した結果、新たに3件のマージ阻害 family を確認しました。いずれも現在の設計前提のまま局所修正できるため、タスク全体の再計画は不要です。

## マージ阻害 finding

### `FG-PRIMG-REPO-ASSET-URL`

- Authorization basis: `direct_acceptance_criterion_violation`
- 根拠: 元要件は `https://github.com/org/repo/assets/...` を対象例として明示しています。一方、[prReviewImageAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/infra/github/prReviewImageAttachments.ts:58) は repo asset URL を `segments.length === 3 && segments[2] === 'assets'` の場合しか許可しません。`/org/repo/assets/id` は4セグメントなので抽出されません。
- 契約経路: PR本文・コメント・review → URL分類 → 画像参照抽出 → ダウンロード → add/direct/pipeline。
- 原因: repo asset URL のパス構造を末尾のasset識別子なしで判定している。
- 受入条件: `https://github.com/<owner>/<repo>/assets/<id...>` をMarkdown・HTML画像から抽出でき、HTTP・外部ホスト・無関係なGitHub URLは引き続き拒否するテストが成功すること。
- 最小修正境界: URL分類と対応する単体テストのみ。
- 初回証跡になかった理由: 既存テストは `user-attachments/assets` 形式だけを使用し、明示されたrepo asset形式を検証していません。

### `FG-PRIMG-STREAM-SIZE-LIMIT`

- Authorization basis: `direct_acceptance_criterion_violation`
- 根拠: [prReviewImageAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/infra/github/prReviewImageAttachments.ts:294) はContent-Lengthを取得した後、先に `arrayBuffer()` で応答全体をメモリへ読み込み、上限判定はその後の同ファイル344–352行で行います。したがって10 MiB上限は保存可否しか制限せず、ダウンロード時のメモリ消費を制限しません。
- 契約経路: 認証済みfetch → 応答本文読込 → サイズ検証 → magic bytes検証 → 一時保存。
- 原因: 本文全体のバッファ化とサイズ判定の順序が逆で、ストリーム読込中の上限がない。
- 受入条件:
  - 明らかに上限超過したContent-Lengthは本文読込前に拒否する。
  - Content-Length欠落・過少申告でも、ストリームを上限超過時点で停止して拒否する。
  - 途中作成物を清掃する。
  - 上記を、既に全量確保したBufferではなく境界を観測できる決定的テストで確認する。
- 最小修正境界: HTTP本文読込・サイズ検証と統合テスト。
- 初回証跡になかった理由: 現在のサイズ超過テストは、既に確保済みの10 MiB超Bufferが最終的にrejectされることだけを確認しています。

### `FG-PRIMG-REQUIRED-TEST-EVIDENCE`

- Authorization basis: `direct_acceptance_criterion_violation`
- 根拠:
  - `SCN-PRIMG-EXTRACT-P1` は「PR画像を解決し、画像を1件取得する」ことを要求しますが、[prReviewImageAttachments.test.ts](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/__tests__/prReviewImageAttachments.test.ts:29) は抽出関数だけを呼び、ダウンロード済みattachmentを観測していません。
  - `SCN-PRIMG-EXTRACT-P2` のGivenは「通常コメントに異なる2 URL」ですが、同ファイル138行のテスト入力はPR本文です。
  - `PRIMG-PIPELINE` の完了契約はrun contextへstageされたorderと画像の確認を求めますが、[pipelineExecution.test.ts](/Users/nrs/work/git/takt-worktrees/20260812T0804-pr-komento-no-wodaunroodoshite-e794a58a0b13d506/src/__tests__/pipelineExecution.test.ts:56) はtask spec準備・解決をともにモックし、1571行のテストは `taskSpec` と `reportDirName` が定義されたことしか確認していません。
- 原因: コンポーネント単体の成功やモック戻り値の存在を、要求シナリオと結合契約の完了証拠として扱っている。
- 受入条件:
  - P1の同一テストでMarkdown付きPR入力から、置換済み本文と実際のattachment 1件を観測する。
  - P2の通常コメント入力で、2件の異なるplaceholder・ファイル名を観測する。
  - pipelineで実task spec準備・stage処理を通し、order、画像、`taskSpec`と`reportDirName`の整合、cleanupを観測する。
  - 変更テストの対象実行を成功させ、IT分類を変更する場合は分類契約テストも成功させる。
- 最小修正境界: 対象テストと、テスト可能性に不可欠な最小限の依存注入のみ。
- 初回証跡になかった理由: テストレポートはファイル単位の対応を記録していますが、各シナリオの具体的な入力・assertionとの一致を確認していません。

## 閉鎖済み事項

- `AI-NEW-routing-L325`: exit前の明示cleanupと呼出順テストを再確認し、最新裁定どおり反証済み。
- `AI-NEW-imageAttachments-L34`: 形式外placeholderは保存境界で拒否されるため、最新裁定どおり契約外要求。
- 以前のfix-planにある2修正単位はfix-verificationで完了済みで、その後の最新裁定が現在の正本です。

## 品質ゲートと差分

実行証跡上、`npm run build`、`npm run lint`、`npm test`、`npm run test:it`、`npm run test:e2e:mock`、変更対象テストは成功しています。ただし、上記の未検出経路と証拠不一致があるため、広いゲート成功だけではマージ可能と判断できません。

累積差分は15件の既存ファイル変更と5件の新規ファイルで、要求外の削除や互換・migration経路の追加は確認されませんでした。未追跡状態自体は問題として扱っていません。

実GitHub通信は未確認ですが、今回の3件はいずれもリポジトリ内の決定的テストで修正・検証できるため、「実行環境により判定不能」には該当しません。