# Git初期設定スクリプト
# 使用方法: .\setup-git.ps1 -UserName "あなたの名前" -Email "your.email@example.com"

param(
    [Parameter(Mandatory=$true)]
    [string]$UserName,
    
    [Parameter(Mandatory=$true)]
    [string]$Email
)

Write-Host "Git初期設定を開始します..." -ForegroundColor Green

# ユーザー名とメールアドレスを設定
Write-Host "ユーザー名を設定: $UserName" -ForegroundColor Cyan
git config --global user.name "$UserName"

Write-Host "メールアドレスを設定: $Email" -ForegroundColor Cyan
git config --global user.email "$Email"

# デフォルトブランチ名をmainに設定
Write-Host "デフォルトブランチ名をmainに設定" -ForegroundColor Cyan
git config --global init.defaultBranch main

# 改行コードの自動変換を設定（Windows推奨）
Write-Host "改行コードの自動変換を設定" -ForegroundColor Cyan
git config --global core.autocrlf true

# 日本語ファイル名の文字化け防止
Write-Host "日本語ファイル名の文字化け防止を設定" -ForegroundColor Cyan
git config --global core.quotepath false

# 設定確認
Write-Host "`n設定内容を確認:" -ForegroundColor Green
git config --global --list | Select-String "user.name|user.email|init.defaultBranch|core.autocrlf|core.quotepath"

Write-Host "`nGit初期設定が完了しました！" -ForegroundColor Green
