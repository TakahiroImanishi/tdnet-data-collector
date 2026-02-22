# APIキー管理ガイド

**最終更新**: 2026-02-22  
**対象**: TDnet Data Collector

## 目次

1. [概要](#概要)
2. [APIキー登録手順](#apiキー登録手順)
3. [APIキー取得手順](#apiキー取得手順)
4. [トラブルシューティング](#トラブルシューティング)
5. [セキュリティベストプラクティス](#セキュリティベストプラクティス)
6. [FAQ](#faq)

---

## 概要

### Secrets Manager使用の理由

TDnet Data CollectorではAWS Secrets Managerを使用してAPIキーを安全に管理しています。

#### なぜSecrets Managerを使用するのか？

| 理由 | 説明 |
|------|------|
| **セキュリティ** | APIキーをコードやGit履歴にハードコードせず、暗号化して保存 |
| **監査** | CloudTrailでAPIキーへのアクセスを記録し、不正アクセスを検知 |
| **ローテーション** | APIキーの定期的な自動ローテーションが可能（将来実装予定） |
| **アクセス制御** | IAMポリシーで誰がAPIキーにアクセスできるかを細かく制御 |
| **環境分離** | 開発環境と本番環境でAPIキーを分離管理 |

#### Secrets Managerの構造

```json
{
  "SecretId": "/tdnet/api-key-prod",
  "SecretString": "{\"api_key\":\"xxxxx\",\"created_at\":\"2026-02-22T10:00:00Z\",\"environment\":\"prod\"}"
}
```

- **シークレット名**: `/tdnet/api-key-{環境}` (例: `/tdnet/api-key-prod`, `/tdnet/api-key-dev`)
- **リージョン**: `ap-northeast-1` (東京)
- **暗号化**: AWS管理キーで自動暗号化

---

## APIキー登録手順

### 前提条件

- AWS CLIがインストールされている
- AWS認証情報が設定されている (`aws configure`実行済み)
- 必要なIAM権限がある:
  - `secretsmanager:CreateSecret`
  - `secretsmanager:PutSecretValue`
  - `secretsmanager:DescribeSecret`

### 手順1: APIキーを準備

TDnet APIキーを取得します（TDnetの管理画面から発行）。

### 手順2: 登録スクリプトを実行

#### 本番環境にAPIキーを登録

```powershell
# PowerShellで実行
.\scripts\register-api-key.ps1 -Environment prod
```

実行すると、APIキーの入力を求められます:

```
========================================
TDnet APIキー登録スクリプト
========================================

環境: prod

APIキーを入力してください: [ここにAPIキーを入力]
```

#### 開発環境にAPIキーを登録

```powershell
.\scripts\register-api-key.ps1 -Environment dev
```

#### コマンドラインでAPIキーを指定

```powershell
# セキュリティ上推奨されませんが、自動化スクリプトで使用可能
.\scripts\register-api-key.ps1 -Environment prod -ApiKeyValue "your-api-key-here"
```

### 手順3: 登録確認

```powershell
# Secrets Managerに登録されたことを確認
aws secretsmanager describe-secret `
  --secret-id /tdnet/api-key-prod `
  --region ap-northeast-1
```

出力例:

```json
{
    "ARN": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:/tdnet/api-key-prod-AbCdEf",
    "Name": "/tdnet/api-key-prod",
    "Description": "TDnet Data Collector API Key (prod)",
    "LastChangedDate": "2026-02-22T10:00:00+09:00",
    "LastAccessedDate": "2026-02-22T10:00:00+09:00"
}
```

### 既存のAPIキーを更新する場合

既にシークレットが存在する場合、スクリプトは自動的に更新します:

```powershell
.\scripts\register-api-key.ps1 -Environment prod
```

出力:

```
✅ シークレットを更新しました
✅ APIキーの登録が完了しました
```

---

## APIキー取得手順

### スクリプトでの使用方法

#### PowerShellスクリプトから取得

```powershell
# Secrets ManagerからAPIキーを取得
$secretJson = aws secretsmanager get-secret-value `
  --secret-id /tdnet/api-key-prod `
  --region ap-northeast-1 `
  --query SecretString `
  --output text

# JSONをパース
$secret = $secretJson | ConvertFrom-Json
$ApiKey = $secret.api_key

# APIキーを使用
Write-Host "APIキー取得成功: $($ApiKey.Substring(0, 8))..."
```

#### エラーハンドリング付き

```powershell
try {
    $secretJson = aws secretsmanager get-secret-value `
      --secret-id /tdnet/api-key-prod `
      --region ap-northeast-1 `
      --query SecretString `
      --output text
    
    $secret = $secretJson | ConvertFrom-Json
    $ApiKey = $secret.api_key
    
    Write-Host "✅ APIキー取得成功" -ForegroundColor Green
} catch {
    Write-Host "❌ APIキー取得失敗: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Secrets Managerに /tdnet/api-key-prod が登録されているか確認してください" -ForegroundColor Yellow
    exit 1
}
```

#### キャッシュ機能（複数回実行時の最適化）

```powershell
# グローバル変数でキャッシュ
$script:CachedApiKey = $null

function Get-TdnetApiKey {
    param(
        [string]$Environment = "prod"
    )
    
    # キャッシュがあれば返す
    if ($script:CachedApiKey) {
        Write-Host "✅ キャッシュからAPIキーを取得" -ForegroundColor Green
        return $script:CachedApiKey
    }
    
    # Secrets Managerから取得
    try {
        $secretJson = aws secretsmanager get-secret-value `
          --secret-id "/tdnet/api-key-$Environment" `
          --region ap-northeast-1 `
          --query SecretString `
          --output text
        
        $secret = $secretJson | ConvertFrom-Json
        $script:CachedApiKey = $secret.api_key
        
        Write-Host "✅ Secrets ManagerからAPIキーを取得" -ForegroundColor Green
        return $script:CachedApiKey
    } catch {
        Write-Host "❌ APIキー取得失敗: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

# 使用例
$ApiKey = Get-TdnetApiKey -Environment "prod"
```

### AWS CLIで直接取得

```bash
# APIキーを取得（JSON形式）
aws secretsmanager get-secret-value \
  --secret-id /tdnet/api-key-prod \
  --region ap-northeast-1 \
  --query SecretString \
  --output text | jq -r '.api_key'
```

### Lambda関数から取得（TypeScript）

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'ap-northeast-1' });

async function getTdnetApiKey(environment: string = 'prod'): Promise<string> {
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: `/tdnet/api-key-${environment}`,
      })
    );
    
    if (!response.SecretString) {
      throw new Error('SecretString is empty');
    }
    
    const secret = JSON.parse(response.SecretString);
    return secret.api_key;
  } catch (error) {
    console.error('Failed to get API key from Secrets Manager:', error);
    throw error;
  }
}

// 使用例
const apiKey = await getTdnetApiKey('prod');
```

---

## トラブルシューティング

### エラー1: AWS CLI not found

**症状**:
```
aws : 用語 'aws' は、コマンドレット、関数、スクリプト ファイル、または操作可能なプログラムの名前として認識されません。
```

**解決策**:
1. AWS CLIをインストール: https://aws.amazon.com/cli/
2. インストール後、PowerShellを再起動
3. 確認: `aws --version`

### エラー2: AWS credentials are not configured

**症状**:
```
❌ AWS credentials are not configured
```

**解決策**:
```powershell
# AWS認証情報を設定
aws configure

# 入力項目:
# AWS Access Key ID: [アクセスキーID]
# AWS Secret Access Key: [シークレットアクセスキー]
# Default region name: ap-northeast-1
# Default output format: json
```

### エラー3: AccessDeniedException

**症状**:
```
An error occurred (AccessDeniedException) when calling the GetSecretValue operation: 
User: arn:aws:iam::123456789012:user/myuser is not authorized to perform: 
secretsmanager:GetSecretValue on resource: /tdnet/api-key-prod
```

**解決策**:

IAMユーザーに必要な権限を付与します:

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
      "Resource": "arn:aws:secretsmanager:ap-northeast-1:*:secret:/tdnet/api-key-*"
    }
  ]
}
```

### エラー4: ResourceNotFoundException

**症状**:
```
An error occurred (ResourceNotFoundException) when calling the GetSecretValue operation: 
Secrets Manager can't find the specified secret.
```

**解決策**:

1. シークレットが存在するか確認:
```powershell
aws secretsmanager list-secrets --region ap-northeast-1
```

2. シークレットが存在しない場合は登録:
```powershell
.\scripts\register-api-key.ps1 -Environment prod
```

### エラー5: InvalidRequestException (JSON parse error)

**症状**:
```
ConvertFrom-Json : JSON 文字列の変換中にエラーが発生しました
```

**解決策**:

シークレットの値が正しいJSON形式か確認:

```powershell
# シークレットの値を確認
aws secretsmanager get-secret-value `
  --secret-id /tdnet/api-key-prod `
  --region ap-northeast-1 `
  --query SecretString `
  --output text

# 期待される形式:
# {"api_key":"xxxxx","created_at":"2026-02-22T10:00:00Z","environment":"prod"}
```

### エラー6: Secrets Manager API コール制限

**症状**:
```
ThrottlingException: Rate exceeded
```

**解決策**:

キャッシュ機能を使用して、不要なAPIコールを削減します（上記「APIキー取得手順」のキャッシュ機能を参照）。

---

## セキュリティベストプラクティス

### 1. APIキーのハードコーディング禁止

❌ **悪い例**:
```powershell
$ApiKey = "my-secret-api-key-12345"  # ハードコード禁止！
```

✅ **良い例**:
```powershell
$ApiKey = Get-TdnetApiKey -Environment "prod"  # Secrets Managerから取得
```

### 2. Git履歴からAPIキーを削除

過去にAPIキーをコミットしてしまった場合:

```powershell
# Git履歴からAPIキーを削除（注意: 履歴を書き換えます）
git filter-branch --force --index-filter `
  "git rm --cached --ignore-unmatch scripts/manual-data-collection.ps1" `
  --prune-empty --tag-name-filter cat -- --all

# 強制プッシュ（チーム全員に通知してから実行）
git push origin --force --all
```

### 3. IAM権限の最小化

#### スクリプト実行ユーザー（読み取り専用）

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
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

### 4. 監査ログの記録

CloudTrailでSecrets Managerへのアクセスを記録:

```powershell
# 最近のSecrets Managerアクセスを確認
aws cloudtrail lookup-events `
  --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::SecretsManager::Secret `
  --max-results 10 `
  --region ap-northeast-1
```

### 5. APIキーのローテーション（将来実装予定）

- **推奨頻度**: 90日ごと
- **自動ローテーション**: Lambda関数で自動化（Phase 4で実装予定）
- **猶予期間**: 新しいキーに切り替え後、7日間は古いキーも有効

### 6. 環境分離

| 環境 | シークレット名 | 用途 |
|------|--------------|------|
| 開発 | `/tdnet/api-key-dev` | ローカル開発、テスト |
| 本番 | `/tdnet/api-key-prod` | 本番環境のデータ収集 |

### 7. コスト最適化

Secrets Manager APIコールは有料（$0.05/10,000リクエスト）:

- **キャッシュ機能を使用**: 同じスクリプト内で複数回取得する場合
- **Lambda環境変数**: Lambda起動時に1回だけ取得し、環境変数にキャッシュ
- **不要なAPIコールを削減**: 必要な時だけ取得

---

## FAQ

### Q1: APIキーを環境変数に設定してもいいですか？

**A**: ローカル開発環境では可能ですが、本番環境では推奨されません。

✅ **ローカル開発**:
```powershell
# .env.local（Gitにコミットしない）
TDNET_API_KEY=your-api-key-here
```

❌ **本番環境**:
- Lambda環境変数に直接設定しない
- Secrets Managerから動的に取得する

### Q2: 複数のAWSアカウントで同じAPIキーを使えますか？

**A**: はい、可能です。各AWSアカウントのSecrets Managerに同じAPIキーを登録してください。

```powershell
# アカウントAで登録
aws secretsmanager create-secret --name /tdnet/api-key-prod --secret-string "key" --profile account-a

# アカウントBで登録
aws secretsmanager create-secret --name /tdnet/api-key-prod --secret-string "key" --profile account-b
```

### Q3: APIキーが漏洩した場合はどうすればいいですか？

**A**: 以下の手順で対応してください:

1. **即座に無効化**: TDnetの管理画面で古いAPIキーを無効化
2. **新しいキーを発行**: TDnetで新しいAPIキーを発行
3. **Secrets Managerを更新**:
```powershell
.\scripts\register-api-key.ps1 -Environment prod
```
4. **CloudTrailログを確認**: 不正アクセスがないか確認
5. **IAM権限を見直し**: 必要最小限の権限に制限

### Q4: LocalStack（開発環境）でもSecrets Managerを使えますか？

**A**: はい、LocalStackはSecrets Managerをサポートしています。

```powershell
# LocalStackにシークレットを作成
aws secretsmanager create-secret `
  --name /tdnet/api-key-dev `
  --secret-string '{"api_key":"test-key","environment":"dev"}' `
  --endpoint-url http://localhost:4566 `
  --region ap-northeast-1
```

### Q5: APIキーの取得に失敗した場合のフォールバック方法は？

**A**: 環境変数をフォールバックとして使用できます:

```powershell
# Secrets Managerから取得を試み、失敗したら環境変数を使用
try {
    $ApiKey = Get-TdnetApiKey -Environment "prod"
} catch {
    Write-Host "⚠️  Secrets Manager接続失敗、環境変数を使用" -ForegroundColor Yellow
    $ApiKey = $env:TDNET_API_KEY
    
    if (-not $ApiKey) {
        Write-Host "❌ APIキーが見つかりません" -ForegroundColor Red
        exit 1
    }
}
```

### Q6: Secrets Managerの料金はいくらですか？

**A**: 以下の料金体系です:

| 項目 | 料金 |
|------|------|
| シークレット保存 | $0.40/月/シークレット |
| APIコール | $0.05/10,000リクエスト |

**例**: 1つのシークレットで月1,000回取得する場合:
- 保存料金: $0.40
- APIコール料金: $0.05 × (1,000 / 10,000) = $0.005
- **合計**: 約$0.41/月

### Q7: APIキーのバージョン管理はできますか？

**A**: はい、Secrets Managerは自動的にバージョン管理します。

```powershell
# 過去のバージョンを取得
aws secretsmanager get-secret-value `
  --secret-id /tdnet/api-key-prod `
  --version-id <version-id> `
  --region ap-northeast-1
```

### Q8: 複数のAPIキーを管理できますか？

**A**: はい、シークレット名を変えて複数管理できます:

```powershell
# TDnet APIキー
/tdnet/api-key-prod

# 他のサービスのAPIキー
/external-service/api-key-prod
/payment-gateway/api-key-prod
```

---

## 関連ドキュメント

- [セキュリティベストプラクティス](../../.kiro/steering/security/security-best-practices.md)
- [デプロイチェックリスト](../../.kiro/steering/infrastructure/deployment-checklist.md)
- [環境変数管理](../../.kiro/steering/infrastructure/environment-variables.md)
- [AWS Secrets Manager公式ドキュメント](https://docs.aws.amazon.com/secretsmanager/)

---

## 変更履歴

- 2026-02-22: 初版作成 - APIキー管理の完全ガイド
