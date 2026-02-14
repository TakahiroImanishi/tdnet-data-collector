# TDnet Data Collector - DynamoDBスキーマ設計

## 概要

TDnet Data Collectorで使用する3つのDynamoDBテーブルのスキーマ定義とモデル定義の対応関係を記載します。

## テーブル一覧

| テーブル名 | 用途 | TTL | Point-in-Time Recovery |
|-----------|------|-----|----------------------|
| `tdnet_disclosures` | 開示情報メタデータ | なし | 有効 |
| `tdnet_executions` | データ収集実行状態 | 30日 | 有効 |
| `tdnet_export_status` | エクスポート状態 | 30日 | 有効 |

## 1. tdnet_disclosures テーブル

### 概要
TDnetから取得した開示情報のメタデータを保存します。

### モデル定義
**TypeScript型**: `Disclosure` (`src/types/index.ts`)

```typescript
interface Disclosure {
  disclosure_id: string;      // 開示ID（一意識別子）: 日付_企業コード_連番形式
  company_code: string;        // 企業コード（4桁の数字）
  company_name: string;        // 企業名
  disclosure_type: string;     // 開示種類（例: 決算短信、有価証券報告書、適時開示）
  title: string;               // タイトル
  disclosed_at: string;        // 開示日時（ISO 8601形式、UTC）: "2024-01-15T10:30:00Z"
  pdf_url?: string;            // PDF URL（オプショナル）
  pdf_s3_key?: string;         // S3キー（PDFファイルの保存先、オプショナル）
  downloaded_at: string;       // ダウンロード日時（ISO 8601形式、UTC）: "2024-01-15T10:35:00Z"
  date_partition: string;      // date_partition（YYYY-MM形式、JST基準）: "2024-01"
}
```

### DynamoDB定義

#### キー構造
| キー種別 | 属性名 | 型 | 説明 |
|---------|--------|-----|------|
| パーティションキー | `disclosure_id` | String | 開示ID（一意識別子） |

#### 属性一覧
| 属性名 | 型 | 必須 | 説明 | バリデーション |
|--------|-----|------|------|--------------|
| `disclosure_id` | String | ✓ | 開示ID | 日付_企業コード_連番形式 |
| `company_code` | String | ✓ | 企業コード | 4桁の数字 |
| `company_name` | String | ✓ | 企業名 | - |
| `disclosure_type` | String | ✓ | 開示種類 | - |
| `title` | String | ✓ | タイトル | - |
| `disclosed_at` | String | ✓ | 開示日時 | ISO 8601形式（UTC） |
| `pdf_url` | String | - | PDF URL | - |
| `pdf_s3_key` | String | - | S3キー | - |
| `downloaded_at` | String | ✓ | ダウンロード日時 | ISO 8601形式（UTC） |
| `date_partition` | String | ✓ | 月パーティション | YYYY-MM形式（JST基準） |

#### Global Secondary Index (GSI)

##### GSI_CompanyCode_DiscloseDate
企業コード別の開示情報を開示日時順に取得するためのインデックス。

| キー種別 | 属性名 | 型 |
|---------|--------|-----|
| パーティションキー | `company_code` | String |
| ソートキー | `disclosed_at` | String |
| プロジェクション | ALL | - |

**使用例**: 特定企業の開示情報を時系列で取得

##### GSI_DatePartition
月単位で開示情報を開示日時順に取得するためのインデックス。

| キー種別 | 属性名 | 型 |
|---------|--------|-----|
| パーティションキー | `date_partition` | String |
| ソートキー | `disclosed_at` | String |
| プロジェクション | ALL | - |

**使用例**: 特定月の開示情報を効率的に取得（月次レポート生成など）

#### CDK実装
**ファイル**: `cdk/lib/stacks/foundation-stack.ts`

```typescript
this.disclosuresTable = new dynamodb.Table(this, 'DisclosuresTable', {
  tableName: `tdnet_disclosures_${env}`,
  partitionKey: { name: 'disclosure_id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
  pointInTimeRecovery: true,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});

// GSI_CompanyCode_DiscloseDate
this.disclosuresTable.addGlobalSecondaryIndex({
  indexName: 'GSI_CompanyCode_DiscloseDate',
  partitionKey: { name: 'company_code', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'disclosed_at', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

// GSI_DatePartition
this.disclosuresTable.addGlobalSecondaryIndex({
  indexName: 'GSI_DatePartition',
  partitionKey: { name: 'date_partition', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'disclosed_at', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});
```

## 2. tdnet_executions テーブル

### 概要
データ収集処理の実行状態を保存します。TTL設定により30日後に自動削除されます。

### モデル定義
**TypeScript型**: `ExecutionStatus` (`src/types/index.ts`)

```typescript
interface ExecutionStatus {
  execution_id: string;        // 実行ID
  status: 'pending' | 'running' | 'completed' | 'failed';  // 状態
  started_at: string;          // 開始日時（ISO 8601形式、UTC）
  completed_at?: string;       // 終了日時（ISO 8601形式、UTC）
  progress: number;            // 進捗率（0〜100）
  success_count: number;       // 成功件数
  failed_count: number;        // 失敗件数
  error_message?: string;      // エラーメッセージ
  ttl: number;                 // TTL（Unix timestamp、30日後に自動削除）
}
```

### DynamoDB定義

#### キー構造
| キー種別 | 属性名 | 型 | 説明 |
|---------|--------|-----|------|
| パーティションキー | `execution_id` | String | 実行ID（一意識別子） |

#### 属性一覧
| 属性名 | 型 | 必須 | 説明 | バリデーション |
|--------|-----|------|------|--------------|
| `execution_id` | String | ✓ | 実行ID | UUID v4形式 |
| `status` | String | ✓ | 状態 | pending/running/completed/failed |
| `started_at` | String | ✓ | 開始日時 | ISO 8601形式（UTC） |
| `completed_at` | String | - | 終了日時 | ISO 8601形式（UTC） |
| `progress` | Number | ✓ | 進捗率 | 0〜100 |
| `success_count` | Number | ✓ | 成功件数 | 0以上 |
| `failed_count` | Number | ✓ | 失敗件数 | 0以上 |
| `error_message` | String | - | エラーメッセージ | - |
| `ttl` | Number | ✓ | TTL | Unix timestamp（30日後） |

#### Global Secondary Index (GSI)

##### GSI_Status_StartedAt
状態別の実行履歴を開始日時順に取得するためのインデックス。

| キー種別 | 属性名 | 型 |
|---------|--------|-----|
| パーティションキー | `status` | String |
| ソートキー | `started_at` | String |
| プロジェクション | ALL | - |

**使用例**: 実行中のジョブ一覧取得、失敗したジョブの調査

#### TTL設定
- **TTL属性**: `ttl`
- **保持期間**: 30日
- **自動削除**: TTL属性のUnix timestampを過ぎたアイテムは自動削除

#### CDK実装
**ファイル**: `cdk/lib/stacks/foundation-stack.ts`

```typescript
this.executionsTable = new dynamodb.Table(this, 'ExecutionsTable', {
  tableName: `tdnet_executions_${env}`,
  partitionKey: { name: 'execution_id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
  timeToLiveAttribute: 'ttl',
  pointInTimeRecovery: true,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});

// GSI_Status_StartedAt
this.executionsTable.addGlobalSecondaryIndex({
  indexName: 'GSI_Status_StartedAt',
  partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'started_at', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});
```

## 3. tdnet_export_status テーブル

### 概要
データエクスポート処理の状態を保存します。TTL設定により30日後に自動削除されます。

### モデル定義
**TypeScript型**: `ExportStatus` (`src/types/index.ts`)

```typescript
interface ExportStatus {
  export_id: string;           // エクスポートID
  status: 'pending' | 'processing' | 'completed' | 'failed';  // 状態
  requested_at: string;        // リクエスト日時（ISO 8601形式、UTC）
  completed_at?: string;       // 完了日時（ISO 8601形式、UTC）
  progress: number;            // 進捗率（0〜100）
  download_url?: string;       // ダウンロードURL（署名付きURL、有効期限7日）
  error_message?: string;      // エラーメッセージ
  ttl: number;                 // TTL（Unix timestamp、30日後に自動削除）
}
```

### DynamoDB定義

#### キー構造
| キー種別 | 属性名 | 型 | 説明 |
|---------|--------|-----|------|
| パーティションキー | `export_id` | String | エクスポートID（一意識別子） |

#### 属性一覧
| 属性名 | 型 | 必須 | 説明 | バリデーション |
|--------|-----|------|------|--------------|
| `export_id` | String | ✓ | エクスポートID | UUID v4形式 |
| `status` | String | ✓ | 状態 | pending/processing/completed/failed |
| `requested_at` | String | ✓ | リクエスト日時 | ISO 8601形式（UTC） |
| `completed_at` | String | - | 完了日時 | ISO 8601形式（UTC） |
| `progress` | Number | ✓ | 進捗率 | 0〜100 |
| `download_url` | String | - | ダウンロードURL | 署名付きURL（有効期限7日） |
| `error_message` | String | - | エラーメッセージ | - |
| `ttl` | Number | ✓ | TTL | Unix timestamp（30日後） |

#### Global Secondary Index (GSI)

##### GSI_Status_RequestedAt
状態別のエクスポート履歴をリクエスト日時順に取得するためのインデックス。

| キー種別 | 属性名 | 型 |
|---------|--------|-----|
| パーティションキー | `status` | String |
| ソートキー | `requested_at` | String |
| プロジェクション | ALL | - |

**使用例**: 処理中のエクスポートジョブ一覧取得、失敗したエクスポートの調査

#### TTL設定
- **TTL属性**: `ttl`
- **保持期間**: 30日
- **自動削除**: TTL属性のUnix timestampを過ぎたアイテムは自動削除

#### CDK実装
**ファイル**: `cdk/lib/stacks/foundation-stack.ts`

```typescript
this.exportStatusTable = new dynamodb.Table(this, 'ExportStatusTable', {
  tableName: `tdnet_export_status_${env}`,
  partitionKey: { name: 'export_id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
  timeToLiveAttribute: 'ttl',
  pointInTimeRecovery: true,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});

// GSI_Status_RequestedAt
this.exportStatusTable.addGlobalSecondaryIndex({
  indexName: 'GSI_Status_RequestedAt',
  partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'requested_at', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});
```

## 設計原則

### 1. コスト最適化
- **オンデマンド課金**: 予測不可能なトラフィックに対応
- **GSI最小限**: 必要なクエリパターンのみインデックス化
- **TTL活用**: 不要データの自動削除でストレージコスト削減

### 2. データ整合性
- **disclosure_id**: `generateDisclosureId()`で一意性保証
- **date_partition**: `generateDatePartition()`でJST基準のYYYY-MM形式生成
- **バリデーション**: Zodスキーマで必須フィールド検証

### 3. クエリパフォーマンス
- **GSI設計**: 頻繁なクエリパターンに最適化
- **プロジェクション**: ALL（全属性投影）で追加クエリ不要
- **ソートキー**: 時系列データの効率的な範囲検索

### 4. 運用性
- **Point-in-Time Recovery**: 全テーブルで有効化（データ保護）
- **暗号化**: AWS管理キーで保存時暗号化
- **RemovalPolicy**: RETAIN（誤削除防止）

## 関連ドキュメント

- **モデル定義**: `src/types/index.ts` - TypeScript型定義
- **Disclosureモデル**: `src/models/disclosure.ts` - 変換関数とバリデーション
- **date_partition生成**: `src/utils/date-partition.ts` - JST基準の月パーティション生成
- **disclosure_id生成**: `src/utils/disclosure-id.ts` - 一意識別子生成
- **CDK実装**: `cdk/lib/stacks/foundation-stack.ts` - DynamoDBテーブル定義
- **データバリデーション**: `.kiro/steering/development/data-validation.md` - バリデーションルール
