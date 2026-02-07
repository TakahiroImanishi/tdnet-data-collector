---
inclusion: fileMatch
fileMatchPattern: '**/lambda/**/*.ts|**/cdk/lib/**/*-stack.ts|**/cdk/lib/constructs/**/*.ts'
---

# Error Handling Enforcement - 強制化ガイドライン

このファイルは、TDnet Data Collectorプロジェクトにおけるエラーハンドリングの**強制化方針**をまとめたものです。

## 目的

エラーハンドリングのベストプラクティスを**推奨**から**必須**に引き上げ、実装漏れを防ぐための仕組みを提供します。

## 役割分担

| ファイル | 役割 | 内容 |
|---------|------|------|
| **core/error-handling-patterns.md** | 基本原則 | エラー分類、再試行戦略の概要 |
| **development/error-handling-implementation.md** | 詳細実装 | 具体的なコード例、AWS SDK設定 |
| **development/error-handling-enforcement.md** (このファイル) | 強制化 | DLQ必須化、Alarms自動設定、テスト検証 |
| **infrastructure/monitoring-alerts.md** | 監視設定 | CloudWatch設定の詳細 |

## 目次

1. [Lambda DLQ必須化方針](#lambda-dlq必須化方針)
2. [CloudWatch Alarms自動設定](#cloudwatch-alarms自動設定)
3. [エラーハンドリングチェックリストの強制](#エラーハンドリングチェックリストの強制)
4. [テストでの検証](#テストでの検証)
5. [CDK実装例](#cdk実装例)

---

## Lambda DLQ必須化方針

### 必須化ルール

**すべての非同期Lambda関数にDead Letter Queue (DLQ)を設定すること。**


#### 対象Lambda関数

| トリガー | DLQ必須 | 理由 |
|---------|---------|------|
| EventBridge (スケジュール) | ✅ 必須 | 非同期実行、失敗時の再実行が必要 |
| SQS | ✅ 必須 | メッセージ処理失敗時の追跡が必要 |
| SNS | ✅ 必須 | 非同期実行、失敗通知が必要 |
| S3イベント | ✅ 必須 | イベント処理失敗時の追跡が必要 |
| DynamoDB Streams | ✅ 必須 | ストリーム処理失敗時の追跡が必要 |
| API Gateway (同期) | ❌ 不要 | 同期実行、エラーは即座に返却 |
| Lambda直接呼び出し (同期) | ❌ 不要 | 同期実行、エラーは呼び出し元で処理 |

#### DLQ設定の標準仕様

```typescript
// すべての非同期Lambda関数に適用する標準設定
const dlqConfig = {
    retentionPeriod: cdk.Duration.days(14),  // 14日間保持
    visibilityTimeout: cdk.Duration.minutes(5),  // 5分
};

const lambdaConfig = {
    deadLetterQueueEnabled: true,  // DLQ有効化
    retryAttempts: 2,  // 2回再試行（合計3回実行）
};
```

#### DLQプロセッサーの必須実装

DLQを設定したすべてのLambda関数に対して、DLQプロセッサーを実装すること。

**DLQプロセッサーの責務:**
1. DLQメッセージを受信
2. エラー内容をログに記録
3. アラート通知を送信（SNS経由）
4. 必要に応じて手動対応のためのメタデータを保存

**実装例:** `.kiro/specs/tdnet-data-collector/templates/lambda-dlq-example.ts` を参照

