# 修正計画

## 結果: 修正計画確定

## 指摘カバレッジ

| finding ID / 出典 | 根拠 | 修正単位 / 後続確認 | 問題 → 直接原因 → 根本原因 | 分類 | 受入条件 |
|-------------------|------|----------------------|-----------------------------|------|----------|
| `AI-NEW-MARKDOWN-LITERAL-SCAN-158` / `ai-antipattern-review.md` | `src/features/tasks/prReviewAttachments.ts:152-178,193-215,296-325,435-505`、`review-resolution.md` | `markdown-literal-scan-complexity` | 大きな画像なしPR本文でCLIが長時間停止する → 各行頭のindented/fenced code判定が`findInheritedListIndent()`を呼ぶ → 呼び出しごとに`content.slice(0, start).split('\n').reverse()`で増大する本文prefixを再構築・再走査する | 局所 | 行ごとの本文prefix再分割・後方走査を除去する。大規模な画像なし本文で非線形退行を検出できる回帰テストを追加し、既存のMarkdown／HTML画像、コードフェンス、inline code、HTMLコメント、引用・リスト・インデントの意味論を維持する |

## 欠陥 family の最終状態

| 修正単位 | 契約の正本 | 完了対象の全不変条件 | 変更後の責務・正本 | 関係する契約経路 | 成立例・失敗例・境界値 | 移行・削除対象 |
|----------|------------|----------------------|--------------------|--------------------|--------------------------|----------------|
| `markdown-literal-scan-complexity` | `order.md`のPR本文・コメント画像処理要求、`review-resolution.md`の受入条件、`preparePrReviewAttachments()`の既存観測可能契約 | 本文を前方へ有界回数だけ走査する。通常のMarkdown画像とHTML画像を出現順に処理する。コードフェンス、inline code、HTMLコメント、インデント式コード内は原文保持する。blockquote深度、list padding、タブ列幅、段落中断、invalid fence、escaped delimiterの既存判定を維持する。画像0件では本文を変更せず、attachment作成・downloadを行わない | `prReviewAttachments`内部のliteral走査が、直前行、blockquote深度、継続中のlist indent、paragraph状態を前方へ引き継ぐ。公開API、画像抽出、download、store、cleanupの責務配置は変更しない | `takt add --pr`、対話CLI `--pr`、pipeline `--pr` → `formatPrReviewAsTask` → `preparePrReviewAttachments` → `findImageReferences` → literal判定。画像発見後だけdownload・一時store・placeholder置換へ進み、失敗時は既存cleanup経路へ進む | 成立例: 大規模な通常テキスト、通常Markdown／HTML画像、引用・リスト内の可視画像。保持例: fenced／indented／inline code、HTMLコメント内の画像風文字列。境界値: 空本文、末尾改行なし、空行を挟むlist継続、タブindent、番号2以降の段落中断不可list、invalid／unmatched fence、escaped opener | `findInheritedListIndent()`によるprefix再走査を置換する。変更により新たに未使用となる全文・start引数、`lineBefore()`等の補助関数だけを削除する。3入口の利用側、公開型、placeholder、attachment形式は移行しない |

## 実施順序

| 順序 | 修正単位 | 工程 | 依存先 | 変更対象 | 完了条件と証拠 |
|------|----------|------|--------|----------|----------------|
| 1 | `markdown-literal-scan-complexity` | 局所修正・旧走査削除 | なし | `src/features/tasks/prReviewAttachments.ts:152-325,435-505` | 行単位の前方状態管理へ置換し、各行から本文先頭までを再構築・再走査する経路がなくなる。画像抽出、download、store、cleanupの公開挙動とエラー経路は変更しない |
| 2 | `markdown-literal-scan-complexity` | 直接回帰テスト追加 | 1 | `src/__tests__/prReviewAttachments.test.ts` | 固定した大規模画像なし本文が変更なく返り、attachmentsが空で、download・saveが呼ばれないことを確認する。修正前の二乗処理を検出できる十分な入力規模とテストローカル上限を使用し、小規模な実測比率に依存する不安定なベンチマークは追加しない。既存28件の意味論テストもすべて成功する |

## 制約適合性

| 修正単位 | 制約の参照先 | 実装方法と候補案の採否 | 検証方法・観測点・実行条件 | 適合根拠 | 品質ゲート |
|----------|--------------|--------------------------|-----------------------------|----------|--------------|
| `markdown-literal-scan-complexity` | 裁定の修正境界、契約置換ポリシーの対象外契約保持、コーディングポリシーのSimple・フェーズ分離・未使用コード削除、テストポリシーのバグ回帰・再現性、TAKTテスト分類 | 直前行、blockquote、active list indent、paragraph状態を内部の前方走査状態として解決し、解決済み状態をfenced／indented code判定へ渡す。行ごとのprefix再構築は削除する。新規Markdown parser依存、別モジュールへの内部parser公開、Markdown構文拡大、画像抽出正規表現やliteral range検索の周辺最適化は不採用 | 大規模固定入力の本文同一性、空attachments、download・save未呼出をunitで観測する。既存テストで通常画像、重複URL、literal範囲、引用・リスト・タブ・段落・escapeの意味論を再確認する。静的照合でprefix再分割経路と変更起因の未使用コードが残っていないことを確認する。外部サービスや資格情報は不要 | 同じ内部関数を3入口が共有しているため入口別変更は不要。公開契約や副作用境界を変えず、裁定された計算量欠陥だけを除去できる。同一の`slice(0, start) → split('\n') → reverse()`原因パターンは他の対象コードに存在しない | `npm test -- src/__tests__/prReviewAttachments.test.ts`、`npm run build`、`npm run lint`、`npm test`、`npm run test:it` |

## 再計画事項

- なし。
- 現在の環境で実証できない完了条件や後続確認はない。
- Markdown構文対応の拡大、新規parser依存、公開API・placeholder・attachment形式の変更、画像総量制限、GitHub互換経路、過去に解消済みまたは非修正対象と裁定された指摘は計画へ含めない。