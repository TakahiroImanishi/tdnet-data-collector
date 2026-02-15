# Lambda関数 ドキュメント・実装整合性チェック

**作業日時:** 2026-02-15 10:04:45  
**作業者:** AI Assistant  
**作業概要:** Lambda関数のドキュメントと実装の整合性を検証

## 作業目的

以下の観点でLambda関数のドキュメントと実装の整合性をチェック：
1. Lambda関数の実装状況確認
2. ドキュメントとの照合
3. CDK定義との照合
4. 不整合の報告

## 調査結果

### 1. Lambda関数実装状況

#### 実装済みLambda関数（8個）

| 関数名 | ディレクトリ | handler.ts | index.ts | 状態 |
|--------|------------|-----------|----------|------|
| Collector | `src/lambda/collector/` | ✅ | ✅ | 実装済み |
| Query | `src/lambda/query/` | ✅ | ✅ | 実装済み |
| Export | `src/lambda/export/` | ✅ | ✅ | 実装済み |
| Collect | `src/lambda/collect/` | ✅ | ✅ | 実装済み |
| Collect Status | `src/lambda/collect-status/` | ✅ | ✅ | 実装済み |
| Get Disclosure | `src/lambda/get-disclosure/` | ✅ | ✅ | 実装済み |
| Health | `src/lambda/health/` | ✅ | ✅ | 実装済み |
| Stats | `src/lambda/stats/` | ✅ | ✅ | 実装済み |

#### 実装済み（特殊）Lambda関数（2個）

| 関数名 | ディレクトリ | 実装形式 | 状態 |
|--------|------------|---------|------|
| API Key Rotation | `src/lambda/api-key-rotation/` | index.tsに直接実装 | 実装済み |
| DLQ Processor | `src/lambda/dlq-processor/` | index.tsに直接実装 | 実装済み |

#### 未実装Lambda関数（1個）

| 関数名 | ディレクトリ | 状態 | 備考 |
|--------|------------|------|------|
| API | `src/lambda/api/` | ❌ 未実装 | ディレクトリは存在するがファイルなし |

### 2. ドキュメントとの照合

#### design.md記載のLambda関数

design.mdには以下の記載があります：

> **詳細**: 9個のLambda関数（Collector, Query, Export, Collect, Collect Status, Export Status, PDF Download, Health, Stats）が存在。

**不整合点:**
1. ❌ **Export Status** - ドキュメントに記載されているが実装なし
2. ❌ **PDF Download** - ドキュメントに記載されているが実装なし
3. ✅ **API Key Rotation** - 実装されているがドキュメントに記載なし
4. ✅ **DLQ Processor** - 実装されているがドキュメントに記載なし
5. ❌ **API** - ディレクトリは存在するが実装なし、ドキュメントにも記載なし

#### コンポーネント設計との照合

design.mdの「Components」セクションには以下が記載：

| ドキュメント記載 | 実装状況 | 備考 |
|----------------|---------|------|
| Lambda Collector | ✅ 実装済み | 一致 |
| Lambda Query | ✅ 実装済み | 一致 |
| Lambda Export | ✅ 実装済み | 一致 |

**不整合点:**
- Collect, Collect Status, Get Disclosure, Health, Stats関数の詳細説明がない
- API Key Rotation, DLQ Processorの説明がない

### 3. CDK定義との照合

#### CDK Compute Stackで定義されているLambda関数（9個）

| CDK定義名 | 関数名 | エントリーポイント | 実装状況 |
|----------|--------|------------------|---------|
| CollectorFunction | `tdnet-collector-${env}` | `src/lambda/collector/handler.ts` | ✅ 実装済み |
| QueryFunction | `tdnet-query-${env}` | `src/lambda/query/handler.ts` | ✅ 実装済み |
| ExportFunction | `tdnet-export-${env}` | `src/lambda/export/handler.ts` | ✅ 実装済み |
| CollectFunction | `tdnet-collect-${env}` | `src/lambda/collect/handler.ts` | ✅ 実装済み |
| CollectStatusFunction | `tdnet-collect-status-${env}` | `src/lambda/collect-status/handler.ts` | ✅ 実装済み |
| ExportStatusFunction | `tdnet-export-status-${env}` | `src/lambda/api/export-status/handler.ts` | ✅ 実装済み |
| PdfDownloadFunction | `tdnet-pdf-download-${env}` | `src/lambda/api/pdf-download/handler.ts` | ✅ 実装済み |
| HealthFunction | `tdnet-health-${env}` | `src/lambda/health/handler.ts` | ✅ 実装済み |
| StatsFunction | `tdnet-stats-${env}` | `src/lambda/stats/handler.ts` | ✅ 実装済み |

#### CDK API Stackで使用されているLambda関数

| エンドポイント | メソッド | Lambda関数 | 実装状況 |
|--------------|---------|-----------|---------|
| `/disclosures` | GET | QueryFunction | ✅ 実装済み |
| `/exports` | POST | ExportFunction | ✅ 実装済み |
| `/exports/{export_id}` | GET | ExportStatusFunction | ✅ 実装済み |
| `/collect` | POST | CollectFunction | ✅ 実装済み |
| `/collect/{execution_id}` | GET | CollectStatusFunction | ✅ 実装済み |
| `/disclosures/{disclosure_id}/pdf` | GET | PdfDownloadFunction | ✅ 実装済み |
| `/health` | GET | HealthFunction | ✅ 実装済み |
| `/stats` | GET | StatsFunction | ✅ 実装済み |

#### CDKで定義されていないLambda関数（2個）

| 関数名 | ディレクトリ | 実装状況 | 備考 |
|--------|------------|---------|------|
| API Key Rotation | `src/lambda/api-key-rotation/` | ✅ 実装済み | Secrets Managerローテーション用（CDKで別途定義の可能性） |
| DLQ Processor | `src/lambda/dlq-processor/` | ✅ 実装済み | DLQメッセージ処理用（CDKで別途定義の可能性） |

### 4. 不整合の詳細分析

#### 4.1 ドキュメント vs 実装の不整合

**design.mdの記載:**
> **詳細**: 9個のLambda関数（Collector, Query, Export, Collect, Collect Status, Export Status, PDF Download, Health, Stats）が存在。

**実際の実装:**
- ✅ Collector - 実装済み
- ✅ Query - 実装済み
- ✅ Export - 実装済み
- ✅ Collect - 実装済み
- ✅ Collect Status - 実装済み
- ✅ Export Status - 実装済み（`src/lambda/api/export-status/`）
- ✅ PDF Download - 実装済み（`src/lambda/api/pdf-download/`）
- ✅ Health - 実装済み
- ✅ Stats - 実装済み
- ✅ API Key Rotation - 実装済み（ドキュメント未記載）
- ✅ DLQ Processor - 実装済み（ドキュメント未記載）

**結論:** design.mdの記載は正確（9個）だが、実際には11個のLambda関数が実装されている。

#### 4.2 ディレクトリ構造の不整合

**tdnet-implementation-rules.mdの記載:**
```
- **src/lambda/**: 11個のLambda関数
  - `collector/` - TDnetスクレイピング・データ収集
  - `query/` - データクエリAPI
  - `export/` - データエクスポート
  - `api/` - API Gateway統合
  - `get-disclosure/` - 個別開示取得
  - `collect-status/` - 収集ステータス確認
  - `stats/` - 統計情報
  - `health/` - ヘルスチェック
  - `dlq-processor/` - DLQメッセージ処理
  - `api-key-rotation/` - APIキーローテーション
```

**実際のディレクトリ構造:**
```
src/lambda/
├── collector/          ✅ 実装済み
├── query/              ✅ 実装済み
├── export/             ✅ 実装済み
├── collect/            ✅ 実装済み
├── collect-status/     ✅ 実装済み
├── get-disclosure/     ✅ 実装済み
├── health/             ✅ 実装済み
├── stats/              ✅ 実装済み
├── api-key-rotation/   ✅ 実装済み
├── dlq-processor/      ✅ 実装済み
└── api/                ⚠️ サブディレクトリのみ
    ├── export-status/  ✅ 実装済み
    └── pdf-download/   ✅ 実装済み
```

**不整合点:**
1. ❌ `api/` ディレクトリは独立したLambda関数ではなく、`export-status/`と`pdf-download/`のコンテナディレクトリ
2. ❌ tdnet-implementation-rules.mdでは`api/`を「API Gateway統合」と説明しているが、実際には2つのサブ関数を含むディレクトリ
3. ❌ `get-disclosure/` ディレクトリは存在するが、CDKで使用されていない（未使用の可能性）

#### 4.3 Lambda関数の設定値照合

**design.mdの記載:**

| 関数タイプ | メモリ | タイムアウト |
|-----------|--------|------------|
| Collector（スクレイピング） | 512MB | 15分 |
| Query（API） | 256MB | 30秒 |
| Export（大量データ） | 1024MB | 5分 |

**CDK Compute Stackの実装:**

| 関数名 | メモリ | タイムアウト | 一致 |
|--------|--------|------------|------|
| Collector | `envConfig.collector.memorySize` | `envConfig.collector.timeout` | ⚠️ 環境設定依存 |
| Query | `envConfig.query.memorySize` | `envConfig.query.timeout` | ⚠️ 環境設定依存 |
| Export | `envConfig.export.memorySize` | `envConfig.export.timeout` | ⚠️ 環境設定依存 |

**注:** CDKでは環境設定ファイル（`environment-config.ts`）から値を読み込んでいるため、実際の値を確認する必要があります。

#### 4.4 環境変数の照合

**lambda-implementation.mdの記載:**
```typescript
const required = ['S3_BUCKET_NAME', 'DYNAMODB_TABLE_NAME', 'ALERT_TOPIC_ARN'];
```

**CDK Compute Stackの実装（Collector関数の例）:**
```typescript
environment: {
  DYNAMODB_TABLE: props.disclosuresTable.tableName,
  DYNAMODB_EXECUTIONS_TABLE: props.executionsTable.tableName,
  S3_BUCKET: props.pdfsBucket.bucketName,
  TDNET_BASE_URL: 'https://www.release.tdnet.info/inbs',
  LOG_LEVEL: envConfig.collector.logLevel,
  ENVIRONMENT: env,
  NODE_OPTIONS: '--enable-source-maps',
}
```

**不整合点:**
1. ❌ 環境変数名が異なる:
   - ドキュメント: `S3_BUCKET_NAME` → CDK: `S3_BUCKET`
   - ドキュメント: `DYNAMODB_TABLE_NAME` → CDK: `DYNAMODB_TABLE`
   - ドキュメント: `ALERT_TOPIC_ARN` → CDK: 設定なし（Collector関数には不要）

2. ✅ Query関数の環境変数は一致:
   - `DYNAMODB_TABLE_NAME`
   - `S3_BUCKET_NAME`
   - `LOG_LEVEL`
   - `ENVIRONMENT`

#### 4.5 DLQ設定の照合

**error-handling-patterns.mdの記載:**
> - [ ] DLQ設定（非同期Lambda/SQSのみ。API Gateway統合Lambdaは不要）

**CDK Compute Stackの実装:**
```typescript
// Collector関数のみDLQ設定あり
deadLetterQueue: this.dlq.queue,
deadLetterQueueEnabled: true,
retryAttempts: 2,
```

**照合結果:**
- ✅ Collector関数: DLQ設定あり（非同期実行のため適切）
- ✅ Query, Export, Collect, CollectStatus, ExportStatus, PdfDownload, Health, Stats: DLQ設定なし（API Gateway統合のため適切）

### 5. 未使用・未実装の可能性がある関数

#### 5.1 get-disclosure関数

**状況:**
- ✅ ディレクトリ存在: `src/lambda/get-disclosure/`
- ✅ 実装ファイル存在: `handler.ts`, `index.ts`
- ❌ CDKで定義なし
- ❌ API Gatewayエンドポイントなし

**推測:**
- 開発途中で作成されたが、最終的に`pdf-download`関数に統合された可能性
- または、将来的に使用予定の関数

**推奨アクション:**
- 使用されていない場合は削除を検討
- 使用予定の場合はドキュメントに記載

#### 5.2 api-key-rotation関数

**状況:**
- ✅ 実装済み: `src/lambda/api-key-rotation/index.ts`
- ❌ CDK Compute Stackで定義なし
- ⚠️ Secrets Managerのローテーション機能で使用される可能性

**推測:**
- Foundation StackまたはMonitoring Stackで定義されている可能性
- Secrets Managerのローテーション設定で直接参照されている可能性

**推奨アクション:**
- Foundation StackまたはMonitoring Stackを確認
- ドキュメントに記載を追加

#### 5.3 dlq-processor関数

**状況:**
- ✅ 実装済み: `src/lambda/dlq-processor/index.ts`
- ❌ CDK Compute Stackで定義なし
- ⚠️ DLQのイベントソースとして使用される可能性

**推測:**
- Monitoring Stackで定義されている可能性
- LambdaDLQ Constructで定義されている可能性

**推奨アクション:**
- Monitoring StackまたはLambdaDLQ Constructを確認
- ドキュメントに記載を追加

## 問題点のまとめ

### 重大な不整合（要修正）

1. **ドキュメントのLambda関数数が不正確**
   - design.md: 9個と記載
   - 実際: 11個実装済み（API Key Rotation, DLQ Processorが未記載）

2. **ディレクトリ構造の説明が不正確**
   - tdnet-implementation-rules.md: `api/`を独立したLambda関数として記載
   - 実際: `api/`は`export-status/`と`pdf-download/`のコンテナディレクトリ

3. **環境変数名の不一致**
   - lambda-implementation.md: `S3_BUCKET_NAME`, `DYNAMODB_TABLE_NAME`
   - CDK（Collector関数）: `S3_BUCKET`, `DYNAMODB_TABLE`

### 中程度の不整合（要確認）

4. **未使用の可能性がある関数**
   - `get-disclosure/` ディレクトリは存在するがCDKで使用されていない

5. **CDK定義の場所が不明な関数**
   - `api-key-rotation/` - Foundation/Monitoring Stackで定義されている可能性
   - `dlq-processor/` - Monitoring Stack/LambdaDLQ Constructで定義されている可能性

6. **Lambda関数の詳細説明不足**
   - design.mdのComponentsセクションに、Collect, Collect Status, Get Disclosure, Health, Stats, API Key Rotation, DLQ Processorの詳細説明がない

### 軽微な不整合（要改善）

7. **メモリ・タイムアウト設定の確認不足**
   - CDKでは環境設定ファイルから読み込んでいるため、実際の値を確認する必要がある

## 推奨される修正アクション

### 優先度: 高

1. **design.mdの更新**
   - Lambda関数数を9個→11個に修正
   - API Key Rotation, DLQ Processorの説明を追加
   - Componentsセクションに全Lambda関数の詳細を追加

2. **tdnet-implementation-rules.mdの更新**
   - `api/`ディレクトリの説明を修正（独立した関数ではなく、サブディレクトリのコンテナ）
   - 実際のディレクトリ構造に合わせて更新

3. **lambda-implementation.mdの更新**
   - 環境変数名をCDK実装に合わせて修正
   - または、CDK実装を統一された命名規則に修正

### 優先度: 中

4. **get-disclosure関数の調査**
   - 使用されていない場合は削除
   - 使用予定の場合はドキュメントに記載

5. **api-key-rotation, dlq-processor関数のCDK定義確認**
   - Foundation Stack, Monitoring Stack, LambdaDLQ Constructを確認
   - 定義場所をドキュメントに記載

6. **環境設定ファイルの確認**
   - `cdk/lib/config/environment-config.ts`を確認
   - 実際のメモリ・タイムアウト設定値をドキュメントに反映

### 優先度: 低

7. **API設計ドキュメントの更新**
   - api-design-guidelines.mdのエンドポイント一覧を実装に合わせて更新
   - `/disclosures/{disclosure_id}/pdf`エンドポイントを追加

## 次のステップ

1. Foundation Stack, Monitoring Stackを確認
2. 環境設定ファイル（`environment-config.ts`）を確認
3. 不整合箇所の修正計画を立案
4. ドキュメント更新作業を実施



## 補足調査: 環境設定ファイルの確認

### environment-config.tsの実際の設定値

#### 開発環境（dev）

| 関数名 | メモリ | タイムアウト | ログレベル |
|--------|--------|------------|-----------|
| Collector | 256MB | 5分（300秒） | DEBUG |
| Query | 128MB | 10秒 | DEBUG |
| Export | 256MB | 2分（120秒） | DEBUG |
| Collect | 256MB | 30秒 | DEBUG |
| CollectStatus | 256MB | 30秒 | DEBUG |
| ExportStatus | 256MB | 30秒 | DEBUG |
| PdfDownload | 256MB | 30秒 | DEBUG |
| Health | 128MB | 10秒 | DEBUG |
| Stats | 256MB | 30秒 | DEBUG |

#### 本番環境（prod）

| 関数名 | メモリ | タイムアウト | ログレベル |
|--------|--------|------------|-----------|
| Collector | 512MB | 15分（900秒） | DEBUG |
| Query | 256MB | 30秒 | DEBUG |
| Export | 512MB | 5分（300秒） | DEBUG |
| Collect | 256MB | 30秒 | DEBUG |
| CollectStatus | 256MB | 30秒 | DEBUG |
| ExportStatus | 256MB | 30秒 | DEBUG |
| PdfDownload | 256MB | 30秒 | DEBUG |
| Health | 128MB | 10秒 | DEBUG |
| Stats | 256MB | 30秒 | DEBUG |

### design.mdとの比較

**design.mdの記載:**

| 関数タイプ | メモリ | タイムアウト |
|-----------|--------|------------|
| Collector（スクレイピング） | 512MB | 15分 |
| Query（API） | 256MB | 30秒 |
| Export（大量データ） | 1024MB | 5分 |

**実際の設定（prod）:**

| 関数タイプ | メモリ | タイムアウト | 一致 |
|-----------|--------|------------|------|
| Collector | 512MB | 15分 | ✅ 一致 |
| Query | 256MB | 30秒 | ✅ 一致 |
| Export | 512MB | 5分 | ❌ 不一致（ドキュメント: 1024MB） |

**不整合点:**
- Export関数のメモリサイズ: ドキュメントでは1024MBと記載されているが、実際の設定は512MB

### lambda-implementation.mdとの比較

**lambda-implementation.mdの記載:**

| 関数タイプ | メモリ | タイムアウト |
|-----------|--------|------------|
| Collector（スクレイピング） | 512MB | 15分 |
| Parser（PDF解析） | 1024MB | 5分 |
| Query（API） | 256MB | 30秒 |
| Export（大量データ） | 1024MB | 15分 |

**実際の設定（prod）:**

| 関数タイプ | メモリ | タイムアウト | 一致 |
|-----------|--------|------------|------|
| Collector | 512MB | 15分 | ✅ 一致 |
| Parser | - | - | ❌ 関数なし |
| Query | 256MB | 30秒 | ✅ 一致 |
| Export | 512MB | 5分 | ❌ 不一致（メモリ: 1024MB→512MB、タイムアウト: 15分→5分） |

**不整合点:**
1. Parser関数: ドキュメントに記載されているが実装なし
2. Export関数: メモリサイズとタイムアウトが異なる

## 最終まとめ

### 発見された不整合の総数: 10件

#### 重大な不整合（5件）

1. **Lambda関数数の不一致**
   - design.md: 9個 → 実際: 11個

2. **ディレクトリ構造の説明不正確**
   - `api/`ディレクトリの説明が不正確

3. **環境変数名の不一致**
   - Collector関数: `S3_BUCKET_NAME`→`S3_BUCKET`, `DYNAMODB_TABLE_NAME`→`DYNAMODB_TABLE`

4. **Export関数のメモリサイズ不一致**
   - design.md: 1024MB → 実際: 512MB

5. **Export関数のタイムアウト不一致**
   - lambda-implementation.md: 15分 → 実際: 5分

#### 中程度の不整合（3件）

6. **未使用の関数**
   - `get-disclosure/` ディレクトリは存在するがCDKで使用されていない

7. **CDK定義場所不明**
   - `api-key-rotation/`, `dlq-processor/`のCDK定義が不明

8. **Parser関数の記載**
   - lambda-implementation.mdに記載されているが実装なし

#### 軽微な不整合（2件）

9. **Lambda関数の詳細説明不足**
   - design.mdのComponentsセクションに一部関数の説明がない

10. **API設計ドキュメントの更新漏れ**
    - api-design-guidelines.mdに`/disclosures/{disclosure_id}/pdf`エンドポイントの記載がない

## 成果物

1. ✅ Lambda関数の実装状況一覧（11個）
2. ✅ CDK定義との照合結果（9個定義、2個未確認）
3. ✅ ドキュメントとの不整合リスト（10件）
4. ✅ 環境設定ファイルの実際の値
5. ✅ 推奨される修正アクション（優先度付き）

## 申し送り事項

### 次のタスクで実施すべきこと

1. **Foundation Stack, Monitoring Stackの確認**
   - `api-key-rotation`, `dlq-processor`のCDK定義を確認
   - LambdaDLQ Constructの実装を確認

2. **ドキュメント更新作業**
   - design.mdの更新（Lambda関数数、Export関数のメモリサイズ）
   - tdnet-implementation-rules.mdの更新（ディレクトリ構造）
   - lambda-implementation.mdの更新（環境変数名、Export関数の設定、Parser関数の削除）
   - api-design-guidelines.mdの更新（エンドポイント一覧）

3. **未使用関数の調査**
   - `get-disclosure/`関数の使用状況を確認
   - 使用されていない場合は削除を検討

4. **環境変数名の統一**
   - Collector関数の環境変数名を統一するか検討
   - または、ドキュメントを実装に合わせて修正

### 作業時間

- 調査開始: 2026-02-15 10:04:45
- 調査完了: 2026-02-15 10:15:00（推定）
- 所要時間: 約10分

### 参照ファイル

- `.kiro/specs/tdnet-data-collector/docs/01-requirements/design.md`
- `.kiro/specs/tdnet-data-collector/docs/02-implementation/README.md`
- `.kiro/steering/core/tdnet-implementation-rules.md`
- `.kiro/steering/development/lambda-implementation.md`
- `.kiro/steering/api/api-design-guidelines.md`
- `cdk/lib/stacks/compute-stack.ts`
- `cdk/lib/stacks/api-stack.ts`
- `cdk/lib/config/environment-config.ts`
- `src/lambda/*/handler.ts`（11個のLambda関数）

---

**作業完了**
