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

禁止: ワイルドカード権限（`actions: ['s3:*'], resources: ['*']`）

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

環境変数: ARNのみ設定（直接設定禁止）

## API Gateway

- WAF: レート制限（5分/2000リクエスト/IP）、AWS管理ルール
- APIキー: レート制限（100/秒）、クォータ（10000/月）
- CORS: 特定オリジンのみ許可

## 監査

- CloudTrail: CloudWatch Logs送信有効化
- ログマスク: 機密情報（APIキー等）をマスク

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
