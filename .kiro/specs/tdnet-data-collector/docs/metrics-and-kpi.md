# メトリクスとKPI定義

**バージョン:** 1.0.0  
**最終更新:** 2026-02-07

このドキュメントは、TDnet Data Collectorの成功指標、パフォーマンスメトリクス、KPI（重要業績評価指標）を定義します。

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

## 関連ドキュメント

- **[監視とアラート](../../.kiro/steering/infrastructure/monitoring-alerts.md)** - CloudWatch設定の詳細
- **[パフォーマンス最適化](../../.kiro/steering/infrastructure/performance-optimization.md)** - 最適化戦略
- **[設計書](./design.md)** - システム設計とパフォーマンス目標
- **[Correctness Propertiesチェックリスト](./correctness-properties-checklist.md)** - 品質検証項目

---

**最終更新:** 2026-02-07
