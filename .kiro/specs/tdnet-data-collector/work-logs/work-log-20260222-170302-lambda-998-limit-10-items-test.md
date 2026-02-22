# Lambda 998制限問題 - 10件テスト実行

**作業日時**: 2026-02-22 17:03:02  
**タスク**: tasks-lambda-998-limit-issue.md - タスク3.1  
**目的**: ログ出力の検証とデバッグ（10件の小規模テスト）

## 作業概要

タスク2で追加したログが本番環境で正しく出力されるか確認するため、10件の小規模テストを実施します。

## 実施内容

### 1. テスト実行

**コマンド**:
```powershell
.\scripts\manual-data-collection.ps1 -StartDate "2026-02-12" -EndDate "2026-02-12" -MaxItems 10
```

**期待される結果**:
- TDnetから10件のデータ取得
- DynamoDBに10件保存
- S3に10件のPDF保存
- CloudWatch Logsに以下のログが出力される:
  - `Total disclosures to process: 10`
  - `Processing batch 1/2`
  - `Batch completed`
  - `All batches completed`

### 2. CloudWatch Logs確認

**確認項目**:
- [ ] バッチ処理ログ（`Processing batch`, `Batch completed`）
- [ ] 個別処理ログ（`Processing disclosure started`, `Processing disclosure completed`）
- [ ] 重複検出ログ（`Duplicate disclosure detected`）
- [ ] エラーログ（`Failed to process disclosure`）

### 3. データ確認

**確認項目**:
- [ ] DynamoDBに10件保存されているか
- [ ] S3に10件のPDF保存されているか
- [ ] 実行状況テーブル（`tdnet_executions_prod`）が更新されているか

## 実行結果

### テスト実行 - 失敗

**実行時刻**: 2026-02-22 17:03:30

**エラー内容**:
```
❌ APIキーの取得に失敗しました
原因: ネットワークエラー（最大リトライ回数に到達）
```

**根本原因**:
AWS認証情報のトークンが無効（`UnrecognizedClientException`）

**AWS CLI設定**:
```
access_key : ****************3IOE
secret_key : ****************a7wn
region     : ap-northeast-1
```

**問題**:
- AWS Secrets Managerへのアクセスが拒否される
- `aws secretsmanager get-secret-value`コマンドが失敗
- エラー: `The security token included in the request is invalid`

## 対処方法

### オプション1: AWS SSOで再認証

```powershell
aws sso login --profile [your-profile]
```

### オプション2: 環境変数で直接APIキーを設定

```powershell
$env:TDNET_API_KEY = 'your-api-key-here'
.\scripts\manual-data-collection.ps1 -StartDate "2026-02-12" -EndDate "2026-02-12" -MaxItems 10
```

### オプション3: AWS認証情報を更新

```powershell
aws configure
# Access Key ID, Secret Access Key, Regionを再入力
```

## 次のステップ

1. ユーザーにAWS認証情報の更新を依頼
2. 認証情報更新後、10件テストを再実行
3. CloudWatch Logsでログ出力を確認

## 申し送り事項

- AWS認証トークンの有効期限が切れている可能性
- 本番環境へのアクセスには有効な認証情報が必要
- テスト実行前に`aws sts get-caller-identity`で認証状態を確認することを推奨

