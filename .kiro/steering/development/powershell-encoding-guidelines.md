---
inclusion: fileMatch
fileMatchPattern: '**/*.ps1'
---

# PowerShellスクリプト エンコーディングガイドライン

## 必須ルール

すべてのPowerShellスクリプトはUTF-8 BOMなしで作成。`Out-File`と`Set-Content`使用時は必ず`-Encoding UTF8NoBOM`を指定。

```powershell
# ✅ 正しい例
$data | Out-File -FilePath "output.json" -Encoding UTF8NoBOM

# ❌ 悪い例（エンコーディング未指定）
$data | Out-File -FilePath "output.json"
```

## チェックリスト

スクリプト作成・修正時に確認：

- [ ] `Out-File`に`-Encoding UTF8NoBOM`を指定（必須）
- [ ] `Set-Content`に`-Encoding UTF8NoBOM`を指定（必須）
- [ ] ファイル作成時にfsWriteを使用（自動的にUTF-8 BOMなし）
- [ ] 日本語コメント・メッセージが正しく表示されることを確認
- [ ] `-Encoding UTF8`（BOM付き）は使用しない

## PowerShellバージョン

| バージョン | デフォルト | 必須指定 |
|-----------|-----------|---------|
| 5.1 | UTF-16LE BOM | `-Encoding UTF8NoBOM` |
| 7+ | UTF-8 BOMなし | `-Encoding UTF8NoBOM` |

## トラブルシューティング

| 問題 | 原因 | 解決策 |
|------|------|--------|
| 日本語が文字化け | エンコーディング未指定 | `-Encoding UTF8NoBOM`追加 |
| BOM付きファイル | UTF8指定 | `-Encoding UTF8NoBOM`に修正 |
| Git差分に不要な変更 | エンコーディング不一致 | 全ファイルを`-Encoding UTF8NoBOM`に統一 |

## 関連

`tdnet-file-naming.md`, `../infrastructure/deployment-scripts.md`, `data-scripts.md`, `../infrastructure/monitoring-scripts.md`
