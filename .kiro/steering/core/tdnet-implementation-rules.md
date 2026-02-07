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

#### タイムゾーン処理

**基本方針: JST（日本標準時）を基準とする**

TDnetは日本の開示情報サービスであり、開示時刻は日本時間（JST, UTC+9）で管理されます。

**disclosed_at のフォーマット:**
- **推奨形式**: ISO 8601形式（UTC）: `"2024-01-15T01:30:00Z"`
- **内部処理**: JSTに変換してから date_partition を生成
- **理由**: 23:30 JST（2024-01-15）と 00:30 JST（2024-01-16）が異なる月になる可能性を考慮

**タイムゾーン変換の注意点:**
```typescript
// ❌ 悪い例: UTCのまま月を抽出（月またぎで誤った partition になる可能性）
const date = new Date("2024-01-31T15:30:00Z"); // JST: 2024-02-01 00:30
const month = date.getUTCMonth() + 1; // 1 (誤り: 実際はJSTで2月)

// ✅ 良い例: JSTに変換してから月を抽出
const date = new Date("2024-01-31T15:30:00Z");
const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
const month = jstDate.getUTCMonth() + 1; // 2 (正しい)
```

#### disclosed_at フォーマット検証ルール

**必須要件:**
1. **ISO 8601形式**: `YYYY-MM-DDTHH:mm:ssZ` または `YYYY-MM-DDTHH:mm:ss.sssZ`
2. **有効な日付**: 実在する日付であること（例: 2024-02-30 は無効）
3. **範囲チェック**: 1970-01-01 以降、現在時刻+1日以内
4. **タイムゾーン**: UTC（Z）またはオフセット形式（+09:00）

**バリデーション実装:**
```typescript
function validateDisclosedAt(disclosedAt: string): void {
    // 1. ISO 8601形式チェック
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?([Z]|[+-]\d{2}:\d{2})$/;
    if (!iso8601Regex.test(disclosedAt)) {
        throw new ValidationError(
            `Invalid disclosed_at format: ${disclosedAt}. Expected ISO 8601 format (e.g., "2024-01-15T10:30:00Z")`
        );
    }

    // 2. 有効な日付チェック
    const date = new Date(disclosedAt);
    if (isNaN(date.getTime())) {
        throw new ValidationError(
            `Invalid date: ${disclosedAt}. Date does not exist.`
        );
    }

    // 3. 範囲チェック（1970-01-01 以降、現在時刻+1日以内）
    const minDate = new Date('1970-01-01T00:00:00Z');
    const maxDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 現在時刻+1日
    if (date < minDate || date > maxDate) {
        throw new ValidationError(
            `Date out of range: ${disclosedAt}. Must be between 1970-01-01 and ${maxDate.toISOString()}`
        );
    }
}
```

#### 不正な日付の処理方法

**エラーハンドリング戦略:**

1. **バリデーションエラー**: 即座に失敗（Non-Retryable Error）
   - 不正なフォーマット
   - 存在しない日付（例: 2024-02-30）
   - 範囲外の日付

2. **ログ記録**: エラー詳細を構造化ログに記録
   ```typescript
   logger.error('Invalid disclosed_at detected', {
       error_type: 'ValidationError',
       disclosed_at: disclosedAt,
       disclosure_id: disclosureId,
       context: { source: 'generateDatePartition' },
   });
   ```

3. **部分的失敗の許容**: バッチ処理では個別の失敗を記録して継続
   ```typescript
   for (const disclosure of disclosures) {
       try {
           validateDisclosedAt(disclosure.disclosed_at);
           const partition = generateDatePartition(disclosure.disclosed_at);
           await saveDisclosure({ ...disclosure, date_partition: partition });
           results.success++;
       } catch (error) {
           logger.error('Failed to process disclosure', { disclosure, error });
           results.failed++;
       }
   }
   ```

#### 月またぎのエッジケース処理

**エッジケース一覧:**

| ケース | UTC時刻 | JST時刻 | date_partition | 注意点 |
|--------|---------|---------|----------------|--------|
| 月末深夜（UTC） | 2024-01-31T15:30:00Z | 2024-02-01T00:30:00+09:00 | `2024-02` | JSTで翌月 |
| 月初深夜（UTC） | 2024-02-01T14:59:59Z | 2024-01-31T23:59:59+09:00 | `2024-01` | JSTで前月 |
| うるう年2月末 | 2024-02-29T15:00:00Z | 2024-03-01T00:00:00+09:00 | `2024-03` | JSTで翌月 |
| 年またぎ | 2023-12-31T15:30:00Z | 2024-01-01T00:30:00+09:00 | `2024-01` | JSTで翌年 |

**テストケース例:**
```typescript
describe('generateDatePartition - Edge Cases', () => {
    it('should handle month boundary (UTC to JST)', () => {
        // UTC: 2024-01-31 15:30 → JST: 2024-02-01 00:30
        const partition = generateDatePartition('2024-01-31T15:30:00Z');
        expect(partition).toBe('2024-02');
    });

    it('should handle leap year February', () => {
        // UTC: 2024-02-29 15:00 → JST: 2024-03-01 00:00
        const partition = generateDatePartition('2024-02-29T15:00:00Z');
        expect(partition).toBe('2024-03');
    });

    it('should handle year boundary', () => {
        // UTC: 2023-12-31 15:30 → JST: 2024-01-01 00:30
        const partition = generateDatePartition('2023-12-31T15:30:00Z');
        expect(partition).toBe('2024-01');
    });

    it('should handle non-leap year February 28', () => {
        // UTC: 2023-02-28 15:00 → JST: 2023-03-01 00:00
        const partition = generateDatePartition('2023-02-28T15:00:00Z');
        expect(partition).toBe('2023-03');
    });
});
```

#### 改善された実装例

```typescript
import { ValidationError } from './errors';
import { logger } from './utils/logger';

/**
 * disclosed_at のバリデーション
 * @throws {ValidationError} フォーマットまたは範囲が不正な場合
 */
function validateDisclosedAt(disclosedAt: string): void {
    // ISO 8601形式チェック
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?([Z]|[+-]\d{2}:\d{2})$/;
    if (!iso8601Regex.test(disclosedAt)) {
        throw new ValidationError(
            `Invalid disclosed_at format: ${disclosedAt}. Expected ISO 8601 format.`
        );
    }

    // 有効な日付チェック
    const date = new Date(disclosedAt);
    if (isNaN(date.getTime())) {
        throw new ValidationError(`Invalid date: ${disclosedAt}`);
    }

    // 範囲チェック
    const minDate = new Date('1970-01-01T00:00:00Z');
    const maxDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (date < minDate || date > maxDate) {
        throw new ValidationError(`Date out of range: ${disclosedAt}`);
    }
}

/**
 * disclosed_at から date_partition を生成（JST基準）
 * @param disclosedAt ISO 8601形式の日時文字列（UTC推奨）
 * @returns YYYY-MM形式の date_partition
 * @throws {ValidationError} 不正なフォーマットまたは日付の場合
 */
function generateDatePartition(disclosedAt: string): string {
    // バリデーション
    validateDisclosedAt(disclosedAt);

    // UTCからJSTに変換（UTC+9時間）
    const utcDate = new Date(disclosedAt);
    const jstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);

    // YYYY-MM形式で返却
    const year = jstDate.getUTCFullYear();
    const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
    
    return `${year}-${month}`;
}

/**
 * DynamoDB保存時の使用例
 */
interface DisclosureItem {
    disclosure_id: string;
    disclosed_at: string;
    date_partition: string;
    company_code: string;
    title: string;
    // ...
}

async function saveDisclosure(disclosure: Omit<DisclosureItem, 'date_partition'>) {
    try {
        // date_partition を自動生成（バリデーション含む）
        const item: DisclosureItem = {
            ...disclosure,
            date_partition: generateDatePartition(disclosure.disclosed_at),
        };
        
        await dynamodb.putItem({
            TableName: 'Disclosures',
            Item: item,
        });
        
        logger.info('Disclosure saved successfully', {
            disclosure_id: item.disclosure_id,
            date_partition: item.date_partition,
        });
    } catch (error) {
        if (error instanceof ValidationError) {
            logger.error('Validation failed for disclosure', {
                error_type: 'ValidationError',
                disclosure_id: disclosure.disclosure_id,
                disclosed_at: disclosure.disclosed_at,
                error_message: error.message,
            });
            throw error; // Non-Retryable Error
        }
        throw error;
    }
}

/**
 * GSIを使用した月単位クエリ
 */
async function queryByMonth(yearMonth: string): Promise<DisclosureItem[]> {
    // yearMonth フォーマット検証
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
        throw new ValidationError(
            `Invalid yearMonth format: ${yearMonth}. Expected YYYY-MM format.`
        );
    }
    
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

/**
 * 日付範囲クエリ（複数月を並行クエリ）
 */
async function queryByDateRange(startDate: string, endDate: string): Promise<DisclosureItem[]> {
    // 日付フォーマット検証
    validateDisclosedAt(startDate);
    validateDisclosedAt(endDate);
    
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

/**
 * 月範囲を生成するヘルパー関数
 */
function generateMonthRange(start: string, end: string): string[] {
    // フォーマット検証
    if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end)) {
        throw new ValidationError(
            `Invalid month format. Expected YYYY-MM format. Got: start=${start}, end=${end}`
        );
    }
    
    const [startYear, startMonth] = start.split('-').map(Number);
    const [endYear, endMonth] = end.split('-').map(Number);
    
    // 範囲チェック（開始月 <= 終了月）
    if (startYear > endYear || (startYear === endYear && startMonth > endMonth)) {
        throw new ValidationError(
            `Invalid month range: start (${start}) must be before or equal to end (${end})`
        );
    }
    
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

**バッチ処理での部分的失敗の処理:**

```typescript
/**
 * 複数の開示情報を一括保存（部分的失敗を許容）
 */
async function saveDisclosuresBatch(disclosures: Omit<DisclosureItem, 'date_partition'>[]): Promise<{
    success: number;
    failed: number;
    errors: Array<{ disclosure_id: string; error: string }>;
}> {
    const results = {
        success: 0,
        failed: 0,
        errors: [] as Array<{ disclosure_id: string; error: string }>,
    };
    
    for (const disclosure of disclosures) {
        try {
            await saveDisclosure(disclosure);
            results.success++;
        } catch (error) {
            results.failed++;
            results.errors.push({
                disclosure_id: disclosure.disclosure_id,
                error: error instanceof Error ? error.message : String(error),
            });
            
            logger.error('Failed to save disclosure in batch', {
                disclosure_id: disclosure.disclosure_id,
                error_type: error instanceof Error ? error.constructor.name : 'Unknown',
                error_message: error instanceof Error ? error.message : String(error),
            });
        }
    }
    
    logger.info('Batch save completed', {
        total: disclosures.length,
        success: results.success,
        failed: results.failed,
    });
    
    return results;
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
