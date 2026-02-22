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

## APIキー管理

### Secrets Manager使用のガイドライン

| 項目 | ガイドライン |
|------|------------|
| **保存場所** | AWS Secrets Manager（シークレット名: `/tdnet/api-key-{環境}`） |
| **取得方法** | スクリプト実行時に動的取得（キャッシュ推奨） |
| **ハードコーディング** | 禁止（コード、環境変数、Git履歴すべて） |
| **環境分離** | 開発環境（`-dev`）と本番環境（`-prod`）を分離 |

### APIキーローテーションの推奨事項

| 項目 | 推奨値 |
|------|--------|
| **ローテーション頻度** | 90日ごと |
| **自動化** | Lambda関数で自動ローテーション（Phase 4実装予定） |
| **猶予期間** | 新キー切替後7日間は旧キーも有効 |
| **通知** | SNSでローテーション成功/失敗を通知 |

### IAM権限の最小化（APIキー管理）

#### スクリプト実行ユーザー（読み取り専用）

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:ap-northeast-1:*:secret:/tdnet/api-key-*"
    }
  ]
}
```

#### 管理者（作成・更新権限）

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:CreateSecret",
        "secretsmanager:PutSecretValue",
        "secretsmanager:UpdateSecret",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:ap-northeast-1:*:secret:/tdnet/api-key-*"
    }
  ]
}
```

### APIキー漏洩時の対応手順

1. **即座に無効化**: TDnet管理画面で旧キーを無効化
2. **新キー発行**: TDnetで新APIキーを発行
3. **Secrets Manager更新**: `.\scripts\register-api-key.ps1 -Environment prod`
4. **CloudTrailログ確認**: 不正アクセスの有無を確認
5. **IAM権限見直し**: 必要最小限の権限に制限
6. **Git履歴クリーン**: 過去にコミットされたキーを削除（`git filter-branch`）

### セキュリティベストプラクティス

- [ ] APIキーをコードにハードコードしない
- [ ] Secrets Managerから動的に取得
- [ ] IAM権限を最小化（読み取り専用ユーザーは`GetSecretValue`のみ）
- [ ] CloudTrailでSecrets Managerアクセスを監査
- [ ] 90日ごとにAPIキーをローテーション
- [ ] 環境ごとにシークレットを分離（`-dev`, `-prod`）
- [ ] キャッシュ機能で不要なAPIコールを削減（コスト最適化）

## チェックリスト

デプロイ前:
- [ ] IAM最小権限（ワイルドカード権限なし）
- [ ] 機密情報が環境変数に含まれない
- [ ] APIキーがSecrets Managerに登録されている
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
- [ ] APIキーローテーション（90日経過時）
