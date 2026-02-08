---
inclusion: fileMatch
fileMatchPattern: '**/cdk/lib/**/*-stack.ts|**/iam/**/*.ts|**/security/**/*.ts'
---

# セキュリティベストプラクティス

TDnet Data Collectorプロジェクトのセキュリティ実装チェックリスト。

## セキュリティ原則

1. **最小権限**: 必要最小限の権限のみ付与（ワイルドカード権限禁止）
2. **暗号化**: 転送時・保存時ともに暗号化（TLS 1.2以上、SSE-S3/AWS管理キー）
3. **監査**: CloudTrail有効化、構造化ログ、機密情報マスク

## IAM権限管理

### Lambda関数のIAMロール設定

| リソース | 許可アクション | スコープ |
|---------|--------------|---------|
| CloudWatch Logs | logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents | 特定ロググループのみ |
| S3 | s3:PutObject, s3:GetObject, s3:DeleteObject | 特定バケット内のオブジェクトのみ |
| DynamoDB | dynamodb:PutItem, dynamodb:GetItem, dynamodb:Query, dynamodb:Scan | 特定テーブルとGSIのみ |
| SNS | sns:Publish | 特定トピックのみ |
| SSM Parameter Store | ssm:GetParameter | `/tdnet/${environment}/*` のみ |
| Secrets Manager | secretsmanager:GetSecretValue | 特定シークレットのみ |

### 禁止事項

```typescript
// ❌ ワイルドカード権限
actions: ['s3:*'], resources: ['*']

// ✅ 特定リソース・アクション
actions: ['s3:PutObject', 's3:GetObject'], resources: [`${bucket.bucketArn}/*`]
```

## データ暗号化

### 転送時の暗号化

| サービス | 設定 | 実装 |
|---------|------|------|
| API Gateway | HTTPS強制 | `securityPolicy: SecurityPolicy.TLS_1_2` |
| S3 | SSL/TLS必須 | `enforceSSL: true` |
| axios | TLS 1.2以上 | `httpsAgent: { minVersion: 'TLSv1.2' }` |

### 保存時の暗号化

| サービス | 暗号化方式 | CDK設定 |
|---------|-----------|---------|
| S3 | SSE-S3 | `encryption: s3.BucketEncryption.S3_MANAGED` |
| DynamoDB | AWS管理キー | `encryption: dynamodb.TableEncryption.AWS_MANAGED` |
| Lambda環境変数 | KMS | `environmentEncryption: kmsKey` |

## 機密情報管理

### Secrets Manager vs SSM Parameter Store

| 用途 | 推奨サービス | 理由 |
|------|------------|------|
| APIキー、パスワード | Secrets Manager | 自動ローテーション、監査ログ |
| 設定値、非機密情報 | SSM Parameter Store | コスト効率 |

### 環境変数の扱い

```typescript
// ❌ 機密情報を直接設定
environment: { API_KEY: 'secret-key' }

// ✅ ARNのみを設定
environment: { API_KEY_SECRET_ARN: apiKeySecret.secretArn }
```

## API Gateway セキュリティ

### WAF設定（基本）

- レート制限: 5分間で2000リクエスト/IP
- AWS管理ルール: `AWSManagedRulesCommonRuleSet`
- CloudWatchメトリクス有効化

### APIキー認証

```typescript
// APIキー + 使用量プラン
const apiKey = api.addApiKey('TdnetApiKey');
const usagePlan = api.addUsagePlan('TdnetUsagePlan', {
    throttle: { rateLimit: 100, burstLimit: 200 },
    quota: { limit: 10000, period: apigateway.Period.MONTH },
});
usagePlan.addApiKey(apiKey);
disclosures.addMethod('GET', integration, { apiKeyRequired: true });
```

### CORS設定

```typescript
// 本番ドメインのみ許可
defaultCorsPreflightOptions: {
    allowOrigins: ['https://dashboard.example.com'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-API-Key'],
}
```

## 監査とログ

### CloudTrail設定

- APIコール記録: `sendToCloudWatchLogs: true`
- S3イベント記録: `addS3EventSelector`

### ログからの機密情報除外

```typescript
// 機密情報をマスク
function sanitizeForLog(data: any): any {
    const sanitized = { ...data };
    if (sanitized.api_key) sanitized.api_key = '***REDACTED***';
    if (sanitized.password) sanitized.password = '***REDACTED***';
    return sanitized;
}
```

## 脆弱性管理

```bash
# 脆弱性チェック
npm audit

# 自動修正
npm audit fix
```

### Dependabot設定

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
```

## セキュリティチェックリスト

### デプロイ前

- [ ] IAM権限が最小権限（ワイルドカード権限なし）
- [ ] 機密情報が環境変数に含まれていない
- [ ] すべてのデータが暗号化（転送時・保存時）
- [ ] npm auditで脆弱性なし
- [ ] CloudTrail有効化
- [ ] WAFルール設定（API Gateway）
- [ ] S3バケットがパブリックアクセスブロック
- [ ] DynamoDBポイントインタイムリカバリ有効

### 定期レビュー（月次）

- [ ] IAM権限の見直し
- [ ] 未使用リソースの削除
- [ ] CloudTrailログの確認
- [ ] セキュリティアラートの確認
- [ ] 依存関係の更新
- [ ] クレデンシャルのローテーション

## インシデント対応

1. **検知**: CloudWatch Alarms, GuardDuty（オプション）
2. **初期対応**: 影響範囲特定、緩和策実施
3. **調査**: CloudTrail/CloudWatch Logs分析
4. **復旧**: 脆弱性修正、クレデンシャルローテーション
5. **事後対応**: インシデントレポート作成、再発防止策実施

## 関連ドキュメント

- **環境変数管理**: `../infrastructure/environment-variables.md` - 機密情報の管理方法
- **監視とアラート**: `../infrastructure/monitoring-alerts.md` - セキュリティアラート設定
