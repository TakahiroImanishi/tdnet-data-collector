# メトリクスとKPI定義

**バージョン:** 1.0.0  
**最終更新:** 2026-02-15

TDnet Data Collectorの成功指標、パフォーマンスメトリクス、KPI（重要業績評価指標）を定義します。

---

## 関連ドキュメント

- **設計書**: `design.md` - パフォーマンスベンチマーク目標
- **監視とアラート**: `../../steering/infrastructure/monitoring-alerts.md` - CloudWatch設定とアラート
- **パフォーマンス最適化**: `../../steering/infrastructure/performance-optimization.md` - 最適化戦略
- **トラブルシューティング**: `troubleshooting.md` - 問題解決ガイド

---

## 主要KPI（Top 5）

| KPI | 目標値 | 測定頻度 | 重要度 |
|-----|--------|---------|--------|
| **収集成功率** | ≥ 99% | 日次 | Critical |
| **平均実行時間** | ≤ 5分 | 実行ごと | High |
| **月間コスト** | ≤ $5 | 月次 | High |
| **データ整合性エラー率** | ≤ 0.1% | 日次 | Critical |
| **API可用性** | ≥ 99.9% | 月次 | High |

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

---

### 2. 収集件数（Collection Count）

**定義:** 期間内に収集した開示情報の総数

**目標値:**
- 日次: 50-200件（市場状況により変動）
- 月次: 1,500-6,000件

**CloudWatchメトリクス:**
- `CollectedDisclosuresCount` (カスタムメトリクス)

---

## パフォーマンスメトリクス

### 3. 平均実行時間（Average Execution Time）

**定義:** Lambda関数の平均実行時間

**目標値:**
- Collector Lambda: ≤ 5分
- Query Lambda: ≤ 3秒
- Export Lambda: ≤ 30秒

**CloudWatchメトリクス:**
- `Duration` (Lambda標準メトリクス)

---

### 4. レイテンシ（Latency）

**定義:** APIリクエストからレスポンスまでの時間

**目標値:**
- GET /disclosures: ≤ 500ms (p50), ≤ 1000ms (p99)
- GET /disclosures/{id}: ≤ 200ms (p50), ≤ 500ms (p99)
- POST /collect: ≤ 100ms (p50), ≤ 300ms (p99)

**CloudWatchメトリクス:**
- `Latency` (API Gateway標準メトリクス)

---

## コストメトリクス

### 5. 月間コスト（Monthly Cost）

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

---

## 品質メトリクス

### 6. データ整合性エラー率（Data Integrity Error Rate）

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

### 7. テストカバレッジ（Test Coverage）

**定義:** コードのテストカバレッジ率

**目標値:**
- ユニットテスト: ≥ 80%
- 統合テスト: ≥ 60%
- E2Eテスト: 主要フロー100%

**測定方法:**
- Jest coverage report
- Codecov

---

## 可用性メトリクス

### 8. API可用性（API Availability）

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

### 9. エラー率（Error Rate）

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

## CloudWatchメトリクス対応表

### Lambda関数メトリクス

| メトリクス名 | 説明 | 単位 | 目標値 |
|------------|------|------|--------|
| `Invocations` | 実行回数 | Count | - |
| `Duration` | 実行時間 | Milliseconds | ≤ 300,000 (5分) |
| `Errors` | エラー数 | Count | ≤ 1% |
| `Throttles` | スロットル数 | Count | 0 |
| `ConcurrentExecutions` | 同時実行数 | Count | ≤ 10 |

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

---

## カスタムメトリクスの送信実装

### 基本的なメトリクス送信

```typescript
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'ap-northeast-1' });

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
        console.error('Failed to put metric', { metricName, error });
    }
}

// 使用例
await putMetric('CollectionSuccessRate', 99.5, 'Percent');
await putMetric('CollectedDisclosuresCount', 150, 'Count', {
    DisclosureType: '決算短信',
});
```

### 収集成功率の記録

```typescript
async function recordCollectionMetrics(
    successCount: number,
    failureCount: number
): Promise<void> {
    const totalCount = successCount + failureCount;
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;
    
    await Promise.all([
        putMetric('CollectionSuccessRate', successRate, 'Percent'),
        putMetric('CollectedDisclosuresCount', successCount, 'Count'),
        putMetric('CollectionFailureCount', failureCount, 'Count'),
    ]);
}
```

---

## メトリクスコストの試算

**カスタムメトリクスの料金:**
- 最初の10,000メトリクス: $0.30/メトリクス/月
- 次の240,000メトリクス: $0.10/メトリクス/月

**本プロジェクトの想定コスト:**

| メトリクス | 送信頻度 | 月間送信回数 | コスト |
|-----------|---------|-------------|--------|
| CollectionSuccessRate | 1回/実行 | 60回 | $0.30 |
| CollectedDisclosuresCount | 1回/実行 | 60回 | $0.30 |
| CollectionFailureCount | 1回/実行 | 60回 | $0.30 |
| Throughput | 1回/実行 | 60回 | $0.30 |
| DataIntegrityErrors | 随時 | 10回 | $0.30 |
| **合計** | - | **約250回** | **$1.50/月** |

**コスト最適化のポイント:**
- メトリクス送信頻度を調整（実行ごと → 5分ごと）
- 不要なDimensionsを削減
- メトリクスフィルターを活用（ログベースのメトリクスは無料）

**無料枠:**
- カスタムメトリクス: 最初の10メトリクスは無料
- 標準メトリクス（Lambda、DynamoDB、S3）: 完全無料

---

## 関連ドキュメント

- **[監視とアラート](../../.kiro/steering/infrastructure/monitoring-alerts.md)** - CloudWatch設定の詳細、ログ分析
- **[パフォーマンス最適化](../../.kiro/steering/infrastructure/performance-optimization.md)** - Lambda最適化、DynamoDB最適化、コスト削減戦略
- **[設計書](./design.md)** - システム設計とパフォーマンス目標

---

**最終更新:** 2026-02-15

