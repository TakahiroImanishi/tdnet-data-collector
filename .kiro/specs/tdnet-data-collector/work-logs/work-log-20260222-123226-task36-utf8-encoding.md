# 作業記録: タスク36 - 16スクリプトにUTF-8エンコーディング設定追加

**作成日時**: 2026-02-22 12:32:26  
**作業者**: Kiro AI Assistant  
**関連タスク**: tasks-improvements-20260222.md - タスク36

## 作業概要

16個のPowerShellスクリプトに包括的なUTF-8エンコーディング設定を追加し、文字化け問題を防止する。

## 対象スクリプト（16ファイル）

1. `scripts/deploy.ps1`
2. `scripts/deploy-dev.ps1`
3. `scripts/deploy-prod.ps1`
4. `scripts/deploy-split-stacks.ps1`
5. `scripts/deploy-dashboard.ps1`
6. `scripts/create-api-key-secret.ps1`
7. `scripts/generate-env-file.ps1`
8. `scripts/delete-all-data.ps1`
9. `scripts/check-iam-permissions.ps1`
10. `scripts/analyze-cloudwatch-logs.ps1`
11. `scripts/check-cloudwatch-logs-simple.ps1`
12. `scripts/check-dynamodb-s3-consistency.ps1`
13. `scripts/check-waf-status.ps1`
14. `scripts/fetch-data-range.ps1`
15. `scripts/manual-data-collection.ps1`
16. `scripts/migrate-disclosure-fields.ps1`

## 追加する設定

```powershell
# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}
```

## 実施内容

### 1. スクリプト修正

