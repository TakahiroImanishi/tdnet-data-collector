# TDnet Data Collector - ユーザマニュアル

**バージョン**: 1.0.0  
**最終更新**: 2026-02-22

---

## 目次

1. [システム概要](#1-システム概要)
2. [主要機能の詳細説明](#2-主要機能の詳細説明)
3. [Webダッシュボードの使い方](#3-webダッシュボードの使い方)
4. [API利用方法](#4-api利用方法)
5. [よくあるエラーと対処法](#5-よくあるエラーと対処法)
6. [管理者向け情報](#6-管理者向け情報)
7. [付録](#7-付録)

---

## 1. システム概要

### 1.1 TDnet Data Collectorとは

TDnet Data Collectorは、日本取引所グループのTDnet（適時開示情報閲覧サービス）から上場企業の開示情報を自動収集するAWSベースのサーバーレスシステムです。

**目的と背景**:
- TDnetから適時開示情報を自動収集
- 投資判断・分析のためのデータ提供
- サーバーレスアーキテクチャによるコスト効率の高い運用

### 1.2 主要機能一覧

#### ✅ 実装済み機能

- ✅ **データ収集**: オンデマンド収集、Step Functions並列処理（最大5並列）
- ✅ **PDFダウンロード**: 開示資料を自動ダウンロードしてS3に保存
- ✅ **メタデータ管理**: 開示情報のメタデータをDynamoDBに保存
- ✅ **検索API**: 企業コード、日付範囲、開示種別による検索
- ✅ **エクスポートAPI**: JSON/CSV形式でのデータエクスポート
- ✅ **Webダッシュボード**: 検索UI、PDF表示、実行状態確認
- ✅ **実行状態管理**: 進捗追跡、成功率計算
- ✅ **監視とアラート**: CloudWatchによる監視とメトリクス送信

#### ⚠️ 未実装機能

- ⚠️ **自動収集**: 毎日午前9時（JST）の自動収集（EventBridge未設定）
- ⚠️ **SNS通知**: エラー発生時・バッチ完了時の通知（SNS未設定）

### 1.3 技術スタック

| カテゴリ | 技術 |
|---------|------|
| **ランタイム** | Node.js 20.x |
| **言語** | TypeScript 5.x |
| **コンピューティング** | AWS Lambda |
| **データベース** | Amazon DynamoDB |
| **ストレージ** | Amazon S3 |
| **API** | Amazon API Gateway |
| **IaC** | AWS CDK |
| **監視** | CloudWatch |

### 1.4 システムアーキテクチャ

**サーバーレスアーキテクチャ**:
- AWS無料枠内で運用可能
- 4スタック構成（Foundation, Compute, API, Monitoring）
- Step Functions並列処理による高速データ収集
- TDnet APIレート制限（1リクエスト/秒）遵守

**データフロー**:
1. Step Functions Initで収集パラメータを初期化
2. Step Functions Fetchで開示情報リストを取得（並列処理）
3. Step Functions SaveでPDFダウンロードとメタデータ保存
4. Step Functions Aggregateで結果を集約

---

## 2. 主要機能の詳細説明

### 2.1 データ収集機能

#### 収集方式

**オンデマンド収集**（実装済み）:
- 指定期間の開示情報を手動で収集
- API経由またはWebダッシュボードから実行
- 日付範囲: 過去1年以内のみ

**自動収集**（未実装）:
- 毎日午前9時（JST）に自動実行予定
- EventBridge未設定のため現在は利用不可

#### Step Functions並列処理

- **4つのLambda関数**: init/fetch/save/aggregate
- **最大5並列**: ページ処理を並列実行
- **TDnet APIレート制限**: 1リクエスト/秒を遵守
- **タイムアウト設定**:
  - 初期化: 30秒
  - 取得: 60秒/ページ
  - 保存: 120秒/ページ
  - 集約: 30秒
  - ワークフロー全体: 3600秒（1時間）

#### 実行状態管理

- **実行ID**: `exec_{timestamp}_{random}_{sequence}` 形式
- **ステータス**: pending/running/completed/failed/partial_success
- **進捗率**: 0-100%
- **成功件数・失敗件数**: リアルタイム追跡
- **TTL**: 30日で自動削除

#### データ整合性

- **disclosure_id**: 一意性保証
- **date_partition**: YYYY-MM形式（JST基準）
- **バリデーション**: Zod使用

#### エラーハンドリング

- **Retryableエラー**: 指数バックオフ再試行（最大3回）
  - ネットワークエラー（ECONNRESET, ETIMEDOUT）
  - サーバーエラー（5xx）
  - レート制限エラー（429）
  - DynamoDBスロットリング
- **Non-Retryableエラー**: 即座に失敗
  - 認証エラー（401/403）
  - リソース不存在（404）
  - バリデーションエラー（400）
- **Partial Failure**: 成功分コミット、失敗分DLQ送信

#### パフォーマンス

- **通常収集（500件）**: 15秒以内
- **大規模収集（2,700件）**: 45秒以内
- **Lambda実行時間**: 従来比89.9%削減

#### 制限事項

- 日付範囲: 過去1年以内のみ
- 未来日の指定不可
- 並列実行: 最大5並列

### 2.2 検索機能

#### 検索条件

- **企業コード**: 4桁の企業コード（例: 7203）
- **企業名**: 部分一致検索
- **日付範囲**: YYYY-MM-DD形式（例: 2024-01-01）
- **開示種別**: 決算短信、有価証券報告書など

#### フィルタリング

- 複数条件の同時指定可能
- AND条件で絞り込み

#### ソート

- 開示日時の降順（デフォルト）
- 企業コード順
- 企業名順

#### ページネーション

- デフォルト: 20件/ページ
- 最大: 100件/ページ
- nextTokenによる次ページ取得

#### レスポンス形式

- JSON形式
- メタデータ + PDF署名付きURL

#### パフォーマンス

- 検索結果表示: 2秒以内

### 2.3 エクスポート機能

#### エクスポート形式

- **JSON**: 構造化データ、LLM/AIエージェント統合向け
- **CSV**: スプレッドシート分析向け

#### エクスポートジョブ

- 非同期処理（大量データ対応）
- ジョブID発行
- ステータス確認API
- 完了後にS3署名付きURLを返却

#### エクスポート条件

- 検索条件と同じ（企業コード、日付範囲、開示種別）
- 最大10,000件まで

#### ダウンロード

- 署名付きURL（有効期限: 1時間）
- ブラウザまたはcurlでダウンロード

#### 制限事項

- エクスポートジョブ: 同時実行5件まで
- ファイルサイズ: 最大100MB

### 2.4 PDF管理機能

#### PDFダウンロード

- TDnetから自動ダウンロード
- Shift_JIS → UTF-8変換
- バイナリ（arraybuffer）受信

#### S3保存

- ディレクトリ構造: `YYYY/MM/disclosure_id.pdf`
- 暗号化: AES-256（サーバーサイド）
- ライフサイクルポリシー: 90日後Standard-IA、365日後Glacier

#### 署名付きURL生成

- 有効期限: 1時間
- CloudFront経由でアクセス
- WAF保護

#### 整合性検証

- ダウンロード後にファイルサイズ確認
- 破損ファイルは再ダウンロード

### 2.5 実行状態管理機能

#### 実行状態テーブル（execution_state）

- 実行ID、開始日時、終了日時
- ステータス、進捗率
- 総件数、成功件数、失敗件数、成功率
- パラメータ（開始日、終了日）

#### ステータス

- **pending**: 実行待ち
- **running**: 実行中
- **completed**: 完了
- **failed**: 失敗
- **partial_success**: 部分的成功

#### 進捗率計算

- 処理済み件数 / 総件数 × 100
- リアルタイム更新

#### API照会

- `GET /collect-status?execution_id={id}`
- レスポンス: 実行状態の詳細

#### TTL設定

- 30日後に自動削除

### 2.6 監視とアラート機能

#### CloudWatchメトリクス

- Lambda実行時間、エラー数、同時実行数
- DynamoDB読み取り/書き込みキャパシティ
- S3ストレージ使用量
- API Gateway 4XXError、5XXError、レイテンシ

#### CloudWatchアラーム

- Lambda エラー率 > 5%
- DynamoDB スロットリング発生
- API Gateway 4XXError > 10%（5分間）
- API Gateway 5XXError > 1件
- DLQメッセージ数 > 0

#### ログ記録

- 構造化ログ（JSON形式）
- ログレベル: DEBUG/INFO/WARN/ERROR
- ログ保持期間: 30日
- CloudWatch Logs Insights対応

#### ダッシュボード

- システム全体の可視化
- リアルタイム監視
- 過去30日分のトレンド分析

---

## 3. Webダッシュボードの使い方

### 3.1 アクセス方法

- **URL**: `https://[CLOUDFRONT_DISTRIBUTION_ID].cloudfront.net`
- **ブラウザ要件**: Chrome/Firefox/Safari最新版
- **レスポンシブデザイン**: PC/タブレット/スマホ対応

### 3.2 検索機能

#### 検索フォーム

- 企業名、企業コード、日付範囲、開示種別を入力
- 検索ボタンクリックで結果表示
- リアルタイム検索（入力中に候補表示）

#### 検索結果

- テーブル形式で表示
- カラム: 開示日時、企業名、企業コード、開示種別、タイトル
- ソート: カラムヘッダークリックで昇順/降順切り替え
- ページネーション: 20件/ページ

### 3.3 PDFダウンロード

- 「PDF表示」ボタンクリック
- 新しいタブでPDF表示
- ダウンロードボタンでローカル保存

### 3.4 実行状態確認

- 「収集状態」タブで実行履歴表示
- 実行ID、開始日時、ステータス、進捗率、成功率
- 実行中のジョブは進捗バー表示

### 3.5 フィルタリング

- 複数条件の組み合わせ可能
- クリアボタンで条件リセット

### 3.6 エクスポート

- 「エクスポート」ボタンでJSON/CSV選択
- エクスポートジョブ開始
- 完了後にダウンロードリンク表示

---

## 4. API利用方法

### 4.1 API概要

- **RESTful API**
- **ベースURL**: `https://[API_GATEWAY_ID].execute-api.ap-northeast-1.amazonaws.com/prod`
- **認証**: APIキー必須
- **レート制限**: 10,000リクエスト/秒、5,000バースト

### 4.2 認証方法

#### HTTPヘッダー（推奨）

```bash
curl -H "x-api-key: YOUR_API_KEY" https://api.example.com/prod/disclosures
```

#### クエリパラメータ

```bash
curl "https://api.example.com/prod/disclosures?api_key=YOUR_API_KEY"
```

#### APIキー取得方法

- 管理者に依頼
- APIキーローテーション: 90日ごと自動更新

### 4.3 エンドポイント一覧

#### 1. データ収集開始

```bash
POST /collect
```

**パラメータ**:
- `start_date` (必須): 開始日（YYYY-MM-DD形式）
- `end_date` (必須): 終了日（YYYY-MM-DD形式）

**レスポンス**:
```json
{
  "status": "success",
  "data": {
    "execution_id": "exec_20240115123456_abc123_001"
  }
}
```

**例**:
```bash
curl -X POST "https://api.example.com/prod/collect" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"start_date":"2024-01-01","end_date":"2024-01-31"}'
```

#### 2. 収集状態取得

```bash
GET /collect-status?execution_id={id}
```

**パラメータ**:
- `execution_id` (必須): 実行ID

**レスポンス**:
```json
{
  "status": "success",
  "data": {
    "execution_id": "exec_20240115123456_abc123_001",
    "status": "running",
    "progress": 75,
    "total_count": 500,
    "success_count": 375,
    "failure_count": 0,
    "success_rate": 100.0,
    "started_at": "2024-01-15T12:34:56Z",
    "updated_at": "2024-01-15T12:35:30Z"
  }
}
```

#### 3. 開示情報検索

```bash
GET /disclosures?start_date={date}&end_date={date}&company_code={code}&disclosure_type={type}
```

**パラメータ**:
- `start_date` (オプション): 開始日（YYYY-MM-DD形式）
- `end_date` (オプション): 終了日（YYYY-MM-DD形式）
- `company_code` (オプション): 企業コード（4桁）
- `disclosure_type` (オプション): 開示種別
- `limit` (オプション): 取得件数（デフォルト: 20、最大: 100）
- `next_token` (オプション): 次ページトークン

**レスポンス**:
```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "disclosure_id": "TD202401151234001",
        "company_code": "7203",
        "company_name": "トヨタ自動車株式会社",
        "disclosure_type": "決算短信",
        "title": "2024年3月期 第3四半期決算短信",
        "disclosed_at": "2024-01-15T15:00:00Z",
        "pdf_url": "https://cloudfront.example.com/2024/01/TD202401151234001.pdf"
      }
    ],
    "next_token": "eyJsYXN0RXZhbHVhdGVkS2V5Ijp7ImRpc2Nsb3N1cmVfaWQiOiJURDIwMjQwMTE1MTIzNDAwMSJ9fQ=="
  }
}
```

**例**:
```bash
curl -X GET "https://api.example.com/prod/disclosures?start_date=2024-01-01&end_date=2024-01-31&company_code=7203" \
  -H "x-api-key: YOUR_API_KEY"
```

#### 4. 開示情報取得

```bash
GET /disclosures/{disclosure_id}
```

**パラメータ**:
- `disclosure_id` (必須): 開示ID

**レスポンス**:
```json
{
  "status": "success",
  "data": {
    "disclosure_id": "TD202401151234001",
    "company_code": "7203",
    "company_name": "トヨタ自動車株式会社",
    "disclosure_type": "決算短信",
    "title": "2024年3月期 第3四半期決算短信",
    "disclosed_at": "2024-01-15T15:00:00Z",
    "pdf_url": "https://cloudfront.example.com/2024/01/TD202401151234001.pdf",
    "collected_at": "2024-01-15T15:05:00Z"
  }
}
```

#### 5. エクスポート開始

```bash
POST /export
```

**パラメータ**:
- `format` (必須): エクスポート形式（json/csv）
- `start_date` (オプション): 開始日（YYYY-MM-DD形式）
- `end_date` (オプション): 終了日（YYYY-MM-DD形式）
- `company_code` (オプション): 企業コード（4桁）
- `disclosure_type` (オプション): 開示種別

**レスポンス**:
```json
{
  "status": "success",
  "data": {
    "job_id": "export_20240115123456_abc123"
  }
}
```

**例**:
```bash
curl -X POST "https://api.example.com/prod/export" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"format":"csv","start_date":"2024-01-01","end_date":"2024-01-31"}'
```

#### 6. エクスポート状態取得

```bash
GET /export-status?job_id={id}
```

**パラメータ**:
- `job_id` (必須): ジョブID

**レスポンス**:
```json
{
  "status": "success",
  "data": {
    "job_id": "export_20240115123456_abc123",
    "status": "completed",
    "download_url": "https://s3.example.com/exports/export_20240115123456_abc123.csv?signature=...",
    "expires_at": "2024-01-15T16:00:00Z"
  }
}
```

#### 7. PDF署名付きURL取得

```bash
GET /pdf-download?disclosure_id={id}
```

**パラメータ**:
- `disclosure_id` (必須): 開示ID

**レスポンス**:
```json
{
  "status": "success",
  "data": {
    "pdf_url": "https://cloudfront.example.com/2024/01/TD202401151234001.pdf?signature=...",
    "expires_at": "2024-01-15T16:00:00Z"
  }
}
```

#### 8. 統計情報取得

```bash
GET /stats
```

**レスポンス**:
```json
{
  "status": "success",
  "data": {
    "total_count": 125000,
    "latest_collected_at": "2024-01-15T15:00:00Z",
    "companies_count": 3800,
    "top_companies": [
      {"company_code": "7203", "company_name": "トヨタ自動車", "count": 150},
      {"company_code": "9984", "company_name": "ソフトバンクグループ", "count": 145}
    ]
  }
}
```

#### 9. ヘルスチェック

```bash
GET /health
```

**レスポンス**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T15:00:00Z"
}
```

### 4.4 レスポンス形式

#### 成功レスポンス

```json
{
  "status": "success",
  "data": {
    // データ
  }
}
```

#### エラーレスポンス

```json
{
  "status": "error",
  "error_code": "ERR_XXX",
  "message": "エラーメッセージ"
}
```

### 4.5 エラーコード

| エラーコード | 説明 | HTTPステータス |
|------------|------|---------------|
| `ERR_AUTH_001` | APIキー不正 | 401 |
| `ERR_AUTH_002` | APIキー期限切れ | 401 |
| `ERR_VALIDATION_001` | パラメータ不正 | 400 |
| `ERR_VALIDATION_002` | 日付フォーマット不正 | 400 |
| `ERR_VALIDATION_003` | 日付範囲不正 | 400 |
| `ERR_NOT_FOUND_001` | 開示情報が見つからない | 404 |
| `ERR_RATE_LIMIT_001` | レート制限超過 | 429 |
| `ERR_INTERNAL_001` | 内部エラー | 500 |

---

## 5. よくあるエラーと対処法

### 5.1 認証エラー

#### エラー

```json
{"message":"Forbidden"}
```

#### 原因

- APIキーが不正または期限切れ
- APIキーヘッダーが欠落している

#### 対処

1. APIキーを確認
2. 管理者に再発行依頼
3. リクエストヘッダーに`x-api-key`を含める

### 5.2 データが見つからない

#### エラー

```json
{"error_code":"ERR_NOT_FOUND_001","message":"開示情報が見つかりません"}
```

#### 原因

- 指定した条件に一致する開示情報が存在しない

#### 対処

1. 検索条件を変更
2. 日付範囲を広げる
3. 企業コードを確認

### 5.3 API呼び出しエラー

#### エラー

```json
{"message":"Too Many Requests"}
```

#### 原因

- レート制限超過（10,000リクエスト/秒）

#### 対処

1. リクエスト頻度を下げる
2. 再試行ロジック実装（指数バックオフ）
3. バッチ処理で複数件を一度に取得

### 5.4 収集エラー

#### エラー

```json
{"status":"failed","message":"データ収集に失敗しました"}
```

#### 原因

- TDnetサイトダウン
- ネットワークエラー
- Lambda関数のタイムアウト

#### 対処

1. 時間をおいて再実行
2. CloudWatch Logsで詳細確認
3. 日付範囲を短縮
4. 管理者に連絡

### 5.5 タイムアウトエラー

#### エラー

```json
{"message":"Endpoint request timed out"}
```

#### 原因

- Lambda関数の実行時間超過（API Gateway: 29秒）

#### 対処

1. 日付範囲を短縮
2. 管理者に連絡
3. 非同期処理（エクスポートAPI）を使用

### 5.6 CORSエラー

#### エラー

```
Access to fetch ... has been blocked by CORS policy
```

#### 原因

- API GatewayのCORS設定不足

#### 対処

1. 管理者に連絡
2. CORS設定を確認
3. プリフライトリクエスト（OPTIONS）を確認

### 5.7 SSL証明書エラー

#### エラー

```
NET::ERR_CERT_DATE_INVALID
```

#### 原因

- SSL証明書の期限切れ

#### 対処

1. 管理者に連絡
2. 証明書を更新

---

## 6. 管理者向け情報

### 6.1 システム管理

#### AWS認証

- **AWS SSO**: `tdnet-prod` プロファイル
- **ログイン**: `aws sso login --profile tdnet-prod`
- **設定ファイル**: `~/.aws/config`

#### デプロイ

- **分割スタックデプロイ（推奨）**: 2-5分
  ```powershell
  .\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack all
  ```
- **単一スタックデプロイ**: 15-20分
  ```bash
  npm run cdk:deploy
  ```

#### APIキー管理

- **保存場所**: Secrets Manager
- **ローテーション**: 90日ごと自動更新
- **手動ローテーション**:
  ```powershell
  .\scripts\register-api-key.ps1 -Environment prod -Action rotate
  ```

#### コスト管理

- **AWS Budgets**: 月次$10.00設定済み
- **主なコスト要因**:
  - AWS WAF: $8.00/月（72%）
  - CloudWatch カスタムメトリクス: $2.70/月（24%）
  - Secrets Manager: $0.40/月（4%）

### 6.2 運用スクリプト

#### デプロイスクリプト

```powershell
# 分割スタックデプロイ（推奨）
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack compute

# Webダッシュボードデプロイ
.\scripts\deploy-dashboard.ps1 -Environment prod
```

#### データ収集スクリプト

```powershell
# 手動データ収集
.\scripts\manual-data-collection.ps1 -StartDate "2024-01-01" -EndDate "2024-01-31"

# 指定期間のデータ一括取得
.\scripts\fetch-data-range.ps1 -StartDate "2024-01-01" -EndDate "2024-01-31"
```

#### 監視スクリプト

```powershell
# CloudWatchログ確認
.\scripts\check-cloudwatch-logs-simple.ps1 -FunctionName tdnet-collector

# IAM権限確認
.\scripts\check-iam-permissions.ps1

# WAF状態確認
.\scripts\check-waf-status.ps1 -Environment prod
```

#### 診断スクリプト

```powershell
# Lambda 998件制限問題の診断
.\scripts\check-lambda-998-limit.ps1

# DynamoDBとS3の整合性確認
.\scripts\check-dynamodb-s3-consistency.ps1 -Environment prod

# CloudWatchログの詳細分析
.\scripts\analyze-cloudwatch-logs.ps1 -FunctionName tdnet-collector -Hours 24
```

### 6.3 監視とアラート

#### CloudWatchダッシュボード

- **URL**: AWS Console > CloudWatch > Dashboards > `tdnet-monitoring`
- **表示内容**:
  - Lambda実行時間、エラー数、同時実行数
  - DynamoDB読み取り/書き込みキャパシティ
  - S3ストレージ使用量
  - API Gateway 4XXError、5XXError、レイテンシ

#### CloudWatchアラーム

| アラーム名 | 条件 | 通知先 |
|-----------|------|--------|
| Lambda エラー率 | > 5% | SNS（未設定） |
| DynamoDB スロットリング | 発生時 | SNS（未設定） |
| API Gateway 4XXError | > 10%（5分間） | SNS（未設定） |
| API Gateway 5XXError | > 1件 | SNS（未設定） |
| DLQメッセージ数 | > 0 | SNS（未設定） |

**注意**: SNS通知は未実装（Phase 5で実装予定）

#### ログ確認

```bash
# Lambda関数のログを確認
aws logs tail /aws/lambda/tdnet-collector --follow --profile tdnet-prod

# 特定の期間のログを確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector \
  --start-time $(date -d '1 hour ago' +%s)000 \
  --end-time $(date +%s)000 \
  --profile tdnet-prod
```

### 6.4 トラブルシューティング

#### Lambda実行エラー

1. CloudWatch Logsでエラーログ確認
2. 環境変数の設定確認
3. IAM権限の確認
4. タイムアウト設定の確認

#### DynamoDBエラー

1. スロットリング発生時はオンデマンド課金モードに変更
2. アクセス拒否時はIAM権限を確認
3. データ整合性エラー時はバリデーションロジックを確認

#### S3エラー

1. バケット未作成時は作成
2. アクセス拒否時はIAM権限を確認
3. ストレージ容量超過時はライフサイクルポリシーを確認

#### API Gatewayエラー

1. CORSエラー時はCORS設定を確認
2. 認証エラー時はAPIキーを確認
3. レート制限エラー時はスロットリング設定を確認
4. タイムアウトエラー時はLambda関数の処理を最適化

---

## 7. 付録

### 7.1 用語集

| 用語 | 説明 |
|------|------|
| **TDnet** | 適時開示情報閲覧サービス（Timely Disclosure network） |
| **開示情報** | 上場企業が公開する決算短信、有価証券報告書など |
| **disclosure_id** | 開示情報の一意識別子（例: TD202401151234001） |
| **date_partition** | 月単位のパーティションキー（YYYY-MM形式、JST基準） |
| **Step Functions** | AWSのワークフローオーケストレーションサービス |
| **DynamoDB** | AWSのNoSQLデータベース |
| **S3** | AWSのオブジェクトストレージ |
| **Lambda** | AWSのサーバーレスコンピューティング |
| **API Gateway** | AWSのAPIマネジメントサービス |
| **CloudWatch** | AWSの監視サービス |
| **WAF** | Web Application Firewall |
| **TTL** | Time To Live（自動削除までの期間） |

### 7.2 FAQ

#### Q: データ収集の頻度は？

A: 現在はオンデマンド収集のみ。自動収集は未実装（Phase 5で実装予定）

#### Q: 過去何年分のデータを取得できる？

A: 過去1年以内のデータのみ取得可能

#### Q: PDFファイルの保存期間は？

A: 無期限（ライフサイクルポリシーで90日後Standard-IA、365日後Glacier移行）

#### Q: APIキーの有効期限は？

A: 90日ごとに自動ローテーション

#### Q: 同時に何件まで収集できる？

A: 最大5並列で処理（TDnet APIレート制限遵守）

#### Q: エクスポートファイルのサイズ制限は？

A: 最大100MB、10,000件まで

#### Q: ダッシュボードはスマホで使える？

A: はい、レスポンシブデザイン対応

#### Q: データ収集が失敗した場合は？

A: 部分的失敗を許容し、成功分はコミット。失敗分はDLQに送信して後で再処理可能

#### Q: API呼び出しのレート制限は？

A: 10,000リクエスト/秒、5,000バースト

#### Q: PDF署名付きURLの有効期限は？

A: 1時間

### 7.3 関連リンク

- **TDnet公式サイト**: https://www.release.tdnet.info/
- **GitHub リポジトリ**: （プロジェクトURL）
- **技術ドキュメント**: `README.md`
- **API設計ガイドライン**: `.kiro/steering/api/api-design-guidelines.md`
- **セキュリティベストプラクティス**: `.kiro/steering/security/security-best-practices.md`
- **エラーハンドリングパターン**: `.kiro/steering/core/error-handling-patterns.md`
- **デプロイチェックリスト**: `.kiro/steering/infrastructure/deployment-checklist.md`

### 7.4 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-02-22 | 1.0.0 | 初版作成 |

#### Phase 1-4完了（2026-02-22時点）

- ✅ 基本機能: データ収集、PDFダウンロード、メタデータ管理
- ✅ API実装: 検索API、エクスポートAPI、APIキー認証
- ✅ Webダッシュボード: 検索UI、PDF表示、実行状態確認
- ✅ 運用改善: CI/CDパイプライン、セキュリティ強化、監視アラート

#### Phase 5進行中

- ⚠️ 自動収集: EventBridge未設定
- ⚠️ SNS通知: 未実装

---

**最終更新日**: 2026-02-22  
**バージョン**: 1.0.0

