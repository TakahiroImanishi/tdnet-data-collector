# Infrastructure Requirements Review - 改善提案詳細

**作成日時**: 2026-02-07 17:33:26  
**関連**: work-log-20260207-173326-infrastructure-requirements-review.md

---

## 改善提案1: コスト目標の明確化

### 対象ファイル
`.kiro/steering/infrastructure/performance-optimization.md`

### 追加すべきセクション

#### コスト目標と無料枠管理

**月間コスト目標:**

| 環境 | 月間コスト目標 | 警告閾値 | 重大閾値 |
|------|--------------|---------|---------|
| 開発環境 | $5以下 | $4 (80%) | $5 (100%) |
| 本番環境 | $10以下 | $8 (80%) | $12 (120%) |

**AWS無料枠の上限（月間）:**

| サービス | 無料枠 | 想定使用量 | 超過リスク |
|---------|--------|-----------|----------|
| Lambda | 100万リクエスト<br>40万GB秒 | 50万リクエスト<br>20万GB秒 | 低 |
| DynamoDB | 25GB ストレージ<br>25 WCU/RCU | 5GB<br>10 WCU/RCU | 低 |
| S3 | 5GB ストレージ<br>20,000 GET<br>2,000 PUT | 10GB<br>10,000 GET<br>5,000 PUT | 中（ストレージ） |
| CloudWatch | 10メトリクス<br>5GB ログ | 20メトリクス<br>2GB ログ | 中（メトリクス） |
| API Gateway | 100万リクエスト | 10万リクエスト | 低 |

**コストアラート設定:**

```typescript
// CDKでのコストアラート設定
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as sns from 'aws-cdk-lib/aws-sns';

// 警告閾値（80%）
new budgets.CfnBudget(this, 'CostWarningBudget', {
    budget: {
        budgetName: 'tdnet-cost-warning',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: {
            amount: props.environment === 'prod' ? 10 : 5,
            unit: 'USD',
        },
    },
    notificationsWithSubscribers: [
        {
            notification: {
                notificationType: 'ACTUAL',
                comparisonOperator: 'GREATER_THAN',
                threshold: 80,
                thresholdType: 'PERCENTAGE',
            },
            subscribers: [
                {
                    subscriptionType: 'SNS',
                    address: costAlertTopic.topicArn,
                },
            ],
        },
    ],
});

// 重大閾値（100%）
new budgets.CfnBudget(this, 'CostCriticalBudget', {
    budget: {
        budgetName: 'tdnet-cost-critical',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: {
            amount: props.environment === 'prod' ? 10 : 5,
            unit: 'USD',
        },
    },
    notificationsWithSubscribers: [
        {
            notification: {
                notificationType: 'ACTUAL',
        