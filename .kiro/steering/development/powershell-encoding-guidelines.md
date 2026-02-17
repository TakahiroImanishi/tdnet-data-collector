---
inclusion: fileMatch
fileMatchPattern: '**/*.ps1'
---

# PowerShellスクリプト エンコーディングガイドライン

## 必須ルール

### 1. ファイル作成時のエンコーディング指定

**すべてのPowerShellスクリプトは UTF-8 BOMなし で作成**

```typescript
// fsWrite使用時
fsWrite({
  path: "scripts/example.ps1",
  text: scriptContent  // UTF-8 BOMなしで自動保存される
});
```

### 2. Out-File使用時の明示的指定

**必須**: `-Encoding UTF8NoBOM` のみを使用

```powershell
# ❌ 悪い例（デフォルトエンコーディングに依存）
$data | Out-File -FilePath "output.json"

# ❌ 悪い例（小文字は禁止）
$data | Out-File -FilePath "output.json" -Encoding utf8

# ❌ 悪い例（BOM付き）
$data | Out-File -FilePath "output.json" -Encoding UTF8

# ✅ 正しい例（UTF-8 BOMなし）
$data | Out-File -FilePath "output.json" -Encoding UTF8NoBOM
```

### 3. ConvertTo-Json使用時

```powershell
# ✅ 推奨パターン
$response | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputFile -Encoding UTF8NoBOM
```

### 4. Set-Content使用時

```powershell
# ❌ 悪い例（小文字は禁止）
Set-Content -Path "file.txt" -Value $content -Encoding utf8nobom

# ✅ UTF-8 BOMなし指定（大文字）
Set-Content -Path "file.txt" -Value $content -Encoding UTF8NoBOM
```

## 既存スクリプトの修正パターン

```powershell
# 修正前
$response | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputFile

# 修正後
$response | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputFile -Encoding UTF8NoBOM
```

## チェックリスト

スクリプト作成・修正時に確認：

- [ ] `Out-File`に`-Encoding UTF8NoBOM`を指定（必須）
- [ ] `Set-Content`に`-Encoding UTF8NoBOM`を指定（必須）
- [ ] ファイル作成時にfsWriteを使用（自動的にUTF-8 BOMなし）
- [ ] 日本語コメント・メッセージが正しく表示されることを確認
- [ ] `-Encoding UTF8`（BOM付き）は使用しない

## PowerShellバージョン別の違い

| バージョン | デフォルト | 必須 |
|-----------|-----------|------|
| PowerShell 5.1 | UTF-16LE BOM | `-Encoding UTF8NoBOM` |
| PowerShell 7+ | UTF-8 BOMなし | `-Encoding UTF8NoBOM` |

## トラブルシューティング

| 問題 | 原因 | 解決策 |
|------|------|--------|
| 日本語が文字化け | エンコーディング未指定 | `-Encoding UTF8NoBOM`追加 |
| BOM付きファイル | UTF8指定 | `-Encoding UTF8NoBOM`に修正 |
| Git差分に不要な変更 | エンコーディング不一致 | 全ファイルを`-Encoding UTF8NoBOM`に統一 |

## 関連ドキュメント

- **ファイル命名規則**: `tdnet-file-naming.md` - スクリプトファイルの命名規則
- **デプロイスクリプト**: `../infrastructure/deployment-scripts.md` - デプロイスクリプト実装
- **データスクリプト**: `data-scripts.md` - データ操作スクリプト実装
- **監視スクリプト**: `../infrastructure/monitoring-scripts.md` - 監視スクリプト実装
