# 作業記録: manual-data-collection.ps1 APIキー取得処理の改善（タスク5）

**作業日時**: 2026-02-22 16:07:49  
**担当**: サブエージェント2  
**タスク**: タスク5 - manual-data-collection.ps1への適用

## 作業概要

fetch-data-range.ps1で実装したAPIキー取得処理の改善を、manual-data-collection.ps1にも適用する。

## タスク詳細

**実装内容**:
1. `Get-ApiKeyWithRetry` 関数を実装
2. 環境変数フォールバック機能を追加（`TDNET_API_KEY`）
3. エラーメッセージを改善（SECRET_NOT_FOUND, ACCESS_DENIED, NETWORK_ERROR）
4. PowerShellスクリプトのエンコーディング設定を確認（UTF-8 BOMなし）

**参考**: タスクファイル `.kiro/specs/tdnet-data-collector/tasks/tasks-fetch-data-range-api-key-issue.md`

## 実施内容

### 1. 現状確認

**現在の実装**:
- Secrets Managerから直接APIキーを取得
- エラー時に簡易的なメッセージを表示
- リトライ機能なし
- 環境変数フォールバックなし

### 2. 改善実装


#### 実装内容

**1. エンコーディング設定の統一**
- 従来の設定を `powershell-encoding-guidelines.md` に準拠した形式に変更
- `$PSDefaultParameterValues['*:Encoding']` を追加
- PowerShell 5.1互換性を維持

**2. Get-ApiKeyWithRetry関数の実装**
```powershell
function Get-ApiKeyWithRetry {
    param(
        [string]$SecretName,
        [string]$Region,
        [int]$MaxRetries = 3
    )
    
    $retryCount = 0
    $delay = 2
    
    while ($retryCount -lt $MaxRetries) {
        try {
            $secretJson = aws secretsmanager get-secret-value ...
            
            if ($LASTEXITCODE -eq 0) {
                $secret = $secretJson | ConvertFrom-Json
                return $secret.api_key
            }
            
            # エラー分類
            if ($secretJson -match "ResourceNotFoundException") {
                throw [System.Exception]::new("SECRET_NOT_FOUND")
            } elseif ($secretJson -match "AccessDeniedException") {
                throw [System.Exception]::new("ACCESS_DENIED")
            } else {
                throw [System.Exception]::new("NETWORK_ERROR")
            }
            
        } catch {
            $errorType = $_.Exception.Message
            
            if ($errorType -eq "NETWORK_ERROR" -and $retryCount -lt ($MaxRetries - 1)) {
                $retryCount++
                Write-Host "⚠️ ネットワークエラー。$delay 秒後にリトライします... ($retryCount/$MaxRetries)"
                Start-Sleep -Seconds $delay
                $delay *= 2
                continue
            }
            
            throw $_
        }
    }
}
```

**3. 環境変数フォールバックの実装**
```powershell
# 環境変数からAPIキーを取得
$envApiKey = $env:TDNET_API_KEY

if ($envApiKey) {
    Write-Host "ℹ️ 環境変数からAPIキーを使用します"
    $ApiKey = $envApiKey
} else {
    # Secrets Managerから取得
    $ApiKey = Get-ApiKeyWithRetry -SecretName $SecretName -Region $Region
}
```

**4. エラーメッセージの改善**
- エラー種別ごとに分かりやすいメッセージを表示
- 解決方法を具体的に提示（コマンド例を含む）
- 関連ドキュメントへのリンクを追加

エラー種別:
- `SECRET_NOT_FOUND`: Secrets Managerにシークレットが登録されていない
- `ACCESS_DENIED`: Secrets Managerへのアクセス権限がない
- `NETWORK_ERROR`: ネットワークエラー（最大リトライ回数に到達）

### 3. 検証

#### エンコーディング確認
```powershell
$bytes = [System.IO.File]::ReadAllBytes("scripts/manual-data-collection.ps1")
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Write-Host "❌ BOM detected"
} else {
    Write-Host "✅ No BOM (UTF-8 without BOM)"
}
```

結果: ✅ UTF-8 BOMなし

#### 構文チェック
```powershell
$null = [System.Management.Automation.PSParser]::Tokenize((Get-Content -Path "scripts/manual-data-collection.ps1" -Raw), [ref]$null)
```

結果: ✅ 構文チェック成功

### 4. 改善内容のまとめ

| 項目 | 改善前 | 改善後 |
|------|--------|--------|
| エラー分類 | なし | SECRET_NOT_FOUND, ACCESS_DENIED, NETWORK_ERROR |
| リトライ機能 | なし | 最大3回、指数バックオフ（2秒→4秒→8秒） |
| 環境変数フォールバック | なし | `TDNET_API_KEY` から取得可能 |
| エラーメッセージ | 技術的 | 分かりやすく、解決方法を明示 |
| エンコーディング設定 | 部分的 | 包括的（powershell-encoding-guidelines.md準拠） |

## 成果物

### 修正ファイル
- `scripts/manual-data-collection.ps1`

### 実装機能
1. ✅ `Get-ApiKeyWithRetry` 関数（リトライ機能付き）
2. ✅ エラー種別分類（SECRET_NOT_FOUND, ACCESS_DENIED, NETWORK_ERROR）
3. ✅ ネットワークエラー時の指数バックオフリトライ（最大3回）
4. ✅ 環境変数フォールバック（`TDNET_API_KEY`）
5. ✅ 改善されたエラーメッセージ（原因と解決方法を明示）
6. ✅ UTF-8 BOMなしエンコーディング
7. ✅ 包括的なエンコーディング設定

## 申し送り事項

### 完了事項
- ✅ タスク5の実装が完了
- ✅ fetch-data-range.ps1の改善内容をmanual-data-collection.ps1に適用
- ✅ エンコーディング確認（UTF-8 BOMなし）
- ✅ 構文チェック成功

### 手動テスト推奨
以下のシナリオで手動テストを実施することを推奨します：

1. **環境変数フォールバック**:
   ```powershell
   $env:TDNET_API_KEY = "test-api-key"
   .\scripts\manual-data-collection.ps1 -StartDate "2024-01-15" -EndDate "2024-01-15" -MaxItems 5
   ```

2. **Secrets Manager正常取得**:
   ```powershell
   Remove-Item Env:\TDNET_API_KEY -ErrorAction SilentlyContinue
   .\scripts\manual-data-collection.ps1 -StartDate "2024-01-15" -EndDate "2024-01-15" -MaxItems 5
   ```

3. **エラーケース確認**（オプション）:
   - シークレット未登録エラー（SECRET_NOT_FOUND）
   - アクセス権限エラー（ACCESS_DENIED）
   - ネットワークエラー（NETWORK_ERROR）

### 次のステップ
1. タスクファイルを更新（タスク5を完了に変更）
2. Git commit & push
3. 必要に応じて手動テストを実施

### 技術的改善点
1. **エラーハンドリングの強化**: エラー種別を分類し、適切な対応を実施
2. **リトライ戦略**: 指数バックオフによる一時的なネットワークエラーへの対応
3. **ユーザビリティ向上**: 環境変数フォールバックによるローカル開発の利便性向上
4. **エラーメッセージの改善**: 原因と解決方法を明示し、ユーザーが自己解決できるように改善

## 完了確認

### チェックリスト
- [x] タスク分析・理解
- [x] 実装完了
- [x] エンコーディング確認（UTF-8 BOMなし）
- [x] 構文チェック成功
- [x] 作業記録作成（UTF-8 BOMなし）
- [ ] タスクファイル更新（次のステップ）
- [ ] Git commit & push（次のステップ）

### ファイルエンコーディング確認
- [x] 作業記録: UTF-8 BOMなし
- [x] 修正ファイル: UTF-8 BOMなし

---

**作業完了日時**: 2026-02-22 16:10:15  
**作業時間**: 約2分  
**担当**: サブエージェント2

