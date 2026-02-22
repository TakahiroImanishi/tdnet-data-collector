# TDnet Data Collector - レート制限実装設計書

**作成日:** 2026-02-07  
**バージョン:** 1.0  
**ステータス:** Draft

---

## 概要

### レート制限の目的

TDnet Data Collectorは、日本取引所グループのTDnetウェブサイトから開示情報を自動収集します。適切なレート制限により以下を実現します：

**主要な目的:**
- TDnetサーバーへの過度な負荷を防止
- サービス提供者への配慮とマナーの遵守
- アクセス制限やIP BANのリスク回避
- 安定した長期的なデータ収集の実現

### TDnetサーバーへの配慮

**基本方針:**
- **リクエスト間隔**: 最低2秒（0.5リクエスト/秒）
- **同時実行数**: 1（並列リクエストなし）
- **User-Agent**: 適切な識別情報を含む
- **エラー時の対応**: 即座に再試行せず、指数バックオフを使用

### レート制限の2層アーキテクチャ

2つの独立したレート制限メカニズムを組み合わせて、確実な制御を実現します：

| レイヤー | メカニズム | 目的 | 実装場所 |
|---------|-----------|------|---------|
| **Layer 1** | Token Bucket | リクエスト間隔の制御 | Lambda関数内 |
| **Layer 2** | Reserved Concurrency | 同時実行数の制限 | Lambda設定 |

**2層で十分な理由:**
1. **Reserved Concurrency = 1**: Lambda関数の同時実行を1インスタンスに制限
2. **Token Bucket**: 単一インスタンス内でリクエスト間隔を2秒に制御
3. **シンプルな設計**: 分散ロックを使用せず、実装とインフラの複雑性を削減

---

## Token Bucketアルゴリズム

### アルゴリズムの説明

Token Bucketは、レート制限の標準的なアルゴリズムです：

**動作原理:**
1. **バケツ（Bucket）**: トークンを保持する容器（容量: capacity）
2. **トークン（Token）**: リクエストを実行する権利
3. **補充（Refill）**: 一定レートでトークンが補充される（refillRate）
4. **消費（Consume）**: リクエスト時にトークンを1つ消費
5. **待機（Wait）**: トークンがない場合、補充されるまで待機

### 設定パラメータ

| パラメータ | 値 | 説明 |
|-----------|---|------|
| **capacity** | 5 | バケツの最大容量（トークン数） |
| **refillRate** | 0.5 | 補充レート（トークン/秒） |
| **初期トークン数** | 5 | 起動時のトークン数 |

**計算根拠:**
- リクエスト間隔2秒 = 0.5リクエスト/秒 = refillRate 0.5
- バースト許容: 最大5リクエストまで連続実行可能（その後は2秒間隔に制限）

### 実装の要点

**基本実装:**
```typescript
class RateLimiter {
    private tokens: number;
    private lastRefillTime: number;
    private readonly capacity: number = 5;
    private readonly refillRate: number = 0.5;
    
    constructor() {
        this.tokens = this.capacity;
        this.lastRefillTime = Date.now();
    }
    
    async waitIfNeeded(): Promise<void> {
        this.refill();
        
        if (this.tokens < 1) {
            const waitTime = (1 - this.tokens) / this.refillRate * 1000;
            await sleep(waitTime);
            this.refill();
        }
        
        this.tokens -= 1;
    }
    
    private refill(): void {
        const now = Date.now();
        const elapsed = (now - this.lastRefillTime) / 1000;
        this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
        this.lastRefillTime = now;
    }
}
```

**使用例:**
```typescript
const rateLimiter = new RateLimiter();

for (const disclosure of disclosures) {
    await rateLimiter.waitIfNeeded();
    await scrapeTdnet(disclosure);
}
```

**詳細実装**: `../../steering/development/tdnet-scraping-patterns.md`

---

## Lambda Reserved Concurrency設定

### 目的

Lambda Reserved Concurrencyを1に設定することで、同時実行を完全に防止します。

### CDK実装

```typescript
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
    functionName: 'tdnet-collector',
    entry: 'src/lambda/collector/handler.ts',
    timeout: cdk.Duration.minutes(15),
    memorySize: 512,
    reservedConcurrentExecutions: 1,  // 同時実行数を1に制限
});
```

**効果:**
- 複数のEventBridgeトリガーやAPI呼び出しがあっても、1つのLambdaインスタンスのみが実行される
- 他のリクエストはキューに入り、順次実行される
- Token Bucketが複数インスタンスで動作することを防止

**注意:** Reserved Concurrency = 1により、処理時間が長くなる可能性があります（最大15分）

---

## テスト戦略

### ユニットテスト

| テストケース | 検証内容 |
|------------|---------|
| Token Bucket基本動作 | トークン消費、補充、待機時間計算 |
| バースト制御 | 5リクエスト連続実行後、2秒間隔に制限 |
| 長時間待機 | トークン枯渇時の待機時間が正確 |

### 統合テスト

| テストケース | 検証内容 |
|------------|---------|
| リクエスト間隔測定 | 実際のHTTPリクエスト間隔が2秒以上 |
| Reserved Concurrency | 同時実行が1に制限されることを確認 |

### E2Eテスト

| テストケース | 検証内容 |
|------------|---------|
| 大量データ収集 | 100件の開示情報を収集、レート制限遵守 |
| 並列トリガー | 複数のEventBridgeトリガーでも順次実行 |

**詳細**: `../../steering/development/testing-strategy.md`

---

## 監視とアラート

### CloudWatchメトリクス

| メトリクス | 説明 | アラート閾値 |
|-----------|------|------------|
| RequestInterval | リクエスト間隔（秒） | < 1.5秒でWarning |
| ConcurrentExecutions | 同時実行数 | > 1でCritical |
| ThrottledRequests | スロットリングされたリクエスト数 | > 0でWarning |
| RateLimiterWaitTime | レート制限による待機時間 | > 10秒でInfo |

### CloudWatch Alarms

```typescript
const intervalAlarm = new cloudwatch.Alarm(this, 'RequestIntervalAlarm', {
    metric: new cloudwatch.Metric({
        namespace: 'TDnet/RateLimit',
        metricName: 'RequestInterval',
        statistic: 'Minimum',
    }),
    threshold: 1.5,
    comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    evaluationPeriods: 2,
    alarmDescription: 'リクエスト間隔が短すぎます',
});
```

**詳細**: `../../steering/infrastructure/monitoring-alerts.md`

---

## パフォーマンスへの影響

### 収集時間の試算

**前提条件:**
- 1日あたりの開示情報: 50件
- リクエスト間隔: 2秒
- 1件あたりの処理時間: 3秒（スクレイピング1秒 + PDFダウンロード2秒）

**計算:**
- 総処理時間 = 50件 × (2秒待機 + 3秒処理) = 250秒 = 約4分

**結論:** レート制限により処理時間は増加しますが、Lambda実行時間制限（15分）内に十分収まります。

### コスト影響

**Lambda実行時間:**
- レート制限なし: 50件 × 3秒 = 150秒
- レート制限あり: 50件 × 5秒 = 250秒
- 増加率: 67%

**コスト増加:**
- Lambda実行時間: 150秒 → 250秒（+100秒）
- 月間コスト影響: 約$0.01/月（無視できるレベル）

**詳細**: `../../steering/infrastructure/performance-optimization.md`

---

## 関連ドキュメント

### 設計ドキュメント
- **[Design Document](./design.md)** - システム全体設計
- **[Requirements](./requirements.md)** - 要件定義（要件9.1, 9.2: レート制限）

### 実装ガイドライン（Steering）
- **[実装ルール](../../steering/core/tdnet-implementation-rules.md)** - レート制限基本方針
- **[スクレイピングパターン](../../steering/development/tdnet-scraping-patterns.md)** - Token Bucket実装詳細
- **[テスト戦略](../../steering/development/testing-strategy.md)** - レート制限テスト
- **[パフォーマンス最適化](../../steering/infrastructure/performance-optimization.md)** - コスト影響分析
- **[監視とアラート](../../steering/infrastructure/monitoring-alerts.md)** - レート制限監視

---

**最終更新:** 2026-02-15
