# TDnet Data Collector - 改善履歴ファイル作成スクリプト
# 使用方法: .\create-improvement.ps1 -TaskNumber "1.1"

param(
    [Parameter(Mandatory=$true)]
    [string]$TaskNumber
)

# JST時刻を取得
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$readableTimestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# 既存の改善ファイル数を取得して連番を決定
$existingFiles = Get-ChildItem -Path $PSScriptRoot -Filter "task-$TaskNumber-improvement-*.md" -ErrorAction SilentlyContinue
$improvementNumber = $existingFiles.Count + 1

# ファイル名を生成
$filename = "task-$TaskNumber-improvement-$improvementNumber-$timestamp.md"
$filepath = Join-Path $PSScriptRoot $filename

# テンプレート内容
$template = @"
# タスク${TaskNumber}完了後の改善

**実行日時:** $readableTimestamp JST

## 問題点

- [発見された問題の説明]

## 改善内容

- [実施した改善の説明]

## 影響範囲

- **requirements.md**: [変更内容 / 変更なし]
- **design.md**: [変更内容 / 変更なし]
- **steering**: [変更内容 / 変更なし]
- **コード**: [変更内容 / 変更なし]

## 検証結果

- [改善の効果]

## 優先度

[Critical / High / Medium / Low]
"@

# ファイルを作成
Set-Content -Path $filepath -Value $template -Encoding UTF8

Write-Host "改善履歴ファイルを作成しました: $filename" -ForegroundColor Green
Write-Host "ファイルパス: $filepath" -ForegroundColor Cyan

# ファイルを開く（オプション）
$openFile = Read-Host "ファイルを開きますか？ (y/n)"
if ($openFile -eq "y") {
    Start-Process $filepath
}
