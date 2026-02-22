# トラブルシューティング

このドキュメントでは、TDnet Data Collectorの運用中に発生する可能性のある問題と、その解決方法を説明します。

## 目次

- [APIキーエラー](#apiキーエラー)
- [Lambda実行エラー](#lambda実行エラー)
- [DynamoDBエラー](#dynamodbエラー)
- [S3エラー](#s3エラー)
- [スクレイピングエラー](#スクレイピングエラー)

---

## APIキーエラー

### エラー: SECRET_NOT_FOUND

**症状**: Secrets Managerにシークレットが登録されていません

**原因**: `/tdnet/api-key-prod` がSecrets Managerに存在しない

**対処方法**:

1. シークレットを登録:
   ```powershell
   .\scripts\register-api-key.ps1 -Environment prod
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

### エラー: ACCESS_DENIED

**症状**: Secrets Managerへのアクセス権限がありません

**原因**: IAMユーザー/ロールに `secretsmanager:GetSecretValue` 権限がない

**対処方法**:

1. IAMポリシーを確認:
   ```bash
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

4. 永続的に環境変数を設定:
   ```powershell
   [System.Environment]::SetEnvironmentVariable("TDNET_API_KEY", "your-api-key", "User")
   ```

---

### エラー: NETWORK_ERROR

**症状**: ネットワークエラー（最大リトライ回数に到達）

**原因**: ネットワーク接続の問題、AWS CLIの設定エラー

**対処方法**:

1. ネットワーク接続を確認:
   ```powershell
   Test-NetConnection aws.amazon.com -Port 443
   ```

2. AWS CLIの設定を確認:
   ```bash
   aws configure list
   aws sts get-caller-identity
   ```

3. AWS CLIの認証情報を再設定:
   ```bash
   aws configure
   ```

4. または、環境変数を設定:
   ```powershell
   $env:TDNET_API_KEY = "your-api-key"
   ```

5. 永続的に環境変数を設定:
   ```powershell
   [System.Environment]::SetEnvironmentVariable("TDNET_API_KEY", "your-api-key", "User")
   ```

---

### FAQ

**Q: 環境変数とSecrets Manager、どちらを使うべきですか？**

A: 
- **本番環境**: Secrets Manager（セキュリティ、監査ログ、自動ローテーション）
- **開発環境**: 環境変数（利便性、迅速なテスト）

**Q: 環境変数を永続的に設定するには？**

A:
```powershell
[System.Environment]::SetEnvironmentVariable("TDNET_API_KEY", "your-api-key", "User")
```

設定後、PowerShellを再起動して反映を確認してください。

**Q: リトライ回数を変更できますか？**

A: 現在は固定（最大3回）。変更が必要な場合は、スクリプトの `$MaxRetries` パラメータを修正してください。

**Q: 環境変数が設定されているか確認するには？**

A:
```powershell
$env:TDNET_API_KEY
```

値が表示されれば設定されています。空の場合は未設定です。

---

## Lambda実行エラー

### エラー: 環境変数未設定

**症状**: Lambda関数が環境変数を読み込めない

**原因**: Lambda関数の環境変数が設定されていない

**対処方法**:

1. Lambda関数の環境変数を確認:
   ```bash
   aws lambda get-function-configuration --function-name tdnet-collector
   ```

2. 環境変数を設定:
   ```bash
   aws lambda update-function-configuration \
     --function-name tdnet-collector \
     --environment Variables={S3_BUCKET_NAME=tdnet-pdfs-prod,DYNAMODB_TABLE_NAME=tdnet-disclosures}
   ```

---

### エラー: タイムアウト

**症状**: Lambda関数がタイムアウトする

**原因**: 処理時間が設定されたタイムアウト値を超過

**対処方法**:

1. Lambda関数のタイムアウトを延長:
   ```bash
   aws lambda update-function-configuration \
     --function-name tdnet-collector \
     --timeout 900
   ```

2. 処理を最適化（バッチサイズの削減、並列度の調整）

---

### エラー: メモリ不足

**症状**: Lambda関数がメモリ不足でクラッシュ

**原因**: 割り当てメモリが不足

**対処方法**:

1. Lambda関数のメモリを増やす:
   ```bash
   aws lambda update-function-configuration \
     --function-name tdnet-collector \
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

### エラー: アクセス拒否

**症状**: `User is not authorized to perform: dynamodb:PutItem`

**原因**: Lambda実行ロールにDynamoDB権限がない

**対処方法**:

1. Lambda実行ロールにDynamoDB権限を追加:
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

```bash
# S3バケットを作成
aws s3 mb s3://tdnet-pdfs-prod --region ap-northeast-1
```

---

### エラー: アクセス拒否

**症状**: `Access Denied`

**原因**: Lambda実行ロールにS3権限がない

**対処方法**:

1. Lambda実行ロールにS3権限を追加:
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
2. `src/scraper/html-parser.ts` のセレクタを更新
3. テストを実行して動作確認

---

### エラー: ネットワークエラー

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
- 必要に応じて `src/utils/rate-limiter.ts` の設定を調整

---

## 関連ドキュメント

- [データ操作スクリプト](../../../../.kiro/steering/development/data-scripts.md)
- [エラーハンドリングパターン](../../../../.kiro/steering/core/error-handling-patterns.md)
- [README.md](../../../../README.md)

