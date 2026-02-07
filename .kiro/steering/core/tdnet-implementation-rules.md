# TDnet Data Collector - 実装ルール

このファイルは、TDnet Data Collectorプロジェクトのコード実装時に従うべきルールとベストプラクティスをまとめたものです。

## プロジェクト概要

TDnet Data Collectorは、日本取引所グループのTDnet（適時開示情報閲覧サービス）から上場企業の開示情報を自動収集するAWSベースのサーバーレスシステムです。

### 主要な技術スタック

- **実行環境**: AWS Lambda (Node.js 20.x, TypeScript)
- **データベース**: Amazon DynamoDB
- **ファイルストレージ**: Amazon S3
- **スケジューリング**: Amazon EventBridge
- **API**: Amazon API Gateway
- **セキュリティ**: AWS WAF, Secrets Manager, CloudTrail
- **通知**: Amazon SNS
- **監視**: CloudWatch Logs & Metrics
- **Webホスティング**: S3 + CloudFront
- **IaC**: AWS CDK (TypeScript)

### 言語選択の理由

**TypeScript/Node.js 20.xを採用:**
1. **CDKとの統合**: インフラコードと実装コードで同じ言語を使用
2. **型安全性**: コンパイル時の型チェックでバグを早期発見
3. **豊富なエコシステム**: npm/yarnの豊富なライブラリ
4. **非同期処理**: async/awaitによる直感的な非同期処理
5. **コールドスタート**: Pythonと比較して遜色ないパフォーマンス

## 実装原則

### 1. コスト最適化を最優先

- AWS無料枠を最大限活用する
- 常時稼働するリソースを避ける（サーバーレス優先）
- S3ライフサイクルポリシーで古いデータを自動的に低コストストレージに移行
- Lambda実行時間を最小化（タイムアウト設定を適切に）

### 2. エラーハンドリングの徹底

- すべての外部API呼び出しに再試行ロジックを実装（指数バックオフ）
- 部分的な失敗を許容し、処理を継続する設計
- 構造化ログ（JSON形式）でCloudWatch Logsに記録
- 重大なエラーはSNS経由で通知

### 3. レート制限とマナー

- TDnetへのリクエスト間隔を適切に制御（デフォルト2秒）
- User-Agentヘッダーを必ず設定
- robots.txtを尊重
- 過度な負荷をかけない

### 4. データ整合性の保証

- 重複チェックを必ず実装（DynamoDB条件付き書込）
- PDFファイルの整合性検証（サイズ、ハッシュ値）
- メタデータとファイルの対応関係を厳密に管理

## ファイル・フォルダ命名規則

**詳細な命名規則とプロジェクト構造については、`../development/tdnet-file-naming.md` を参照してください。**

### 基本原則

- steeringファイルのfileMatchパターンに対応した命名規則に従うこと
- ファイル名は機能を明確に表現すること
- ケバブケース（kebab-case）を使用すること
- 適切なフォルダに配置すること

## コーディング規約

### TypeScript

```typescript
// 型定義を明示的に
interface DisclosureMetadata {
    disclosure_id: string;
    company_code: string;
    company_name: string;
    disclosure_date: string;
    disclosure_type: string;
    title: string;
    pdf_s3_key: string;
    downloaded_at: string;
}

// async/awaitを使用
async function fetchDisclosures(date: string): Promise<DisclosureMetadata[]> {
    try {
        const response = await axios.get(url);
        return parseDisclosures(response.data);
    } catch (error) {
        logger.error('Failed to fetch disclosures', { date, error });
        throw error;
    }
}

// 環境変数は起動時に検証
const config = {
    s3BucketName: process.env.S3_BUCKET_NAME || throwError('S3_BUCKET_NAME is required'),
    dynamoTableName: process.env.DYNAMODB_TABLE_NAME || throwError('DYNAMODB_TABLE_NAME is required'),
};
```

### ログ出力

```typescript
// 構造化ログを使用
logger.info('Batch collection started', {
    execution_id: executionId,
    date: targetDate,
});

logger.error('Failed to download PDF', {
    disclosure_id: disclosureId,
    company_code: companyCode,
    error: error.message,
    stack: error.stack,
});
```

### エラーハンドリング

**詳細な実装は `error-handling-patterns.md` を参照してください。**

**基本原則:**
- すべての外部API呼び出しに再試行ロジックを実装
- 再試行可能なエラーと永続的なエラーを区別
- 構造化ログ（JSON形式）でCloudWatch Logsに記録
- 重大なエラーはSNS経由で通知

**エラー分類:**
- **Retryable Errors**: ネットワークエラー、タイムアウト、5xxエラー、AWS一時的エラー
- **Non-Retryable Errors**: 認証エラー、404、バリデーションエラー、設定エラー

**実装例:**
```typescript
import { retryWithBackoff, RetryableError } from './error-handling';

// 再試行ロジックの使用
async function fetchDataWithRetry(url: string): Promise<any> {
    return retryWithBackoff(
        async () => {
            const response = await axios.get(url);
            return response.data;
        },
        {
            maxRetries: 3,
            initialDelay: 2000,
            maxDelay: 30000,
            backoffMultiplier: 2,
            jitter: true,
        }
    );
}
```

詳細な再試行戦略、サーキットブレーカー、エラーログ構造については `error-handling-patterns.md` を参照してください。

## AWS CDK パターン

### Lambda関数の定義

```typescript
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
    entry: 'lambda/collector/index.ts',
    handler: 'handler',
    runtime: lambda.Runtime.NODEJS_20_X,
    timeout: cdk.Duration.minutes(15),
    memorySize: 512,
    environment: {
        S3_BUCKET_NAME: pdfBucket.bucketName,
        DYNAMODB_TABLE_NAME: table.tableName,
    },
    bundling: {
        minify: true,
        sourceMap: true,
    },
});
```

### IAM権限の最小化

```typescript
// 必要最小限の権限のみ付与
pdfBucket.grantReadWrite(collectorFn);
table.grantWriteData(parserFn);
table.grantReadData(queryFn);
```

## テスト戦略

### ユニットテスト

- すべての関数に対してユニットテストを作成
- モックを使用して外部依存を排除
- エッジケースとエラー条件を必ずテスト

### プロパティベーステスト

- fast-checkを使用
- Correctness Propertiesに対応するテストを実装
- 最低100回の実行でランダム入力をテスト

```typescript
import fc from 'fast-check';

test('Property: 日付範囲バリデーション', () => {
    fc.assert(
        fc.property(
            fc.date(),
            fc.date(),
            (startDate, endDate) => {
                if (startDate > endDate) {
                    expect(() => validateDateRange(startDate, endDate))
                        .toThrow(ValidationError);
                }
            }
        ),
        { numRuns: 100 }
    );
});
```

### テストデータ生成（Arbitrary）

fast-checkのArbitraryを使用して、ドメイン固有のテストデータを生成：

**企業コードのArbitrary:**
```typescript
import fc from 'fast-check';

// 4桁の企業コード（1000-9999）
const arbCompanyCode = fc.integer({ min: 1000, max: 9999 })
    .map(code => code.toString().padStart(4, '0'));

// 使用例
fc.assert(
    fc.property(arbCompanyCode, (companyCode) => {
        expect(() => validateCompanyCode(companyCode)).not.toThrow();
    })
);
```

**開示情報IDのArbitrary:**
```typescript
// 開示情報ID: YYYYMMDD_企業コード_連番
const arbDisclosureId = fc.tuple(
    fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    arbCompanyCode,
    fc.integer({ min: 1, max: 999 })
).map(([date, code, seq]) => {
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const seqStr = seq.toString().padStart(3, '0');
    return `${dateStr}_${code}_${seqStr}`;
});

// 使用例
fc.assert(
    fc.property(arbDisclosureId, (disclosureId) => {
        expect(() => validateDisclosureId(disclosureId)).not.toThrow();
    })
);
```

**日付範囲のArbitrary:**
```typescript
// 有効な日付範囲（start_date <= end_date）
const arbDateRange = fc.tuple(
    fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    fc.integer({ min: 0, max: 365 })
).map(([startDate, daysOffset]) => {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + daysOffset);
    
    return {
        start_date: startDate.toISOString().slice(0, 10),
        end_date: endDate.toISOString().slice(0, 10),
    };
});

// 使用例
fc.assert(
    fc.property(arbDateRange, ({ start_date, end_date }) => {
        expect(() => validateDateRange(start_date, end_date)).not.toThrow();
    })
);
```

**開示情報全体のArbitrary:**
```typescript
const arbDisclosureType = fc.constantFrom(
    '決算短信',
    '業績予想修正',
    '配当予想修正',
    '自己株式取得',
    'その他'
);

const arbDisclosure = fc.record({
    disclosure_id: arbDisclosureId,
    company_code: arbCompanyCode,
    company_name: fc.string({ minLength: 1, maxLength: 200 }),
    disclosure_type: arbDisclosureType,
    title: fc.string({ minLength: 1, maxLength: 500 }),
    disclosed_at: fc.date({ min: new Date('2020-01-01'), max: new Date() })
        .map(d => d.toISOString()),
    pdf_s3_key: fc.tuple(
        fc.date({ min: new Date('2020-01-01'), max: new Date() }),
        arbCompanyCode,
        arbDisclosureType
    ).map(([date, code, type]) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const timestamp = date.toISOString().replace(/[-:]/g, '').slice(0, 14);
        return `${year}/${month}/${day}/${code}_${type}_${timestamp}.pdf`;
    }),
});

// 使用例
fc.assert(
    fc.property(arbDisclosure, (disclosure) => {
        expect(() => validateDisclosure(disclosure)).not.toThrow();
    }),
    { numRuns: 100 }
);
```

**無効なデータのArbitrary（ネガティブテスト用）:**
```typescript
// 無効な企業コード
const arbInvalidCompanyCode = fc.oneof(
    fc.string({ minLength: 0, maxLength: 3 }), // 短すぎる
    fc.string({ minLength: 5, maxLength: 10 }), // 長すぎる
    fc.string().filter(s => !/^\d{4}$/.test(s)), // 数字以外
    fc.integer({ min: 0, max: 999 }).map(String), // 範囲外
    fc.integer({ min: 10000, max: 99999 }).map(String) // 範囲外
);

// 使用例
fc.assert(
    fc.property(arbInvalidCompanyCode, (invalidCode) => {
        expect(() => validateCompanyCode(invalidCode)).toThrow(ValidationError);
    })
);
```

**Arbitraryの合成パターン:**
```typescript
// 複数のArbitraryを組み合わせて複雑なテストケースを生成
const arbBatchCollectionRequest = fc.record({
    date_range: arbDateRange,
    company_codes: fc.array(arbCompanyCode, { minLength: 1, maxLength: 10 }),
    disclosure_types: fc.array(arbDisclosureType, { minLength: 1, maxLength: 3 }),
});

// 使用例
fc.assert(
    fc.property(arbBatchCollectionRequest, (request) => {
        const result = processBatchCollection(request);
        expect(result.collected_count).toBeGreaterThanOrEqual(0);
        expect(result.failed_count).toBeGreaterThanOrEqual(0);
    }),
    { numRuns: 50 }
);
```

## デプロイメント

### 環境分離

- 開発環境（dev）と本番環境（prod）を分離
- 環境ごとに異なるAWSアカウントまたはリージョンを使用

### デプロイ手順

```bash
# 依存関係のインストール
npm install

# テスト実行
npm test

# CDKスタックのデプロイ
cdk deploy --profile your-aws-profile

# 環境変数の設定（必要に応じて）
aws ssm put-parameter --name /tdnet/api-key --value "your-api-key" --type SecureString
```

## トラブルシューティング

### Lambda実行エラー

1. CloudWatch Logsでエラーログを確認
2. X-Rayトレースで実行フローを分析
3. 環境変数が正しく設定されているか確認

### DynamoDB書込エラー

- スロットリングエラー: オンデマンドモードを使用しているか確認
- 条件付き書込失敗: 重複データの可能性（正常な動作）

### S3アップロードエラー

- IAM権限を確認
- バケット名が正しいか確認
- リージョンが一致しているか確認

## セキュリティ

### APIキー管理

- APIキーは環境変数またはSSM Parameter Storeで管理
- ログやエラーメッセージにAPIキーを出力しない
- 定期的にAPIキーをローテーション

### S3セキュリティ

- パブリックアクセスをブロック
- 署名付きURLで一時的なアクセスを提供
- SSE-S3で暗号化

### DynamoDBセキュリティ

- IAMロールで最小権限を付与
- VPC内からのアクセスを検討（必要に応じて）

## 参考リンク

- [TDnet適時開示情報閲覧サービス](https://www.release.tdnet.info/inbs/I_main_00.html)
- [AWS Lambda開発者ガイド](https://docs.aws.amazon.com/lambda/)
- [AWS CDK TypeScript リファレンス](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-construct-library.html)
- [fast-check ドキュメント](https://github.com/dubzzz/fast-check)

## 注意事項

- TDnetの公式APIは存在するがコストが高いため、Webスクレイピングを採用
- スクレイピングはTDnetの利用規約を遵守すること
- 過度なアクセスでサービスに負荷をかけないこと
- 個人利用の範囲内で使用すること

## 関連ドキュメント

- **エラーハンドリング**: `error-handling-patterns.md` - エラー処理の詳細パターン
- **タスク実行ルール**: `tdnet-data-collector.md` - タスク実行とフィードバックループ
- **ファイル命名規則**: `../development/tdnet-file-naming.md` - 詳細な命名規則とプロジェクト構造
- **テスト戦略**: `../development/testing-strategy.md` - プロパティテストの実装例
- **データバリデーション**: `../development/data-validation.md` - バリデーションルール
- **スクレイピングパターン**: `../development/tdnet-scraping-patterns.md` - TDnetスクレイピングの詳細
