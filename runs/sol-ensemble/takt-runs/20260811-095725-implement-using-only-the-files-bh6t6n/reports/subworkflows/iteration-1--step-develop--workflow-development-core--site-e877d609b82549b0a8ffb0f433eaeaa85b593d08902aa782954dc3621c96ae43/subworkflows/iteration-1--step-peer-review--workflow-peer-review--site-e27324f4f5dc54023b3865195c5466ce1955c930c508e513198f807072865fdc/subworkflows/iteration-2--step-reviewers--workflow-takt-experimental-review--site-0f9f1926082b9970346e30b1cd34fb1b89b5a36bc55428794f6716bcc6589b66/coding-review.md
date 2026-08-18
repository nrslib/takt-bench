# コーディングレビュー

## 結果: REJECT

## サマリー

旧Markdown非線形走査は解消済みだが、共通化された画像採番処理に安全整数境界を超えた場合の重複採番を確認した。PR画像およびretry添付の保存が失敗するため差し戻す。

## 契約入口チェック

| 入口・経路 | 元要件 | 実装根拠 | テスト根拠 | 判定 | 例外・未確認の根拠 |
|-----------|--------|----------|------------|------|-------------------|
| `takt add --pr` | 既存参照と衝突せず画像をtask attachmentへ保存 | `src/features/tasks/prReviewAttachments.ts:564` | `src/__tests__/prReviewAttachments.test.ts:112` | ❌ | 安全整数を超える既存番号が未検証 |
| 対話CLI `--pr` | PR画像を実行・保存まで維持 | `src/app/cli/routing-inputs.ts:73` | `src/__tests__/cli-routing-pr-resolve.test.ts:370` | ❌ | 同じPR画像採番処理を利用するため重複採番が到達可能 |
| pipeline `--pr` | attachment付きtask specをworkflowへ渡す | `src/features/pipeline/steps.ts:232` | `src/__tests__/pipelineExecution.test.ts:1433` | ❌ | 重複fileNameによりtask spec作成時に失敗する |
| retry添付再注入 | 既存添付と重複しない番号を割り当てる | `src/features/tasks/retryTaskSpecAttachments.ts:52` | `src/__tests__/retryTaskSpecAttachments.test.ts:39` | ❌ | 実保存経路で重複destinationエラーを再現 |
| Markdown literal走査 | 大規模本文を非線形に走査しない | `src/features/tasks/prReviewAttachments.ts:429` | `src/__tests__/prReviewAttachments.test.ts:569` | ✅ | なし |

## 非finding化した懸念

| 項目 | 場所 | 分類 | finding化しない根拠 |
|------|------|------|---------------------|
| Markdown前方走査の意味論回帰 | `src/features/tasks/prReviewAttachments.ts:429` | no_issue_after_verification | literal文脈を含む対象30テストと30,000行回帰テストが成功 |
| 通常範囲の既存placeholder採番 | `src/features/tasks/attachments.ts:31` | no_issue_after_verification | `[Image #1]`からの採番はPR・retryの既存テストで成功。問題は安全整数境界に限定される |

## 問題系列の完了走査

| family_tag / 変更契約 | 不変条件・根本原因 | 定義・生成・検証 | 利用・永続化・再注入 | 失敗・中断・再試行・再開・並列・補助入口 | mock・fixture・test double | 未確認経路 | 判定 |
|-----------------------|-------------------|------------------|----------------------|------------------------------------------|----------------------------|------------|------|
| `image-attachment-index-precision` | 既存番号より大きい一意なplaceholder／fileNameを桁落ちなく生成する | `src/features/tasks/attachments.ts:31-55` | PR: `prReviewAttachments.ts:564-575`、retry: `retryTaskSpecAttachments.ts:52-58`、保存: `attachments.ts:126-134` | 2添付のretry保存で重複destinationエラーを再現。PRのadd・対話CLI・pipelineも同じhelperへ到達 | PR・retryテストはいずれも小さい番号のみ | なし | `CODE-NEW-imageAttachmentIndex-L37` |
| `markdown-literal-scan-complexity` | 行ごとの本文prefix再走査を行わない | `src/features/tasks/prReviewAttachments.ts:429-520` | 3つのPR入口が共通処理を利用 | 画像なし30,000行、通常画像、各literal文脈を確認 | `prReviewAttachments.test.ts` | なし | 問題なし |

## 今回の指摘（new）

| # | finding_id | family_tag | 重大度 | 場所 | 問題 | 影響 | 修正案 |
|---|------------|------------|--------|------|------|------|--------|
| 1 | `CODE-NEW-imageAttachmentIndex-L37` | `image-attachment-index-precision` | Medium | `src/features/tasks/attachments.ts:37` | 既存番号を`Number`へ変換するため、`[Image #9007199254740992]`では`+1`や後続の`+=1`が値を進めず、同じplaceholderとfileNameを複数回生成する | 既存参照を新規画像が上書きし、複数画像では`Task attachment destination already exists`によりPR保存・pipeline・retryが失敗する | 採番を`BigInt`または10進文字列として桁落ちなく扱う。安全整数を超える既存番号と2画像を組み合わせたPR・retry回帰テストを追加する |

## 継続指摘（persists）

| # | finding_id | family_tag | 前回根拠 | 今回根拠 | 問題 | 修正案 |
|---|------------|------------|----------|----------|------|--------|
| - | なし | - | - | - | - | - |

## 解消済み（resolved）

| finding_id | 元の期待結果 | 解消根拠 |
|------------|--------------|----------|
| `AI-NEW-MARKDOWN-LITERAL-SCAN-158` | 行ごとの本文prefix再走査を除去し、大規模画像なし本文で非線形退行を防ぐ | `src/features/tasks/prReviewAttachments.ts:429`の前方状態計算と、30,000行回帰テストの成功を確認 |

## 再開指摘（reopened）

| # | finding_id | family_tag | 解消根拠（前回） | 再発根拠 | 問題 | 修正案 |
|---|------------|------------|----------------|---------|------|--------|
| - | なし | - | - | - | - | - |

## 検証証跡

- 差分確認: 共通採番helperの定義と全参照を確認し、PR・retryの2経路へ限定されることを確認
- ビルド: このレビューでは未実行
- テスト: `npm test -- src/__tests__/prReviewAttachments.test.ts src/__tests__/retryTaskSpecAttachments.test.ts`を実行し、型契約検査、unit 30件、light IT 3件が成功
- 再現: `[Image #9007199254740992]`を含む本文と2添付をretry保存経路へ渡し、両方が`image-9007199254740992.png`となってdestination重複エラーになることを確認
- 差分整合: `git diff --check`成功

## 再走査証跡（2回目以降のレビューで必須）

| 照合した Policy/Knowledge の章 | 差分側の根拠（`file:line` または「該当なし」） |
|-------------------------------|---------------------------------------------|
| 契約影響経路・呼び出しチェーン | `src/features/tasks/attachments.ts:31-55`、`src/features/tasks/prReviewAttachments.ts:564-575`、`src/features/tasks/retryTaskSpecAttachments.ts:52-58` |
| 意味付きフィールド・契約一貫性 | placeholderとfileNameが同じindexを共有する`src/features/tasks/attachments.ts:53-54` |
| 副作用・状態変更の失敗経路 | 重複destinationを拒否する`src/features/tasks/attachments.ts:126-134` |
| 境界値分析 | `Number.MAX_SAFE_INTEGER`を超える10進番号に対するテストは該当なし |
| 欠陥クラス再走査 | 共通helperの全参照を検索し、PRとretryの両経路で同一原因を確認 |
| 解消判定 | 旧prefix走査不存在、`src/features/tasks/prReviewAttachments.ts:429-520`、大規模回帰テスト成功 |

## REJECT判定条件

- `CODE-NEW-imageAttachmentIndex-L37`が`new`として1件存在するためREJECT。