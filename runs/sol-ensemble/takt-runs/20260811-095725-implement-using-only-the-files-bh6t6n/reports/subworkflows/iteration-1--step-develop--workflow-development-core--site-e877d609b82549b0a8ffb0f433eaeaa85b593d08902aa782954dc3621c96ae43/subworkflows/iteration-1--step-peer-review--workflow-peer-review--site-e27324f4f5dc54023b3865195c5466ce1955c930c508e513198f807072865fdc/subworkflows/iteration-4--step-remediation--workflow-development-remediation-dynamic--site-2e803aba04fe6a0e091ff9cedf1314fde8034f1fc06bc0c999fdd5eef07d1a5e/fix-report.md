# 修正レポート
## サマリー
PRコメント画像処理の既存AST実装を維持しつつ、mock E2Eの限定的Vitest worker RPC timeoutを安全に再測定するrunner境界を実装した。さらに画像添付index採番が通常本文や外部URLを誤認する問題を修正し、実添付相対パスとplaceholderのみを予約対象に限定した。最終コードでbuild、lint、全unit、light IT、mock E2Eが成功し、全Companion findingのresolvedを確認した。

## 修正単位
| 修正単位 | 対象 finding | 契約の正本 | 実施内容・反映先 | 状態 |
|----------|--------------|------------|-----------------|------|
| `PRMA-01` | `ai-antipattern-review-companion-1`, `ai-antipattern-review-companion-2` | `order.md`のMarkdown・HTML画像抽出契約と非画像リテラル保存契約 | `prReviewAttachments.ts`をMarkdown/HTML AST解析へ置換し、参照形式画像とraw HTML境界のテストを追加。parser依存をproduction経路へ配線 | 完了 |
| `FSME-01` | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | `package.json`の`test:e2e:mock`正式入口とfix-planの最終E2E受入条件 | `teed-command.mjs`へ明示的な`cwd`・`env`伝播を追加し、`run-e2e-mock-shards.mjs`へ出力収集、限定的birpc判定、全初回完了後の1回再測定、最終終了状態集約を実装。決定的runnerテストを追加 | 完了 |
| `IAI-01` | `ai-antipattern-review-companion-3` | 未使用の最小画像indexを割り当て、既存の実添付参照だけを予約する契約 | `imageAttachmentReferences.ts`の予約パターンを境界付き`attachments/image-N.ext`と`[Image #N]`へ限定し、通常ファイル名と外部URLの反例を追加 | 完了 |

## 完了義務
| 修正単位 | 義務ID | 種別 | 対象 finding | 不変条件と対象経路 | 違反を検出する反例・観測点 | 修正前または差し戻し時の結果 | 実装根拠 | 修正後の証拠 | 状態 |
|----------|--------|------|--------------|--------------------|------------------------------|--------------------------------|----------|--------------|------|
| `PRMA-01` | `PRMA-01-1` | 振る舞い修正 | `ai-antipattern-review-companion-1` | Markdown構文上の画像ノードだけをダウンロード・置換する | `<pre>`内のMarkdownリテラルと後続実画像を同時に入力する | 独自正規表現がraw HTML内のリテラルを画像として扱った | Markdown ASTの画像ノードとsource offsetを使用 | 対象テストと最終unit gate成功 | 完了 |
| `PRMA-01` | `PRMA-01-2` | 振る舞い修正 | `ai-antipattern-review-companion-1` | full・collapsed・shortcut形式の参照画像をdefinitionから解決する | 3形式の参照画像を同一入力で検証する | インライン画像形式以外を検出できなかった | `imageReference.identifier`とdefinition mapを使用 | 参照形式の回帰テスト成功 | 完了 |
| `PRMA-01` | `PRMA-01-3` | 既存契約保存 | `ai-antipattern-review-companion-1` | HTMLの実`img`要素を従来どおり処理する | Markdown画像とHTML画像を混在させる既存テスト | HTML構文境界と画像抽出が独自正規表現に混在していた | HTML ASTの実`img`開始タグだけを抽出 | 最終unit gate成功 | 完了 |
| `PRMA-01` | `PRMA-01-4` | 旧経路削除 | `ai-antipattern-review-companion-1` | 独自Markdownリテラル解析と旧画像正規表現を残さない | 旧parser symbolの検索 | 約500行の独自構文解析が存在した | 独自parser関数・型・正規表現を削除 | 旧symbol残存なし、lint成功 | 完了 |
| `PRMA-01` | `PRMA-01-5` | 利用側移行 | `ai-antipattern-review-companion-2` | 追加parser依存をproduction画像抽出経路で使用する | package依存とproduction import・呼び出しの照合 | 依存追加途中では未配線だった | Markdown・HTML parserを画像抽出経路へ直接配線 | build、unit、Companion resolved | 完了 |
| `FSME-01` | `FSME-01-1` | 既存契約保存 | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | 各shard attemptが固有の`cwd`・隔離環境を受け、出力と終了状態を返す | `cwd`・`env`伝播を検証するrunnerテスト | 既存tee helperにshard固有実行環境を渡す境界がなかった | `teed-command.mjs`の実行optionを必要最小限拡張 | build、lint、対象runnerテスト成功 | 完了 |
| `FSME-01` | `FSME-01-2` | 振る舞い修正 | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | 4シャードの初回実行をすべて完了してから再測定を開始する | 遅延した初回shardとnoise shardを組み合わせた決定的テスト | RPC timeout発生時点で正式gate全体が失敗した | 初回`Promise.all`完了後に再測定候補を処理 | `e2eMockRunner.test.ts`成功、正式E2Eログで順序確認 | 完了 |
| `FSME-01` | `FSME-01-3` | 振る舞い修正 | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | ローカルで成功テスト1件以上・失敗0件・bare `onTaskUpdate` timeoutのみの非0 shardを最大1回再測定する | assertion失敗、別エラー、引数付きtimeout、成功0件、CI、再測定再失敗 | 限定noiseと実失敗を区別する再測定境界がなかった | 既存`vitest-birpc-noise.mjs`を判定正本として再利用 | 対象runnerテストの全分岐成功 | 完了 |
| `FSME-01` | `FSME-01-4` | 既存契約保存 | `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | 全settled shardが0の場合だけ正式commandを成功させる | 初回noise後の再測定成功と再測定失敗を比較する | shard 2のテスト失敗0件でもworker errorで全体終了コード1だった | 最終attempt結果からprocess終了状態を集約 | 正式`npm run test:e2e:mock`終了コード0、全4 JSONが`success=true`・失敗テスト0件 | 完了 |
| `IAI-01` | `IAI-01-1` | 振る舞い修正 | `ai-antipattern-review-companion-3` | 通常の`image-N.ext`と外部URLを予約indexとして扱わない | `https://example.com/image-1.png`、`https://example.com/attachments/image-2.webp`、`image-3.webp`を入力する | 添付パス境界が弱く、無関係な文字列がindexを予約し得た | 添付相対パスの前後区切りを正規表現で限定 | allocator対象テスト8件成功 | 完了 |
| `IAI-01` | `IAI-01-2` | 既存契約保存 | `ai-antipattern-review-companion-3` | `[Image #N]`と実`attachments/image-N.ext`は予約し、残る最小indexから採番する | index 4の添付パスとindex 6のplaceholderを置き、1・2・3・5を順次期待する | 境界修正で実添付参照まで除外する危険があった | 共通allocator内でplaceholderと境界付き添付パスを収集 | 期待値1・2・3・5の回帰テスト成功 | 完了 |

## 受入条件
| finding ID | 受入条件 | 証拠 | 状態 |
|------------|----------|------|------|
| `ai-antipattern-review-companion-1` | Markdown画像だけを処理し、raw HTMLリテラルを保存し、参照形式画像も処理する | 対象回帰テスト、全unit、light IT成功 | 完了 |
| `ai-antipattern-review-companion-2` | parser依存がproduction経路で使用される | production配線確認、build・lint成功、Companion resolved | 完了 |
| `FINAL-NEW-MOCK-E2E-EVIDENCE-01` | 正式mock E2Eの4シャードが最終的に終了コード0となる | 初回shard 2の限定noiseを全初回完了後に1回再測定し、28件成功。全体終了コード0 | 完了 |
| `ai-antipattern-review-companion-3` | 無関係な本文・外部URLをindex予約から除外し、実添付参照だけを予約する | 外部URL2種、通常ファイル、実添付パス、placeholderを含む対象テスト8件成功。最終Companion status resolved | 完了 |

## 差し戻し後の証拠修正
| 修正単位 | 義務ID | verifier が確認した不足 | 前回の証拠が検出できなかった理由 | 修正した反例・観測点 | 同じ証明手段から再開・再確認した義務 |
|----------|--------|--------------------------|----------------------------------|----------------------|----------------------------------------|
| `PRMA-01` | `PRMA-01-1` | `<pre>`内のMarkdownリテラルを実画像として処理していた | fenced code等だけを走査し、raw HTML要素境界を扱っていなかった | `<pre>`内リテラルと後続実画像の反例を追加 | `PRMA-01-1`, `PRMA-01-3`, `PRMA-01-4` |
| `PRMA-01` | `PRMA-01-2` | Markdown参照形式画像を検出しなかった | インライン形式だけを観測していた | full・collapsed・shortcut形式を追加 | `PRMA-01-2`, `PRMA-01-4` |
| `PRMA-01` | `PRMA-01-5` | parser依存が追加途中で未使用だった | package変更とproduction配線の間の一時状態を検出された | import・AST処理経路・依存ツリーを再確認 | `PRMA-01-1`から`PRMA-01-5` |
| `FSME-01` | `FSME-01-4` | mock E2Eの最終終了コード0の証拠がなかった | テスト結果JSONだけではworker RPC timeoutによるprocess終了コード1を検出・回復できなかった | 正式入口の最終終了コードと全settled結果を観測点に変更 | `FSME-01-1`から`FSME-01-4` |
| `IAI-01` | `IAI-01-1` | 添付パス境界なしで無関係なファイル名を誤認した | 最初の反例がbare外部ファイル名だけで、外部URL内の`/attachments/image-N.ext`を検出できなかった | 添付パス形状を含む外部URLを反例へ追加し、前後区切りを厳格化 | `IAI-01-1`, `IAI-01-2` |

## 品質ゲート
| 種別 | 結果 | 証拠 |
|------|------|------|
| 画像index対象テスト | 成功 | `npm test -- src/__tests__/imageAttachmentReferences.test.ts`、1ファイル・8件成功 |
| E2E runner対象テスト | 成功 | `npm test -- src/__tests__/e2eMockRunner.test.ts` |
| テスト分類契約 | 成功 | `npm test -- src/__tests__/releaseVerificationWiring.test.ts`、19件成功 |
| ビルド | 成功 | `npm run build`、終了コード0 |
| Lint | 成功 | `npm run lint`、終了コード0 |
| Fast unit | 成功 | `npm test`、全4シャード成功 |
| Light IT | 成功 | `HOME=/tmp/takt-bench-v3-home npm run test:it`、159ファイル・2358件成功 |
| Full mock E2E | 成功 | `npm run test:e2e:mock`。初回shard 2のみbare RPC timeout、全初回完了後の1回再測定で28件成功、全体終了コード0 |
| E2E結果JSON | 成功 | `mock-shard-1.json`から`mock-shard-4.json`がすべて`success=true`、`failedTests=0` |
| 差分セルフスキャン | 成功 | `git diff --check`成功。今回の差分に未使用化、依存方向違反、重複責務、空白エラーなし |
| Companion | 成功 | `ai-antipattern-review-companion-1`、`-2`、`-3`の最終状態resolved |

## 未完了義務
- なし