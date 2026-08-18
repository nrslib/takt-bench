要件を「画像付きPRコメントの取得・検証・保存・各 `--pr` 経路への伝播」と要約し、計画で定義された契約を直接観測するテストだけを先に作成します。実装・テスト作成に該当するため `coding` スキルを使用し、まずスキル、タスク正本、Knowledge／Policy、指定レポートを末尾まで確認します。プロダクションコードは変更しません。
`coding` スキルが指定する6つの正本も確認対象に加えます。このスキルにより、テスト差分についてもフォールバック、配線漏れ、スコープ逸脱、依存方向をセルフレビューします。次に、各文書の行数を確認して分割読了し、指定された Report Directory だけを一覧化します。
正本の分類は、変更対象が `PRIMG-01`〜`PRIMG-07`、維持対象が `PRIMG-08`、品質証拠が `PRIMG-09` です。対象外は Issue/GitLab/任意外部URL/SVG等です。ここから、計画で指定された所有者と既存テストの全 assertion を確認し、テスト名や配置ではなく実際の契約対応で追加先を決めます。
テスト境界は、純粋な抽出・重複排除・URL拒否・取得検証を unit、実ファイル保存を既存の `addTask.test.ts`（light IT）、入口から末端引数までの配線を既存 routing／pipeline テストに置きます。誤実装として「PR本文だけ走査」「同一URLを複数回取得」「外部URLを取得」「Content-Typeだけを信用」「attachmentを生成して保存・実行へ渡さない」「cleanup漏れ」を拒否する assertion に絞ります。
主要テストを追加しました。現時点の差分はテストファイルだけです。続いて、まず差分を機械確認し、対象テストを実行して「未実装のモジュール／配線」が原因で失敗することを確認します。その後、テストコード自体の構文・型・fixture不備がないか、未実装モジュールを除いた静的検査結果と照合します。
対象テストは実行前の型契約ゲートで停止し、原因は未実装機能ではなく依存関係未導入（`tsc: command not found`）でした。テスト失敗の根拠としては使えないため、リポジトリ指定の `npm install` で依存関係を整え、同じコマンドを再実行します。
再実行できました。結果は意図した red 状態です。既存81件中76件は成功し、新規契約の7箇所だけが失敗しました。内訳は、新規2モジュール未作成、routingで初期attachment／cleanup未配線、pipelineでtask spec／cleanup未配線、`add --pr`でattachment保存／cleanup未配線です。fixtureや既存契約の破損ではなく、計画した未実装動作に対応しています。次に lint とIT分類契約を確認し、テスト差分自体の欠陥を修正します。
セルフスキャンで、`npm install` が作業対象外の `package-lock.json` を書き換えていることを検出しました。これは依存導入時の副作用で要件差分ではないため、テスト差分は維持したまま、この自分が生じさせた lockfile 差分だけを逆パッチで戻します。
維持対象 `PRIMG-08` の直接証拠として、画像処理と無関係なPR整形・レビュー分類、および既存インライン画像解析の所有テストを個別実行します。これらは新規モジュールに依存しないため、redテストとは分離して既存契約の維持を確認できます。
テスト先行実装を完了しました。プロダクションコードは変更していません。

追加・更新:

- [prReviewAttachments.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/prReviewAttachments.test.ts): 全PRセクション、Markdown/HTML、重複排除、外部URL拒否、失敗時cleanup
- [github-pr-image-download.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/github-pr-image-download.test.ts): 4形式、認証、URL制限、MIME/magic不一致、サイズ上限、HTTP失敗、token非露出
- [addTask.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/addTask.test.ts): attachment保存、`order.md`追記、取消時cleanup
- [cli-routing-pr-resolve.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/cli-routing-pr-resolve.test.ts): interactive初期入力、execute/save_task伝播、取消時cleanup
- [pipelineExecution.test.ts](/Users/nrs/work/git/takt-worktrees/20260811T0957-pr-komento-no-wodaunroodoshite-bc1d7fe94d416276/src/__tests__/pipelineExecution.test.ts): attachment付きtask spec実行、成功・失敗時cleanup

検証結果:

- 対象テスト: 意図したred状態。既存92件成功、新規契約に対応する7テストと未実装2モジュールが失敗
- `npm run lint`: 成功
- 分類契約テスト: 19件成功
- PR整形・インライン画像の維持テスト: 29件成功
- task specのrun context転送テスト: 13件成功
- 変更した重いIT `addTask.test.ts`: 対象実行済み
- 全新規assertionを `PRIMG-01`〜`PRIMG-08`へ対応付け済み。未対応assertionなし
- セルフスキャン: 未使用、依存方向、重複責務、対象外差分を確認し、問題なし。`npm install`によるlockfile差分は除去済みです。