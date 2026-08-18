# 実装完了証跡

## 完了契約

| 契約ID | 由来 | 上流で確立した完了義務 | 実装結果 | 実装箇所 | 反例と観測結果 | 証拠 | 状態 |
|--------|------|------------------|----------|----------|------------------|------|------|
| 未確認（契約台帳ID不在） | 未確認 | 直前の実装レポートにはGitHub PR画像attachment familyの概要はあるが、追記専用契約台帳のID付き行は記録されていない | GitHub PR画像の抽出、許可URL制限、Content-Type・magic bytes・10MiB検証、attachment保存、`add --pr`・通常`--pr`・pipeline`--pr`への受け渡しを実装 | `src/infra/github/pr-images.ts`、`src/infra/github/pr.ts`、`src/features/tasks/add/index.ts`、`src/app/cli/routing.ts`、`src/features/pipeline/execute.ts`、行番号は台帳に未記録 | 外部URL、コード内画像、非対応Content-Type、Content-Type不一致、サイズ超過を拒否。キャンセル・失敗時の一時添付削除を確認 | 正常系: 対象テスト170件成功; 失敗経路: URL・形式・サイズ検証テスト成功; 境界状態: 10MiB超過と添付番号衝突を検証; assertion: pipelineの`taskSpec`にattachment manifestを確認; コマンド: `npm test -- src/__tests__/github-pr-images.test.ts src/__tests__/github-pr.test.ts src/__tests__/imageAttachments.test.ts src/__tests__/addTask.test.ts src/__tests__/cli-routing-pr-resolve.test.ts src/__tests__/pipelineExecution.test.ts` | 未完了 |

## 影響経路の確認

| 契約ID | 確認した生成元・同種分岐・補助入口・消費元 | 移行・保持・旧経路 | 該当する不変条件と連続シナリオ |
|--------|--------------------------------------------|--------------------|----------------------------------|
| 未確認（契約台帳ID不在） | GitHub PR本文・通常コメント・review summary・review thread → 画像抽出・検証 → `gh api` → `StoredImageAttachment` → task specまたはinteractive seed → workflow実行 | GitHub PR経路を追加。既存task attachment manifest、`order.md`形式、run context staging、Issue・GitLab経路は保持。任意外部URL取得や旧alias経路は追加していない | 認可・許可拒否: GitHub attachment URL以外を拒否。失敗・再進入: ダウンロード失敗、保存失敗、キャンセル時に一時添付を削除。終端: `add --pr`の`order.md`、通常`--pr`のinteractive seed、pipelineの`executeTask.taskSpec`まで確認。対象テスト、統合テスト、mock E2Eで検証済み |

## 品質ゲート

| 種別 | 実行内容 | 結果 |
|------|----------|------|
| ビルド | `npm run build` | 成功 |
| 静的検査 | `npm run lint` | 成功 |
| Fast Unit Gate | `npm test`、4 shard合計5,427件 | 成功 |
| 対象テスト | PR画像・PR取得・添付・add・routing・pipelineテスト170件 | 成功 |
| 軽量統合 | `HOME=/tmp/takt-bench-v3-home npm run test:it`、131ファイル・2,049件 | 成功 |
| モックE2E | `npm run test:e2e:mock`、成功155件・skip17件・失敗0 | 成功 |
| smoke E2E | `npm run test:e2e:smoke`、成功21件・skip1件 | 成功 |

## 未確認範囲

| 項目 | 理由 | 決定的な代替検証 | 残るリスク |
|------|------|------------------|------------|
| 追記専用契約台帳の全行、契約ID、計画基底行と新規発見行の対応 | 利用可能な実装レポートに契約ID付き台帳が記録されていない | 実装レポートに記録された契約family、影響経路、対象テスト、品質ゲート結果を確認 | 上流契約とのID単位の完全な対応を確定できない。契約台帳の正本が提供されれば再照合が必要 |