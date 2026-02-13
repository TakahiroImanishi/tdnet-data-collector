# 負荷テストガイド

## 概要

TDnet Data Collectorの負荷テストを実施するためのガイドです。

## テストシナリオ

### シナリオ1: 大量データ収集（100件以上）

**目的**: 大量の開示情報を収集する際のシステム動作を確認

**テスト内容**:
- Lambda Collector を呼び出し、過去30日間の開示情報を収集
- 100件以上のデータを収集
- 実行時間、成功率、エラー率を測定

**合格基準**:
- 収集件数: 100件以上
- 成功率: 95%以上
- 実行時間: 15分以内

### シナリオ2: 同時API呼び出し（10並列）

**目的**: 複数のAPIリクエストが同時に実行された際の動作を確認

**テスト内容**:
- GET /disclosures を10並列で呼び出し
- レスポンスタイム、成功率を測定

**合格基準**:
- 成功率: 80%以上
- 平均応答時間: 5秒以内

### シナリオ3: エクスポート同時実行（5並列）

**目的**: 複数のエクスポートリクエストが同時に実行された際の動作を確認

**テスト内容**:
- POST /exports を5並列で呼び出し
- エクスポート完了時間、成功率を測定

**合格基準**:
- 成功率: 80%以上
- 総実行時間: 10秒以内

### シナリオ4: レート制限の確認

**目的**: レート制限が正しく機能することを確認

**テスト内容**:
- 連続してAPIリクエストを送信
- レート制限が適用されることを確認

**合格基準**:
- レート制限が機能すること

### シナリオ5: エラーハンドリングの確認

**目的**: 不正なリクエストに対して適切なエラーが返されることを確認

**テスト内容**:
- 不正な日付範囲でリクエスト
- APIキーなしでリクエスト

**合格基準**:
- 適切なHTTPステータスコード（400, 401）が返されること

## 実行方法

### 前提条件

1. **環境変数の設定**

`.env.load-test` ファイルを作成:

```bash
# テスト環境
TEST_ENV=dev

# API設定
API_BASE_URL=https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod
API_KEY=your-api-key

# AWS設定
AWS_REGION=us-east-1
COLLECTOR_FUNCTION_NAME=tdnet-collector-prod
DISCLOSURES_TABLE_NAME=tdnet-disclosures-prod
```

2. **AWS認証情報の設定**

```bash
aws configure
```

### テスト実行

#### すべてのシナリオを実行

```bash
npm test -- load-test.test.ts --testTimeout=600000
```

#### 特定のシナリオのみ実行

```bash
# シナリオ1のみ
npm test -- load-test.test.ts -t "シナリオ1"

# シナリオ2のみ
npm test -- load-test.test.ts -t "シナリオ2"
```

### LocalStack環境でのテスト

LocalStack環境でテストする場合:

```bash
# LocalStack起動
docker compose up -d

# 環境変数設定
export TEST_ENV=local
export API_BASE_URL=http://localhost:4566
export AWS_REGION=us-east-1

# テスト実行
npm test -- load-test.test.ts --testTimeout=600000
```

## テスト結果の確認

### CloudWatch Logs

Lambda関数のログを確認:

```bash
aws logs tail /aws/lambda/tdnet-collector-prod --follow
```

### CloudWatch Metrics

カスタムメトリクスを確認:

```bash
aws cloudwatch get-metric-statistics \
  --namespace TDnet \
  --metric-name DisclosuresCollected \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

### DynamoDB

収集されたデータを確認:

```bash
aws dynamodb scan \
  --table-name tdnet-disclosures-prod \
  --limit 10
```

## トラブルシューティング

### Lambda タイムアウト

**症状**: Lambda関数が15分でタイムアウトする

**対策**:
- 並列度を調整（デフォルト: 5並列）
- 日付範囲を短縮

### DynamoDB スロットリング

**症状**: `ProvisionedThroughputExceededException` エラー

**対策**:
- DynamoDBテーブルをオンデマンドモードに変更
- または、プロビジョニングされた容量を増やす

### API Gateway レート制限

**症状**: `429 Too Many Requests` エラー

**対策**:
- API Gatewayの使用量プランを調整
- リクエスト間隔を調整

### メモリ不足

**症状**: Lambda関数がメモリ不足でクラッシュ

**対策**:
- Lambda関数のメモリサイズを増やす（推奨: 512MB以上）

## パフォーマンス目標

| 項目 | 目標値 | 測定方法 |
|------|--------|----------|
| 大量データ収集（100件） | 15分以内 | Lambda実行時間 |
| 同時API呼び出し（10並列） | 平均5秒以内 | APIレスポンスタイム |
| エクスポート同時実行（5並列） | 10秒以内 | API呼び出し完了時間 |
| 成功率 | 95%以上 | 成功件数 / 総件数 |

## 注意事項

1. **本番環境でのテスト**
   - 本番環境でテストする場合は、事前に関係者に通知すること
   - テストデータと本番データを区別できるようにすること

2. **コスト**
   - 負荷テストはAWS利用料金が発生します
   - テスト後は不要なリソースを削除すること

3. **レート制限**
   - TDnet APIのレート制限（1リクエスト/秒）を遵守すること
   - 過度なリクエストはTDnetサーバーに負荷をかける可能性があります

## 関連ドキュメント

- [パフォーマンステストガイド](./performance-testing-guide.md)
- [デプロイガイド](./deployment-smoke-test.md)
- [監視ガイド](./cloudwatch-metrics-guide.md)
