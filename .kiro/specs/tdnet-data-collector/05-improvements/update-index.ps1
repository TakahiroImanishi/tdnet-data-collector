# 改善記録インデックス自動更新スクリプト
# 使用方法: .\update-index.ps1

$ErrorActionPreference = "Stop"

# スクリプトのディレクトリを取得
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$improvementsDir = $scriptDir

# 改善記録ファイルを取得（README.md, index.md, スクリプトを除外）
$improvementFiles = Get-ChildItem -Path $improvementsDir -Filter "*.md" | 
    Where-Object { $_.Name -notin @("README.md", "index.md") } |
    Sort-Object Name

# カテゴリ別に分類
$categories = @{
    "task" = @()
    "docs" = @()
    "steering" = @()
}

foreach ($file in $improvementFiles) {
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    
    # ファイル名からカテゴリを判定
    if ($file.Name -match "^task-") {
        $category = "task"
    } elseif ($file.Name -match "^docs-") {
        $category = "docs"
    } elseif ($file.Name -match "^steering-") {
        $category = "steering"
    } else {
        Write-Warning "Unknown category for file: $($file.Name)"
        continue
    }
    
    # タイトルを抽出（最初の#行）
    $title = ""
    if ($content -match "(?m)^#\s+(.+)$") {
        $title = $Matches[1]
    }
    
    # 概要を抽出（## 問題点 または ## 概要 または ## Problem または ## Overview）
    $summary = ""
    $lines = $content -split "`n"
    $inSummary = $false
    foreach ($line in $lines) {
        if ($line -match "^##\s+(Problem|Overview|Issues)") {
            $inSummary = $true
            continue
        }
        if ($inSummary) {
            if ($line -match "^##") {
                break
            }
            if ($line.Trim()) {
                $summary += $line.Trim() + " "
            }
        }
    }
    $summary = $summary.Trim()
    if ($summary.Length -gt 200) {
        $summary = $summary.Substring(0, 200) + "..."
    }
    
    # 優先度を抽出
    $priority = "Medium"
    if ($content -match "(?m)^\*\*優先度:\*\*\s*(.+)$") {
        $priority = $Matches[1].Trim()
    }
    
    # タグを抽出
    $tags = @()
    if ($content -match "(?m)^\*\*タグ:\*\*\s*(.+)$") {
        $tagString = $Matches[1].Trim()
        $tags = $tagString -split "\s+" | Where-Object { $_ -match "^#" }
    }
    
    # 日時を抽出（ファイル名から）
    $dateTime = ""
    if ($file.Name -match "(\d{8})-(\d{6})") {
        $date = $Matches[1]
        $time = $Matches[2]
        $dateTime = "$($date.Substring(0,4))-$($date.Substring(4,2))-$($date.Substring(6,2))"
    }
    
    $categories[$category] += @{
        FileName = $file.Name
        Title = $title
        Summary = $summary
        Priority = $priority
        Tags = $tags
        DateTime = $dateTime
    }
}

# 最終更新日を取得
$lastUpdate = Get-Date -Format "yyyy-MM-dd"

# index.mdを生成
$indexContent = @"
# 改善履歴インデックス

このドキュメントは、すべての改善記録を分類・整理し、検索しやすくするためのインデックスです。

**最終更新:** $lastUpdate
**自動生成:** このファイルは ``update-index.ps1`` により自動生成されています。

---

## 改善記録サマリー

| カテゴリ | 件数 | 最終更新 |
|---------|------|---------|
| タスク実装 | $($categories["task"].Count) | $(if ($categories["task"].Count -gt 0) { ($categories["task"] | Sort-Object DateTime -Descending | Select-Object -First 1).DateTime } else { "-" }) |
| ドキュメント | $($categories["docs"].Count) | $(if ($categories["docs"].Count -gt 0) { ($categories["docs"] | Sort-Object DateTime -Descending | Select-Object -First 1).DateTime } else { "-" }) |
| Steering | $($categories["steering"].Count) | $(if ($categories["steering"].Count -gt 0) { ($categories["steering"] | Sort-Object DateTime -Descending | Select-Object -First 1).DateTime } else { "-" }) |
| **合計** | **$($improvementFiles.Count)** | **$lastUpdate** |

---

## カテゴリ別改善記録

### 🎯 タスク実装（Task Implementation）

"@

if ($categories["task"].Count -eq 0) {
    $indexContent += "`n改善記録なし`n"
} else {
    foreach ($item in $categories["task"]) {
        $indexContent += @"

#### $($item.FileName)
**タイトル:** $($item.Title)

**概要:** $($item.Summary)

**優先度:** $($item.Priority)

**日時:** $($item.DateTime)

$(if ($item.Tags.Count -gt 0) { "**タグ:** $($item.Tags -join ' ')" })

---

"@
    }
}

$indexContent += @"

### 📋 ドキュメント（Documentation）

"@

if ($categories["docs"].Count -eq 0) {
    $indexContent += "`n改善記録なし`n"
} else {
    foreach ($item in $categories["docs"]) {
        $indexContent += @"

#### $($item.FileName)
**タイトル:** $($item.Title)

**概要:** $($item.Summary)

**優先度:** $($item.Priority)

**日時:** $($item.DateTime)

$(if ($item.Tags.Count -gt 0) { "**タグ:** $($item.Tags -join ' ')" })

---

"@
    }
}

$indexContent += @"

### 🎨 Steering（Implementation Guidelines）

"@

if ($categories["steering"].Count -eq 0) {
    $indexContent += "`n改善記録なし`n"
} else {
    foreach ($item in $categories["steering"]) {
        $indexContent += @"

#### $($item.FileName)
**タイトル:** $($item.Title)

**概要:** $($item.Summary)

**優先度:** $($item.Priority)

**日時:** $($item.DateTime)

$(if ($item.Tags.Count -gt 0) { "**タグ:** $($item.Tags -join ' ')" })

---

"@
    }
}

$indexContent += @"

## 検索ガイド

### カテゴリ別検索

- **タスク実装**: ``task-*.md`` - 実装タスク完了後の改善記録
- **ドキュメント**: ``docs-*.md`` - 要件定義書、設計書、API仕様の改善
- **Steering**: ``steering-*.md`` - 実装ガイドラインの改善

### 優先度別検索

- **Critical**: システムが動作しない、データ損失のリスク
- **High**: パフォーマンス、セキュリティ、コスト問題
- **Medium**: コード品質、保守性、テストカバレッジ
- **Low**: ドキュメント、コメント、スタイル

### タグ検索

PowerShellで特定のタグを含む改善記録を検索：

``````powershell
# 例: #consistency タグを含むファイルを検索
Get-ChildItem -Path . -Filter "*.md" | Select-String -Pattern "#consistency"
``````

---

## 更新方法

このインデックスは自動生成されます。更新するには：

``````powershell
.\update-index.ps1
``````

または、改善記録作成時に自動更新：

``````powershell
.\create-improvement.ps1 -TaskNumber "1.1" -AutoUpdateIndex
``````

---

**注意:** このファイルを手動編集しないでください。``update-index.ps1`` により上書きされます。
"@

# index.mdに書き込み
$indexPath = Join-Path $improvementsDir "index.md"
$indexContent | Out-File -FilePath $indexPath -Encoding UTF8 -NoNewline

Write-Host "✅ index.md を更新しました: $indexPath" -ForegroundColor Green
Write-Host "📊 改善記録: $($improvementFiles.Count) 件" -ForegroundColor Cyan
Write-Host "   - タスク実装: $($categories['task'].Count) 件" -ForegroundColor Cyan
Write-Host "   - ドキュメント: $($categories['docs'].Count) 件" -ForegroundColor Cyan
Write-Host "   - Steering: $($categories['steering'].Count) 件" -ForegroundColor Cyan
