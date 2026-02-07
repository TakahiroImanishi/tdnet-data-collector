# 作業記録作成スクリプト
# 使用方法: .\create-work-log.ps1 [-Title "作業タイトル"] [-Task "タスク番号"] [-Open]

param(
    [Parameter(Mandatory=$false)]
    [string]$Title = "",
    
    [Parameter(Mandatory=$false)]
    [string]$Task = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$Open
)

# スクリプトのディレクトリを取得
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# テンプレートファイルのパス
$TemplateFile = Join-Path $ScriptDir "work-log-template.md"

# テンプレートファイルの存在確認
if (-not (Test-Path $TemplateFile)) {
    Write-Host "エラー: テンプレートファイルが見つかりません: $TemplateFile" -ForegroundColor Red
    exit 1
}

Write-Host "作業記録を作成します..." -ForegroundColor Green

# 現在時刻を取得（JST）
$JstTime = [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::Now, 'Tokyo Standard Time')
$Timestamp = $JstTime.ToString("yyyyMMdd-HHmmss")
$FormattedDateTime = $JstTime.ToString("yyyy-MM-dd HH:mm:ss")

# 新しい作業記録ファイル名
$NewFileName = "work-log-$Timestamp.md"
$NewFilePath = Join-Path $ScriptDir $NewFileName

Write-Host "ファイル名: $NewFileName" -ForegroundColor Cyan
Write-Host "作成日時: $FormattedDateTime JST" -ForegroundColor Cyan

# テンプレートを読み込み
$Content = Get-Content $TemplateFile -Raw -Encoding UTF8

# プレースホルダーを置換
$Content = $Content -replace "YYYY-MM-DD HH:MM:SS", $FormattedDateTime

# タイトルが指定されている場合は置換
if ($Title -ne "") {
    $Content = $Content -replace "\[作業タイトル\]", $Title
    Write-Host "タイトル: $Title" -ForegroundColor Cyan
}

# タスク番号が指定されている場合は置換
if ($Task -ne "") {
    $Content = $Content -replace "\[タスク番号または説明\]", $Task
    Write-Host "関連タスク: $Task" -ForegroundColor Cyan
}

# ファイルを作成（UTF-8 BOMなし）
$Utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($NewFilePath, $Content, $Utf8NoBom)

Write-Host "`n作業記録ファイルを作成しました！" -ForegroundColor Green
Write-Host "ファイルパス: $NewFilePath" -ForegroundColor Yellow

# -Openオプションが指定されている場合、ファイルを開く
if ($Open) {
    Write-Host "`nファイルを開きます..." -ForegroundColor Cyan
    
    # デフォルトのエディタでファイルを開く
    if (Get-Command code -ErrorAction SilentlyContinue) {
        # VS Codeがインストールされている場合
        code $NewFilePath
        Write-Host "VS Codeでファイルを開きました" -ForegroundColor Green
    } elseif (Get-Command notepad++ -ErrorAction SilentlyContinue) {
        # Notepad++がインストールされている場合
        notepad++ $NewFilePath
        Write-Host "Notepad++でファイルを開きました" -ForegroundColor Green
    } else {
        # デフォルトのメモ帳で開く
        notepad $NewFilePath
        Write-Host "メモ帳でファイルを開きました" -ForegroundColor Green
    }
}

Write-Host "`n使用方法:" -ForegroundColor Yellow
Write-Host "  1. 作業概要を記入してください" -ForegroundColor White
Write-Host "  2. 作業中に実施内容を随時更新してください" -ForegroundColor White
Write-Host "  3. 問題が発生した場合は「発生した問題と解決策」に記録してください" -ForegroundColor White
Write-Host "  4. タスク完了時に成果物と次回への申し送りを記入してください" -ForegroundColor White
