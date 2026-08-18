# 修正レポート
## サマリー
Markdown literal判定の行ごとの本文prefix再構築を廃止し、blockquote深度、list indent、paragraph状態を行単位で前方計算する実装へ置換した。30,000行の画像なし本文を用いた回帰テストを追加し、本文不変、attachments空、download・save未実行を確認した。

Companionで検出された既存placeholderとの衝突も修正した。本文中の最大画像番号を予約し、PR画像とretry attachmentの採番責務を共通所有者へ集約した。Companionの3件は最終確認ですべてresolvedとなった。

## 修正単位
| 修正単位 | 対象 finding | 契約の正本 | 実施内容・反映先 | 状態 |
|----------|--------------|------------|-----------------|------|
| `markdown-literal-scan-complexity` | `AI-NEW-MARKDOWN-LITERAL-SCAN-158` | `order.md`のPR画像処理要求、`review-resolution.md`の受入条件、`preparePrReviewAttachments()`の既存契約 | `prReviewAttachments.ts`で行状態を前方計算し、旧prefix後方走査を削除。大規模本文回帰テストを追加 | 完了 |
| `pr-image-placeholder-index-collision` | `ai-antipattern-review-companion-1`、`ai-antipattern-review-companion-3` | 既存本文保持、`[Image #N]`／`image-N.ext` attachment契約 | 最大画像番号解決と再採番を`attachments.ts`へ集約し、PR・retry経路へ配線。衝突反例テストを追加 | 完了 |

## 完了義務
| 修正単位 | 義務ID | 種別 | 対象 finding | 不変条件と対象経路 | 違反を検出する反例・観測点 | 修正前または差し戻し時の結果 | 実装根拠 | 修正後の証拠 | 状態 |
|----------|--------|------|--------------|--------------------|------------------------------|--------------------------------|----------|--------------|------|
| `markdown-literal-scan-complexity` | `MLSC-01` | 振る舞い修正 | `AI-NEW-MARKDOWN-LITERAL-SCAN-158` | literal判定は本文prefixを行ごとに再走査しない | `findInheritedListIndent`、`slice(0,start)`、reverse走査の静的検索 | 16,000行で4,256ms、入力倍増時に約4倍化 | `buildMarkdownLineContexts()`で直前行、blockquote、list、paragraph状態を前方計算 | 旧走査名・原因パターンの検索結果0件 | 完了 |
| `markdown-literal-scan-complexity` | `MLSC-02` | 旧経路削除 | `AI-NEW-MARKDOWN-LITERAL-SCAN-158` | 置換済みprefix走査と補助関数を残さない | `findInheritedListIndent`、`lineBefore`の参照検索 | 両関数と全文・start引数が残存 | 旧関数と不要引数を削除 | build、lint、静的検索成功 | 完了 |
| `markdown-literal-scan-complexity` | `MLSC-03` | 既存契約保存 | `AI-NEW-MARKDOWN-LITERAL-SCAN-158` | Markdown／HTML画像、fence、inline code、HTML comment、引用、list、tab、段落、escapeの意味論を維持 | `prReviewAttachments.test.ts`全体 | 既存28件が基準 | 公開API、download、store、cleanup経路を維持 | 対象テスト30件成功 | 完了 |
| `markdown-literal-scan-complexity` | `MLSC-04` | 振る舞い修正 | `AI-NEW-MARKDOWN-LITERAL-SCAN-158` | 画像0件では本文不変、attachments空、download・saveなし | 30,000行の固定本文、3秒のテストローカル上限 | 修正前は大規模入力で二乗時間 | 前方行状態と画像0件early return | 大規模本文テスト成功、対象テスト全体85ms | 完了 |
| `markdown-literal-scan-complexity` | `MLSC-05` | 利用側移行 | `AI-NEW-MARKDOWN-LITERAL-SCAN-158` | add、対話CLI、pipelineの3入口が同じ修正済み関数を利用する | 3入口から`preparePrReviewAttachments`への既存配線 | 3入口とも同じ非線形処理へ到達 | 共通内部関数のみ局所置換し入口契約は変更なし | unit、light IT、mock E2E成功 | 完了 |
| `pr-image-placeholder-index-collision` | `PIPC-01` | 振る舞い修正 | `ai-antipattern-review-companion-1` | 既存`[Image #N]`を新規画像が上書きしない | `Compare [Image #1] with ![actual](URL)` | 両方が`[Image #1]`になる | 本文の最大画像番号＋1から採番 | `[Image #1]`を保持し新規画像を`[Image #2]`へ変換するテスト成功 | 完了 |
| `pr-image-placeholder-index-collision` | `PIPC-02` | 利用側移行 | `ai-antipattern-review-companion-3` | PRとretryの採番が同じ責務を共有する | helperのimport・呼び出し検索 | 追加直後はPR経路へ未配線 | `resolveMaxImageAttachmentIndex()`と`assignImageAttachmentIndex()`をPR・retry双方へ配線 | PR30件、retry 3件成功。Companion resolved | 完了 |
| `pr-image-placeholder-index-collision` | `PIPC-03` | 既存契約保存 | `ai-antipattern-review-companion-1` | placeholderとfileName形式、temp file cleanupを維持 | attachment戻り値と既存cleanupテスト | `[Image #N]`／`image-N.ext`形式が既存基準 | 番号のみ再割当し、tempPathとstore所有権を維持 | build、unit、light IT、mock E2E成功 | 完了 |

## 受入条件
| finding ID | 受入条件 | 証拠 | 状態 |
|------------|----------|------|------|
| `AI-NEW-MARKDOWN-LITERAL-SCAN-158` | 行ごとの本文prefix再分割・再走査を除去する | 原因パターンの静的検索0件、前方行状態実装 | 完了 |
| `AI-NEW-MARKDOWN-LITERAL-SCAN-158` | 大規模な画像なし本文で非線形退行を検出する | 30,000行、3秒上限の回帰テスト成功 | 完了 |
| `AI-NEW-MARKDOWN-LITERAL-SCAN-158` | 既存Markdown literal意味論を維持する | `prReviewAttachments.test.ts` 30件成功 | 完了 |
| `ai-antipattern-review-companion-1` | 既存placeholderと新規画像の参照を衝突させない | `[Image #1]`保持／新規`[Image #2]`の反例テスト成功 | 完了 |
| `ai-antipattern-review-companion-2` | list状態更新で受領配列を直接変更しない | 更新後配列を返し所有側で置換。push／pop／length代入検索0件 | 完了 |
| `ai-antipattern-review-companion-3` | 共通採番helperを実経路へ配線する | PR・retry双方のimport・呼び出し確認、Companion resolved | 完了 |

## 差し戻し後の証拠修正
| 修正単位 | 義務ID | verifier が確認した不足 | 前回の証拠が検出できなかった理由 | 修正した反例・観測点 | 同じ証明手段から再開・再確認した義務 |
|----------|--------|--------------------------|----------------------------------|----------------------|----------------------------------------|
| `pr-image-placeholder-index-collision` | `PIPC-01` | 既存`[Image #1]`と新規画像が衝突する | 大規模本文回帰と既存構文テストに、既存placeholderを含む入力がなかった | 既存placeholderと新規Markdown画像を同じ本文へ配置するテストを追加 | `PIPC-01`、`PIPC-02`、`PIPC-03` |
| `pr-image-placeholder-index-collision` | `PIPC-02` | 共通helper追加直後はPR採番経路へ未配線 | 中間状態で定義側のみが先に編集されていた | import・呼び出し検索とPR衝突テストを追加 | `PIPC-01`、`PIPC-02` |
| `markdown-literal-scan-complexity` | `MLSC-01` | list状態配列の直接変更 | 局所所有配列はポリシー上許容されるが、Companion観測点では所有境界を判別できなかった | immutableな戻り値更新へ変更し、push／pop／length代入を検索 | `MLSC-01`、`MLSC-03`、`MLSC-04` |

## 品質ゲート
| 種別 | 結果 | 証拠 |
|------|------|------|
| 対象unit／light IT | 成功 | `npm test -- src/__tests__/prReviewAttachments.test.ts src/__tests__/retryTaskSpecAttachments.test.ts`：30件＋3件成功 |
| ビルド | 成功 | `npm run build` |
| lint | 成功 | `npm run lint` |
| unit全体 | 成功 | `npm test` |
| light integration | 成功 | `HOME=/tmp/takt-bench-v3-home npm run test:it` |
| mock E2E | 成功 | `npm run test:e2e:mock` |
| 静的確認 | 成功 | `git diff --check`、旧prefix走査・未使用・重複責務・依存方向の検索 |
| Companion | 成功 | `ai-antipattern-review-companion-1`、`-2`、`-3`がすべてresolved |
| smoke E2E | 未実施 | CLI起動、workflow実行、provider選択、設定読込、sandbox、runtime preparationの変更ではないため対象外 |

## 未完了義務
- なし。