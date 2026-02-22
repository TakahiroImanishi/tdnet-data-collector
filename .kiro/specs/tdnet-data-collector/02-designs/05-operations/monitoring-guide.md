# 監視ガイド

**最終更新日**: 2026-02-15

TDnet Data Collectorの包括的な監視戦略、CloudWatchメトリクス、KPI、外部依存監視をまとめたガイドです。

---

## 目次

1. [主要KPI](#主要kpi)
2. [CloudWatchメトリクス](#cloudwatchメトリクス)
3. [外部依存監視](#外部依存監視)
4. [アラート設定](#アラート設定)
5. [ダッシュボード](#ダッシュボード)

---

## 主要KPI

### Top 5 KPI

| KPI | 目標値 | 測定頻度 | 重要度 |
|-----|--------|---------|--------|
| **収集成功率** | ≥ 99% | 日次 | Critical |
| **平均実行時間** | ≤ 5分 | 実行ごと | High |
| **月間コスト** | ≤ $5 | 月次 | High |
| **データ整合性エラー率** | ≤ 0.1% | 日次 | Critical |
| **API可用性** | ≥ 99.9% | 月次 | High |

### 収集メトリクス

**収集成功率（Collection Success Rate）**
- 定義: 正常に収集できた開示情報の割合
- 計算式: `(成功件数 / 試行件数) × 100`
- 目標値: Phase 1-2: ≥ 95%、Phase 3-4: ≥ 99%

**収集件数（Collection Count）**
- 定義: 期間内に収集した開示情報の総数
- 目標値: 日次 50-200件、月次 1,500-6,000件

### パフォーマンスメトリクス

**平均実行時間（Average Execution Time）**
- Collector Lambda: ≤ 5分
- Query Lambda: ≤ 3秒
- Export Lambda: ≤ 30秒

**レイテンシ（Latency）**
- GET /disclosures: ≤ 500ms (p50), ≤ 1000ms (p99)
- GET /disclosures/{id}: ≤ 200ms (p50), ≤ 500ms (p99)
- POST /collect: ≤ 100ms (p50), ≤ 300ms (p99)

### 品質メトリクス

**データ整合性エラー率**
- 定義: データ整合性エラーの発生率
- 計算式: `(エラー件数 / 総件数) × 100`
- 目標値: ≤ 0.1%

**テストカバレッジ**
- ユニットテスト: ≥ 80%
- 統合テスト: ≥ 60%
- E2Eテスト: 主要フロー100%

### 可用性メトリクス

**API可用性**
- 定義: APIが正常に応答した時間の割合
- 計算式: `(稼働時間 / 総時間) × 100`
- 目標値: ≥ 99.9% (月間ダウンタイム ≤ 43分)

**エラー率**
- 4XXエラー: ≤ 5%
- 5XXエラー: ≤ 0.1%

---

## CloudWatchメトリクス

### カスタムメトリクス（3個のみ）

**コスト最適化のため、カスタムメトリクスを3個のみに制限しています。**

| メトリクス名 | 説明 | 用途 |
|------------|------|------|
| `DisclosuresCollected` | 開示情報収集成功件数 | 日次収集件数の監視 |
| `DisclosuresFailed` | 開示情報収集失敗件数 | 収集エラーの監視 |
| `CollectionSuccessRate` | 開示情報収集成功率（%） | 収集品質の監視 |

**重要:** これら3個以外のカスタムメトリクスは送信しないでください。

### AWS標準メトリクス（無料）

#### Lambda標準メトリクス

| メトリクス名 | 説明 | 目標値 |
|------------|------|--------|
| `Invocations` | 実行回数 | - |
| `Errors` | エラー数 | ≤ 1% |
| `Duration` | 実行時間 | ≤ 300,000ms (5分) |
| `Throttles` | スロットル数 | 0 |
| `ConcurrentExecutions` | 同時実行数 | ≤ 10 |

#### DynamoDB標準メトリクス

| メトリクス名 | 説明 | 目標値 |
|------------|------|--------|
| `ConsumedReadCapacityUnits` | 読み込みキャパシティ | - |
| `ConsumedWriteCapacityUnits` | 書き込みキャパシティ | - |
| `UserErrors` | ユーザーエラー | ≤ 0.1% |
| `SystemErrors` | システムエラー | 0 |
| `ThrottledRequests` | スロットルリクエスト | 0 |

#### S3標準メトリクス

| メトリクス名 | 説明 | 目標値 |
|------------|------|--------|
| `BucketSizeBytes` | バケットサイズ | ≤ 10GB |
| `NumberOfObjects` | オブジェクト数 | - |
| `AllRequests` | 全リクエスト | - |
| `4xxErrors` | 4xxエラー | ≤ 1% |
| `5xxErrors` | 5xxエラー | 0 |

#### API Gateway標準メトリクス

| メトリクス名 | 説明 | 目標値 |
|------------|------|--------|
| `Count` | リクエスト数 | - |
| `Latency` | レイテンシ | ≤ 500ms (p50) |
| `IntegrationLatency` | 統合レイテンシ | ≤ 400ms (p50) |
| `4XXError` | 4xxエラー | ≤ 5% |
| `5XXError` | 5xxエラー | ≤ 0.1% |

### Lambda専用ヘルパー関数

#### カスタムメトリクス送信関数（3個のみ）

```typescript
import {
  sendDisclosuresCollectedMetric,
  sendDisclosuresFailedMetric,
  sendCollectionSuccessRateMetric,
} from '../../utils/metrics';

// 収集完了時に送信
await sendDisclosuresCollectedMetric(150, context.functionName);
await sendDisclosuresFailedMetric(5, context.functionName);

const successRate = (collected / (collected + failed)) * 100;
await sendCollectionSuccessRateMetric(successRate, context.functionName);
```

#### 非推奨関数（AWS標準メトリクスで代替）

以下の関数は**使用しないでください**。AWS標準メトリクスで代替できます。

| 非推奨関数 | 代替AWS標準メトリクス |
|-----------|---------------------|
| `sendErrorMetric()` | Lambda標準メトリクス: `Errors` |
| `sendSuccessMetric()` | Lambda標準メトリクス: `Invocations` - `Errors` |
| `sendExecutionTimeMetric()` | Lambda標準メトリクス: `Duration` |

### コスト最適化の成果

| 項目 | 以前 | 現在 | 削減率 |
|------|------|------|--------|
| カスタムメトリクス数 | 7個 | 3個 | 57%削減 |
| 月額コスト | $2.10 | $0.90 | 57%削減 |
| 年額コスト | $25.20 | $10.80 | 57%削減 |

**AWS標準メトリクスの活用:**
- Lambda標準メトリクス: 6個（無料）
- DynamoDB標準メトリクス: 5個（無料）
- S3標準メトリクス: 5個（無料）
- 合計: 16個（無料）

---

## 外部依存監視

### TDnet監視対象

**監視URL:**
- メインページ: `https://www.release.tdnet.info/inbs/I_main_00.html`
- 一覧ページ: `https://www.release.tdnet.info/inbs/I_list_001_[YYYYMMDD].html`
- PDFダウンロード: `https://www.release.tdnet.info/inbs/[disclosure_id].pdf`

### 監視メトリクス

| メトリクス | 正常範囲 | アラート閾値 |
|-----------|---------|------------|
| **可用性** | 99.5%以上 | 95%未満 |
| **レスポンス時間** | 2秒以内 | 5秒以上 |
| **エラー率** | 0.5%以下 | 5%以上 |
| **タイムアウト率** | 0.1%以下 | 1%以上 |

### CloudWatch Syntheticsによる監視

```typescript
// cdk/lib/constructs/external-monitoring-construct.ts

import * as synthetics from 'aws-cdk-lib/aws-synthetics';

// TDnetメインページの監視Canary
const mainPageCanary = new synthetics.Canary(this, 'TdnetMainPageCanary', {
  canaryName: 'tdnet-main-page-check',
  runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_6_2,
  test: synthetics.Test.custom({
    code: synthetics.Code.fromInline(`
const synthetics = require('Synthetics');
const log = require('SyntheticsLogger');

const pageLoadBlueprint = async function () {
  const page = await synthetics.getPage();
  
  const response = await page.goto('https://www.release.tdnet.info/inbs/I_main_00.html', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  
  if (response.status() !== 200) {
    throw new Error(\`TDnet main page returned status \${response.status()}\`);
  }
  
  const hasTable = await page.$('table') !== null;
  if (!hasTable) {
    throw new Error('Expected table element not found on TDnet main page');
  }
  
  log.info('TDnet main page is accessible and contains expected elements');
};

exports.handler = async () => {
  return await pageLoadBlueprint();
};
    `),
    handler: 'index.handler',
  }),
  schedule: synthetics.Schedule.rate(Duration.minutes(5)),
});
```

### Lambda関数内でのエラー監視

```typescript
// src/utils/metrics.ts

import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });

export async function recordTdnetMetric(
  metricName: string,
  value: number,
  unit: string = 'Count'
): Promise<void> {
  try {
    await cloudwatch.send(new PutMetricDataCommand({
      Namespace: 'TDnetDataCollector/ExternalDependency',
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: unit,
          Timestamp: new Date(),
          Dimensions: [
            {
              Name: 'Service',
              Value: 'TDnet',
            },
          ],
        },
      ],
    }));
  } catch (error) {
    console.error('Failed to record metric:', error);
  }
}
```

### スクレイピング処理でのメトリクス記録

```typescript
// src/scraper/tdnet-scraper.ts

import { recordTdnetMetric } from '../utils/metrics';

export class TdnetScraper {
  async fetchDisclosures(date: string): Promise<Disclosure[]> {
    const startTime = Date.now();
    let statusCode = 0;
    let errorOccurred = false;

    try {
      const response = await this.rateLimiter.execute(async () => {
        return await axios.get(this.buildUrl(date), {
          timeout: 30000,
          validateStatus: (status) => status < 500,
        });
      });

      statusCode = response.status;

      // レスポンス時間を記録
      const responseTime = Date.now() - startTime;
      await recordTdnetMetric('ResponseTime', responseTime, 'Milliseconds');

      // ステータスコードを記録
      await recordTdnetMetric(`StatusCode${statusCode}`, 1);

      if (response.status !== 200) {
        errorOccurred = true;
        throw new Error(`TDnet returned status ${response.status}`);
      }

      // 成功を記録
      await recordTdnetMetric('SuccessfulRequest', 1);

      return this.parseHtml(response.data);
    } catch (error) {
      errorOccurred = true;

      // エラータイプを記録
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          await recordTdnetMetric('TimeoutError', 1);
        } else if (error.code === 'ECONNRESET') {
          await recordTdnetMetric('ConnectionResetError', 1);
        } else {
          await recordTdnetMetric('NetworkError', 1);
        }
      } else {
        await recordTdnetMetric('UnknownError', 1);
      }

      throw error;
    } finally {
      await recordTdnetMetric('TotalRequests', 1);
      if (errorOccurred) {
        await recordTdnetMetric('FailedRequests', 1);
      }
    }
  }
}
```

---

## アラート設定

### 可用性アラート

```typescript
// TDnet可用性が95%を下回った場合
const availabilityAlarm = new cloudwatch.Alarm(this, 'TdnetAvailabilityAlarm', {
  metric: new cloudwatch.MathExpression({
    expression: '(m1 / m2) * 100',
    usingMetrics: {
      m1: new cloudwatch.Metric({
        namespace: 'TDnetDataCollector/ExternalDependency',
        metricName: 'SuccessfulRequest',
        statistic: 'Sum',
        period: Duration.minutes(15),
      }),
      m2: new cloudwatch.Metric({
        namespace: 'TDnetDataCollector/ExternalDependency',
        metricName: 'TotalRequests',
        statistic: 'Sum',
        period: Duration.minutes(15),
      }),
    },
  }),
  threshold: 95,
  evaluationPeriods: 2,
  comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
  alarmDescription: 'TDnet availability is below 95%',
});
```

### レスポンス時間アラート

```typescript
// レスポンス時間が5秒を超えた場合
const responseTimeAlarm = new cloudwatch.Alarm(this, 'TdnetResponseTimeAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'TDnetDataCollector/ExternalDependency',
    metricName: 'ResponseTime',
    statistic: 'Average',
    period: Duration.minutes(5),
  }),
  threshold: 5000, // 5秒
  evaluationPeriods: 3,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  alarmDescription: 'TDnet response time is above 5 seconds',
});
```

### エラー率アラート

```typescript
// エラー率が5%を超えた場合
const errorRateAlarm = new cloudwatch.Alarm(this, 'TdnetErrorRateAlarm', {
  metric: new cloudwatch.MathExpression({
    expression: '(m1 / m2) * 100',
    usingMetrics: {
      m1: new cloudwatch.Metric({
        namespace: 'TDnetDataCollector/ExternalDependency',
        metricName: 'FailedRequests',
        statistic: 'Sum',
        period: Duration.minutes(15),
      }),
      m2: new cloudwatch.Metric({
        namespace: 'TDnetDataCollector/ExternalDependency',
        metricName: 'TotalRequests',
        statistic: 'Sum',
        period: Duration.minutes(15),
      }),
    },
  }),
  threshold: 5,
  evaluationPeriods: 2,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  alarmDescription: 'TDnet error rate is above 5%',
});
```

---

## ダッシュボード

### CloudWatchダッシュボードの作成

```typescript
// cdk/lib/constructs/monitoring-construct.ts

import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

// TDnet可用性ウィジェット
const tdnetAvailabilityWidget = new cloudwatch.GraphWidget({
  title: 'TDnet Availability',
  left: [
    new cloudwatch.MathExpression({
      expression: '(m1 / m2) * 100',
      label: 'Success Rate (%)',
      usingMetrics: {
        m1: new cloudwatch.Metric({
          namespace: 'TDnetDataCollector/ExternalDependency',
          metricName: 'SuccessfulRequest',
          statistic: 'Sum',
          period: Duration.minutes(5),
        }),
        m2: new cloudwatch.Metric({
          namespace: 'TDnetDataCollector/ExternalDependency',
          metricName: 'TotalRequests',
          statistic: 'Sum',
          period: Duration.minutes(5),
        }),
      },
    }),
  ],
  width: 12,
  height: 6,
});

// TDnetレスポンス時間ウィジェット
const tdnetResponseTimeWidget = new cloudwatch.GraphWidget({
  title: 'TDnet Response Time',
  left: [
    new cloudwatch.Metric({
      namespace: 'TDnetDataCollector/ExternalDependency',
      metricName: 'ResponseTime',
      statistic: 'Average',
      period: Duration.minutes(5),
      label: 'Average',
    }),
    new cloudwatch.Metric({
      namespace: 'TDnetDataCollector/ExternalDependency',
      metricName: 'ResponseTime',
      statistic: 'Maximum',
      period: Duration.minutes(5),
      label: 'Maximum',
    }),
  ],
  width: 12,
  height: 6,
});

// エラータイプ別ウィジェット
const tdnetErrorTypesWidget = new cloudwatch.GraphWidget({
  title: 'TDnet Error Types',
  left: [
    new cloudwatch.Metric({
      namespace: 'TDnetDataCollector/ExternalDependency',
      metricName: 'TimeoutError',
      statistic: 'Sum',
      period: Duration.minutes(5),
    }),
    new cloudwatch.Metric({
      namespace: 'TDnetDataCollector/ExternalDependency',
      metricName: 'ConnectionResetError',
      statistic: 'Sum',
      period: Duration.minutes(5),
    }),
    new cloudwatch.Metric({
      namespace: 'TDnetDataCollector/ExternalDependency',
      metricName: 'NetworkError',
      statistic: 'Sum',
      period: Duration.minutes(5),
    }),
  ],
  width: 12,
  height: 6,
});

dashboard.addWidgets(
  tdnetAvailabilityWidget,
  tdnetResponseTimeWidget,
  tdnetErrorTypesWidget
);
```

---

## 障害発生時の対応フロー

### 1. アラート受信

SNS経由でメール通知を受信:
```
件名: ALARM: TdnetAvailabilityAlarm

TDnet availability is below 95%
Current value: 87.5%
Threshold: 95%
```

### 2. 状況確認

```bash
# CloudWatch Logsでエラーログを確認
aws logs tail /aws/lambda/tdnet-collector --follow --filter-pattern "ERROR"

# CloudWatch Syntheticsの結果を確認
aws synthetics get-canary-runs --name tdnet-main-page-check --max-results 10
```

### 3. 対応策の実施

**TDnetが完全にダウンしている場合:**
- 収集処理を一時停止
- 復旧を待つ
- 復旧後に未収集データを再収集

**部分的な障害の場合:**
- 再試行ロジックが自動的に対応
- エラー率を監視
- 必要に応じてレート制限を調整

**HTML構造が変更された場合:**
- スクレイピングロジックの修正が必要
- 緊急対応として手動収集を検討

### 4. 事後対応

- インシデントレポートの作成
- 再発防止策の検討
- 監視設定の見直し

---

## 定期的な監視レビュー

### 週次チェックリスト

- [ ] CloudWatch Syntheticsの成功率を確認
- [ ] TDnetのレスポンス時間トレンドを確認
- [ ] エラーログを確認
- [ ] アラートの誤検知がないか確認

### 月次チェックリスト

- [ ] TDnetの可用性レポートを作成
- [ ] エラー率の月次トレンドを分析
- [ ] アラート閾値の妥当性を確認
- [ ] 新しい監視項目の追加を検討
- [ ] KPI達成状況を確認
- [ ] メトリクスコストを確認

---

## 関連ドキュメント

- **監視とアラート**: `../../.kiro/steering/infrastructure/monitoring-alerts.md`
- **パフォーマンス最適化**: `../../.kiro/steering/infrastructure/performance-optimization.md`
- **エラーハンドリング**: `../../.kiro/steering/core/error-handling-patterns.md`
- **スクレイピングパターン**: `../../.kiro/steering/development/tdnet-scraping-patterns.md`
- **コスト監視**: `./cost-monitoring.md`
- **トラブルシューティング**: `./troubleshooting.md`
