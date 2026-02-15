# TDnet Dashboard - デプロイガイド

## デプロイ概要

TDnet Dashboardは、S3 + CloudFrontを使用した静的Webサイトとしてデプロイされます。

## デプロイアーキテクチャ

```
┌──────────────────────────────────────────────────────────┐
│                      ユーザー                             │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTPS
                     │
          ┌──────────▼──────────┐
          │   CloudFront        │
          │   Distribution      │
          │                     │
          │  - HTTPS強制        │
          │  - Gzip圧縮         │
          │  - キャッシング     │
          │  - WAF統合          │
          └──────────┬──────────┘
                     │ OAI
                     │
          ┌──────────▼──────────┐
          │   S3 Bucket         │
          │   (Static Website)  │
          │                     │
          │  - index.html       │
          │  - static/js/       │
          │  - static/css/      │
          │  - static/media/    │
          └─────────────────────┘
```

## 前提条件

### 必要なツール

- AWS CLI 2.x以上
- Node.js 20.x以上
- npm 10.x以上
- PowerShell 7.x以上 (Windows)

### AWS権限

以下のAWS権限が必要です:

- S3: `s3:PutObject`, `s3:ListBucket`, `s3:GetBucketLocation`
- CloudFront: `cloudfront:CreateInvalidation`, `cloudfront:GetDistribution`
- STS: `sts:GetCallerIdentity`

## 環境変数の設定

### 開発環境 (.env.development)

```env
# API Gateway URL (LocalStack)
REACT_APP_API_URL=http://localhost:4566

# API Key (開発用)
REACT_APP_API_KEY=dev-api-key-12345

# 環境
REACT_APP_ENV=development
```

### 本番環境 (.env.production)

```env
# API Gateway URL (本番)
REACT_APP_API_URL=https://api.example.com

# API Key (本番用 - Secrets Managerから取得)
REACT_APP_API_KEY=<本番APIキー>

# 環境
REACT_APP_ENV=production
```

**重要**: `.env.production`はGitにコミットしないでください。

## ビルド

### ローカルビルド

```bash
# dashboardディレクトリに移動
cd dashboard

# 依存関係のインストール
npm install

# 本番用ビルド
npm run build
```

### ビルド成果物

```
dashboard/build/
├── index.html                    # エントリーポイント
├── static/
│   ├── js/
│   │   ├── main.[hash].js       # アプリケーションコード
│   │   └── [chunk].[hash].js    # コード分割されたチャンク
│   ├── css/
│   │   └── main.[hash].css      # スタイルシート
│   └── media/
│       └── [assets]              # 画像、フォント等
├── favicon.ico
├── logo192.png
├── logo512.png
├── manifest.json
└── robots.txt
```

### ビルドの検証

```bash
# ビルドサイズの確認
du -sh build/

# ビルドファイルの一覧
ls -lh build/static/js/
ls -lh build/static/css/

# ローカルでビルドを確認
npx serve -s build -p 3000
```

## デプロイ手順

### 方法1: デプロイスクリプトを使用 (推奨)

```powershell
# 本番環境にデプロイ
.\scripts\deploy-dashboard.ps1 -Environment prod

# ビルドをスキップしてデプロイ
.\scripts\deploy-dashboard.ps1 -Environment prod -SkipBuild
```

### 方法2: 手動デプロイ

#### 1. AWS Account IDを取得

```powershell
$accountId = aws sts get-caller-identity --query Account --output text
Write-Host "Account ID: $accountId"
```

#### 2. S3バケット名を確認

```powershell
$bucketName = "tdnet-dashboard-prod-$accountId"
Write-Host "Bucket Name: $bucketName"

# バケットの存在確認
aws s3 ls s3://$bucketName/
```

#### 3. ビルド実行

```powershell
cd dashboard
npm run build
```

#### 4. S3にアップロード

```powershell
# すべてのファイルをアップロード
aws s3 sync build/ s3://$bucketName/ --delete

# Cache-Controlヘッダーを設定
# 静的ファイル (JS, CSS, 画像): 1年間キャッシュ
aws s3 cp build/static/ s3://$bucketName/static/ `
  --recursive `
  --cache-control "public, max-age=31536000, immutable"

# index.html: キャッシュなし
aws s3 cp build/index.html s3://$bucketName/index.html `
  --cache-control "no-cache, no-store, must-revalidate"
```

#### 5. CloudFront Invalidation

```powershell
# Distribution IDを取得
$distributionId = aws cloudfront list-distributions `
  --query "DistributionList.Items[?Origins.Items[?DomainName=='$bucketName.s3.amazonaws.com']].Id | [0]" `
  --output text

Write-Host "Distribution ID: $distributionId"

# キャッシュをクリア
aws cloudfront create-invalidation `
  --distribution-id $distributionId `
  --paths "/*"
```

#### 6. デプロイ確認

```powershell
# CloudFront URLを取得
$cloudfrontUrl = aws cloudfront get-distribution `
  --id $distributionId `
  --query "Distribution.DomainName" `
  --output text

Write-Host "Dashboard URL: https://$cloudfrontUrl"

# ブラウザで開く
Start-Process "https://$cloudfrontUrl"
```

## デプロイスクリプト (deploy-dashboard.ps1)

### 使用方法

```powershell
# 基本的な使用
.\scripts\deploy-dashboard.ps1 -Environment prod

# オプション
.\scripts\deploy-dashboard.ps1 `
  -Environment prod `
  -SkipBuild `
  -Verbose
```

### パラメータ

| パラメータ | 説明 | デフォルト |
|-----------|------|-----------|
| `-Environment` | デプロイ環境 (dev, prod) | prod |
| `-SkipBuild` | ビルドをスキップ | false |
| `-Verbose` | 詳細ログを表示 | false |

### スクリプトの動作

1. AWS認証確認
2. Account ID取得
3. S3バケット名生成
4. ビルド実行 (SkipBuildがfalseの場合)
5. S3にアップロード
6. Cache-Controlヘッダー設定
7. CloudFront Invalidation
8. デプロイ完了通知

## デプロイ後の確認

### 1. ダッシュボードへのアクセス

```powershell
# CloudFront URLを取得
$distributionId = aws cloudfront list-distributions `
  --query "DistributionList.Items[?contains(Origins.Items[0].DomainName, 'tdnet-dashboard')].Id | [0]" `
  --output text

$cloudfrontUrl = aws cloudfront get-distribution `
  --id $distributionId `
  --query "Distribution.DomainName" `
  --output text

Write-Host "Dashboard URL: https://$cloudfrontUrl"
```

### 2. 動作確認チェックリスト

- [ ] ページが正しく表示される
- [ ] 検索フィルターが動作する
- [ ] 開示情報一覧が表示される
- [ ] ページネーションが動作する
- [ ] PDFダウンロードが動作する
- [ ] エクスポート機能が動作する
- [ ] レスポンシブデザインが正しく表示される (モバイル/タブレット)
- [ ] エラーハンドリングが正しく動作する

### 3. パフォーマンス確認

```bash
# Lighthouseでパフォーマンス測定
lighthouse https://<cloudfront-url> --view

# 目標スコア
# - Performance: 90以上
# - Accessibility: 90以上
# - Best Practices: 90以上
# - SEO: 90以上
```

### 4. ログ確認

```powershell
# CloudFrontアクセスログ
aws s3 ls s3://tdnet-cloudtrail-logs-$accountId/cloudfront/

# S3アクセスログ
aws s3 ls s3://tdnet-cloudtrail-logs-$accountId/s3/
```

## ロールバック

### 前のバージョンに戻す

```powershell
# S3バケットのバージョニングを有効化している場合
aws s3api list-object-versions `
  --bucket tdnet-dashboard-prod-$accountId `
  --prefix index.html

# 特定のバージョンを復元
aws s3api copy-object `
  --bucket tdnet-dashboard-prod-$accountId `
  --copy-source "tdnet-dashboard-prod-$accountId/index.html?versionId=<version-id>" `
  --key index.html

# CloudFront Invalidation
aws cloudfront create-invalidation `
  --distribution-id $distributionId `
  --paths "/*"
```

## トラブルシューティング

### 1. ビルドが失敗する

```bash
# node_modulesを削除して再インストール
rm -rf node_modules package-lock.json
npm install

# キャッシュをクリア
npm cache clean --force
```

### 2. S3アップロードが失敗する

```powershell
# AWS認証情報を確認
aws sts get-caller-identity

# S3バケットの存在確認
aws s3 ls s3://tdnet-dashboard-prod-$accountId/

# IAM権限を確認
aws iam get-user-policy --user-name <your-user> --policy-name <policy-name>
```

### 3. CloudFront Invalidationが失敗する

```powershell
# Distribution IDを確認
aws cloudfront list-distributions

# Invalidation状態を確認
aws cloudfront list-invalidations --distribution-id $distributionId

# 手動でInvalidationを作成
aws cloudfront create-invalidation `
  --distribution-id $distributionId `
  --paths "/*"
```

### 4. ダッシュボードが表示されない

```powershell
# CloudFront Distribution状態を確認
aws cloudfront get-distribution --id $distributionId `
  --query "Distribution.Status"

# S3バケットポリシーを確認
aws s3api get-bucket-policy --bucket tdnet-dashboard-prod-$accountId

# CloudFront OAIを確認
aws cloudfront get-distribution --id $distributionId `
  --query "Distribution.DistributionConfig.Origins.Items[0].S3OriginConfig.OriginAccessIdentity"
```

### 5. APIエラーが発生する

```powershell
# 環境変数を確認
cat dashboard/.env.production

# API Gatewayの状態を確認
aws apigateway get-rest-apis

# API Keyを確認
aws apigateway get-api-keys
```

## CI/CDパイプライン

### GitHub Actions設定例

```yaml
name: Deploy Dashboard

on:
  push:
    branches:
      - main
    paths:
      - 'dashboard/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        working-directory: dashboard
        run: npm ci
      
      - name: Build
        working-directory: dashboard
        run: npm run build
        env:
          REACT_APP_API_URL: ${{ secrets.API_URL }}
          REACT_APP_API_KEY: ${{ secrets.API_KEY }}
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-northeast-1
      
      - name: Deploy to S3
        working-directory: dashboard
        run: |
          ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
          BUCKET_NAME="tdnet-dashboard-prod-$ACCOUNT_ID"
          
          aws s3 sync build/ s3://$BUCKET_NAME/ --delete
          
          aws s3 cp build/static/ s3://$BUCKET_NAME/static/ \
            --recursive \
            --cache-control "public, max-age=31536000, immutable"
          
          aws s3 cp build/index.html s3://$BUCKET_NAME/index.html \
            --cache-control "no-cache, no-store, must-revalidate"
      
      - name: Invalidate CloudFront
        run: |
          ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
          BUCKET_NAME="tdnet-dashboard-prod-$ACCOUNT_ID"
          
          DISTRIBUTION_ID=$(aws cloudfront list-distributions \
            --query "DistributionList.Items[?Origins.Items[?DomainName=='$BUCKET_NAME.s3.amazonaws.com']].Id | [0]" \
            --output text)
          
          aws cloudfront create-invalidation \
            --distribution-id $DISTRIBUTION_ID \
            --paths "/*"
```

## セキュリティ

### 環境変数の管理

```powershell
# Secrets Managerから本番APIキーを取得
$apiKey = aws secretsmanager get-secret-value `
  --secret-id tdnet-api-key-prod `
  --query SecretString `
  --output text | ConvertFrom-Json | Select-Object -ExpandProperty api_key

# .env.productionに設定
@"
REACT_APP_API_URL=https://api.example.com
REACT_APP_API_KEY=$apiKey
REACT_APP_ENV=production
"@ | Out-File -FilePath dashboard/.env.production -Encoding utf8
```

### S3バケットポリシー

CloudFront OAIのみがアクセス可能:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAI",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity <OAI-ID>"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::tdnet-dashboard-prod-*/*"
    }
  ]
}
```

## 監視

### CloudWatchメトリクス

- CloudFront: リクエスト数、エラー率、レイテンシ
- S3: GetObject/PutObject リクエスト数

### アラート設定

```powershell
# CloudFrontエラー率アラーム
aws cloudwatch put-metric-alarm `
  --alarm-name "dashboard-cloudfront-error-rate" `
  --alarm-description "CloudFront error rate > 5%" `
  --metric-name "5xxErrorRate" `
  --namespace "AWS/CloudFront" `
  --statistic "Average" `
  --period 300 `
  --evaluation-periods 2 `
  --threshold 5 `
  --comparison-operator "GreaterThanThreshold"
```

## 関連ドキュメント

- [ARCHITECTURE.md](./ARCHITECTURE.md) - アーキテクチャ
- [DEVELOPMENT.md](./DEVELOPMENT.md) - 開発ガイドライン
- [TESTING.md](./TESTING.md) - テスト戦略
- [README.md](./README.md) - プロジェクト概要
- [../docs/04-deployment/production-deployment-guide.md](../.kiro/specs/tdnet-data-collector/docs/04-deployment/production-deployment-guide.md) - 本番デプロイガイド
