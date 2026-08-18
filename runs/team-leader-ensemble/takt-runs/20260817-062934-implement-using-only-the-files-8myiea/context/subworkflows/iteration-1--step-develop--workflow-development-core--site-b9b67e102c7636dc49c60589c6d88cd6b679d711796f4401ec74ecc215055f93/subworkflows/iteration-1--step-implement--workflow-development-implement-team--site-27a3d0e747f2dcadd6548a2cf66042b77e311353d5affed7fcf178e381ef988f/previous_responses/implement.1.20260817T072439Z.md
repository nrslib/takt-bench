## decomposition

---

{
  "parts": [
    {
      "id": "part-1",
      "title": "指定タスクの実装（単一契約経路）",
      "instruction": "担当ファイル: `.takt/runs/20260817-062934-implement-using-only-the-files-8myiea/context/task/order.md` を読み、そこに明示された実装対象ファイル一式。対象パスは未提示のため、order.md と同ディレクトリ内の指定資料を確認して確定し、指定外のファイルは変更しない。参照専用ファイル: `.takt/runs/20260817-062934-implement-using-only-the-files-8myiea/context/task/` 内の、実装対象として指定されていない全ファイル、および Report Directory の既存レポート。実装内容: order.md、指定された task 資料、Report Directory の全文を確認し、同一 contract family の owner と相互依存する participates 経路を分断せず、指定仕様に従って実装する。未提示の repository 事実を推測せず、旧契約の互換・fallback・migration は要求に明示された範囲だけ扱う。担当外ファイル、コミット、ステージング、push は行わない。完了基準: order.md が指定する変更を担当ファイルへ反映し、同一 family の owner から終端 consumer までの必要な経路が欠落なく実装され、変更対象外の契約が保持されていること。検証は実装後の後続 feedback batch で実施するため、この part では全体品質ゲートを重複実行しない。"
    }
  ]
}

---

## part-1: 指定タスクの実装（単一契約経路）
