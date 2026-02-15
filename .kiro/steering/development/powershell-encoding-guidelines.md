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

```powershell
# ❌ 悪い例（デフォルトエンコーディングに依存）
$data | Out-File -FilePath "output.json"

# ✅ 良い例（UTF-8明示）
$data | Out-File -FilePath "output.json" -Encoding UTF8

# ✅ より良い例（UTF-8 BOMなし）
$data | Out-File -FilePath "output.json" -Encoding UTF8NoBOM
```

### 3. ConvertTo-Json使用時

```powershell
# ✅ 推奨パターン
$response | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputFile -Encoding UTF8
```

### 4. Set-Content使用時

```powershell
# ✅ UTF-8 BOMなし指定
Set-Content -Path "file.txt" -Value $content -Encoding UTF8NoBOM
```

## 既存スクリプトの修正パターン

### fetch-data-range.ps1（修正済み）
```powershell
# 修正前
$response | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputFile

# 修正後
$response | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputFile -Encoding UTF8
```

## チェックリスト

スクリプト作成・修正時に確認：

- [ ] `Out-File`に`-Encoding UTF8`または`-Encoding UTF8NoBOM`を指定
- [ ] `Set-Content`に`-Encoding UTF8NoBOM`を指定
- [ ] ファイル作成時にfsWriteを使用（自動的にUTF-8 BOMなし）
- [ ] 日本語コメント・メッセージが正しく表示されることを確認

## PowerShellバージョン別の違い

| バージョン | デフォルト | 推奨 |
|-----------|-----------|------|
| PowerShell 5.1 | UTF-16LE BOM | `-Encoding UTF8` |
| PowerShell 7+ | UTF-8 BOMなし | `-Encoding UTF8` or `-Encoding UTF8NoBOM` |

## トラブルシューティング

| 問題 | 原因 | 解決策 |
|------|------|--------|
| 日本語が文字化け | エンコーディング未指定 | `-Encoding UTF8`追加 |
| BOM付きファイル | UTF8指定（PS 5.1） | `-Encoding UTF8NoBOM`使用（PS 7+） |
| Git差分に不要な変更 | エンコーディング不一致 | 全ファイルをUTF-8 BOMなしに統一 |

## 関連ドキュメント

- **ファイル命名規則**: `tdnet-file-naming.md` - スクリプトファイルの命名規則
- **デプロイスクリプト**: `../infrastructure/deployment-scripts.md` - デプロイスクリプト実装
- **データスクリプト**: `data-scripts.md` - データ操作スクリプト実装
- **監視スクリプト**: `../infrastructure/monitoring-scripts.md` - 監視スクリプト実装
