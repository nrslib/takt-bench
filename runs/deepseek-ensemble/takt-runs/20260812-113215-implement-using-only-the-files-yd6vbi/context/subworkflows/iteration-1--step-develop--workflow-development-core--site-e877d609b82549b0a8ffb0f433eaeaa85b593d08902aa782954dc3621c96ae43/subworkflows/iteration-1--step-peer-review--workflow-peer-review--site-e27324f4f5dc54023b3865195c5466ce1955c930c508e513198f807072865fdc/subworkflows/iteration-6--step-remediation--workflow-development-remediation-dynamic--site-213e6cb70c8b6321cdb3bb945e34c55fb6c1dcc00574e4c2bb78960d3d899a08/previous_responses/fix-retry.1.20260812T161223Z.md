The verifier found a real bug: sequential `replaceAll` causes re-conversion when multiple placeholders map to overlapping values. Let me fix it with a single-pass replacement owned by the shared module.
Now update the retry consumer to use the single-pass replacement:
Now add a regression test for the multi-placeholder case:
All 19 tests pass. Now let me run the full verification suite for the affected consumers and build/lint.
Lint passes. Now let me run the full fast unit gate and the classification contract test.
The `check:release failed` is the harness's intentional simulation (20/20 passed). Now run light IT and e2e:mock since this touches retry/CLI behavior.
The e2e:mock run is hanging (likely environment-related). Let me run it in the background and capture output to a file.
The e2e:mock is still running across shards. Let me wait for it to complete.
e2e:mock passes (55 passed, rest skipped/todo). All gates green. Let me do the self-scan of my edits.
The diff confirms my step's changes are correct. Self-scan: `replaceImageAttachmentPlaceholders` is used by the retry consumer (no unused import), dependency direction is features→shared (correct), and the replacement logic now lives in the shared owner consistent with the plan.

## 作業結果
- 修正完了

## 変更内容と受入条件
verifier が指摘した OBL-6 / OBL-8（retry 経路で複数 placeholder を順次 `replaceAll` すると、置換先が別の元 placeholder と一致して同一番号化する）を修正した。

- **正本** `src/shared/utils/imageAttachmentReferences.ts`: 単一走査で全 placeholder を一括置換する `replaceImageAttachmentPlaceholders(text, replacements)` を追加。`IMAGE_ATTACHMENT_PLACEHOLDER_PATTERN` の `replace` コールバックで、各 placeholder を置換マップから解決するため、置換結果が別の元 placeholder と一致しても再変換されない。
- **retry consumer** `src/features/tasks/retryTaskSpecAttachments.ts:93`: 順次 `replaceAll` ループを `replaceImageAttachmentPlaceholders` の単一走査に置換。
- **回帰テスト** `src/__tests__/retryTaskSpecAttachments.test.ts`: 本文最大番号 `2`、retry note に `[Image #1]` と `[Image #3]`、添付2件の反例を追加。期待値 `Use [Image #3] and [Image #4].`（一意）を検証。

差し戻し後に再開した全完了義務（OBL-1〜OBL-8）を再確認した。OBL-6 / OBL-8 は上記の単一走査化で解消。OBL-1〜5, 7 は既存テストと静的検索で成立を再確認。

## 検証結果と証拠
- `npm test -- src/__tests__/retryTaskSpecAttachments.test.ts src/__tests__/imageAttachmentReferences.test.ts` → 19 passed（新規回帰テスト含む）
- `npm test -- src/__tests__/prReviewImageAttachments.test.ts src/__tests__/imageAttachments.test.ts` → 18 + 16 passed
- `npm run build` → 成功
- `npm run lint` → 成功（`prefer-const` 1件を修正後クリーン）
- `npm test`（fast unit gate）→ 1864 passed
- `npm test -- src/__tests__/releaseVerificationWiring.test.ts` → 20/20 passed（`check:release failed` はハーネスの意図的シミュレーション）
- `HOME=/tmp/takt-bench-v3-home npm run test:it` → 2366 passed
- `HOME=/tmp/takt-bench-v3-home npm run test:e2e:mock` → 55 passed / 13 skipped / 30 todo（残りは既存 skip/todo）

編集後セルフスキャン: 追加した `replaceImageAttachmentPlaceholders` は retry consumer で使用（未使用 import なし）、依存方向は features→shared で規約に適合、置換責務は正本に集約済み。問題なし。