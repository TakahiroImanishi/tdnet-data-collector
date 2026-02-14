# DynamoDBスキーマ定義

TDnet Data CollectorのDynamoDBテーブル設計とスキーマ定義。

## テーブル一覧

| テーブル名 | 用途 | PK | GSI |
|-----------|------|-----|-----|
| `tdnet-disclosures-{env}` | 開示情報メタデータ | `disclosure_id` | `date_partition` + `disclosed_at` |
| `tdnet-executions-{env}` | 収集実行状態 | `execution_id` | なし |
| `tdnet-export-status-{env}` | エクスポート状態 | `export_id` | なし |

## 1. Disclosures テーブル

### 概要
TDnetから収集した開示情報のメタデータを保存します。

### テーブル設計

| 項目 | 値 |
|------|-----|
| テーブル名 | `tdnet-disclosures-{env}` |
| 課金モード | オンデマンド |
| PK | `disclosure_id` (String) |
| GSI | `DatePartitionIndex` |
| TTL | なし（永続保存） |

### フィールド定義

#### 必須フィールド

| フィールド名 | DynamoDB型 | TypeScript型 | 説明 | 例 |
|-------------|-----------|-------------|------|-----|
| `disclosure_id` | String (PK) | `string` | 開示ID（一意識別子） | `TD20240115001` |
| `company_code` | String | `string` | 企業コード（4桁） | `7203` |
| `company_name` | String | `string` | 企業名 | `トヨタ自動車株式会社` |
| `disclosure_type` | String | `string` | 開示種類 | `決算短信` |
| `title` | String | `string` | タイトル | `2024年3月期 第3四半期決算短信` |
| `disclosed_at` | String | `string` | 開示日時（ISO 8601、UTC） | `2024-01-15T10:30:00Z` |
| `downloaded_at` | String | `string` | ダウンロード日時（ISO 8601、UTC） | `2024-01-15T10:35:00Z` |
| `date_partition` | String (GSI PK) | `string` | 日付パーティション（YYYY-MM、JST基準） | `2024-01` |

#### オプショナルフィールド

| フィールド名 | DynamoDB型 | TypeScript型 | 説明 | 例 |
|-------------|-----------|-------------|------|-----|
| `pdf_url` | String | `string?` | PDF URL | `https://www.release.tdnet.info/inbs/140120240115001.pdf` |
| `pdf_s3_key` | String | `string?` | S3キー（PDFファイルの保存先） | `pdfs/2024/01/TD20240115001_7203.pdf` |

### GSI: DatePartitionIndex

月単位での開示情報クエリを高速化するためのGSI。

| 項目 | 値 |
|------|-----|
| GSI名 | `DatePartitionIndex` |
| PK | `date_partition` (String) |
| SK | `disclosed_at` (String) |
| 射影 | ALL |

**クエリ例**:
```typescript
// 2024年1月の開示情報を取得
const result = await docClient.send(new QueryCommand({
  TableName: 'tdnet-disclosures-prod',
  IndexName: 'DatePartitionIndex',
  KeyConditionExpression: 'date_partition = :partition',
  ExpressionAttributeValues: {
    ':partition': '2024-01',
  },
}));
```

### モデル定義との対応

#### TypeScript型定義 (`src/types/index.ts`)

```typescript
export interface Disclosure {
  disclosure_id: string;
  company_code: string;
  company_name: string;
  disclosure_type: string;
  title: string;
  disclosed_at: string;
  pdf_url?: string;
  pdf_s3_key?: string;
  downloaded_at: string;
  date_partition: string;
}
```

#### DynamoDBアイテム変換 (`src/models/disclosure.ts`)

- `toDynamoDBItem()`: Disclosure → DynamoDBアイテム
- `fromDynamoDBItem()`: DynamoDBアイテム → Disclosure
- `validateDisclosure()`: 必須フィールドとフォーマット検証

### データ整合性ルール

1. **disclosure_id**: `generateDisclosureId()`で生成、一意性保証
2. **date_partition**: `generateDatePartition(disclosed_at)`で生成、YYYY-MM形式、JST基準
3. **company_code**: 4桁の数字（正規表現: `^\d{4}$`）
4. **disclosed_at, downloaded_at**: ISO 8601形式（正規表現: `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$`）
5. **pdf_url, pdf_s3_key**: オプショナル（PDFが存在しない場合は未設定）

## 2. Executions テーブル

### 概要
データ収集処理の実行状態を保存します。

### テーブル設計

| 項目 | 値 |
|------|-----|
| テーブル名 | `tdnet-executions-{env}` |
| 課金モード | オンデマンド |
| PK | `execution_id` (String) |
| GSI | なし |
| TTL | `ttl` (30日後に自動削除) |

### フィールド定義

| フィールド名 | DynamoDB型 | TypeScript型 | 説明 |
|-------------|-----------|-------------|------|
| `execution_id` | String (PK) | `string` | 実行ID |
| `status` | String | `'pending' \| 'running' \| 'completed' \| 'failed'` | 状態 |
| `started_at` | String | `string` | 開始日時（ISO 8601、UTC） |
| `completed_at` | String | `string?` | 終了日時（ISO 8601、UTC） |
| `progress` | Number | `number` | 進捗率（0〜100） |
| `success_count` | Number | `number` | 成功件数 |
| `failed_count` | Number | `number` | 失敗件数 |
| `error_message` | String | `string?` | エラーメッセージ |
| `ttl` | Number | `number` | TTL（Unix timestamp） |

## 3. Export Status テーブル

### 概要
データエクスポート処理の状態を保存します。

### テーブル設計

| 項目 | 値 |
|------|-----|
| テーブル名 | `tdnet-export-status-{env}` |
| 課金モード | オンデマンド |
| PK | `export_id` (String) |
| GSI | なし |
| TTL | `ttl` (30日後に自動削除) |

### フィールド定義

| フィールド名 | DynamoDB型 | TypeScript型 | 説明 |
|-------------|-----------|-------------|------|
| `export_id` | String (PK) | `string` | エクスポートID |
| `status` | String | `'pending' \| 'processing' \| 'completed' \| 'failed'` | 状態 |
| `requested_at` | String | `string` | リクエスト日時（ISO 8601、UTC） |
| `completed_at` | String | `string?` | 完了日時（ISO 8601、UTC） |
| `progress` | Number | `number` | 進捗率（0〜100） |
| `s3_key` | String | `string?` | S3キー（エクスポートファイルの保存先） |
| `download_url` | String | `string?` | ダウンロードURL（署名付きURL、有効期限7日） |
| `error_message` | String | `string?` | エラーメッセージ |
| `ttl` | Number | `number` | TTL（Unix timestamp） |

## データ移行

### フィールド名変更（2026-02-15）

以下のフィールド名が変更されました：

| 旧フィールド名 | 新フィールド名 | 変更理由 |
|--------------|--------------|---------|
| `s3_key` | `pdf_s3_key` | 用途を明確化（PDF専用） |
| `collected_at` | `downloaded_at` | 意味を明確化（ダウンロード日時） |

**移行スクリプト**: `scripts/migrate-disclosure-fields.ts`

```bash
# Dry run（変更内容の確認）
npx ts-node scripts/migrate-disclosure-fields.ts --table-name tdnet-disclosures-dev --dry-run

# 本番実行
npx ts-node scripts/migrate-disclosure-fields.ts --table-name tdnet-disclosures-prod
```

## 関連ドキュメント

- **型定義**: `src/types/index.ts` - TypeScript型定義
- **モデル**: `src/models/disclosure.ts` - Disclosureモデルと変換関数
- **バリデーション**: `.kiro/steering/development/data-validation.md` - バリデーションルール
- **CDK定義**: `cdk/lib/stacks/foundation-stack.ts` - DynamoDBテーブル定義
