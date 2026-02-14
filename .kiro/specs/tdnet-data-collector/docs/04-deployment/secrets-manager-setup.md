# AWS Secrets Manager セットアップガイド

## 概要

このドキュメントでは、TDnet Data Collectorで使用する機密情報をAWS Secrets Managerに保存する手順を説明します。

## 保存する機密情報

### 1. TDnet APIキー

**シークレット名**: `/tdnet/api-key`  
**説明**: TDnet APIへのアクセスに使用するAPIキー  
**ローテーション**: 90日ごとに自動ローテーション

## セットアップ手順

### 方法1: AWS CLIを使用

#### 1. TDnet APIキーの作成

```bash
# APIキーを生成（ランダムな32文字の英数字）
$API_KEY = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Secrets Managerにシークレットを作成
aws secretsmanager create-secret `
  --name /tdnet/api-key `
  --description "TDnet API Key for authentication" `
  --secret-string $API_KEY `
  --region ap-northeast-1
```

#### 2. 自動ローテーションの設定

```bash
# Lambda関数ARNを取得（CDKデプロイ後）
$ROTATION_LAMBDA_ARN = aws cloudformation describe-stacks `
  --stack-name TdnetDataCollectorStack-prod `
  --query "Stacks[0].Outputs[?OutputKey=='RotationLambdaArn'].OutputValue" `
  --output text

# 自動ローテーションを有効化（90日ごと）
aws secretsmanager rotate-secret `
  --secret-id /tdnet/api-key `
  --rotation-lambda-arn $ROTATION_LAMBDA_ARN `
  --rotation-rules AutomaticallyAfterDays=90 `
  --region ap-northeast-1
```

### 方法2: CDKで自動作成（推奨）

CDKスタックには既にSecrets Manager Constructが含まれており、デプロイ時に自動的にシークレットが作成されます。

```typescript
// cdk/lib/constructs/secrets-manager.ts
const secretsManagerConstruct = new SecretsManagerConstruct(this, 'SecretsManager', {
  environment: 'prod',
  enableRotation: true,  // 自動ローテーション有効化
  rotationDays: 90,      // 90日ごとにローテーション
});
```

**CDKデプロイコマンド**:

```bash
# 本番環境にデプロイ
cdk deploy TdnetDataCollectorStack-prod --context environment=prod
```

## シークレットの確認

### シークレット値の取得

```bash
# シークレット値を取得
aws secretsmanager get-secret-value `
  --secret-id /tdnet/api-key `
  --region ap-northeast-1 `
  --query SecretString `
  --output text
```

### シークレット情報の確認

```bash
# シークレットのメタデータを確認
aws secretsmanager describe-secret `
  --secret-id /tdnet/api-key `
  --region ap-northeast-1
```

## Lambda関数での使用方法

### 環境変数の設定

Lambda関数の環境変数には、シークレットのARNのみを設定します（値は設定しない）。

```typescript
// CDKスタックで自動設定済み
environment: {
  API_KEY_SECRET_ARN: apiKeyValue.secretArn,  // ARNのみ
}
```

### Lambda関数内でのシークレット取得

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'ap-northeast-1' });

async function getApiKey(): Promise<string> {
  const secretArn = process.env.API_KEY_SECRET_ARN;
  
  if (!secretArn) {
    throw new Error('API_KEY_SECRET_ARN environment variable is not set');
  }

  const command = new GetSecretValueCommand({ SecretId: secretArn });
  const response = await client.send(command);

  if (!response.SecretString) {
    throw new Error('Secret value is empty');
  }

  return response.SecretString;
}
```

## IAM権限

### Lambda関数に必要な権限

CDKスタックで自動的に以下の権限が付与されます：

```typescript
// Lambda関数にシークレット読み取り権限を付与
apiKeyValue.grantRead(lambdaFunction);
```

これにより、以下のIAMポリシーが自動的に追加されます：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:ap-northeast-1:{account-id}:secret:/tdnet/api-key*"
    }
  ]
}
```

## 自動ローテーション

### ローテーションの仕組み

1. **90日ごとに自動実行**: Secrets Managerが自動的にローテーションLambda関数を呼び出します
2. **新しいAPIキーの生成**: ローテーションLambda関数が新しいAPIキーを生成します
3. **シークレットの更新**: 新しいAPIキーでシークレットを更新します
4. **古いキーの無効化**: 古いAPIキーを無効化します（猶予期間あり）

### ローテーション履歴の確認

```bash
# ローテーション履歴を確認
aws secretsmanager list-secret-version-ids `
  --secret-id /tdnet/api-key `
  --region ap-northeast-1
```

### 手動ローテーション

```bash
# 手動でローテーションを実行
aws secretsmanager rotate-secret `
  --secret-id /tdnet/api-key `
  --region ap-northeast-1
```

## トラブルシューティング

### シークレットが見つからない

```bash
# シークレットの存在確認
aws secretsmanager list-secrets `
  --filters Key=name,Values=/tdnet/api-key `
  --region ap-northeast-1
```

### Lambda関数がシークレットにアクセスできない

1. Lambda関数のIAMロールを確認
2. シークレットのリソースポリシーを確認
3. CloudWatch Logsでエラーメッセージを確認

```bash
# Lambda関数のIAMロールを確認
aws lambda get-function --function-name tdnet-query-prod --query Configuration.Role

# IAMロールのポリシーを確認
aws iam list-attached-role-policies --role-name {role-name}
```

## セキュリティベストプラクティス

1. ✅ **シークレット値を環境変数に設定しない**: ARNのみを環境変数に設定
2. ✅ **最小権限の原則**: Lambda関数には必要最小限の権限のみを付与
3. ✅ **自動ローテーション**: 90日ごとに自動ローテーションを有効化
4. ✅ **監査ログ**: CloudTrailでシークレットへのアクセスを記録
5. ✅ **暗号化**: AWS KMSで暗号化（デフォルトで有効）

## コスト

- **シークレット保存**: $0.40/月/シークレット
- **API呼び出し**: $0.05/10,000リクエスト
- **自動ローテーション**: Lambda実行コスト（無料枠内）

**月間推定コスト**: 約$0.50（1シークレット、10,000リクエスト/月）

## 関連ドキュメント

- [AWS Secrets Manager公式ドキュメント](https://docs.aws.amazon.com/secretsmanager/)
- [Secrets Managerのベストプラクティス](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- `cdk/lib/constructs/secrets-manager.ts` - Secrets Manager Construct実装
- `.env.production.template` - 本番環境設定テンプレート
- `docs/ssm-parameter-store-setup.md` - SSM Parameter Storeセットアップガイド
