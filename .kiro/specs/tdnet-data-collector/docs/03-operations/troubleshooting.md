# TDnet Data Collector - トラブルシューティングガイド

**最終更新**: 2026-02-23
**対象**: システム運用者

## 目次

1. [環境情報取得エラー](#環境情報取得エラー)
2. [APIキーエラー](#apiキーエラー)
3. [AWS認証エラー](#aws認証エラー)
4. [Step Functions実行エラー](#step-functions実行エラー)
5. [Lambda実行エラー](#lambda実行エラー)
6. [DynamoDBエラー](#dynamodbエラー)
7. [S3エラー](#s3エラー)
8. [スクレイピングエラー](#スクレイピングエラー)

---

## 環境情報取得エラー

### エラー: STACK_NOT_FOUND

**症状**: スタックが見つかりません

```
❌ エラー: スタックが見つかりません
スタック名: tdnet-api-prod
```

**原因**: CDK Stackがデプロイされていない、または削除された

**対処方法**:

1. スタックの存在を確認:
   ```powershell
   aws cloudformation list-stacks --region ap-northeast-1 --query 'StackSummaries[?StackStatus!=`DELETE_COMPLETE`].StackName'
   ```

2. 環境名が正しいか確認（dev または prod）:
   ```powershell
   # 正しい環境名を指定
   .\scripts\manual-data-collection.ps1 -Environment prod -StartDate "2026-02-21"
   ```

3. スタックをデプロイ:
   ```powershell
   .\scripts\deploy-all.ps1 -Environment prod
   ```

---

### エラー: AUTH_EXPIRED

**症状**: AWS認証が期限切れです

```
❌ エラー: AWS認証が期限切れです
```

**原因**: AWS SSOセッションが期限切れ（通常8時間）

**対処方法**:

1. AWS SSOで再ログイン:
   ```powershell
   aws sso login --profile manishi-awssso
   ```

2. 認証状態を確認:
   ```powershell
   aws sts get-caller-identity --profile manishi-awssso
   ```

3. スクリプトを再実行:
   ```powershell
   .\scripts\manual-data-collection.ps1 -Profile manishi-awssso -StartDate "2026-02-21"
   ```

---

### エラー: ACCESS_DENIED

**症状**: CloudFormationへのアクセス権限がありません

```
❌ エラー: CloudFormationへのアクセス権限がありません
```

**原因**: IAMユーザー/ロールに`cloudformation:DescribeStacks`権限がない

**対処方法**:

1. IAMポリシーを確認:
   ```powershell
   aws iam get-user-policy --user-name your-user --policy-name your-policy
   ```

2. 必要な権限を付与:
   ```json
   {
     "Effect": "Allow",
     "Action": "cloudformation:DescribeStacks",
     "Resource": "*"
   }
   ```

3. 正しいAWSプロファイルを使用しているか確認:
   ```powershell
   aws configure list --profile manishi-awssso
   ```

---

### エラー: MISSING_OUTPUT

**症状**: 必須の出力が見つかりません

```
❌ エラー: 必須の出力が見つかりません
出力名: ApiEndpoint
```

**原因**: CDK Stackが古いバージョンで、必要な出力が定義されていない

**対処方法**:

1. スタックを最新バージョンに更新:
   ```powershell
   .\scripts\deploy-all.ps1 -Environment prod
   ```

2. CDK定義を確認（タスク8.1.1の実装が必要）:
   - `cdk/lib/stacks/api-stack.ts`
   - `cdk/lib/stacks/compute-stack.ts`

---

### エラー: AWS_CLI_ERROR

**症状**: AWS CLIエラー

```
❌ エラー: Stack Outputsの取得に失敗しました
詳細: AWS CLI error message
```

**原因**: AWS CLIの設定エラー、ネットワーク接続の問題

**対処方法**:

1. AWS CLIが正しくインストールされているか確認:
   ```powershell
   aws --version
   ```

2. ネットワーク接続を確認:
   ```powershell
   Test-NetConnection aws.amazon.com -Port 443
   ```

3. AWS CLI設定を確認:
   ```powershell
   aws configure list
   ```

---

## APIキーエラー

### エラー: SECRET_NOT_FOUND

**症状**: Secrets Managerにシークレットが登録されていません

```
❌ APIキーの取得に失敗しました

原因: Secrets Managerにシークレットが登録されていません
```

**原因**: `/tdnet/api-key-prod`がSecrets Managerに存在しない

**対処方法**:

1. シークレットを登録:
   ```powershell
   .\scripts\create-api-key-secret.ps1
   ```

2. または、環境変数を設定:
   ```powershell
   $env:TDNET_API_KEY = "your-api-key"
   ```

3. 永続的に環境変数を設定:
   ```powershell
   [System.Environment]::SetEnvironmentVariable("TDNET_API_KEY", "your-api-key", "User")
   ```

---

### エラー: ACCESS_DENIED（APIキー）

**症状**: Secrets Managerへのアクセス権限がありません

```
❌ APIキーの取得に失敗しました

原因: Secrets Managerへのアクセス権限がありません
```

**原因**: IAMユーザー/ロールに`secretsmanager:GetSecretValue`権限がない

**対処方法**:

1. IAMポリシーを確認:
   ```powershell
   aws iam get-user-policy --user-name your-user --policy-name your-policy
   ```

2. 必要な権限を付与:
   ```json
   {
     "Effect": "Allow",
     "Action": "secretsmanager:GetSecretValue",
     "Resource": "arn:aws:secretsmanager:ap-northeast-1:*:secret:/tdnet/api-key-*"
   }
   ```

3. または、環境変数を設定:
   ```powershell
   $env:TDNET_API_KEY = "your-api-key"
   ```

---

### エラー: NETWORK_ERROR

**症状**: ネットワークエラー（最大リトライ回数に到達）

```
❌ APIキーの取得に失敗しました

原因: ネットワークエラー（最大リトライ回数に到達）
```

**原因**: ネットワーク接続の問題、AWS CLIの設定エラー

**対処方法**:

1. ネットワーク接続を確認:
   ```powershell
   Test-NetConnection aws.amazon.com -Port 443
   ```

2. AWS CLIの設定を確認:
   ```powershell
   aws configure list
   aws sts get-caller-identity
   ```

3. または、環境変数を設定:
   ```powershell
   $env:TDNET_API_KEY = "your-api-key"
   ```

---

## AWS認証エラー

### エラー: ExpiredToken

**症状**: AWS認証トークンが期限切れ

```
An error occurred (ExpiredToken) when calling the GetSecretValue operation
```

**原因**: AWS SSOセッションが期限切れ

**対処方法**:

```powershell
aws sso login --profile manishi-awssso
```

---

### エラー: InvalidClientTokenId

**症状**: 無効なAWS認証情報

```
An error occurred (InvalidClientTokenId) when calling the GetSecretValue operation
```

**原因**: AWS認証情報が正しく設定されていない

**対処方法**:

1. AWS CLI設定を確認:
   ```powershell
   aws configure list
   ```

2. AWS認証情報を再設定:
   ```powershell
   aws configure
   ```

---

## Step Functions実行エラー

### エラー: ExecutionDoesNotExist

**症状**: 実行が見つかりません

```
❌ エラー: 実行が見つかりません
実行ID: exec_123
```

**原因**: 指定された実行IDが存在しない、または削除された

**対処方法**:

1. 実行IDが正しいか確認

2. 実行一覧を確認:
   ```powershell
   aws stepfunctions list-executions --state-machine-arn <StateMachineArn> --region ap-northeast-1
   ```

---

### エラー: ExecutionAlreadyStopped

**症状**: 実行は既に停止しています

```
⚠️ 警告: 実行は既に停止しています
実行ID: exec_123
```

**原因**: 実行が既に完了またはキャンセルされている

**対処方法**:

実行状態を確認:
```powershell
.\scripts\check-step-functions-execution.ps1 -ExecutionId exec_123
```

---

### エラー: AccessDeniedException（Step Functions）

**症状**: Step Functionsへのアクセス権限がありません

```
❌ エラー: アクセス権限がありません
詳細: states:StopExecution 権限を確認してください
```

**原因**: IAMユーザー/ロールに`states:StopExecution`権限がない

**対処方法**:

必要な権限を付与:
```json
{
  "Effect": "Allow",
  "Action": [
    "states:DescribeExecution",
    "states:StopExecution"
  ],
  "Resource": "arn:aws:states:ap-northeast-1:*:execution:tdnet-collector-*:*"
}
```

---

## Lambda実行エラー

### エラー: 環境変数未設定

**症状**: Lambda関数が環境変数を読み込めない

**原因**: Lambda関数の環境変数が設定されていない

**対処方法**:

1. Lambda関数の環境変数を確認:
   ```powershell
   aws lambda get-function-configuration --function-name tdnet-collector
   ```

2. 環境変数を設定:
   ```powershell
   aws lambda update-function-configuration `
     --function-name tdnet-collector `
     --environment Variables={S3_BUCKET_NAME=tdnet-pdfs-prod,DYNAMODB_TABLE_NAME=tdnet-disclosures}
   ```

---

### エラー: タイムアウト

**症状**: Lambda関数がタイムアウトする

**原因**: 処理時間が設定されたタイムアウト値を超過

**対処方法**:

1. Lambda関数のタイムアウトを延長:
   ```powershell
   aws lambda update-function-configuration `
     --function-name tdnet-collector `
     --timeout 900
   ```

2. 処理を最適化（バッチサイズの削減、並列度の調整）

---

### エラー: メモリ不足

**症状**: Lambda関数がメモリ不足でクラッシュ

**原因**: 割り当てメモリが不足

**対処方法**:

Lambda関数のメモリを増やす:
```powershell
aws lambda update-function-configuration `
  --function-name tdnet-collector `
  --memory-size 1024
```

---

## DynamoDBエラー

### エラー: スロットリング

**症状**: `ProvisionedThroughputExceededException`

**原因**: 書き込み/読み込みキャパシティを超過

**対処方法**:

1. オンデマンド課金モードに変更（推奨）
2. または、プロビジョニング済みキャパシティを増やす

---

### エラー: アクセス拒否（DynamoDB）

**症状**: `User is not authorized to perform: dynamodb:PutItem`

**原因**: Lambda実行ロールにDynamoDB権限がない

**対処方法**:

Lambda実行ロールにDynamoDB権限を追加:
```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:PutItem",
    "dynamodb:GetItem",
    "dynamodb:Query",
    "dynamodb:Scan"
  ],
  "Resource": "arn:aws:dynamodb:REGION:ACCOUNT-ID:table/tdnet-disclosures"
}
```

---

## S3エラー

### エラー: バケット未作成

**症状**: `The specified bucket does not exist`

**原因**: S3バケットが作成されていない

**対処方法**:

S3バケットを作成:
```powershell
aws s3 mb s3://tdnet-pdfs-prod --region ap-northeast-1
```

---

### エラー: アクセス拒否（S3）

**症状**: `Access Denied`

**原因**: Lambda実行ロールにS3権限がない

**対処方法**:

Lambda実行ロールにS3権限を追加:
```json
{
  "Effect": "Allow",
  "Action": [
    "s3:PutObject",
    "s3:GetObject"
  ],
  "Resource": "arn:aws:s3:::tdnet-pdfs-prod/*"
}
```

---

## スクレイピングエラー

### エラー: TDnetサイト変更

**症状**: `Failed to parse HTML: selector not found`

**原因**: TDnetサイトのHTML構造が変更された

**対処方法**:

1. TDnetサイトのHTML構造を確認
2. `src/scraper/html-parser.ts`のセレクタを更新
3. テストを実行して動作確認

---

### エラー: ネットワークエラー（スクレイピング）

**症状**: `ECONNRESET: Connection reset by peer`

**原因**: ネットワーク接続の問題

**対処方法**:

- 再試行ロジックが自動的に実行されます（最大3回）
- それでも失敗する場合は、TDnetサイトの状態を確認

---

### エラー: レート制限

**症状**: `Too many requests`

**原因**: TDnetサイトのレート制限を超過

**対処方法**:

- レート制限設定を確認（デフォルト: 1リクエスト/秒）
- 必要に応じて`src/utils/rate-limiter.ts`の設定を調整

---

## FAQ

### Q: 環境変数とSecrets Manager、どちらを使うべきですか？

A:
- **本番環境**: Secrets Manager（セキュリティ、監査ログ、自動ローテーション）
- **開発環境**: 環境変数（利便性、迅速なテスト）

### Q: 環境変数を永続的に設定するには？

A:
```powershell
[System.Environment]::SetEnvironmentVariable("TDNET_API_KEY", "your-api-key", "User")
```

設定後、PowerShellを再起動して反映を確認してください。

### Q: 環境変数が設定されているか確認するには？

A:
```powershell
$env:TDNET_API_KEY
```

値が表示されれば設定されています。空の場合は未設定です。

### Q: AWS SSOセッションの有効期限は？

A: 通常8時間です。期限切れの場合は`aws sso login --profile manishi-awssso`で再ログインしてください。

### Q: 環境情報のキャッシュをクリアするには？

A: PowerShellセッションを再起動してください。キャッシュは同一セッション内でのみ有効です。

---

## 関連ドキュメント

- [運用手順書](./operation-guide.md)
- [データ操作スクリプト](../../../.kiro/steering/development/data-scripts.md)
- [エラーハンドリングパターン](../../../.kiro/steering/core/error-handling-patterns.md)
- [システムアーキテクチャ](../02-architecture/system-architecture.md)
