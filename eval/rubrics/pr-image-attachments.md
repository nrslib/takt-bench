# 題材: PRコメント画像 → task attachments 配置(TAKT 本体)

対象は TypeScript CLI プロジェクト(TAKT)のリポジトリで、「PR コメント内の画像をダウンロードして task attachments に配置する機能」が実装済みの状態。

状態: **凍結**(taktrc-experimental-sol-lead / taktrc-experimental-sol-all を採点済み。項目変更は全対象の再採点を要する)

## F. 機能の正しさと堅牢性

- F1: コードフェンス・インラインコード内の擬似画像記法を誤検出しない
- F2: 本文・通常コメント・review summary・review thread の全対象から抽出し、連結時に一方の未閉鎖フェンスが他方を壊さない
- F3: 同一 URL は1回取得・1添付に集約
- F4: リダイレクトの自前制御(回数上限+行き先の許可検証。fetch 既定の追従任せは 0)
- F5: 通信タイムアウト
- F6: 1ファイル上限(ストリーム実測打ち切り)と全体総量上限
- F7: Content-Type と magic bytes の両検証、認証トークンの他ホスト非転送
- F8: 正常・例外・キャンセル・process.exit の全出口で一時領域が消える(exit ハンドラ。finally 頼みは 1)
- F9: 採番が既存 `[Image #N]` と衝突せず、整数境界(巨大値・非数値)で壊れない
- F10: 3経路(add --pr / 対話 --pr / pipeline --pr)すべてで機能する

## 分類(欠陥プロファイル用。採点後に変更しない)

```json classification
{
  "F1": "correctness",
  "F2": "correctness",
  "F3": "correctness",
  "F4": "safety",
  "F5": "safety",
  "F6": "safety",
  "F7": "safety",
  "F8": "safety",
  "F9": "correctness",
  "F10": "correctness"
}
```
