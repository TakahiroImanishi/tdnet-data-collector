---
inclusion: fileMatch
fileMatchPattern: '**/*.ps1'
---

# PowerShellスクリプト エンコーディングガイドライン

## 必須ルール

すべてのPowerShellスクリプトはUTF-8 BOMなしで作成。スクリプトの先頭に包括的なエンコーディング設定を追加。

```powershell
# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
# PowerShell 5.1互換性のため
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}
```

## 理由

- **文字化け防止**: 日本語メッセージが正しく表示される
- **クロスプラットフォーム対応**: PowerShell Core（7+）との互換性
- **一貫性**: すべてのファイル操作でUTF-8を使用

## エンコーディング設定の詳細

| 設定 | 目的 | 対象バージョン |
|------|------|---------------|
| `$PSDefaultParameterValues['*:Encoding']` | すべてのコマンドレットのデフォルトエンコーディング | 全バージョン |
| `[Console]::OutputEncoding` | コンソール出力エンコーディング | 全バージョン |
| `$OutputEncoding` | パイプライン出力エンコーディング | 全バージョン |
| `$PSDefaultParameterValues['Out-File:Encoding']` | Out-Fileコマンドレット（PS 5.1互換） | PowerShell 5.1 |

## 従来の設定（非推奨）

```powershell
# ❌ 不完全な設定（文字化けの原因）
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['Out-File:Encoding'] = 'UTF8NoBOM'
```

この設定では、`$OutputEncoding`と`$PSDefaultParameterValues['*:Encoding']`が設定されていないため、一部のコマンドレットで文字化けが発生します。

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
