---
inclusion: manual
---

# 運用を考慮した設計・実装チェックリスト

**重要: すべての実装とドキュメントは日本語で記述してください**

このチェックリストは、設計・実装時に運用性を考慮するための指針です。新機能の開発やインフラ変更時に使用してください。

## 目次

1. [環境情報の管理](#環境情報の管理)
2. [運用スクリプトの設計](#運用スクリプトの設計)
3. [エラーハンドリング](#エラーハンドリング)
4. [監視・ログ](#監視ログ)
5. [ドキュメント](#ドキュメント)
6. [テスト](#テスト)

---

## 環境情報の管理

### CDK Stack Outputs

**目的**: 運用スクリプトが環境情報を自動取得できるようにする

**チェック項目**:
- [ ] 運用スクリプトで必要な環境情報をCDK Stack Outputsに定義
- [ ] Output名は明確で一貫性がある（例: `ApiEndpoint`, `ApiKeySecretName`）
- [ ] 環境（dev/prod）ごとに適切な値を出力
- [ ] Outputの説明（description）を記載

**例**:
```typescript
// cdk/lib/stacks/api-stack.ts
new cdk.CfnOutput(this, 'ApiEndpoint', {
  value: api.url,
  description: 'API Gateway endpoint URL',
  exportName: `${props.environment}-api-endpoint`,
});

new cdk.CfnOutput(this, 'ApiKeySecretName', {
  value: apiKeySecret.secretName,
  description: 'API Key secret name in Secrets Manager',
  exportName: `${props.environment}-api-key-secret-name`,
});

new cdk.CfnOutput(this, 'Region', {
  value: this.region,
  description: 'AWS Region',
  exportName: `${props.environment}-region`,
});

new cdk.CfnOutput(this, 'Environment', {
  value: props.environment,
  description: 'Environment name (dev or prod)',
  exportName: `${props.environment}-environment`,
});
```

### ハードコーディングの排除

**目的**: 環境切り替えを容易にし、保守性を向上させる

**チェック項目**:
- [ ] 運用スクリプトに環境情報をハードコーディングしない
- [ ] CDK Stack Outputsまたは環境変数から環境情報を取得
- [ ] 環境（dev/prod）をパラメータで指定可能にする

**NG例**:
```powershell
# ハードコーディング（NG）
$ApiEndpoint = "https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/prod"
$Region = "ap-northeast-1"
```

**OK例**:
```powershell
# CDK Stack Outputsから取得（OK）
$stackOutputs = Get-StackOutputs -Environment $Environment
$ApiEndpoint = $stackOutputs.ApiEndpoint
$Region = $stackOutputs.Region
```

---

## 運用スクリプトの設計

### 共通関数の活用

**目的**: コードの重複を避け、保守性を向上させる

**チェック項目**:
- [ ] 複数のスクリプトで使用する処理を共通関数化
- [ ] 共通関数は`scripts/lib/`に配置
- [ ] 共通関数のエラーハンドリングを適切に実装

**例**:
```powershell
# scripts/lib/get-stack-outputs.ps1
function Get-StackOutputs {
    param(
        [Parameter(Mandatory=$true)]
        [ValidateSet("dev", "prod")]
        [string]$Environment
    )
    
    # CDK Stack Outputsを取得
    # エラーハンドリング
    # キャッシュ機能
}
```

### パラメータ設計

**目的**: スクリプトの柔軟性と使いやすさを向上させる

**チェック項目**:
- [ ] 環境（dev/prod）をパラメータで指定可能
- [ ] AWS CLIプロファイルをパラメータで指定可能
- [ ] デフォルト値を適切に設定（本番環境: prod）
- [ ] ヘルプメッセージ（-Help）を実装

**例**:
```powershell
param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("dev", "prod")]
    [string]$Environment = "prod",
    
    [Parameter(Mandatory=$false)]
    [string]$Profile,
    
    [Parameter(Mandatory=$false)]
    [switch]$Help
)

if ($Help) {
    Write-Host "使用方法:" -ForegroundColor Yellow
    Write-Host "  .\script.ps1 -Environment <dev|prod> [-Profile <profile>]"
    exit 0
}
```

### エラーメッセージ

**目的**: 運用者が問題を迅速に解決できるようにする

**チェック項目**:
- [ ] エラーメッセージは日本語で記述
- [ ] エラーの原因を明確に説明
- [ ] 解決方法を具体的に提示（コマンド例を含む）
- [ ] トラブルシューティングガイドへのリンクを提供

**例**:
```powershell
Write-Host "❌ エラー: スタックが見つかりません" -ForegroundColor Red
Write-Host "スタック名: $stackName" -ForegroundColor Yellow
Write-Host ""
Write-Host "解決方法:" -ForegroundColor Cyan
Write-Host "1. スタックがデプロイされているか確認してください:" -ForegroundColor White
Write-Host "   aws cloudformation list-stacks --region $Region" -ForegroundColor Gray
Write-Host ""
Write-Host "2. スタックをデプロイしてください:" -ForegroundColor White
Write-Host "   .\scripts\deploy-all.ps1 -Environment $Environment" -ForegroundColor Gray
Write-Host ""
Write-Host "詳細: .kiro/specs/tdnet-data-collector/docs/03-operations/troubleshooting.md" -ForegroundColor Gray
```

---

## エラーハンドリング

### エラー分類

**目的**: 適切なエラーハンドリングを実装する

**チェック項目**:
- [ ] エラーをRetryable/Non-Retryable/Partial Failureに分類
- [ ] Retryableエラーには指数バックオフで再試行
- [ ] Non-Retryableエラーは即座に失敗
- [ ] Partial Failureは成功分をコミット、失敗分を記録

**参照**: `error-handling-patterns.md`

### 構造化ログ

**目的**: 問題の診断を容易にする

**チェック項目**:
- [ ] ログは構造化（error_type, error_message, context, stack_trace）
- [ ] CloudWatch Logsに出力
- [ ] ログレベルを適切に設定（ERROR, WARN, INFO, DEBUG）

**例**:
```typescript
logger.error('Operation failed', {
    error_type: 'NetworkError',
    error_message: error.message,
    context: { disclosure_id: 'TD20240115001', retry_count: 2 },
    stack_trace: error.stack
});
```

---

## 監視・ログ

### CloudWatch Alarms

**目的**: 問題を早期に検出する

**チェック項目**:
- [ ] エラー率のアラームを設定
- [ ] タイムアウトのアラームを設定
- [ ] DLQメッセージ数のアラームを設定（非同期処理）
- [ ] アラーム通知先を設定（SNS）

### CloudWatch Dashboard

**目的**: システムの状態を可視化する

**チェック項目**:
- [ ] 主要メトリクスをダッシュボードに表示
- [ ] エラー率グラフを表示
- [ ] 実行時間グラフを表示
- [ ] Step Functions実行状況を表示（Step Functions使用時）

---

## ドキュメント

### 運用手順書

**目的**: 運用者が迷わず作業できるようにする

**チェック項目**:
- [ ] 環境情報の取得方法を記載
- [ ] 運用スクリプトの使用方法を記載
- [ ] 環境切り替え方法を記載
- [ ] 日常運用の手順を記載
- [ ] ベストプラクティスを記載

**参照**: `.kiro/specs/tdnet-data-collector/docs/03-operations/operation-guide.md`

### トラブルシューティングガイド

**目的**: 問題発生時に迅速に対応できるようにする

**チェック項目**:
- [ ] よくある問題と解決方法を記載
- [ ] エラーメッセージの解説を記載
- [ ] 具体的なコマンド例を記載
- [ ] FAQを記載

**参照**: `.kiro/specs/tdnet-data-collector/docs/03-operations/troubleshooting.md`

### CDK変更時のドキュメント更新

**目的**: ドキュメントを最新の状態に保つ

**チェック項目**:
- [ ] CDK Stack Outputsを追加・変更した場合、運用手順書を更新
- [ ] 新しいエラーが発生した場合、トラブルシューティングガイドを更新
- [ ] 運用スクリプトを変更した場合、運用手順書を更新

---

## テスト

### 運用性テスト

**目的**: 運用スクリプトが正しく動作することを確認する

**チェック項目**:
- [ ] 環境情報の取得が正しく動作することを確認
- [ ] エラーメッセージが適切に表示されることを確認
- [ ] ヘルプメッセージが表示されることを確認
- [ ] 環境切り替えが正しく動作することを確認

### 手動テスト

**目的**: 実際の運用環境で動作することを確認する

**チェック項目**:
- [ ] 開発環境で運用スクリプトを実行
- [ ] 本番環境で運用スクリプトを実行（小規模データ）
- [ ] エラー発生時の挙動を確認
- [ ] ドキュメントの内容を検証

---

## チェックリストの使用方法

### 新機能開発時

1. **設計段階**: このチェックリストを参照し、運用性を考慮した設計を行う
2. **実装段階**: チェック項目を確認しながら実装
3. **テスト段階**: 運用性テストを実施
4. **ドキュメント作成**: 運用手順書とトラブルシューティングガイドを更新

### コードレビュー時

1. **レビュアー**: このチェックリストを参照し、運用性を確認
2. **指摘事項**: チェック項目に該当する問題を指摘
3. **修正**: 指摘事項を修正し、再度レビュー

### 問題発生時

1. **根本原因分析**: このチェックリストを参照し、どの項目が不足していたか確認
2. **改善策の検討**: チェック項目を満たすための改善策を検討
3. **実装**: 改善策を実装
4. **再発防止**: チェックリストを更新し、同様の問題を予防

---

## 関連ドキュメント

- [運用手順書](../../specs/tdnet-data-collector/docs/03-operations/operation-guide.md)
- [トラブルシューティングガイド](../../specs/tdnet-data-collector/docs/03-operations/troubleshooting.md)
- [エラーハンドリングパターン](../core/error-handling-patterns.md)
- [タスク実行ルール](../core/tdnet-data-collector.md)
- [実装ルール](../core/tdnet-implementation-rules.md)
