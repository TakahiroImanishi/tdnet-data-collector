---
inclusion: fileMatch
fileMatchPattern: 'scripts/**/*.ps1|scripts/**/*.ts'
---

# Scripts実装ガイド

PowerShellスクリプトとTypeScriptスクリプトの実装ガイドライン。

## 共通原則

### 1. エンコーディング
- UTF-8 BOM付き（PowerShell）
- UTF-8 BOMなし（TypeScript）

### 2. エラーハンドリング

**PowerShell**:
```powershell
$ErrorActionPreference = "Stop"

try {
    # 処理
} catch {
    Write-Error "エラー: $_"
    exit 1
}
```

**TypeScript**:
```typescript
try {
    // 処理
} catch (error) {
    console.error('エラー:', error);
    process.exit(1);
}
```

### 3. ログ出力

**PowerShell**:
```powershell
Write-Host "[INFO] 処理開始" -ForegroundColor Green
Write-Host "[ERROR] エラー発生" -ForegroundColor Red
```

**TypeScript**:
```typescript
console.log('[INFO] 処理開始');
console.error('[ERROR] エラー発生');
```

### 4. 環境変数検証

**PowerShell**:
```powershell
if (-not $env:AWS_REGION) {
    Write-Error "AWS_REGIONが設定されていません"
    exit 1
}
```

**TypeScript**:
```typescript
if (!process.env.AWS_REGION) {
    throw new Error('AWS_REGIONが設定されていません');
}
```

## スクリプト種別

### デプロイスクリプト
- 詳細: `deployment-scripts.md`
- 例: `deploy-*.ps1`, `deploy-split-stacks.ps1`

### セットアップスクリプト
- 詳細: `setup-scripts.md`
- 例: `create-api-key-secret.ps1`, `generate-env-file.ps1`

### データ操作スクリプト
- 詳細: `data-scripts.md`
- 例: `fetch-data-range.ps1`, `manual-data-collection.ps1`

### 監視スクリプト
- 詳細: `monitoring-scripts.md`
- 例: `deploy-dashboard.ps1`, `check-iam-permissions.ps1`

## 関連ドキュメント

- `deployment-scripts.md` - デプロイスクリプト詳細
- `setup-scripts.md` - セットアップスクリプト詳細
- `data-scripts.md` - データ操作スクリプト詳細
- `monitoring-scripts.md` - 監視スクリプト詳細
- `powershell-encoding-guidelines.md` - PowerShellエンコーディング
