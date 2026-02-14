# TDnet Data Collector - スタック分割設計

## 概要

単一の巨大なスタックを4つの独立したスタックに分割し、デプロイ時間の短縮とロールバックの影響範囲を最小化します。

## 分割戦略

### スタック構成

```
1. TdnetFoundation-{env} (基盤層)
   ├─ DynamoDB Tables (3つ)
   │  ├─ tdnet_disclosures
   │  ├─ tdnet_executions
   │  └─ tdnet_export_status
   ├─ S3 Buckets (4つ)
   │  ├─ PDFs
   │  ├─ Exports
   │  ├─ Dashboard
   │  └─ CloudTrail Logs
   ├─ Secrets Manager
   └─ SNS Topic (Alerts)

2. TdnetCompute-{env} (コンピュート層)
   ├─ Lambda Functions (7つ)
   │  ├─ Collector
   │  ├─ Query
   │  ├─ Export
   │  ├─ Collect
   │  ├─ Collect Status
   │  ├─ Export Status
   │  └─ PDF Download
   └─ DLQ (Dead Letter Queue)

3. TdnetApi-{env} (API層)
   ├─ API Gateway
   ├─ API Key & Usage Plan
   ├─ WAF Web ACL
   └─ CloudFront Distribution

4. TdnetMonitoring-{env} (監視層)
   ├─ CloudWatch Alarms
   ├─ CloudWatch Dashboard
   └─ CloudTrail
```

### 依存関係

```
Foundation (基盤)
    ↓
Compute (Lambda関数)
    ↓
API (API Gateway)
    ↓
Monitoring (監視)
```

## 分割の利点

### 1. デプロイ時間の短縮

| スタック | 推定デプロイ時間 | 変更頻度 |
|---------|----------------|---------|
| Foundation | 5-7分 | 低（月1回以下） |
| Compute | 3-5分 | 高（週数回） |
| API | 2-3分 | 中（月数回） |
| Monitoring | 2-3分 | 低（月1回以下） |

**従来**: 全体で15-20分  
**分割後**: 変更のあるスタックのみ（通常3-5分）

### 2. ロールバック影響の最小化

| スタック | ロールバック時の影響範囲 |
|---------|---------------------|
| Foundation | データ層のみ（DynamoDB, S3） |
| Compute | Lambda関数のみ |
| API | API設定のみ |
| Monitoring | 監視設定のみ |

### 3. 並列開発の促進

- Lambda関数の変更: Compute Stackのみ
- API設定の変更: API Stackのみ
- 監視設定の変更: Monitoring Stackのみ

### 4. コスト最適化

- 変更のないスタックはデプロイ不要
- CloudFormationの実行時間削減
- CI/CDパイプラインの効率化

## デプロイ方法

### 初回デプロイ（全スタック）

```powershell
# 開発環境
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action deploy -Stack all

# 本番環境
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack all
```

### 個別スタックのデプロイ

```powershell
# Lambda関数のみ更新
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action deploy -Stack compute

# API設定のみ更新
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action deploy -Stack api

# 監視設定のみ更新
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action deploy -Stack monitoring
```

### 変更差分の確認

```powershell
# 全スタックの差分確認
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action diff -Stack all

# 特定スタックの差分確認
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action diff -Stack compute
```

### CloudFormationテンプレート生成

```powershell
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action synth
```

### スタック削除

```powershell
# 全スタック削除（依存関係の逆順で実行）
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action destroy -Stack all

# 特定スタック削除
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action destroy -Stack monitoring
```

## マイグレーション手順

### 既存スタックからの移行

1. **バックアップ作成**
   ```powershell
   # DynamoDBテーブルのバックアップ
   aws dynamodb create-backup --table-name tdnet_disclosures_dev --backup-name tdnet-migration-backup
   
   # S3バケットのバージョニング確認
   aws s3api get-bucket-versioning --bucket tdnet-data-collector-pdfs-dev-{ACCOUNT_ID}
   ```

2. **新スタックのデプロイ**
   ```powershell
   # 新しいスタック構成でデプロイ
   .\scripts\deploy-split-stacks.ps1 -Environment dev -Action deploy -Stack all
   ```

3. **動作確認**
   ```powershell
   # API疎通確認
   curl -H "x-api-key: YOUR_API_KEY" https://YOUR_API_ENDPOINT/disclosures
   
   # Lambda関数の動作確認
   aws lambda invoke --function-name tdnet-query-dev response.json
   ```

4. **旧スタックの削除**
   ```powershell
   # 旧スタックを削除
   npx cdk destroy TdnetDataCollectorStack-dev
   ```

### ロールバック手順

問題が発生した場合、影響を受けたスタックのみをロールバック：

```powershell
# CloudFormationコンソールから該当スタックを選択
# 「スタックアクション」→「以前のスタック設定に更新」

# または、前のバージョンを再デプロイ
git checkout <previous-commit>
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action deploy -Stack compute
```

## トラブルシューティング

### スタック間の依存関係エラー

**エラー**: `Export TdnetDisclosuresTableName-dev cannot be deleted as it is in use by TdnetCompute-dev`

**解決策**: 依存関係の逆順で削除
```powershell
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action destroy -Stack all
```

### Lambda関数のデプロイ失敗

**エラー**: `Function code size exceeds limit`

**解決策**: 
1. `npm run build`でビルド確認
2. `dist/`ディレクトリのサイズ確認
3. 不要な依存関係を削除

### API Gatewayの統合エラー

**エラー**: `Invalid permissions on Lambda Function`

**解決策**: Compute Stackを再デプロイしてIAM権限を更新
```powershell
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action deploy -Stack compute
```

## ベストプラクティス

### 1. デプロイ前の確認

```powershell
# 必ず差分を確認
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action diff -Stack all

# テンプレート生成で構文エラーチェック
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action synth
```

### 2. 段階的デプロイ

```powershell
# 開発環境で検証
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action deploy -Stack all

# 動作確認後、本番環境へ
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack all
```

### 3. 変更の最小化

- Lambda関数のみ変更 → Compute Stackのみデプロイ
- API設定のみ変更 → API Stackのみデプロイ
- 不要なスタックのデプロイを避ける

### 4. モニタリング

```powershell
# CloudWatchダッシュボードで確認
# https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#dashboards:name=TdnetDashboard-dev

# CloudFormationスタックの状態確認
aws cloudformation describe-stacks --stack-name TdnetCompute-dev
```

## 参考資料

- [AWS CDK Best Practices](https://docs.aws.amazon.com/cdk/latest/guide/best-practices.html)
- [CloudFormation Stack Dependencies](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-attribute-dependson.html)
- [Lambda Deployment Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)

## 関連ドキュメント

- `cdk/lib/stacks/foundation-stack.ts` - 基盤スタック実装
- `cdk/lib/stacks/compute-stack.ts` - コンピュートスタック実装
- `cdk/lib/stacks/api-stack.ts` - APIスタック実装
- `cdk/lib/stacks/monitoring-stack.ts` - 監視スタック実装
- `cdk/bin/tdnet-data-collector-split.ts` - エントリーポイント
- `scripts/deploy-split-stacks.ps1` - デプロイスクリプト
