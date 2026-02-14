---
inclusion: fileMatch
fileMatchPattern: '**/cdk/lib/**/*-stack.ts|**/iam/**/*.ts|**/security/**/*.ts'
---

# セキュリティベストプラクティス

## セキュリティ原則

1. 最小権限（ワイルドカード権限禁止）
2. 暗号化（TLS 1.2以上、SSE-S3/AWS管理キー）
3. 監査（CloudTrail、構造化ログ、機密情報マスク）

## IAM権限

| リソース | 許可アクション | スコープ |
|---------|--------------|---------|
| CloudWatch Logs | logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents | 特定ロググループ |
| S3 | s3:PutObject, s3:GetObject, s3:DeleteObject | 特定バケット内 |
| DynamoDB | dynamodb:PutItem, dynamodb:GetItem, dynamodb:Query, dynamodb:Scan | 特定テーブル・GSI |
| Secrets Manager | secretsmanager:GetSecretValue | 特定シークレット |

禁止:
```typescript
// ❌ ワイルドカード
actions: ['s3:*'], resources: ['*']

// ✅ 特定リソース
actions: ['s3:PutObject', 's3:GetObject'], resources: [`${bucket.bucketArn}/*`]
```

## 暗号化

| サービス | 方式 | CDK設定 |
|---------|------|---------|
| API Gateway | HTTPS強制 | `securityPolicy: SecurityPolicy.TLS_1_2` |
| S3 | SSE-S3 | `encryption: s3.BucketEncryption.S3_MANAGED` |
| DynamoDB | AWS管理キー | `encryption: dynamodb.TableEncryption.AWS_MANAGED` |

## 機密情報管理

| 用途 | サービス |
|------|---------|
| APIキー、パスワード | Secrets Manager |
| 設定値 | SSM Parameter Store |

環境変数:
```typescript
// ❌ 直接設定
environment: { API_KEY: 'secret-key' }

// ✅ ARNのみ
environment: { API_KEY_SECRET_ARN: apiKeySecret.secretArn }
```

## API Gateway

WAF: レート制限（5分/2000リクエスト/IP）、AWS管理ルール

APIキー:
```typescript
const apiKey = api.addApiKey('TdnetApiKey');
const usagePlan = api.addUsagePlan('TdnetUsagePlan', {
    throttle: { rateLimit: 100, burstLimit: 200 },
    quota: { limit: 10000, period: apigateway.Period.MONTH },
});
```

CORS:
```typescript
defaultCorsPreflightOptions: {
    allowOrigins: ['https://dashboard.example.com'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
}
```

## 監査

CloudTrail: `sendToCloudWatchLogs: true`

ログマスク:
```typescript
function sanitizeForLog(data: any): any {
    const sanitized = { ...data };
    if (sanitized.api_key) sanitized.api_key = '***REDACTED***';
    return sanitized;
}
```

## チェックリスト

デプロイ前:
- [ ] IAM最小権限（ワイルドカード権限なし）
- [ ] 機密情報が環境変数に含まれない
- [ ] データ暗号化（転送時・保存時）
- [ ] npm audit実行
- [ ] CloudTrail有効化
- [ ] WAFルール設定
- [ ] S3パブリックアクセスブロック

月次レビュー:
- [ ] IAM権限見直し
- [ ] 未使用リソース削除
- [ ] CloudTrailログ確認
- [ ] 依存関係更新
