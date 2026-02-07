---
inclusion: always
---

# TDnet Data Collector - 実装ルール

このファイルは、TDnet Data Collectorプロジェクトの基本的な実装原則をまとめたものです。詳細な実装ガイドラインは各専門ファイルを参照してください。

## プロジェクト概要

TDnet Data Collectorは、日本取引所グループのTDnet（適時開示情報閲覧サービス）から上場企業の開示情報を自動収集するAWSベースのサーバーレスシステムです。

### 主要な技術スタック

- **実行環境**: AWS Lambda (Node.js 20.x, TypeScript)
- **データベース**: Amazon DynamoDB
- **ストレージ**: Amazon S3
- **API**: Amazon API Gateway
- **IaC**: AWS CDK (TypeScript)
- **監視**: CloudWatch Logs & Metrics
- **セキュリティ**: AWS WAF, Secrets Manager, CloudTrail

## 実装原則

### 1. コスト最適化を最優先

AWS無料枠を最大限活用し、サーバーレスアーキテクチャを採用してコストを最小化します。

**詳細**: `../infrastructure/performance-optimization.md` を参照

### 2. エラーハンドリングの徹底

すべての外部API呼び出しに再試行ロジックを実装し、部分的な失敗を許容する設計を採用します。

**詳細**: `error-handling-patterns.md` および `../development/error-handling-implementation.md` を参照

### 3. レート制限とマナー

TDnetへのリクエスト間隔を適切に制御し、過度な負荷をかけないようにします。

**詳細**: `../development/tdnet-scraping-patterns.md` を参照

### 4. データ整合性の保証

重複チェックとデータ検証を徹底し、メタデータとファイルの対応関係を厳密に管理します。

**詳細**: `../development/data-validation.md` を参照

### 5. date_partition による効率的なクエリ

DynamoDBのクエリ効率を最大化するため、`date_partition`（YYYY-MM形式）を使用します。

**設計原則:**
- `date_partition`は`disclosed_at`から自動生成（YYYY-MM形式）
- GSI（Global Secondary Index）のパーティションキーとして使用
- 月単位のクエリを高速化
- 日付範囲クエリは複数の月を並行クエリ

**実装例:**

```typescript
// disclosed_atからdate_partitionを生成
function generateDatePartition(disclosedAt: string): string {
    // disclosedAt: "2024-01-15T10:30:00Z" (ISO 8601形式)
    const date = new Date(disclosedAt);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`; // "2024-01"
}

// DynamoDB保存時の使用例
interface DisclosureItem {
    disclosure_id: string;
    disclosed_at: string;
    date_partition: string;
    company_code: string;
    title: string;
    // ...
}

async function saveDisclosure(disclosure: Omit<DisclosureItem, 'date_partition'>) {
    const item: DisclosureItem = {
        ...disclosure,
        date_partition: generateDatePartition(disclosure.disclosed_at),
    };
    
    await dynamodb.putItem({
        TableName: 'Disclosures',
        Item: item,
    });
}

// GSIを使用した月単位クエリ
async function queryByMonth(yearMonth: string): Promise<DisclosureItem[]> {
    const result = await dynamodb.query({
        TableName: 'Disclosures',
        IndexName: 'DatePartitionIndex', // GSI名
        KeyConditionExpression: 'date_partition = :partition',
        ExpressionAttributeValues: {
            ':partition': yearMonth, // "2024-01"
        },
    });
    
    return result.Items as DisclosureItem[];
}

// 日付範囲クエリ（複数月を並行クエリ）
async function queryByDateRange(startDate: string, endDate: string): Promise<DisclosureItem[]> {
    // 開始月と終了月を生成
    const startPartition = generateDatePartition(startDate);
    const endPartition = generateDatePartition(endDate);
    
    // 月のリストを生成（例: ["2024-01", "2024-02", "2024-03"]）
    const partitions = generateMonthRange(startPartition, endPartition);
    
    // 並行クエリ
    const results = await Promise.all(
        partitions.map(partition => queryByMonth(partition))
    );
    
    // 結果を統合してフィルタリング
    return results
        .flat()
        .filter(item => {
            const disclosedAt = new Date(item.disclosed_at);
            return disclosedAt >= new Date(startDate) && disclosedAt <= new Date(endDate);
        })
        .sort((a, b) => new Date(b.disclosed_at).getTime() - new Date(a.disclosed_at).getTime());
}

// 月範囲を生成するヘルパー関数
function generateMonthRange(start: string, end: string): string[] {
    const [startYear, startMonth] = start.split('-').map(Number);
    const [endYear, endMonth] = end.split('-').map(Number);
    
    const months: string[] = [];
    let year = startYear;
    let month = startMonth;
    
    while (year < endYear || (year === endYear && month <= endMonth)) {
        months.push(`${year}-${String(month).padStart(2, '0')}`);
        month++;
        if (month > 12) {
            month = 1;
            year++;
        }
    }
    
    return months;
}
```

**パフォーマンス考慮事項:**
- 単一月のクエリは高速（GSIのパーティションキーで直接アクセス）
- 複数月のクエリは並行実行で効率化
- 1年以上の範囲クエリは、月数が多い場合にコストが増加する可能性あり
- 必要に応じて、結果のページネーションを実装

**詳細**: `../development/data-validation.md` の date_partition セクションを参照

## 関連ドキュメント

- **タスク実行ルール**: `tdnet-data-collector.md` - タスク実行とフィードバックループ
- **エラーハンドリング基本原則**: `error-handling-patterns.md` - エラー分類と再試行戦略
- **ファイル命名規則**: `../development/tdnet-file-naming.md` - プロジェクト構造と命名規則
- **エラーハンドリング実装**: `../development/error-handling-implementation.md` - 詳細な実装パターン
- **テスト戦略**: `../development/testing-strategy.md` - ユニット、統合、プロパティテスト
- **データバリデーション**: `../development/data-validation.md` - バリデーションルール
- **スクレイピングパターン**: `../development/tdnet-scraping-patterns.md` - TDnetスクレイピングの詳細
- **デプロイメント**: `../infrastructure/deployment-checklist.md` - デプロイ手順とチェックリスト
- **環境変数**: `../infrastructure/environment-variables.md` - 環境変数の管理方法
- **パフォーマンス最適化**: `../infrastructure/performance-optimization.md` - コスト削減とパフォーマンス
- **監視とアラート**: `../infrastructure/monitoring-alerts.md` - CloudWatch設定
- **セキュリティベストプラクティス**: `../security/security-best-practices.md` - IAM、暗号化、監査
- **API設計ガイドライン**: `../api/api-design-guidelines.md` - RESTful API設計
