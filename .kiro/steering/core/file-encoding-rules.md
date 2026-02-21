# ファイルエンコーディングルール

**重要: すべてのファイルはUTF-8 BOM無しで作成・編集してください**

## 必須ルール

### すべてのファイル作成・編集時
- **文字エンコーディング**: UTF-8 BOM無し（UTF-8 without BOM）
- **改行コード**: LF（Line Feed）推奨
- **対象ファイル**: すべてのテキストファイル（.ts, .js, .json, .md, .yml, .yaml, .txt, .env等）

### 理由
- **BOM（Byte Order Mark）の問題**:
  - Node.js/TypeScriptでBOMが含まれるとパースエラーが発生する可能性
  - Gitでの差分表示が不正確になる
  - 一部のツールやエディタで互換性問題が発生
  - AWS Lambda実行時に予期しないエラーの原因となる

### 確認方法

#### PowerShellでBOM確認
```powershell
# 単一ファイル確認
$bytes = [System.IO.File]::ReadAllBytes("path/to/file.ts")
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Write-Host "BOM detected"
} else {
    Write-Host "No BOM (OK)"
}

# プロジェクト全体スキャン
Get-ChildItem -Recurse -Include *.ts,*.js,*.json,*.md | ForEach-Object {
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        Write-Host "BOM found: $($_.FullName)"
    }
}
```

#### VS Code設定
```json
{
  "files.encoding": "utf8",
  "files.autoGuessEncoding": false
}
```

### 修正方法

#### PowerShellでBOM削除
```powershell
# 単一ファイル
$content = Get-Content -Path "file.ts" -Raw
[System.IO.File]::WriteAllText("file.ts", $content, (New-Object System.Text.UTF8Encoding $false))

# 複数ファイル一括変換
Get-ChildItem -Recurse -Include *.ts,*.js,*.json,*.md | ForEach-Object {
    $content = Get-Content -Path $_.FullName -Raw
    [System.IO.File]::WriteAllText($_.FullName, $content, (New-Object System.Text.UTF8Encoding $false))
}
```

## タスク実行時のチェックリスト

### ファイル作成時
- [ ] UTF-8 BOM無しで作成
- [ ] エディタ設定確認（VS Code: 右下ステータスバー「UTF-8」表示）

### ファイル編集時
- [ ] 既存ファイルのエンコーディング確認
- [ ] BOM検出時は削除してから編集

### 完了時
- [ ] 作成・編集したすべてのファイルがUTF-8 BOM無しであることを確認
- [ ] 必要に応じてPowerShellスクリプトで一括確認

## 関連

`tdnet-data-collector.md`, `tdnet-implementation-rules.md`
