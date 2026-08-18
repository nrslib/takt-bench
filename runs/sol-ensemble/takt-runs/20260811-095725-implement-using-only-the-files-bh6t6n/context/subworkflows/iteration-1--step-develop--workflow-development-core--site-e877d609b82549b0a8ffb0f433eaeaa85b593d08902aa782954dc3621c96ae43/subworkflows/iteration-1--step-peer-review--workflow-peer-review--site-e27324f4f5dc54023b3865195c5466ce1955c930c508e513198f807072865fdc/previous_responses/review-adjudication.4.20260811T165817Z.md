## coding-review
変更契約を確定するため、まず指定されたタスク資料、レビュー履歴、全文の Policy／Knowledge を読みます。その後、継続レビューの open finding と修正箇所・直接影響経路に絞り、現在の累積差分と実行証跡を再確認します。編集・ステージング・コミットは行いません。
指定資料では今回の中心契約は、GitHub PR の4種の本文ソースから画像参照を抽出し、安全に取得・検証した `TaskAttachment[]` を add と pipeline の双方へ一貫して渡すことです。履歴上の指摘台帳と最新の修正報告を照合し、継続レビュー対象を確定しています。
open finding の根本原因だった `Number` 採番は現在のコードから除去され、共通 allocator は任意長番号を文字列として予約し、`BigInt` は小さい未使用候補の増分にだけ使っています。PR・retry・対話の各経路が同じ allocator を利用し、retry は本文にない既存ルート添付ファイル名も予約対象にしています。次に対象テストを再実行して、保存・再注入・後片付けまで確認します。
対象一覧の回帰確認では、変更された unit／light IT／heavy IT を分類済み runner で実行し、ここまで対象17ファイル・計355件が成功しています。画像取得の許可・拒否、MIME／magic bytes／サイズ制限、add・対話・pipeline・retry・保存済みtaskからrun contextへの復元を含みます。最終判定前に旧採番経路の不存在と差分整合を再確認します。
# コーディングレビュー

## 結果: APPROVE

blocking finding はありません。

前回の `CODE-NEW-imageAttachmentIndex-L37` は解消済みです。

- 任意長の番号を文字列として予約し、未使用番号を安全に採番
- PR・retry・対話経路を共通 allocator へ統一
- 本文にない既存添付ファイル名も衝突判定へ反映
- 旧 `Number(rawIndex)`／手動加算経路は不存在
- 対象一覧34ファイルの回帰範囲を確認

検証結果:

- 対象17テストファイル、528件成功
- 型契約検査成功
- `git diff --check` 成功
- 保存、run contextへの復元、失敗時cleanupを確認

ソースファイルの編集は行っていません。

---

## ai-antipattern-review
問題を「PRコメント内の画像をダウンロードする変更」に関するAI生成コード特有の不整合レビューとして整理します。まず正本の要件・全文ポリシー・ナレッジ・過去レポートを読み、レビュー区分と未解決 finding を確定してから、該当する変更契約の経路だけを追跡します。編集は行いません。
正本の要件では、画像抽出対象はPR本文・通常コメント・レビュー要約・レビューコメント、取得対象はGitHub attachment URL、検証はContent-Type・magic bytes・サイズ上限、利用経路は `add --pr` と pipeline `--pr` の両方です。続いて、適用判断に必要なナレッジ全文とレビュー履歴の有無を確認しています。
レビュー区分は Finding Contract なしの `follow_up` です。直前の未解決 family は「任意長の画像番号を `Number` 化して衝突する問題」で、修正・検証レポート上は共通allocatorへの移行済みです。ここからは、この family の修正箇所と、PR・retry・対話・pipelineへ直接つながる経路だけを現在コードで再確認します。
現在コードでは、共通allocatorが予約番号を10進文字列として保持し、候補だけを `BigInt` で進めています。PR・retry・対話ストアはいずれも割当直後に同じ予約集合へ反映され、旧 `Number`/最大値加算経路は見当たりません。次に、境界値・実ファイル保存・入口配線を対象テストで再実行します。
対象実行は、unit・light IT・変更されたheavy IT・分類契約を含めて計188件すべて成功しました。最後に、提示された34ファイルを対象として旧採番経路の残存と、修正が入口間のattachment契約を壊していないことだけを回帰確認します。
# AI生成コードレビュー

## 結果: APPROVE

Blocking finding はありません。

- `AI-NEW-IMAGE-INDEX-PRECISION-31` は解消済みです。
- 画像番号は文字列で予約され、`BigInt` 候補から未使用番号を割り当てています。
- PR・retry・対話・pipeline経路が共通allocatorへ移行済みです。
- 旧 `Number(rawIndex)`、最大値加算、件数ベース採番は34対象ファイルに残っていません。
- 安全整数境界、400桁番号、既存ファイル、同一バッチ、保存済みtask復元を含む対象テスト208件が成功しました。
- `git diff --check` も成功しています。

主な根拠は [imageAttachmentReferences.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/shared/utils/imageAttachmentReferences.ts:21)、[prReviewAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/prReviewAttachments.ts:546)、[retryTaskSpecAttachments.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/features/tasks/retryTaskSpecAttachments.ts:46) です。

---

## architecture-review
問題を、PRコメント内の画像を安全に取得して各実行経路へ添付する変更の継続アーキテクチャレビューとして扱います。まず正本の要件・Policy・Knowledge・過去レポートを全文確認し、open finding と変更契約を確定した後、その修正箇所と直接影響経路だけを実コードで再検証します。編集・ステージング・コミットは行いません。
正本の要件から、変更契約は「PR本文・通常コメント・レビュー本文・レビューコメントの4ソースからGitHub画像URLを抽出し、検証済み画像だけを attachments に保存し、add と pipeline の双方で本文参照と保存物を一貫させること」です。Policy/Knowledge は長文のため、出力省略が起きない単位に分けて EOF まで再読しています。
Finding Contract の宣言は確認できず、レビュー区分は指示どおり `follow_up` です。現時点の open finding は、外部本文の任意長画像番号を `Number` で採番して重複・`Infinity`を生む `image-attachment-index-precision` 1 family です。修正履歴は共通allocatorへの移行を主張しているため、現在コードでその正本・全参照・PR／retry／対話／保存済みtaskの経路を再確認します。承認候補になった場合は最後に提示34ファイルの回帰確認も行います。
現在コードでは、採番の正本が `createImageAttachmentIndexAllocator` に集約され、予約値を10進文字列のまま保持し、生成候補だけを `BigInt` で進めています。PR・retry・対話storeの3利用側はいずれも同じallocatorへ移行済みで、retryは本文に現れない既存 `attachments/image-N.*` もmanifestから予約しています。次に境界値と実経路の対象テストを実行し、報告上の解消を実際の振る舞いで確認します。
対象実行は、採番境界のPR・retry・対話62件、add・CLI・pipeline・downloader・保存済みtaskデータフロー127件がすべて成功しました。`Number.MAX_SAFE_INTEGER`、安全整数超過、400桁値、疎な既存番号、同一バッチ2画像、本文にない既存fileNameを含む反例も通過しています。最後に、34ファイル全体について配線参照・旧経路不存在・差分整合・過去に解消した境界の回帰を現在状態で照合します。
# アーキテクチャレビュー結果: APPROVE

ブロッキング指摘はありません。

`ARCH-NEW-src-features-tasks-attachments-L31` は解消済みです。[imageAttachmentReferences.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/shared/utils/imageAttachmentReferences.ts:21) が任意長番号を文字列で予約し、`BigInt` 候補から未使用番号を割り当てています。PR・retry・対話経路も共通allocatorへ移行済みです。

確認結果:

- PR・retry・対話の対象テスト: 62件成功
- add・CLI・pipeline・downloader・保存済みtaskデータフロー: 127件成功
- 判断直前のPR・retry再実行: 35件成功
- 提示された変更対象34ファイルを回帰確認
- 旧数値採番・旧GitHub URL helperの参照なし
- `git diff --check` 問題なし
- 未追跡の新規8ファイルはいずれも `.gitignore` 対象外
- ソースファイルの編集は行っていません

---

## security-review
変更された信頼境界を中心に、PR画像URLの取得・検証・保存・再利用経路を監査します。まず正本の要件、全文のPolicy/Knowledge、既存レポートから未解決findingとレビュー区分を確定し、その後に修正箇所と直接影響経路だけを実コードで追跡します。ファイル編集は行いません。
正本を確認した結果、この変更では「GitHubコメント由来の低信頼URL・レスポンス」を「認証情報付き外部取得」と「ローカル添付ファイル保存」へ渡す点が主要な信頼境界です。現在は継続レビューなので、過去のセキュリティfindingと直近の修正履歴を正本に、URL許可条件、認証情報の送信先、リダイレクト、サイズ制限、Content-Type/magic bytes、保存名の固定化を再確認しています。
過去の `SEC-001` は裁定履歴で `overreach` と確定しており、未解決findingではありません。現行コードでは、HTTPSかつ`github.com`のattachmentパスだけを認証前に許可し、`gh auth token --hostname github.com`で取得したトークンを使用し、単一画像10 MiB・MIME・magic bytesを検証しています。最新の採番修正はこれらの取得境界を変更していません。次に、保存先隔離・cleanup・全入口の回帰を対象テストで確認します。
対象テストはここまで209件すべて成功しています。変更対象34ファイルの存在確認、危険な実行API・認証ヘッダ・ファイル副作用の静的走査、差分の空白検査も完了し、画像データがシェル文字列へ入る経路や、外部入力から保存先を組み立てる経路は確認されませんでした。残る対話・retry系の変更テストを実行して、共有ストア化による回帰がないことを確定します。
# セキュリティレビュー

## 結果: APPROVE

ブロッキングfindingはありません。

確認内容:

- 変更対象34ファイルを回帰確認
- GitHub attachment URLをHTTPS・`github.com`・許可パスへ制限
- 認証先を`gh auth token --hostname github.com`へ固定
- Content-Type、magic bytes、単一画像10 MiB上限を検証
- 保存名の固定化、パストラバーサル防止、通常ファイル検証、非公開一時保存、cleanupを確認
- シェル文字列への画像入力混入、認証トークンのエラー露出、依存関係変更なし
- 過去の`SEC-001`は裁定済み`overreach`のため再指摘なし

検証結果:

- 対象テスト16ファイル、509件成功
- 型契約検査成功
- `git diff --check`成功
- 実GitHub private repositoryとの通信は未確認ですが、現行コード上の欠陥を示す証拠はありません

ファイルの編集は行っていません。

---

## testing-review
テスト品質レビューとして、まず指定された正本（`order.md`、Knowledge、Policy）を全文確認し、Report Directory のテスト計画・既存 finding と現在の実装テストを突合します。編集は行いません。
指定された Report Directory には現時点でレポートファイルがありませんでした。実行履歴の所在を確認し、Finding Contract の有無と継続レビュー対象を特定します。
継続レビューとして、過去の testing finding 2件は既に解消済みで、今回の直接対象は直近 remediation の採番・retry・保存済み task 再注入に関するテスト変更です。これらを現行コードと突合し、APPROVE 前の34ファイル回帰確認を行います。
現行テストでは、任意長番号・疎な既存番号・本文未記載ファイル・同一バッチ・対話 seed から paste まで・保存済み task から run context までが、それぞれ観測可能な副作用で検証されています。次に対象テストを実行し、レポート記載ではなく現在の実体で確認します。
対象テスト82件と分類契約20件（型契約を含む）は現行状態で成功しました。最後に、提示された変更対象一覧の全テストファイルを分類済み runner で一括回帰確認します。これは新規探索ではなく、継続レビューでの変更契約破壊がないことの確認です。
## 結果: APPROVE

テスト品質上の blocking finding はありません。

- 採番境界、retry、対話 seed、保存済み task から run context への再注入を確認。
- Given-When-Then、命名、独立性、cleanup、テスト分類はいずれも適切。
- 変更対象16テストファイルを実行し、509件成功。
- 分類契約19件、データフローIT 1件も成功。
- 型契約と `git diff --check` も成功。

実 private GitHub repository との通信は未確認で、認証・HTTP境界はモック検証のみです。外部サービス依存のため非ブロッキングの未確認範囲とします。