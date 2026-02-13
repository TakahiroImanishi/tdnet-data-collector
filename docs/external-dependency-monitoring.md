# 外部依存監視ガイド

## 概要

TDnet Data Collectorは外部サービス（TDnet）に依存しているため、その可用性とパフォーマンスを継続的に監視する必要があります。

## 監視対象

### 1. TDnet Webサイトの可用性

**監視URL**:
- メインページ: `https://www.release.tdnet.info/inbs/I_main_00.html`
- 一覧ページ: `https://www.release.tdnet.info/inbs/I_list_001_[YYYYMMDD].html`
- PDFダウンロード: `https://www.release.tdnet.info/inbs/[disclosure_id].pdf`

### 2. 監視メトリクス

| メトリクス | 説明 | 正常範囲 | アラート閾値 |
|-----------|------|---------|------------|
| **可用性** | HTTPステータスコード200の割合 | 99.5%以上 | 95%未満 |
| **レスポンス時間** | リクエストからレスポンスまでの時間 | 2秒以内 | 5秒以上 |
| **エラー率** | 4xx/5xxエラーの割合 | 0.5%以下 | 5%以上 |
| **タイムアウト率** | タイムアウトの割合 | 0.1%以下 | 1%以上 |

## CloudWatch Syntheticsによる監視

### 1. Canaryスクリプトの作成

TDnetの可用性を定期的にチェックするCanaryスクリプトを作成します。

```typescript
// cdk/lib/constructs/external-monitoring-construct.ts

import * as synthetics from 'aws-cdk-lib/aws-synthetics';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

export class ExternalMonitoringConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Canary結果を保存するS3バケット
    const canaryBucket = new s3.Bucket(this, 'CanaryResultsBucket', {
      bucketName: `tdnet-canary-results-${Stack.of(this).account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          expiration: Duration.days(30),
        },
      ],
    });

    // Canaryの実行ロール
    const canaryRole = new iam.Role(this, 'CanaryRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchSyntheticsFullAccess'),
      ],
    });

    canaryBucket.grantReadWrite(canaryRole);

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
  
  // ステータスコードの確認
  if (response.status() !== 200) {
    throw new Error(\`TDnet main page returned status \${response.status()}\`);
  }
  
  // ページタイトルの確認
  const title = await page.title();
  log.info('Page title: ' + title);
  
  // 重要な要素の存在確認
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
      artifactsBucketLocation: {
        bucket: canaryBucket,
      },
      role: canaryRole,
      environmentVariables: {
        TIMEOUT: '30000',
      },
    });

    // TDnet一覧ページの監視Canary
    const listPageCanary = new synthetics.Canary(this, 'TdnetListPageCanary', {
      canaryName: 'tdnet-list-page-check',
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_6_2,
      test: synthetics.Test.custom({
        code: synthetics.Code.fromInline(`
const synthetics = require('Synthetics');
const log = require('SyntheticsLogger');

const listPageBlueprint = async function () {
  const page = await synthetics.getPage();
  
  // 今日の日付でURLを生成
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  const url = \`https://www.release.tdnet.info/inbs/I_list_001_\${dateStr}.html\`;
  
  log.info('Checking URL: ' + url);
  
  const response = await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  
  // ステータスコードの確認（404も許容 - 開示がない日もある）
  if (response.status() !== 200 && response.status() !== 404) {
    throw new Error(\`TDnet list page returned unexpected status \${response.status()}\`);
  }
  
  if (response.status() === 200) {
    // 開示情報テーブルの存在確認
    const hasDisclosures = await page.$('table.kjTable') !== null;
    log.info('Disclosures table found: ' + hasDisclosures);
  }
  
  log.info('TDnet list page check completed successfully');
};

exports.handler = async () => {
  return await listPageBlueprint();
};
        `),
        handler: 'index.handler',
      }),
      schedule: synthetics.Schedule.rate(Duration.minutes(15)),
      artifactsBucketLocation: {
        bucket: canaryBucket,
      },
      role: canaryRole,
    });

    // Canary失敗時のアラーム
    const mainPageAlarm = new cloudwatch.Alarm(this, 'TdnetMainPageAlarm', {
      metric: mainPageCanary.metricSuccessPercent(),
      threshold: 95,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      alarmDescription: 'TDnet main page availability is below 95%',
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    const listPageAlarm = new cloudwatch.Alarm(this, 'TdnetListPageAlarm', {
      metric: listPageCanary.metricSuccessPercent(),
      threshold: 90,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      alarmDescription: 'TDnet list page availability is below 90%',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }
}
```

### 2. CDKスタックへの統合

```typescript
// cdk/lib/tdnet-data-collector-stack.ts

import { ExternalMonitoringConstruct } from './constructs/external-monitoring-construct';

export class TdnetDataCollectorStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 外部依存監視の追加
    new ExternalMonitoringConstruct(this, 'ExternalMonitoring');
  }
}
```

## Lambda関数内でのエラー監視

### 1. カスタムメトリクスの記録

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
    // メトリクス記録の失敗はログのみ（処理は継続）
    console.error('Failed to record metric:', error);
  }
}
```

### 2. スクレイピング処理でのメトリクス記録

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
      // エラー率の計算用
      await recordTdnetMetric('TotalRequests', 1);
      if (errorOccurred) {
        await recordTdnetMetric('FailedRequests', 1);
      }
    }
  }
}
```

## CloudWatchダッシュボードの作成

### 外部依存監視ダッシュボード

```typescript
// cdk/lib/constructs/monitoring-construct.ts に追加

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

## アラート設定

### 1. 可用性アラート

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
  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
});
```

### 2. レスポンス時間アラート

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

### 3. エラー率アラート

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

#### TDnetが完全にダウンしている場合
- 収集処理を一時停止
- 復旧を待つ
- 復旧後に未収集データを再収集

#### 部分的な障害の場合
- 再試行ロジックが自動的に対応
- エラー率を監視
- 必要に応じてレート制限を調整

#### HTML構造が変更された場合
- スクレイピングロジックの修正が必要
- 緊急対応として手動収集を検討

### 4. 事後対応

- インシデントレポートの作成
- 再発防止策の検討
- 監視設定の見直し

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

## 関連ドキュメント

- [エラーハンドリングパターン](../.kiro/steering/core/error-handling-patterns.md)
- [スクレイピングパターン](../.kiro/steering/development/tdnet-scraping-patterns.md)
- [監視とアラート](../.kiro/steering/infrastructure/monitoring-alerts.md)
- [AWS Budgets設定手順書](./aws-budgets-setup.md)
- [コスト監視ガイド](./cost-monitoring.md)
