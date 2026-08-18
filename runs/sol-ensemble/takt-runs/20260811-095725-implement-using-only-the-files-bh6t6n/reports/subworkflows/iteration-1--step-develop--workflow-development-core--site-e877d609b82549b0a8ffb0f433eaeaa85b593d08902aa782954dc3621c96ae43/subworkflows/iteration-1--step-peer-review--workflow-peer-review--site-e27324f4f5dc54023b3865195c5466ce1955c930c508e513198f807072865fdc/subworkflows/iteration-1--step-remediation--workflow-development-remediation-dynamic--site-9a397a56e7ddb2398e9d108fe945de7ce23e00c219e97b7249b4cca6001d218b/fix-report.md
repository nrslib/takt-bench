# 修正レポート
## サマリー

最新verifierで未完了とされた`markdown-image-semantics`を再開し、前回証拠の不足を「未実行の反例」と「過大な完了報告」に分類した。

Markdown画像抽出のliteral境界を修正し、引用・リスト・ネストコンテナ、エスケープ済みdelimiter、インデント式コード、段落中断規則、リストpadding、タブ展開を反映した。通常のMarkdown／HTML画像だけを取得・置換し、コード・コメント・エスケープ済み画像記法は原文を保持する。

対象テスト28件、全ユニット6,056件、light IT 2,355件、build、lintが成功した。Companion指摘1〜15は最終的にすべて`resolved`となった。他の7修正単位も最新verifierの完了判定とproduction dataflowで完了状態を維持した。

## 修正単位
| 修正単位 | 対象 finding | 契約の正本 | 実施内容・反映先 | 状態 |
|----------|--------------|------------|-----------------|------|
| `shared-image-boundary-ownership` | `ARCH-NEW-src-shared-utils-githubAttachmentUrl-L1`、Companion 3、5 | GitHub固有規則はGitHub infra、shared storeは画像attachment一般、interactive公開契約はfeature境界 | GitHub URL規則のinfra移行、shared store汎用化、interactive adapterによる既存契約保存を再確認 | 完了 |
| `github-auth-host-binding` | `CODE-NEW-prImageDownload-L39` | URL許可ホストとtoken選択ホストを`github.com`へ結合 | `gh auth token --hostname github.com`と末端Authorization経路を再確認 | 完了 |
| `image-signature-validation` | `ARCH-NEW-src-shared-utils-imageMimeType-L17`、`AI-NEW-IMAGE-MAGIC-16`、`CODE-NEW-imageMimeType-L17` | 共有MIME helperがPR取得・inline paste双方の署名正本 | PNG正式8バイト署名、短縮・途中不一致拒否、他形式維持を再確認 | 完了 |
| `markdown-image-semantics` | `CODE-NEW-prReviewAttachments-L22`、Companion 1〜15 | Markdown上で画像として解釈される参照だけを取得・置換する | `src/features/tasks/prReviewAttachments.ts`のliteral走査を修正。引用・リスト・ネスト、段落中断、インデント式コード、リストpadding、タブ列幅を反映。`src/__tests__/prReviewAttachments.test.ts`へ対向回帰テストを追加 | 完了 |
| `pr-body-image-routing` | `AI-NEW-TASKS-PR-BODY-194`、`ARCH-NEW-src-features-tasks-add-index-L194` | PR本文・review・commentのいずれかが入力なら画像準備へ進み、全入力空なら拒否する | 本文画像のみ、本文テキストのみ、全入力空の既存テストとdataflowを再確認 | 完了 |
| `pipeline-cleanup-result-preservation` | `ARCH-NEW-src-features-pipeline-steps-L411` | workflow結果・元例外をcleanup例外より優先する | true／false／実行例外とcleanup失敗の組合せを既存テストで再確認 | 完了 |
| `pr-image-owner-failure-tests` | `TEST-NEW-pr-image-cleanup-L301` | add保存所有者とPR routing所有者が元例外・永続状態を保持して一度だけcleanupする | add保存失敗とPR実行失敗の代表経路テストを再確認 | 完了 |
| `pr-image-production-dataflow-test` | `TEST-NEW-pr-image-dataflow-L29` | 実store、永続化、task spec、resolver、stagingを横断するproduction配線 | task保存側とrun context側の画像bytes・`order.md`参照、light分類を再確認 | 完了 |

## 完了義務
| 修正単位 | 義務ID | 種別 | 対象 finding | 不変条件と対象経路 | 違反を検出する反例・観測点 | 修正前または差し戻し時の結果 | 実装根拠 | 修正後の証拠 | 状態 |
|----------|--------|------|--------------|--------------------|------------------------------|--------------------------------|----------|--------------|------|
| `shared-image-boundary-ownership` | `SIBO-01` | 利用側移行 | `ARCH-NEW-src-shared-utils-githubAttachmentUrl-L1` | GitHub URL判定はinfra境界だけが所有する | 旧shared module参照検索 | GitHub規則がsharedに存在した | `src/infra/github/attachmentUrl.ts`と利用側import | 旧module・旧参照なし、build成功 | 完了 |
| `shared-image-boundary-ownership` | `SIBO-02` | 旧経路削除 | 同上 | 旧URL alias・re-exportを残さない | ファイル存在と参照検索 | 旧shared URL moduleが存在した | 旧module削除 | 旧経路不存在 | 完了 |
| `shared-image-boundary-ownership` | `SIBO-03` | 既存契約保存 | 同上、Companion 3、5 | shared storeは汎用契約、interactive経路は既存公開契約を維持する | 未対応MIMEとcleanupログ | 責務境界の混在があった | shared storeとinteractive adapter | 対象テスト成功 | 完了 |
| `github-auth-host-binding` | `GAHB-01` | 振る舞い修正 | `CODE-NEW-prImageDownload-L39` | token選択と送信先を`github.com`へ固定する | Enterprise `GH_HOST`反例 | default host tokenを選択可能だった | host定数と`--hostname github.com` | downloader対象テスト成功 | 完了 |
| `image-signature-validation` | `ISV-01` | 振る舞い修正 | PNG署名3 finding | PNGは8バイト完全一致だけを受理する | 4バイトprefix、末尾不一致、短い入力 | 先頭4バイトだけでPNG判定した | `imageMimeType.ts` | downloader・inline paste反例成功 | 完了 |
| `image-signature-validation` | `ISV-02` | 既存契約保存 | 同上 | JPEG／GIF／WebPとContent-Type照合を維持する | 形式別正常値とMIME不一致 | PNG修正による退行余地があった | 既存分岐を維持 | 対象テスト成功 | 完了 |
| `image-signature-validation` | `ISV-03` | 利用側移行 | `AI-NEW-IMAGE-MAGIC-16` | 正常PNG fixtureは正式署名を使う | fixture内容と両入口 | 4バイト疑似fixtureが存在した | 関連fixture更新 | 両入口の対象テスト成功 | 完了 |
| `markdown-image-semantics` | `MIS-01` | 振る舞い修正 | `CODE-NEW-prReviewAttachments-L22` | 通常Markdown／HTML画像をappearance orderで処理する | 通常4セクション、重複URL、エスケープ済みdelimiter後の画像 | エスケープ済みdelimiterをliteral開始と誤認し画像を見落とした | `findLiteralRanges`とエスケープ判定 | 対象28件成功 | 完了 |
| `markdown-image-semantics` | `MIS-02` | 既存契約保存 | 同上、Companion 1〜9 | コードフェンス、inline code、HTMLコメントを原文保持する | 引用・リスト・ネストフェンス、引用再開、invalid fence、unmatched run | トップレベル以外のフェンスで取得・置換した | コンテナ付きliteral範囲走査 | 原文保持、downloadなしを確認 | 完了 |
| `markdown-image-semantics` | `MIS-03` | 既存契約保存 | 同上 | 重複URLを1回取得しplaceholderを再利用する | Markdown／HTMLの同一URL | 重複取得の退行余地があった | URL→placeholder Mapを維持 | download・save各1回 | 完了 |
| `markdown-image-semantics` | `MIS-04` | 振る舞い修正 | Companion 10〜15 | インデント式コード内の画像風文字列を取得しない | 4空白、タブ、引用・リスト内コード、5空白padding、marker後タブ | インデント式コードを通常画像として置換した | 列幅ベースのindent計算と共通コンテナ走査 | 対象反例すべて成功 | 完了 |
| `markdown-image-semantics` | `MIS-05` | 既存契約保存 | Companion 8、13 | インデント式コードや番号2以降のリストは段落を不正に中断しない | `Paragraph`直後の4空白画像、`2. ```md`、親リスト内`2.` | literal偽陽性で通常画像を見落とした | 段落状態と有効なlist marker判定 | 対向テスト成功 | 完了 |
| `markdown-image-semantics` | `MIS-06` | 振る舞い修正 | Companion 11、14、15 | リストpaddingと継承indentを表示列で統一する | 5空白、marker後タブ、タブ継続フェンス | 列幅を文字数としてsliceしていた | `indentationWidth`、`stripIndentColumns` | タブ・スペース反例成功 | 完了 |
| `pr-body-image-routing` | `PBIR-01` | 振る舞い修正 | PR本文画像2 finding | review/commentなしでも本文画像を準備・保存する | 本文画像のみのPR | 画像準備前に早期終了した | add入口条件と共通準備処理 | addテスト・dataflow成功 | 完了 |
| `pr-body-image-routing` | `PBIR-02` | 既存契約保存 | 同上 | 全入力が空なら拒否する | 空白本文、空配列 | 条件変更による空PR受理余地 | 3入力のAND条件 | task未作成を確認 | 完了 |
| `pr-body-image-routing` | `PBIR-03` | 既存契約保存 | Companion 4 | 通常本文のみもtask入力として成立する | 本文テキストのみ | Companionが要求外変更として指摘した | 確定計画の成立例を維持 | add対象テスト成功 | 完了 |
| `pipeline-cleanup-result-preservation` | `PCRP-01` | 振る舞い修正 | `ARCH-NEW-src-features-pipeline-steps-L411` | workflow falseをcleanup失敗後も維持する | execute=false＋cleanup throw | cleanup例外が結果を上書きした | pipeline所有期間のbest-effort cleanup | false／exit code 3維持 | 完了 |
| `pipeline-cleanup-result-preservation` | `PCRP-02` | 振る舞い修正 | 同上 | 実行例外の同一性を維持する | execute throw＋cleanup throw | cleanup例外が元例外を上書きした | 同じcleanup境界 | 元Error参照を維持 | 完了 |
| `pipeline-cleanup-result-preservation` | `PCRP-03` | 既存契約保存 | 同上 | workflow成功をcleanup失敗で変更しない | execute=true＋cleanup throw | 成功がcleanup例外へ変化した | 同じcleanup境界 | 成功結果を維持 | 完了 |
| `pr-image-owner-failure-tests` | `PIOF-01` | 既存契約保存 | `TEST-NEW-pr-image-cleanup-L301` | add保存失敗時にcleanupを1回実行し永続状態を維持する | 存在しないattachment source | 失敗側が未検証だった | add保存失敗テスト | 元例外、cleanup 1回、状態不変 | 完了 |
| `pr-image-owner-failure-tests` | `PIOF-02` | 既存契約保存 | 同上 | PR実行失敗時にcleanupを1回実行し元例外を維持する | `selectAndExecuteTask` throw | 実行失敗側が未検証だった | routing失敗テスト | 元Error同一性、cleanup 1回 | 完了 |
| `pr-image-production-dataflow-test` | `PIDF-01` | 利用側移行 | `TEST-NEW-pr-image-dataflow-L29` | PR入力からtask保存まで実store・永続化を通す | 保存済み`order.md`と画像bytes | 内部production配線の横断観測がなかった | production dataflow IT | placeholder・参照・bytes一致 | 完了 |
| `pr-image-production-dataflow-test` | `PIDF-02` | 利用側移行 | 同上 | task specからrun context stagingまで参照とbytesを維持する | staged `order.md`とcontext attachment | staging側の横断観測がなかった | 同light IT | task側・run側の参照一致 | 完了 |
| `pr-image-production-dataflow-test` | `PIDF-03` | 利用側移行 | 同上 | 新規ITをlight分類へ排他的に登録する | 分類契約 | 未分類になる余地があった | classification script | 分類契約19件成功 | 完了 |

## 受入条件
| finding ID | 受入条件 | 証拠 | 状態 |
|------------|----------|------|------|
| `AI-NEW-TASKS-PR-BODY-194` | review/commentなしでも本文画像を保存しplaceholderとattachment参照を出力する | add対象テスト、production dataflow IT | 完了 |
| `ARCH-NEW-src-features-tasks-add-index-L194` | 本文画像のみを受理し、実質的に空のPRを拒否する | add対象テスト | 完了 |
| `ARCH-NEW-src-shared-utils-imageMimeType-L17` | PNG正式8バイトだけを受理する | downloader・inline paste反例 | 完了 |
| `AI-NEW-IMAGE-MAGIC-16` | 両入口の正常fixtureを正式署名へ更新する | 関連テスト成功 | 完了 |
| `CODE-NEW-imageMimeType-L17` | 共有helperでContent-Typeとmagic bytesを照合する | downloader対象テスト | 完了 |
| `ARCH-NEW-src-features-pipeline-steps-L411` | cleanup失敗後もworkflow結果・元例外を維持する | pipeline対象テスト | 完了 |
| `ARCH-NEW-src-shared-utils-githubAttachmentUrl-L1` | GitHub規則をinfraへ移しshared storeを汎用化する | 旧参照なし、build・lint成功 | 完了 |
| `CODE-NEW-prImageDownload-L39` | tokenを`github.com`用に明示選択する | Enterprise default host反例 | 完了 |
| `CODE-NEW-prReviewAttachments-L22` | literal文脈を原文保持し通常画像だけを処理する | Markdown対象28件成功、Companion 1〜15 resolved | 完了 |
| `TEST-NEW-pr-image-dataflow-L29` | production componentsを横断して保存・stagingを観測する | light IT成功 | 完了 |
| `TEST-NEW-pr-image-cleanup-L301` | 代表的失敗経路でcleanup 1回、元例外、永続状態を維持する | add／routing対象テスト | 完了 |

## 差し戻し後の証拠修正
| 修正単位 | 義務ID | verifier が確認した不足 | 前回の証拠が検出できなかった理由 | 修正した反例・観測点 | 同じ証明手段から再開・再確認した義務 |
|----------|--------|--------------------------|----------------------------------|----------------------|----------------------------------------|
| `markdown-image-semantics` | `MIS-01` | エスケープ済みinline code／HTML comment delimiter後の通常画像を見落とした | 未実行の反例、過大報告 | エスケープ済み開始記号の後に通常画像を配置しdownloadとplaceholderを観測 | `MIS-01`、`MIS-02`、`MIS-03` |
| `markdown-image-semantics` | `MIS-02` | 引用内チルダ式フェンスの画像を取得・置換した | トップレベルのバッククォートフェンスだけを観測した | 引用、リスト、ネスト、引用終了・再開、invalid fence、unmatched runを追加 | `MIS-01`、`MIS-02`、`MIS-03` |
| `markdown-image-semantics` | `MIS-04` | インデント式コード内の画像を取得・置換した | 未走査経路 | 4空白、タブ、引用内、リスト内、5空白paddingを追加 | `MIS-01`〜`MIS-06` |
| `markdown-image-semantics` | `MIS-05` | 段落直後のインデントや番号2のリストをliteralと誤判定した | ブロック状態を観測していなかった | 通常段落、親リスト段落、4空白内のlist風文字列を対向ケースとして追加 | `MIS-01`〜`MIS-06` |
| `markdown-image-semantics` | `MIS-06` | リストpaddingと継承indentでタブ列幅を文字数として扱った | スペースだけを前提にした不完全な移行 | marker後タブ、タブ継続フェンス、列幅超過の除去を追加 | `MIS-01`〜`MIS-06` |

## 品質ゲート
| 種別 | 結果 | 証拠 |
|------|------|------|
| Build | 成功 | `npm run build` |
| Lint | 成功 | `npm run lint` |
| Fast unit | 成功 | `npm test`、380ファイル、6,056件成功 |
| Light IT | 成功 | `npm run test:it`、159ファイル、2,355件成功 |
| Markdown画像意味論 | 成功 | `npm test -- src/__tests__/prReviewAttachments.test.ts`、28件成功 |
| Production dataflow | 成功 | `pr-image-dataflow.integration.test.ts`、1件成功 |
| IT分類契約 | 成功 | `releaseVerificationWiring.test.ts`、19件成功 |
| Companion | 成功 | 指摘1〜15の最終状態がすべて`resolved` |
| Full mock E2E | 失敗・非ブロッキング | shard 2の3 assertion成功後、Vitest workerの`onTaskUpdate`通知タイムアウト。最新verifierが環境要因として非ブロッキング判定 |
| 差分整合 | 成功 | `git diff --check`、未追跡対象の空白検査 |
| 編集後セルフスキャン | 成功 | 未使用化、依存方向、共通責務候補を検索。新規問題なし |

## 未完了義務
- なし。