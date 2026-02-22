# 作業記録: fetch-data-range.ps1 APIキー問題改善タスク作成

**作成日時**: 2026-02-22 16:00:52  
**作業概要**: fetch-data-range-api-key-task-creation  
**関連タスク**: 新規タスク作成

## 作業内容

fetch-data-range.ps1スクリプトのAPIキー取得処理を改善するための新規タスクファイルを作成しました。

## 実施内容

### 1. タスクファイル作成

**ファイル**: `.kiro/specs/tdnet-data-collector/tasks/tasks-fetch-data-range-api-key-issue.md`

**内容**:
- 背景と問題の詳細を記載
- 5つのタスクを定義（優先度: 高3件、中2件）
- 実装例とテスト計画を含む

### 2. タスク一覧

#### 優先度: 高（1週間以内）

1. **タスク1**: エラー分類とリトライ機能の実装
   - エラー種別を分類（SECRET_NOT_FOUND, ACCESS_DENIED, NETWORK_ERROR）
   - ネットワークエラー時に指数バックオフでリトライ（最大3回）
   - `Get-ApiKeyWithRetry` 関数を実装

2. **タスク2**: 環境変数フォールバックの実装
   - 環境変数 `TDNET_API_KEY` からAPIキーを取得
   - Secrets Manager取得失敗時に環境変数をチェック

3. **タスク3**: エラーメッセージの改善
   - エラー種別ごとに分かりやすいメッセージを表示
   - 解決方法を具体的に提示

#### 優先度: 中（2週間以内）

4. **タスク4**: ドキュメント更新
   - data-scripts.md、troubleshooting.md、README.mdを更新

5. **タスク5**: manual-data-collection.ps1への適用
   - 同様の改善をmanual-data-collection.ps1にも適用

### 3. 現在の問題点

fetch-data-range.ps1の現在の実装には以下の問題があります：

1. **エラー分類なし**: ネットワークエラー、権限エラー、シークレット未登録を区別していない
2. **リトライなし**: 一時的なエラーでも即座に失敗
3. **環境変数フォールバック未実装**: ローカル開発時に不便
4. **エラーメッセージが技術的**: 一般ユーザーには理解しにくい

### 4. 改善内容

#### エラー分類とリトライ機能

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
            # Secrets Manager取得処理
            # エラー分類: SECRET_NOT_FOUND, ACCESS_DENIED, NETWORK_ERROR
        } catch {
            # リトライ処理
        }
    }
}
```

#### 環境変数フォールバック

```powershell
$envApiKey = $env:TDNET_API_KEY

if ($envApiKey) {
    Write-Host "ℹ️ 環境変数からAPIキーを使用します" -ForegroundColor Cyan
    $ApiKey = $envApiKey
} else {
    $ApiKey = Get-ApiKeyWithRetry -SecretName $SecretName -Region $Region
}
```

#### エラーメッセージの改善

エラー種別ごとに分かりやすいメッセージと解決方法を表示：

- **SECRET_NOT_FOUND**: シークレット登録方法を提示
- **ACCESS_DENIED**: IAMポリシー確認方法を提示
- **NETWORK_ERROR**: ネットワーク接続確認方法を提示

## 成果物

- `.kiro/specs/tdnet-data-collector/tasks/tasks-fetch-data-range-api-key-issue.md`（新規作成）
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-160052-fetch-data-range-api-key-task-creation.md`（本ファイル）

## 次のステップ

1. タスク1-3を優先的に実施（1週間以内）
2. タスク4-5を計画的に実施（2週間以内）
3. 実装後にユニットテストと手動テストを実施
4. ドキュメントを更新

## 申し送り事項

- PowerShellスクリプトはUTF-8 BOMなしで作成・編集すること
- エンコーディング設定を包括的に行うこと（`powershell-encoding-guidelines.md`参照）
- エラーハンドリングは `error-handling-patterns.md` に従うこと
- manual-data-collection.ps1にも同様の改善を適用すること

## 関連ファイル

- `scripts/fetch-data-range.ps1`
- `scripts/manual-data-collection.ps1`
- `.kiro/steering/development/data-scripts.md`
- `.kiro/steering/development/powershell-encoding-guidelines.md`
- `.kiro/specs/tdnet-data-collector/docs/03-operations/troubleshooting.md`
