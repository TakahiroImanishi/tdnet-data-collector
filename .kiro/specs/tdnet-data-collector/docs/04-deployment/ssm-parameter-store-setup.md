# AWS SSM Parameter Store セットアップガイド

## 概要

このドキュメントでは、TDnet Data Collectorで使用する設定値をAWS Systems Manager Parameter Storeに保存する手順を説明します。

## Parameter Storeとは

AWS Systems Manager Parameter Storeは、設定データとシークレットを一元管理するサービスです。

**Secrets Managerとの使い分け**:
- **Secrets Manager**: 機密情報（APIキー、パスワード）、自動ローテーション必要
- **Parameter Store**: アプリケーション設定、環境固有の設定、自動ローテーション不要

## 保存する設定値

### 1. アプリケーション設定

| パラメータ名 | 説明 | 型 | 例 |
|------------|------|-----|-----|
| `/tdnet/config/base-url` | TDnetベースURL | String | `https://www.release.tdnet.info` |
| `/tdnet/config/request-delay-ms` | リクエスト間隔（ミリ秒） | String | `2000` |
| `/tdnet/config/max-retries` | 最大再試行回数 | String | `3` |
| `/tdnet/config/rate-limit-rpm` | レート制限（リクエスト/分） | String | `30` |

### 2. 環境固有の設定

| パラメータ名 | 説明 | 型 | 例 |
|------------|------|-----|-----|
| `/tdnet/prod/log-level` | ログレベル | String | `INFO` |
| `/tdnet/prod/enable-metrics` | メトリクス有効化 | String | `true` |
| `/tdnet/prod/enable-xray` | X-Rayトレーシング有効化 | String | `true` |
| `/tdnet/prod/enable-detailed-logging` | 詳細ログ有効化 | String | `false` |

## セットアップ手順

### 方法1: AWS CLIを使用

#### 1. アプリケーション設定の作成

```bash
# TDnetベースURL
aws ssm put-parameter `
  --name /tdnet/config/base-url `
  --value "https://www.release.tdnet.info" `
  --type String `
  --description "TDnet base URL for scraping" `
  --region ap-northeast-1

# リクエスト間隔
aws ssm put-parameter `
  --name /tdnet/config/request-delay-ms `
  --value "2000" `
  --type String `
  --description "Delay between requests in milliseconds" `
  --region ap-northeast-1

# 最大再試行回数
aws ssm put-parameter `
  --name /tdnet/config/max-retries `
  --value "3" `
  --type String `
  --description "Maximum number of retries for failed requests" `
  --region ap-northeast-1

# レート制限
aws ssm put-parameter `
  --name /tdnet/config/rate-limit-rpm `
  --value "30" `
  --type String `
  --description "Rate limit in requests per minute" `
  --region ap-northeast-1
```

#### 2. 環境固有の設定の作成（本番環境）

```bash
# ログレベル
aws ssm put-parameter `
  --name /tdnet/prod/log-level `
  --value "INFO" `
  --type String `
  --description "Log level for production environment" `
  --region ap-northeast-1

# メトリクス有効化
aws ssm put-parameter `
  --name /tdnet/prod/enable-metrics `
  --value "true" `
  --type String `
  --description "Enable CloudWatch metrics" `
  --region ap-northeast-1

# X-Rayトレーシング有効化
aws ssm put-parameter `
  --name /tdnet/prod/enable-xray `
  --value "true" `
  --type String `
  --description "Enable AWS X-Ray tracing" `
  --region ap-northeast-1

# 詳細ログ有効化
aws ssm put-parameter `
  --name /tdnet/prod/enable-detailed-logging `
  --value "false" `
  --type String `
  --description "Enable detailed logging" `
  --region ap-northeast-1
```

### 方法2: 一括作成スクリプト

```powershell
# scripts/setup-ssm-parameters.ps1

# アプリケーション設定
$appConfig = @{
    "/tdnet/config/base-url" = "https://www.release.tdnet.info"
    "/tdnet/config/request-delay-ms" = "2000"
    "/tdnet/config/max-retries" = "3"
    "/tdnet/config/rate-limit-rpm" = "30"
}

# 環境固有の設定（本番環境）
$prodConfig = @{
    "/tdnet/prod/log-level" = "INFO"
    "/tdnet/prod/enable-metrics" = "true"
    "/tdnet/prod/enable-xray" = "true"
    "/tdnet/prod/enable-detailed-logging" = "false"
}

# アプリケーション設定を作成
foreach ($key in $appConfig.Keys) {
    Write-Host "Creating parameter: $key"
    aws ssm put-parameter `
        --name $key `
        --value $appConfig[$key] `
        --type String `
        --overwrite `
        --region ap-northeast-1
}

# 環境固有の設定を作成
foreach ($key in $prodConfig.Keys) {
    Write-Host "Creating parameter: $key"
    aws ssm put-parameter `
        --name $key `
        --value $prodConfig[$key] `
        --type String `
        --overwrite `
        --region ap-northeast-1
}

Write-Host "All parameters created successfully!"
```

## パラメータの確認

### パラメータ一覧の取得

```bash
# すべてのTDnetパラメータを取得
aws ssm describe-parameters `
  --parameter-filters "Key=Name,Option=BeginsWith,Values=/tdnet/" `
  --region ap-northeast-1
```

### パラメータ値の取得

```bash
# 単一パラメータの値を取得
aws ssm get-parameter `
  --name /tdnet/config/base-url `
  --region ap-northeast-1 `
  --query Parameter.Value `
  --output text

# 複数パラメータの値を一括取得
aws ssm get-parameters `
  --names /tdnet/config/base-url /tdnet/config/request-delay-ms `
  --region ap-northeast-1
```

### パスによる一括取得

```bash
# /tdnet/config/配下のすべてのパラメータを取得
aws ssm get-parameters-by-path `
  --path /tdnet/config/ `
  --region ap-northeast-1
```

## Lambda関数での使用方法

### 環境変数の設定（オプション）

Parameter Storeの値をLambda関数の環境変数として設定する場合：

```typescript
// CDKスタック
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

const baseUrl = StringParameter.valueFromLookup(this, '/tdnet/config/base-url');

const lambdaFunction = new lambda.Function(this, 'Function', {
  environment: {
    TDNET_BASE_URL: baseUrl,
  },
});
```

### Lambda関数内でのパラメータ取得

```typescript
import { SSMClient, GetParameterCommand, GetParametersByPathCommand } from '@aws-sdk/client-ssm';

const client = new SSMClient({ region: 'ap-northeast-1' });

// 単一パラメータの取得
async function getParameter(name: string): Promise<string> {
  const command = new GetParameterCommand({ Name: name });
  const response = await client.send(command);

  if (!response.Parameter?.Value) {
    throw new Error(`Parameter ${name} not found`);
  }

  return response.Parameter.Value;
}

// パスによる一括取得
async function getParametersByPath(path: string): Promise<Record<string, string>> {
  const command = new GetParametersByPathCommand({ Path: path });
  const response = await client.send(command);

  const parameters: Record<string, string> = {};
  
  if (response.Parameters) {
    for (const param of response.Parameters) {
      if (param.Name && param.Value) {
        parameters[param.Name] = param.Value;
      }
    }
  }

  return parameters;
}

// 使用例
const baseUrl = await getParameter('/tdnet/config/base-url');
const prodConfig = await getParametersByPath('/tdnet/prod/');
```

## IAM権限

### Lambda関数に必要な権限

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": [
        "arn:aws:ssm:ap-northeast-1:{account-id}:parameter/tdnet/*"
      ]
    }
  ]
}
```

### CDKでの権限付与

```typescript
import * as iam from 'aws-cdk-lib/aws-iam';

lambdaFunction.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
      'ssm:GetParameter',
      'ssm:GetParameters',
      'ssm:GetParametersByPath',
    ],
    resources: [
      `arn:aws:ssm:${this.region}:${this.account}:parameter/tdnet/*`,
    ],
  })
);
```

## パラメータの更新

### 単一パラメータの更新

```bash
# パラメータ値を更新
aws ssm put-parameter `
  --name /tdnet/config/request-delay-ms `
  --value "3000" `
  --type String `
  --overwrite `
  --region ap-northeast-1
```

### バージョン履歴の確認

```bash
# パラメータのバージョン履歴を確認
aws ssm get-parameter-history `
  --name /tdnet/config/request-delay-ms `
  --region ap-northeast-1
```

## パラメータの削除

```bash
# 単一パラメータの削除
aws ssm delete-parameter `
  --name /tdnet/config/request-delay-ms `
  --region ap-northeast-1

# 複数パラメータの削除
aws ssm delete-parameters `
  --names /tdnet/config/base-url /tdnet/config/request-delay-ms `
  --region ap-northeast-1
```

## パラメータタイプ

### String（標準）

通常の設定値に使用。

```bash
aws ssm put-parameter `
  --name /tdnet/config/base-url `
  --value "https://www.release.tdnet.info" `
  --type String
```

### StringList

カンマ区切りのリスト値に使用。

```bash
aws ssm put-parameter `
  --name /tdnet/config/allowed-ips `
  --value "192.168.1.1,192.168.1.2,192.168.1.3" `
  --type StringList
```

### SecureString（暗号化）

機密性の高い設定値に使用（ただし、APIキーなどはSecrets Managerを推奨）。

```bash
aws ssm put-parameter `
  --name /tdnet/config/database-password `
  --value "MySecurePassword123!" `
  --type SecureString `
  --key-id alias/aws/ssm  # KMSキーID（オプション）
```

## トラブルシューティング

### パラメータが見つからない

```bash
# パラメータの存在確認
aws ssm describe-parameters `
  --parameter-filters "Key=Name,Values=/tdnet/config/base-url" `
  --region ap-northeast-1
```

### Lambda関数がパラメータにアクセスできない

1. Lambda関数のIAMロールを確認
2. パラメータ名が正しいか確認
3. リージョンが正しいか確認
4. CloudWatch Logsでエラーメッセージを確認

```bash
# Lambda関数のIAMロールを確認
aws lambda get-function --function-name tdnet-query-prod --query Configuration.Role

# IAMロールのポリシーを確認
aws iam list-attached-role-policies --role-name {role-name}
```

## ベストプラクティス

1. ✅ **階層構造**: `/tdnet/config/`, `/tdnet/prod/`のように階層化
2. ✅ **命名規則**: ケバブケース（`base-url`）を使用
3. ✅ **環境分離**: 環境ごとにパスを分ける（`/tdnet/prod/`, `/tdnet/dev/`）
4. ✅ **バージョン管理**: 重要なパラメータは変更履歴を記録
5. ✅ **最小権限**: Lambda関数には必要なパラメータのみアクセス許可
6. ✅ **キャッシング**: 頻繁にアクセスするパラメータはキャッシュ

## コスト

- **Standard Parameters**: 無料（10,000パラメータまで）
- **Advanced Parameters**: $0.05/月/パラメータ
- **API呼び出し**: 無料（Standard Parameters）

**月間推定コスト**: $0（Standard Parametersのみ使用）

## 関連ドキュメント

- [AWS Systems Manager Parameter Store公式ドキュメント](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
- [Parameter Storeのベストプラクティス](https://docs.aws.amazon.com/systems-manager/latest/userguide/parameter-store-best-practices.html)
- `.env.production.template` - 本番環境設定テンプレート
- `docs/secrets-manager-setup.md` - Secrets Managerセットアップガイド
