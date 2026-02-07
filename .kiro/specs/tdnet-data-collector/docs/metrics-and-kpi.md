# メトリクスとKPI定義

**バージョン:** 1.0.0  
**最終更新:** 2026-02-07

このドキュメントは、TDnet Data Collectorの成功指標、パフォーマンスメトリクス、KPI（重要業績評価指標）を定義します。

---

## 関連ドキュメント

- **設計書**: `design.md` - パフォーマンスベンチマーク目標
- **監視とアラート**: `../../steering/infrastructure/monitoring-alerts.md` - CloudWatch設定とアラート
- **パフォーマンス最適化**: `../../steering/infrastructure/performance-optimization.md` - 最適化戦略
- **トラブルシューティング**: `troubleshooting.md` - 問題解決ガイド

---

## 目次

1. [KPI概要](#kpi概要)
2. [収集メトリクス](#収集メトリクス)
3. [パフォーマンスメトリクス](#パフォーマンスメトリクス)
4. [コストメトリクス](#コストメトリクス)
5. [品質メトリクス](#品質メトリクス)
6. [可用性メトリクス](#可用性メトリクス)
7. [CloudWatchメトリクス対応表](#cloudwatchメトリクス対応表)
8. [フェーズ別目標値](#フェーズ別目標値)

---

## KPI概要

### 主要KPI（Top 5）

| KPI | 目標値 | 測定頻度 | 重要度 |
|-----|--------|---------|--------|
| **収集成功率** | ≥ 99% | 日次 | Critical |
| **平均実行時間** | ≤ 5分 | 実行ごと | High |
| **月間コスト** | ≤ $5 | 月次 | High |
| **データ整合性エラー率** | ≤ 0.1% | 日次 | Critical |
| **API可用性** | ≥ 99.9% | 月次 | High |

### KPIダッシュボード

```
┌─────────────────────────────────────────────────────────┐
│ TDnet Data Collector - KPIダッシュボード                 │
├─────────────────────────────────────────────────────────┤
│ 収集成功率:     99.5% ✓                                  │
│ 平均実行時間:   3分42秒 ✓                                │
│ 月間コスト:     $3.20 ✓                                  │
│ エラー率:       0.05% ✓                                  │
│ API可用性:      99.95% ✓                                 │
└─────────────────────────────────────────────────────────┘
```

---

## 収集メトリクス

### 1. 収集成功率（Collection Success Rate）

**定義:** 正常に収集できた開示情報の割合

**計算式:**
```
収集成功率 = (成功件数 / 試行件数) × 100
```

**目標値:**
- Phase 1-2: ≥ 95%
- Phase 3-4: ≥ 99%

**CloudWatchメトリクス:**
- `CollectionSuccessCount` (カスタムメトリクス)
- `CollectionFailureCount` (カスタムメトリクス)

**実装例:**
```typescript
await cloudwatch.putMetricData({
    Namespace: 'TDnetDataCollector',
    MetricData: [{
        MetricName: 'CollectionSuccessRate',
        Value: (successCount / totalCount) * 100,
        Unit: 'Percent',
        Timestamp: new Date(),
    }],
});
```

---

### 2. 収集件数（Collection Count）

**定義:** 期間内に収集した開示情報の総数

**目標値:**
- 日次: 50-200件（市場状況により変動）
- 月次: 1,500-6,000件

**CloudWatchメトリクス:**
- `CollectedDisclosuresCount` (カスタムメトリクス)

**分類:**
- 決算短信
- 業績予想修正
- 配当予想修正
- その他

---

### 3. 重複検出率（Duplicate Detection Rate）

**定義:** 重複として検出された開示情報の割合

**計算式:**
```
重複検出率 = (重複件数 / 試行件数) × 100
```

**目標値:** ≤ 5%

**CloudWatchメトリクス:**
- `DuplicateDetectionCount` (カスタムメトリクス)

---

## パフォーマンスメトリクス

### 4. 平均実行時間（Average Execution Time）

**定義:** Lambda関数の平均実行時間

**目標値:**
- Collector Lambda: ≤ 5分
- Query Lambda: ≤ 3秒
- Export Lambda: ≤ 30秒

**CloudWatchメトリクス:**
- `Duration` (Lambda標準メトリクス)

**実装例:**
```typescript
const startTime = Date.now();
// 処理
const duration = Date.now() - startTime;

await cloudwatch.putMetricData({
    Namespace: 'TDnetDataCollector',
    MetricData: [{
        MetricName: 'CollectionDuration',
        Value: duration,
        Unit: 'Milliseconds',
    }],
});
```

---

### 5. スループット（Throughput）

**定義:** 単位時間あたりの処理件数

**計算式:**
```
スループット = 収集件数 / 実行時間（秒）
```

**目標値:** ≥ 1件/秒

**CloudWatchメトリクス:**
- `Throughput` (カスタムメトリクス)

---

### 6. レイテンシ（Latency）

**定義:** APIリクエストからレスポンスまでの時間

**目標値:**
- GET /disclosures: ≤ 500ms (p50), ≤ 1000ms (p99)
- GET /disclosures/{id}: ≤ 200ms (p50), ≤ 500ms (p99)
- POST /collect: ≤ 100ms (p50), ≤ 300ms (p99)

**CloudWatchメトリクス:**
- `Latency` (API Gateway標準メトリクス)

---

## コストメトリクス

### 7. 月間コスト（Monthly Cost）

**定義:** AWS利用料金の月間合計

**目標値:** ≤ $5/月

**内訳:**
- Lambda: $1.50
- DynamoDB: $1.00
- S3: $1.50
- API Gateway: $0.50
- その他: $0.50

**測定方法:**
- AWS Cost Explorer
- AWS Budgets

**コスト最適化指標:**
```
コスト効率 = 収集件数 / 月間コスト
目標: ≥ 1,000件/$
```

---

### 8. Lambda実行コスト（Lambda Execution Cost）

**定義:** Lambda関数の実行コスト

**計算式:**
```
Lambda実行コスト = (実行時間 × メモリサイズ × 単価) + (リクエスト数 × リクエスト単価)
```

**目標値:** ≤ $1.50/月

**CloudWatchメトリクス:**
- `Invocations` (Lambda標準メトリクス)
- `Duration` (Lambda標準メトリクス)

---

### 9. ストレージコスト（Storage Cost）

**定義:** S3とDynamoDBのストレージコスト

**目標値:**
- S3: ≤ $1.00/月
- DynamoDB: ≤ $1.00/月

**測定方法:**
- S3: `BucketSizeBytes` (S3標準メトリクス)
- DynamoDB: `TableSize` (DynamoDB標準メトリクス)

---

## 品質メトリクス

### 10. データ整合性エラー率（Data Integrity Error Rate）

**定義:** データ整合性エラーの発生率

**計算式:**
```
エラー率 = (エラー件数 / 総件数) × 100
```

**目標値:** ≤ 0.1%

**エラー分類:**
- メタデータとPDFの不一致
- 重複キーエラー
- バリデーションエラー

**CloudWatchメトリクス:**
- `DataIntegrityErrors` (カスタムメトリクス)

---

### 11. テストカバレッジ（Test Coverage）

**定義:** コードのテストカバレッジ率

**目標値:**
- ユニットテスト: ≥ 80%
- 統合テスト: ≥ 60%
- E2Eテスト: 主要フロー100%

**測定方法:**
- Jest coverage report
- Codecov

---

### 12. バグ密度（Bug Density）

**定義:** コード1,000行あたりのバグ数

**計算式:**
```
バグ密度 = (バグ数 / コード行数) × 1000
```

**目標値:** ≤ 5 bugs/KLOC

---

## 可用性メトリクス

### 13. API可用性（API Availability）

**定義:** APIが正常に応答した時間の割合

**計算式:**
```
可用性 = (稼働時間 / 総時間) × 100
```

**目標値:** ≥ 99.9% (月間ダウンタイム ≤ 43分)

**CloudWatchメトリクス:**
- `5XXError` (API Gateway標準メトリクス)
- `4XXError` (API Gateway標準メトリクス)

---

### 14. エラー率（Error Rate）

**定義:** エラーレスポンスの割合

**計算式:**
```
エラー率 = (エラー数 / 総リクエスト数) × 100
```

**目標値:**
- 4XXエラー: ≤ 5%
- 5XXエラー: ≤ 0.1%

**CloudWatchメトリクス:**
- `Errors` (Lambda標準メトリクス)

---

### 15. 平均復旧時間（MTTR: Mean Time To Recovery）

**定義:** 障害発生から復旧までの平均時間

**目標値:** ≤ 30分

**測定方法:**
- CloudWatch Alarms
- SNS通知タイムスタンプ

---

## CloudWatchメトリクス対応表

### Lambda関数メトリクス

| メトリクス名 | 説明 | 単位 | 目標値 |
|------------|------|------|--------|
| `Invocations` | 実行回数 | Count | - |
| `Duration` | 実行時間 | Milliseconds | ≤ 300,000 (5分) |
| `Errors` | エラー数 | Count | ≤ 1% |
| `Throttles` | スロットル数 | Count | 0 |
| `ConcurrentExecutions` | 同時実行数 | Count | ≤ 10 |
| `IteratorAge` | イテレータ年齢 | Milliseconds | - |

### DynamoDBメトリクス

| メトリクス名 | 説明 | 単位 | 目標値 |
|------------|------|------|--------|
| `ConsumedReadCapacityUnits` | 読み込みキャパシティ | Count | - |
| `ConsumedWriteCapacityUnits` | 書き込みキャパシティ | Count | - |
| `UserErrors` | ユーザーエラー | Count | ≤ 0.1% |
| `SystemErrors` | システムエラー | Count | 0 |
| `ThrottledRequests` | スロットルリクエスト | Count | 0 |

### S3メトリクス

| メトリクス名 | 説明 | 単位 | 目標値 |
|------------|------|------|--------|
| `BucketSizeBytes` | バケットサイズ | Bytes | ≤ 10GB |
| `NumberOfObjects` | オブジェクト数 | Count | - |
| `AllRequests` | 全リクエスト | Count | - |
| `4xxErrors` | 4xxエラー | Count | ≤ 1% |
| `5xxErrors` | 5xxエラー | Count | 0 |

### API Gatewayメトリクス

| メトリクス名 | 説明 | 単位 | 目標値 |
|------------|------|------|--------|
| `Count` | リクエスト数 | Count | - |
| `Latency` | レイテンシ | Milliseconds | ≤ 500 (p50) |
| `IntegrationLatency` | 統合レイテンシ | Milliseconds | ≤ 400 (p50) |
| `4XXError` | 4xxエラー | Count | ≤ 5% |
| `5XXError` | 5xxエラー | Count | ≤ 0.1% |

### カスタムメトリクス

| メトリクス名 | 説明 | 単位 | 目標値 |
|------------|------|------|--------|
| `CollectionSuccessRate` | 収集成功率 | Percent | ≥ 99% |
| `CollectedDisclosuresCount` | 収集件数 | Count | - |
| `DuplicateDetectionCount` | 重複検出数 | Count | - |
| `DataIntegrityErrors` | データ整合性エラー | Count | ≤ 0.1% |
| `Throughput` | スループット | Count/Second | ≥ 1 |

---

## フェーズ別目標値

### Phase 1: 基本機能（MVP）

| メトリクス | 目標値 | 備考 |
|-----------|--------|------|
| 収集成功率 | ≥ 95% | 基本的な動作確認 |
| 平均実行時間 | ≤ 10分 | 最適化前 |
| 月間コスト | ≤ $10 | 初期段階 |
| テストカバレッジ | ≥ 60% | ユニットテストのみ |

### Phase 2: API実装

| メトリクス | 目標値 | 備考 |
|-----------|--------|------|
| 収集成功率 | ≥ 97% | エラーハンドリング改善 |
| 平均実行時間 | ≤ 7分 | 部分的最適化 |
| API可用性 | ≥ 99% | API追加 |
| レイテンシ (p50) | ≤ 1000ms | 初期目標 |
| 月間コスト | ≤ $7 | API Gateway追加 |
| テストカバレッジ | ≥ 70% | 統合テスト追加 |

### Phase 3: 自動化

| メトリクス | 目標値 | 備考 |
|-----------|--------|------|
| 収集成功率 | ≥ 98% | 自動化による安定性向上 |
| 平均実行時間 | ≤ 5分 | 最適化実施 |
| API可用性 | ≥ 99.5% | 監視強化 |
| レイテンシ (p50) | ≤ 500ms | 最適化実施 |
| 月間コスト | ≤ $5 | コスト最適化 |
| テストカバレッジ | ≥ 80% | E2Eテスト追加 |

### Phase 4: 運用改善

| メトリクス | 目標値 | 備考 |
|-----------|--------|------|
| 収集成功率 | ≥ 99% | 本番運用レベル |
| 平均実行時間 | ≤ 3分 | 完全最適化 |
| API可用性 | ≥ 99.9% | 高可用性 |
| レイテンシ (p50) | ≤ 300ms | 最終目標 |
| データ整合性エラー率 | ≤ 0.1% | 品質保証 |
| 月間コスト | ≤ $5 | 目標達成 |
| テストカバレッジ | ≥ 85% | 完全なテスト |
| MTTR | ≤ 30分 | 迅速な復旧 |

---

## メトリクス収集実装例

### カスタムメトリクスの送信

```typescript
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'ap-northeast-1' });

async function putMetric(
    metricName: string,
    value: number,
    unit: string = 'None',
    dimensions: Record<string, string> = {}
) {
    await cloudwatch.send(new PutMetricDataCommand({
        Namespace: 'TDnetDataCollector',
        MetricData: [{
            MetricName: metricName,
            Value: value,
            Unit: unit,
            Timestamp: new Date(),
            Dimensions: Object.entries(dimensions).map(([Name, Value]) => ({
                Name,
                Value,
            })),
        }],
    }));
}

// 使用例
await putMetric('CollectionSuccessRate', 99.5, 'Percent');
await putMetric('CollectedDisclosuresCount', 150, 'Count', {
    DisclosureType: '決算短信',
});
```

### CloudWatchアラームの設定

```typescript
import { Alarm, ComparisonOperator } from 'aws-cdk-lib/aws-cloudwatch';

// 収集成功率が95%を下回ったらアラート
const successRateAlarm = new Alarm(this, 'CollectionSuccessRateAlarm', {
    metric: new Metric({
        namespace: 'TDnetDataCollector',
        metricName: 'CollectionSuccessRate',
        statistic: 'Average',
    }),
    threshold: 95,
    evaluationPeriods: 2,
    comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
    alarmDescription: '収集成功率が95%を下回りました',
});

successRateAlarm.addAlarmAction(new SnsAction(alertTopic));
```

---

## CloudWatchメトリクス設定例（CDK）

### 基本的なメトリクス定義

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class TdnetMonitoringStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Lambda関数の参照（既存のスタックから取得）
        const collectorFn = lambda.Function.fromFunctionName(
            this,
            'CollectorFunction',
            'tdnet-collector-function'
        );

        // DynamoDBテーブルの参照
        const table = dynamodb.Table.fromTableName(
            this,
            'DisclosuresTable',
            'tdnet-disclosures'
        );

        // Lambda標準メトリクス
        const invocationsMetric = collectorFn.metricInvocations({
            period: cdk.Duration.minutes(5),
            statistic: 'Sum',
        });

        const errorsMetric = collectorFn.metricErrors({
            period: cdk.Duration.minutes(5),
            statistic: 'Sum',
        });

        const durationMetric = collectorFn.metricDuration({
            period: cdk.Duration.minutes(5),
            statistic: 'Average',
        });

        const throttlesMetric = collectorFn.metricThrottles({
            period: cdk.Duration.minutes(5),
            statistic: 'Sum',
        });
    }
}
```

### カスタムメトリクスの作成

```typescript
// カスタムメトリクスの定義
const collectionSuccessRateMetric = new cloudwatch.Metric({
    namespace: 'TDnetDataCollector',
    metricName: 'CollectionSuccessRate',
    dimensionsMap: {
        Environment: 'production',
    },
    statistic: 'Average',
    period: cdk.Duration.minutes(5),
});

const collectedDisclosuresMetric = new cloudwatch.Metric({
    namespace: 'TDnetDataCollector',
    metricName: 'CollectedDisclosuresCount',
    dimensionsMap: {
        Environment: 'production',
        DisclosureType: 'ALL',
    },
    statistic: 'Sum',
    period: cdk.Duration.hours(1),
});

const dataIntegrityErrorsMetric = new cloudwatch.Metric({
    namespace: 'TDnetDataCollector',
    metricName: 'DataIntegrityErrors',
    dimensionsMap: {
        Environment: 'production',
    },
    statistic: 'Sum',
    period: cdk.Duration.hours(1),
});

const throughputMetric = new cloudwatch.Metric({
    namespace: 'TDnetDataCollector',
    metricName: 'Throughput',
    dimensionsMap: {
        Environment: 'production',
    },
    statistic: 'Average',
    period: cdk.Duration.minutes(5),
    unit: cloudwatch.Unit.COUNT_PER_SECOND,
});
```

### メトリクスフィルターの設定

```typescript
import * as logs from 'aws-cdk-lib/aws-logs';

// Lambda関数のロググループ
const logGroup = logs.LogGroup.fromLogGroupName(
    this,
    'CollectorLogGroup',
    `/aws/lambda/${collectorFn.functionName}`
);

// エラーメトリクスフィルター
const errorMetricFilter = new logs.MetricFilter(this, 'ErrorMetricFilter', {
    logGroup,
    metricNamespace: 'TDnetDataCollector',
    metricName: 'ApplicationErrors',
    filterPattern: logs.FilterPattern.literal('[timestamp, request_id, level = "ERROR", ...]'),
    metricValue: '1',
    defaultValue: 0,
    dimensions: {
        Environment: 'production',
    },
});

// 収集成功メトリクスフィルター
const successMetricFilter = new logs.MetricFilter(this, 'SuccessMetricFilter', {
    logGroup,
    metricNamespace: 'TDnetDataCollector',
    metricName: 'CollectionSuccess',
    filterPattern: logs.FilterPattern.literal('[..., msg = "Successfully collected disclosure", ...]'),
    metricValue: '1',
    defaultValue: 0,
});

// 収集失敗メトリクスフィルター
const failureMetricFilter = new logs.MetricFilter(this, 'FailureMetricFilter', {
    logGroup,
    metricNamespace: 'TDnetDataCollector',
    metricName: 'CollectionFailure',
    filterPattern: logs.FilterPattern.literal('[..., msg = "Failed to collect disclosure", ...]'),
    metricValue: '1',
    defaultValue: 0,
});

// データ整合性エラーフィルター
const integrityErrorFilter = new logs.MetricFilter(this, 'IntegrityErrorFilter', {
    logGroup,
    metricNamespace: 'TDnetDataCollector',
    metricName: 'DataIntegrityErrors',
    filterPattern: logs.FilterPattern.literal('[..., error_type = "DataIntegrityError", ...]'),
    metricValue: '1',
    defaultValue: 0,
});
```

---

## アラート設定例（CDK）

### SNSトピックの作成

```typescript
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

// アラート通知用SNSトピック
const alertTopic = new sns.Topic(this, 'AlertTopic', {
    topicName: 'tdnet-alerts',
    displayName: 'TDnet Data Collector Alerts',
});

// メール通知の追加
alertTopic.addSubscription(
    new subscriptions.EmailSubscription('alerts@example.com')
);

// 複数の宛先を追加
const emails = ['admin@example.com', 'ops@example.com'];
emails.forEach(email => {
    alertTopic.addSubscription(
        new subscriptions.EmailSubscription(email)
    );
});
```

### Lambda関数のアラーム

```typescript
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';

// エラー率アラーム（5分間で10件以上のエラー）
const highErrorRateAlarm = new cloudwatch.Alarm(this, 'HighErrorRateAlarm', {
    alarmName: 'tdnet-high-error-rate',
    alarmDescription: 'Lambda関数のエラーが5分間で10件を超えました',
    metric: errorsMetric,
    threshold: 10,
    evaluationPeriods: 2,
    datapointsToAlarm: 2,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
});

highErrorRateAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
highErrorRateAlarm.addOkAction(new actions.SnsAction(alertTopic));

// 実行時間アラーム（平均10分超過）
const longDurationAlarm = new cloudwatch.Alarm(this, 'LongDurationAlarm', {
    alarmName: 'tdnet-long-duration',
    alarmDescription: 'Lambda実行時間が平均10分を超えました',
    metric: durationMetric,
    threshold: 600000, // 10分（ミリ秒）
    evaluationPeriods: 2,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
});

longDurationAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

// スロットリングアラーム（即座に通知）
const throttleAlarm = new cloudwatch.Alarm(this, 'ThrottleAlarm', {
    alarmName: 'tdnet-throttle',
    alarmDescription: 'Lambdaスロットリングが発生しました',
    metric: throttlesMetric,
    threshold: 1,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
});

throttleAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
```

### ビジネスメトリクスのアラーム

```typescript
// 収集成功率アラーム（95%未満）
const lowSuccessRateAlarm = new cloudwatch.Alarm(this, 'LowSuccessRateAlarm', {
    alarmName: 'tdnet-low-success-rate',
    alarmDescription: '収集成功率が95%を下回りました',
    metric: collectionSuccessRateMetric,
    threshold: 95,
    evaluationPeriods: 2,
    comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
});

lowSuccessRateAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

// データ収集停止アラーム（24時間データなし）
const noDataAlarm = new cloudwatch.Alarm(this, 'NoDataAlarm', {
    alarmName: 'tdnet-no-data-collected',
    alarmDescription: '24時間データ収集がありません',
    metric: collectedDisclosuresMetric.with({
        period: cdk.Duration.hours(24),
    }),
    threshold: 1,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    treatMissingData: cloudwatch.TreatMissingData.BREACHING,
});

noDataAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

// データ整合性エラーアラーム（1時間で5件以上）
const integrityErrorAlarm = new cloudwatch.Alarm(this, 'IntegrityErrorAlarm', {
    alarmName: 'tdnet-integrity-errors',
    alarmDescription: 'データ整合性エラーが1時間で5件を超えました',
    metric: dataIntegrityErrorsMetric,
    threshold: 5,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
});

integrityErrorAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
```

### DynamoDBのアラーム

```typescript
// DynamoDBユーザーエラーアラーム
const dynamoUserErrorsMetric = new cloudwatch.Metric({
    namespace: 'AWS/DynamoDB',
    metricName: 'UserErrors',
    dimensionsMap: {
        TableName: table.tableName,
    },
    statistic: 'Sum',
    period: cdk.Duration.minutes(5),
});

const dynamoUserErrorAlarm = new cloudwatch.Alarm(this, 'DynamoUserErrorAlarm', {
    alarmName: 'tdnet-dynamodb-user-errors',
    alarmDescription: 'DynamoDBユーザーエラーが5分間で5件を超えました',
    metric: dynamoUserErrorsMetric,
    threshold: 5,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
});

dynamoUserErrorAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

// DynamoDBスロットリングアラーム
const dynamoThrottleMetric = new cloudwatch.Metric({
    namespace: 'AWS/DynamoDB',
    metricName: 'ThrottledRequests',
    dimensionsMap: {
        TableName: table.tableName,
    },
    statistic: 'Sum',
    period: cdk.Duration.minutes(5),
});

const dynamoThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoThrottleAlarm', {
    alarmName: 'tdnet-dynamodb-throttles',
    alarmDescription: 'DynamoDBスロットリングが発生しました',
    metric: dynamoThrottleMetric,
    threshold: 1,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
});

dynamoThrottleAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
```

### アラート閾値の設定根拠

| アラーム | 閾値 | 根拠 |
|---------|------|------|
| **エラー率** | 10件/5分 | 通常は0-2件。10件超過は異常な状態 |
| **実行時間** | 10分 | 目標5分の2倍。タイムアウト（15分）前に検知 |
| **スロットリング** | 1件 | 即座に対応が必要な重大な問題 |
| **収集成功率** | 95% | Phase 1-2の目標値。これを下回ると品質低下 |
| **データ収集停止** | 24時間 | 平日は必ず開示情報があるため、24時間なしは異常 |
| **整合性エラー** | 5件/時間 | 目標0.1%。1時間で5件は許容範囲を超える |
| **DynamoDBエラー** | 5件/5分 | 通常は0件。5件超過は設定ミスやバグの可能性 |

---

## ダッシュボード作成例（CDK）

### 総合ダッシュボード

```typescript
// メインダッシュボードの作成
const dashboard = new cloudwatch.Dashboard(this, 'TdnetDashboard', {
    dashboardName: 'tdnet-collector-overview',
    periodOverride: cloudwatch.PeriodOverride.AUTO,
});

// 1行目: KPI概要
dashboard.addWidgets(
    new cloudwatch.SingleValueWidget({
        title: '収集成功率（24時間）',
        metrics: [collectionSuccessRateMetric.with({
            period: cdk.Duration.hours(24),
        })],
        width: 6,
        height: 4,
        setPeriodToTimeRange: true,
    }),
    new cloudwatch.SingleValueWidget({
        title: '収集件数（24時間）',
        metrics: [collectedDisclosuresMetric.with({
            period: cdk.Duration.hours(24),
        })],
        width: 6,
        height: 4,
    }),
    new cloudwatch.SingleValueWidget({
        title: '平均実行時間',
        metrics: [durationMetric],
        width: 6,
        height: 4,
    }),
    new cloudwatch.SingleValueWidget({
        title: 'エラー数（24時間）',
        metrics: [errorsMetric.with({
            period: cdk.Duration.hours(24),
        })],
        width: 6,
        height: 4,
    })
);

// 2行目: Lambda実行状況
dashboard.addWidgets(
    new cloudwatch.GraphWidget({
        title: 'Lambda実行回数',
        left: [invocationsMetric],
        width: 12,
        height: 6,
        leftYAxis: {
            label: '実行回数',
            showUnits: false,
        },
    }),
    new cloudwatch.GraphWidget({
        title: 'Lambdaエラー数',
        left: [errorsMetric],
        width: 12,
        height: 6,
        leftYAxis: {
            label: 'エラー数',
            showUnits: false,
        },
    })
);

// 3行目: パフォーマンス
dashboard.addWidgets(
    new cloudwatch.GraphWidget({
        title: 'Lambda実行時間',
        left: [
            durationMetric,
            collectorFn.metricDuration({
                statistic: 'Maximum',
                period: cdk.Duration.minutes(5),
                label: '最大実行時間',
            }),
        ],
        width: 12,
        height: 6,
        leftYAxis: {
            label: '実行時間（ミリ秒）',
            showUnits: false,
        },
    }),
    new cloudwatch.GraphWidget({
        title: 'スループット',
        left: [throughputMetric],
        width: 12,
        height: 6,
        leftYAxis: {
            label: '件/秒',
            showUnits: false,
        },
    })
);

// 4行目: ビジネスメトリクス
dashboard.addWidgets(
    new cloudwatch.GraphWidget({
        title: '収集件数（時間別）',
        left: [collectedDisclosuresMetric],
        width: 12,
        height: 6,
        leftYAxis: {
            label: '収集件数',
            showUnits: false,
        },
    }),
    new cloudwatch.GraphWidget({
        title: '収集成功率',
        left: [collectionSuccessRateMetric],
        width: 12,
        height: 6,
        leftYAxis: {
            label: '成功率（%）',
            min: 0,
            max: 100,
        },
    })
);

// 5行目: DynamoDB
dashboard.addWidgets(
    new cloudwatch.GraphWidget({
        title: 'DynamoDB読み書きキャパシティ',
        left: [
            new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'ConsumedReadCapacityUnits',
                dimensionsMap: { TableName: table.tableName },
                statistic: 'Sum',
                label: '読み込み',
            }),
        ],
        right: [
            new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'ConsumedWriteCapacityUnits',
                dimensionsMap: { TableName: table.tableName },
                statistic: 'Sum',
                label: '書き込み',
            }),
        ],
        width: 12,
        height: 6,
    }),
    new cloudwatch.GraphWidget({
        title: 'DynamoDBエラー',
        left: [
            dynamoUserErrorsMetric,
            new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'SystemErrors',
                dimensionsMap: { TableName: table.tableName },
                statistic: 'Sum',
                label: 'システムエラー',
            }),
        ],
        width: 12,
        height: 6,
    })
);
```

### 詳細パフォーマンスダッシュボード

```typescript
const performanceDashboard = new cloudwatch.Dashboard(this, 'PerformanceDashboard', {
    dashboardName: 'tdnet-collector-performance',
});

performanceDashboard.addWidgets(
    // パーセンタイル分析
    new cloudwatch.GraphWidget({
        title: 'Lambda実行時間（パーセンタイル）',
        left: [
            collectorFn.metricDuration({
                statistic: 'p50',
                label: 'p50',
            }),
            collectorFn.metricDuration({
                statistic: 'p90',
                label: 'p90',
            }),
            collectorFn.metricDuration({
                statistic: 'p99',
                label: 'p99',
            }),
        ],
        width: 24,
        height: 6,
    }),
    
    // 同時実行数
    new cloudwatch.GraphWidget({
        title: 'Lambda同時実行数',
        left: [
            collectorFn.metricInvocations({
                statistic: 'Sum',
                label: '実行回数',
            }),
        ],
        right: [
            new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'ConcurrentExecutions',
                dimensionsMap: {
                    FunctionName: collectorFn.functionName,
                },
                statistic: 'Maximum',
                label: '同時実行数',
            }),
        ],
        width: 12,
        height: 6,
    }),
    
    // メモリ使用量
    new cloudwatch.GraphWidget({
        title: 'メモリ使用量',
        left: [
            new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'MemoryUtilization',
                dimensionsMap: {
                    FunctionName: collectorFn.functionName,
                },
                statistic: 'Average',
                label: '平均使用率',
            }),
        ],
        width: 12,
        height: 6,
    })
);
```

### コスト監視ダッシュボード

```typescript
const costDashboard = new cloudwatch.Dashboard(this, 'CostDashboard', {
    dashboardName: 'tdnet-collector-cost',
});

costDashboard.addWidgets(
    // Lambda実行コスト推定
    new cloudwatch.GraphWidget({
        title: 'Lambda実行回数（コスト推定用）',
        left: [
            invocationsMetric.with({
                period: cdk.Duration.days(1),
                statistic: 'Sum',
            }),
        ],
        width: 12,
        height: 6,
    }),
    
    // Lambda実行時間合計（コスト推定用）
    new cloudwatch.GraphWidget({
        title: 'Lambda実行時間合計（日次）',
        left: [
            durationMetric.with({
                period: cdk.Duration.days(1),
                statistic: 'Sum',
            }),
        ],
        width: 12,
        height: 6,
    }),
    
    // DynamoDBキャパシティ消費
    new cloudwatch.GraphWidget({
        title: 'DynamoDBキャパシティ消費（日次）',
        left: [
            new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'ConsumedReadCapacityUnits',
                dimensionsMap: { TableName: table.tableName },
                statistic: 'Sum',
                period: cdk.Duration.days(1),
                label: '読み込み',
            }),
            new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'ConsumedWriteCapacityUnits',
                dimensionsMap: { TableName: table.tableName },
                statistic: 'Sum',
                period: cdk.Duration.days(1),
                label: '書き込み',
            }),
        ],
        width: 12,
        height: 6,
    }),
    
    // S3ストレージサイズ
    new cloudwatch.GraphWidget({
        title: 'S3ストレージサイズ',
        left: [
            new cloudwatch.Metric({
                namespace: 'AWS/S3',
                metricName: 'BucketSizeBytes',
                dimensionsMap: {
                    BucketName: 'tdnet-pdfs-prod',
                    StorageType: 'StandardStorage',
                },
                statistic: 'Average',
                period: cdk.Duration.days(1),
            }),
        ],
        width: 12,
        height: 6,
    })
);
```

### ウィジェット配置のベストプラクティス

**ダッシュボードレイアウト原則:**

1. **最重要KPIを最上部に配置**
   - SingleValueWidgetで一目で状態を把握
   - 幅6（4列配置）で主要指標を並べる

2. **時系列グラフは中段に配置**
   - GraphWidgetで傾向を可視化
   - 幅12（2列配置）で詳細を表示

3. **詳細メトリクスは下段に配置**
   - 技術的な詳細情報
   - トラブルシューティング用

4. **色分けとラベル**
   - 正常: 緑系
   - 警告: 黄色系
   - エラー: 赤系
   - ラベルは日本語で明確に

---

## Lambda関数内でのメトリクス送信実装

### カスタムメトリクスの送信

```typescript
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

// グローバルスコープで初期化（再利用）
const cloudwatch = new CloudWatchClient({ region: 'ap-northeast-1' });

/**
 * カスタムメトリクスを送信
 */
async function putMetric(
    metricName: string,
    value: number,
    unit: string = 'None',
    dimensions: Record<string, string> = {}
): Promise<void> {
    try {
        await cloudwatch.send(new PutMetricDataCommand({
            Namespace: 'TDnetDataCollector',
            MetricData: [{
                MetricName: metricName,
                Value: value,
                Unit: unit,
                Timestamp: new Date(),
                Dimensions: Object.entries(dimensions).map(([Name, Value]) => ({
                    Name,
                    Value,
                })),
            }],
        }));
    } catch (error) {
        // メトリクス送信失敗はログのみ（処理は継続）
        console.error('Failed to put metric', { metricName, error });
    }
}

/**
 * 収集成功率を計算して送信
 */
async function recordCollectionMetrics(
    successCount: number,
    failureCount: number
): Promise<void> {
    const totalCount = successCount + failureCount;
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;
    
    await Promise.all([
        putMetric('CollectionSuccessRate', successRate, 'Percent', {
            Environment: process.env.ENVIRONMENT || 'dev',
        }),
        putMetric('CollectedDisclosuresCount', successCount, 'Count', {
            Environment: process.env.ENVIRONMENT || 'dev',
        }),
        putMetric('CollectionFailureCount', failureCount, 'Count', {
            Environment: process.env.ENVIRONMENT || 'dev',
        }),
    ]);
}

/**
 * スループットを記録
 */
async function recordThroughput(
    itemCount: number,
    durationMs: number
): Promise<void> {
    const throughput = (itemCount / durationMs) * 1000; // 件/秒
    
    await putMetric('Throughput', throughput, 'Count/Second', {
        Environment: process.env.ENVIRONMENT || 'dev',
    });
}

/**
 * データ整合性エラーを記録
 */
async function recordIntegrityError(errorType: string): Promise<void> {
    await putMetric('DataIntegrityErrors', 1, 'Count', {
        Environment: process.env.ENVIRONMENT || 'dev',
        ErrorType: errorType,
    });
}

// Lambda ハンドラーでの使用例
export const handler = async (event: any): Promise<any> => {
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;
    
    try {
        // 収集処理
        const disclosures = await scrapeDisclosureList(event.date);
        
        for (const disclosure of disclosures) {
            try {
                await processDisclosure(disclosure);
                successCount++;
            } catch (error) {
                failureCount++;
                console.error('Failed to process disclosure', { disclosure, error });
            }
        }
        
        // メトリクス送信
        const duration = Date.now() - startTime;
        await Promise.all([
            recordCollectionMetrics(successCount, failureCount),
            recordThroughput(successCount, duration),
        ]);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                collected: successCount,
                failed: failureCount,
                duration,
            }),
        };
    } catch (error) {
        console.error('Collection failed', { error });
        throw error;
    }
};
```

---

## 関連ドキュメント

- **[監視とアラート](../../.kiro/steering/infrastructure/monitoring-alerts.md)** - CloudWatch設定の詳細、ログ分析、X-Rayトレーシング
- **[パフォーマンス最適化](../../.kiro/steering/infrastructure/performance-optimization.md)** - Lambda最適化、DynamoDB最適化、コスト削減戦略
- **[設計書](./design.md)** - システム設計とパフォーマンス目標
- **[Correctness Propertiesチェックリスト](./correctness-properties-checklist.md)** - 品質検証項目

---

**最終更新:** 2026-02-07
