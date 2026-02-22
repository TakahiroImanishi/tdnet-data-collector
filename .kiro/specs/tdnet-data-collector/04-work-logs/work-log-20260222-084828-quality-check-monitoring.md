# 品質チェック: 監視・アラート実装

作成日時: 2026-02-22 08:48:28

## チェック結果

### CloudWatch Logs
**実装状況: ✅ 実装済み**

- **場所**: `cdk/lib/stacks/monitoring-stack.ts`
- **設定内容**:
  - Lambda関数ごとにLogGroupを作成
  - ログ保持期間:
    - Collector Lambda: 本番3ヶ月、開発1週間
    - その他Lambda: 本番1ヶ月、開発1週間
  - 削除ポリシー: 本番RETAIN、開発DESTROY
  - 対象Lambda: collector, query, export, collect, collectStatus, exportStatus, pdfDownload
  - Health/Stats Lambdaは既存LogGroupを使用（CDK管理外）

**問題点**:
- なし（設計通り実装済み）

---

### CloudWatch Metrics
**実装状況: ✅ 実装済み**

- **場所**: `src/utils/cloudwatch-metrics.ts`
- **実装内容**:
  - カスタムメトリクス送信ユーティリティ
  - 名前空間: `TDnet`
  - 主要関数:
    - `sendMetric()`: 単一メトリクス送信
    - `sendMetrics()`: 複数メトリクス一括送信
    - `sendErrorMetric()`: エラーメトリクス送信
    - `sendSuccessMetric()`: 成功メトリクス送信
  - ディメンション対応（ErrorType, FunctionName, Environment等）
  - エラーハンドリング: メトリクス送信失敗時はログ記録のみ（メイン処理は継続）

**使用箇所**:
- `src/lambda/collector/handler.ts`
- `src/lambda/collector/scrape-tdnet-list.ts`
- `src/lambda/collector/save-metadata.ts`
- `src/lambda/collector/download-pdf.ts`
- `src/lambda/query/handler.ts`
- `src/lambda/export/handler.ts`
- `src/lambda/get-disclosure/handler.ts`
- `src/lambda/collect-status/handler.ts`
- `src/lambda/collect/handler.ts`
- `src/lambda/api/pdf-download/handler.ts`
- `src/lambda/api/export-status/handler.ts`
- `src/lambda/stats/handler.ts`
- `src/lambda/health/handler.ts`

**問題点**:
- なし（設計通り実装済み）

---

### CloudWatch Alarms
**実装状況: ✅ 実装済み**

- **場所**: `cdk/lib/constructs/cloudwatch-alarms.ts`
- **実装内容**:
  - Lambda関数ごとのアラーム（各関数4種類）:
    1. Error Rate > 10% → Critical
    2. Duration > 10分（600秒） → Warning
    3. Duration > 13分（780秒） → Critical
    4. Throttles > 0 → Critical
  - カスタムメトリクスアラーム:
    5. CollectionSuccessRate < 95% → Warning
    6. NoDataCollected（24時間データ収集なし） → Critical
    7. CollectionFailure > 10件/日 → Warning
  - DLQアラーム（オプション）:
    8. DLQメッセージ数 > 0 → Critical
  - SNS Topic統合（アラート通知）
  - メール通知対応

**アラート種類**:
- Lambda Error Rate（7関数 × 1 = 7個）
- Lambda Duration Warning（7関数 × 1 = 7個）
- Lambda Duration Critical（7関数 × 1 = 7個）
- Lambda Throttles（7関数 × 1 = 7個）
- CollectionSuccessRate（1個）
- NoDataCollected（1個）
- CollectionFailure（1個）
- **合計**: 31個のアラーム（DLQ除く）

**設計ドキュメントとの整合性**:
| メトリクス | 設計 | 実装 | 状態 |
|-----------|------|------|------|
| Lambda Errors | > 5/5分（警告）、> 10/5分（重大） | > 10%（Critical） | ⚠️ 閾値が異なる |
| Lambda Duration | > 10分（警告）、> 13分（重大） | > 10分（Warning）、> 13分（Critical） | ✅ 一致 |
| Lambda Throttles | > 0（警告）、> 5（重大） | > 0（Critical） | ⚠️ 閾値が異なる |
| CollectionSuccessRate | - | < 95%（Warning） | ✅ 実装済み |
| NoDataCollected | = 0（24時間） | < 1（24時間、Critical） | ✅ 一致 |
| CollectionFailure | > 10/日 | > 10/日（Warning） | ✅ 一致 |

**問題点**:
1. **Lambda Errors閾値**: 設計では「> 5/5分（警告）、> 10/5分（重大）」だが、実装では「> 10%（Critical）」のみ
2. **Lambda Throttles閾値**: 設計では「> 0（警告）、> 5（重大）」だが、実装では「> 0（Critical）」のみ
3. **DynamoDB/API Gatewayアラーム**: 設計ドキュメントに記載されているが未実装

---

### CloudWatch Dashboard
**実装状況: ✅ 実装済み**

- **場所**: `cdk/lib/constructs/cloudwatch-dashboard.ts`
- **実装内容**:
  - ダッシュボード名: `tdnet-collector-{environment}`
  - ウィジェット構成:
    1. **Lambda実行メトリクス**:
       - Invocations（7関数）
       - Errors（7関数）
       - Duration（7関数）
       - Throttles（7関数）
    2. **DynamoDBメトリクス**:
       - Consumed Capacity Units（Read/Write、3テーブル）
       - Errors（UserErrors/SystemErrors、3テーブル）
       - Throttled Requests（3テーブル）
    3. **ビジネスメトリクス**:
       - Disclosures Collected（日次）
       - Disclosures Failed
       - Collection Success Rate（%）
    4. **API Gatewayメトリクス**:
       - ⚠️ 型エラーのためコメントアウト（Requests, Errors, Latency）
    5. **S3ストレージメトリクス**:
       - Bucket Size（PDFs/Exports）
       - Number of Objects（PDFs/Exports）
       - Requests（PDFs/Exports）

**問題点**:
1. **API Gatewayウィジェット**: 型エラーのためコメントアウトされている
   - `apiGateway.metricCount()`, `apiGateway.metricClientError()`, `apiGateway.metricServerError()`, `apiGateway.metricLatency()`, `apiGateway.metricIntegrationLatency()`が使用不可

---

### X-Ray トレーシング
**実装状況: ❌ 未実装**

- **検索結果**: X-Ray関連のコード（`tracing`, `Tracing.ACTIVE`, `X-Ray`, `xray`）が見つからない
- **問題点**:
  - Lambda関数でX-Rayトレーシングが有効化されていない
  - 設計ドキュメント（`monitoring-alerts.md`）には「X-Rayトレースで実行フロー確認」と記載されているが未実装

---

### SNS通知
**実装状況: ✅ 実装済み**

- **場所**: `cdk/lib/constructs/cloudwatch-alarms.ts`
- **実装内容**:
  - SNS Topic作成: `tdnet-alerts-{environment}`
  - メール通知対応（`alertEmail`パラメータ）
  - すべてのアラームにSNS Action設定
  - 既存SNS Topic再利用対応（`existingAlertTopic`パラメータ）
  - CloudFormation Output: `AlertTopicArn`

**問題点**:
- なし（設計通り実装済み）

---

## 総合評価
**⚠️ 概ね良好だが改善推奨項目あり**

### 実装済み（✅）
1. CloudWatch Logs設定（Lambda関数ごと、保持期間、削除ポリシー）
2. CloudWatch Metrics（カスタムメトリクス送信ユーティリティ、全Lambda関数で使用）
3. CloudWatch Alarms（Lambda、カスタムメトリクス、DLQ対応）
4. CloudWatch Dashboard（Lambda、DynamoDB、ビジネスメトリクス、S3）
5. SNS通知（アラート通知、メール対応）

### 未実装（❌）
1. X-Rayトレーシング（Lambda関数で未有効化）

### 部分的実装（⚠️）
1. CloudWatch Alarms閾値（Lambda Errors、Throttlesが設計と異なる）
2. CloudWatch Dashboard（API Gatewayウィジェットがコメントアウト）
3. DynamoDB/API Gatewayアラーム（設計ドキュメントに記載されているが未実装）

---

## 改善推奨

### 1. X-Rayトレーシング有効化 - 優先度: 高
**理由**: 設計ドキュメントに記載されており、実行フロー確認に必要

**対応方法**:
```typescript
// cdk/lib/constructs/lambda-*.ts
import * as lambda from 'aws-cdk-lib/aws-lambda';

new lambda.Function(this, 'Function', {
  // ... 既存設定
  tracing: lambda.Tracing.ACTIVE, // X-Rayトレーシング有効化
});
```

**影響範囲**:
- `cdk/lib/constructs/lambda-collector.ts`
- `cdk/lib/constructs/lambda-query.ts`
- `cdk/lib/constructs/lambda-export.ts`
- その他Lambda Construct

---

### 2. CloudWatch Alarms閾値の見直し - 優先度: 中
**理由**: 設計ドキュメントと実装が異なる

**対応方法**:
```typescript
// cdk/lib/constructs/cloudwatch-alarms.ts

// Lambda Errors: 警告と重大の2段階に分ける
// 現在: > 10%（Critical）のみ
// 提案: > 5%（Warning）、> 10%（Critical）

// Lambda Throttles: 警告と重大の2段階に分ける
// 現在: > 0（Critical）のみ
// 提案: > 0（Warning）、> 5（Critical）
```

**影響範囲**:
- `cdk/lib/constructs/cloudwatch-alarms.ts`
- アラーム数が増加（7関数 × 2 = 14個追加）

---

### 3. API Gatewayウィジェット修正 - 優先度: 中
**理由**: 型エラーでコメントアウトされている

**対応方法**:
```typescript
// cdk/lib/constructs/cloudwatch-dashboard.ts

// 型エラーを修正してコメントアウトを解除
// または、直接Metricオブジェクトを作成
new cloudwatch.Metric({
  namespace: 'AWS/ApiGateway',
  metricName: 'Count',
  dimensionsMap: { ApiName: apiGateway.restApiName },
  statistic: 'Sum',
});
```

**影響範囲**:
- `cdk/lib/constructs/cloudwatch-dashboard.ts`

---

### 4. DynamoDB/API Gatewayアラーム追加 - 優先度: 低
**理由**: 設計ドキュメントに記載されているが、現状の実装でも基本的な監視は可能

**対応方法**:
```typescript
// cdk/lib/constructs/cloudwatch-alarms.ts

// DynamoDB UserErrors > 5/5分（警告）、> 20/5分（重大）
// DynamoDB SystemErrors > 0（警告）、> 5/5分（重大）
// DynamoDB ThrottledRequests > 0（警告）、> 10/5分（重大）
// API Gateway 4XXError > 10%（警告）、> 20%（重大）
// API Gateway 5XXError > 1%（警告）、> 5%（重大）
// API Gateway Latency > 3秒（警告）、> 5秒（重大）
```

**影響範囲**:
- `cdk/lib/constructs/cloudwatch-alarms.ts`
- アラーム数が大幅に増加（+18個程度）

---

## 関連ファイル

### 実装ファイル
- `cdk/lib/stacks/monitoring-stack.ts` - MonitoringStack（Logs、Alarms、Dashboard、CloudTrail統合）
- `cdk/lib/constructs/cloudwatch-alarms.ts` - CloudWatch Alarms Construct
- `cdk/lib/constructs/cloudwatch-dashboard.ts` - CloudWatch Dashboard Construct
- `cdk/lib/constructs/cloudwatch-logs.ts` - CloudWatch Logs Construct（未使用）
- `src/utils/cloudwatch-metrics.ts` - カスタムメトリクス送信ユーティリティ

### Lambda関数（メトリクス送信）
- `src/lambda/collector/handler.ts`
- `src/lambda/collector/scrape-tdnet-list.ts`
- `src/lambda/collector/save-metadata.ts`
- `src/lambda/collector/download-pdf.ts`
- `src/lambda/query/handler.ts`
- `src/lambda/export/handler.ts`
- `src/lambda/get-disclosure/handler.ts`
- `src/lambda/collect-status/handler.ts`
- `src/lambda/collect/handler.ts`
- `src/lambda/api/pdf-download/handler.ts`
- `src/lambda/api/export-status/handler.ts`
- `src/lambda/stats/handler.ts`
- `src/lambda/health/handler.ts`

### テストファイル
- `cdk/__tests__/cloudwatch-integration.test.ts` - CloudWatch統合テスト
- `cdk/__tests__/cloudwatch-alarms.test.ts` - CloudWatch Alarmsテスト
- `cdk/__tests__/cloudwatch-logs.test.ts` - CloudWatch Logsテスト
- `cdk/lib/stacks/__tests__/monitoring-stack.test.ts` - MonitoringStackテスト

### 設計ドキュメント
- `.kiro/steering/infrastructure/monitoring-alerts.md` - 監視・アラート設計

---

## 申し送り

### 次のタスクへの推奨事項
1. **X-Rayトレーシング有効化**: 優先度高、実装は簡単（Lambda Constructに`tracing: lambda.Tracing.ACTIVE`を追加）
2. **API Gatewayウィジェット修正**: 型エラーを解決してダッシュボードを完全にする
3. **アラーム閾値の見直し**: 設計ドキュメントとの整合性を取る（必要に応じて設計ドキュメントを更新）

### 品質評価
- **実装完成度**: 85%（主要機能は実装済み、X-Rayとアラーム閾値が未対応）
- **設計整合性**: 80%（一部閾値が設計と異なる）
- **テストカバレッジ**: 良好（CloudWatch統合テスト、Alarmsテスト、Logsテスト、MonitoringStackテストが存在）

### 特記事項
- MonitoringStackは独立したスタックとして実装されており、Foundation/Compute/API Stackに依存
- CloudWatch Alarmsは31個作成される（DLQ除く）
- カスタムメトリクス送信は全Lambda関数で実装済み
- CloudTrailもMonitoringStackに統合されている
