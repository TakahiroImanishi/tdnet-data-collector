# Work Log: Task 15.17 - Architecture Design Document Update

**作成日時**: 2026-02-08 17:05:22  
**タスク**: 15.17 アーキテクチャ設計書の更新  
**担当**: AI Assistant

---

## タスク概要

### 目的
アーキテクチャ設計書（architecture.md）の不整合を修正し、実装との整合性を確保する。

### 背景
- architecture-discrepancies-20260208.mdで特定された5つの不整合が存在
- Lambda関数数、date_partition形式、GSI名、セキュリティベストプラクティス、CloudFormation Outputsの記載が不正確

### 目標
1. Lambda関数リストを7個に更新（現状: 3個）
2. date_partitionの形式を`YYYY-MM`に統一（現状: YYYY-MM-DD）
3. DynamoDB GSI名を`GSI_DatePartition`に修正（現状: GSI_DateRange）
4. API Keyのセキュリティベストプラクティスを明記
5. CloudFormation Outputsの詳細を追加

---

## 実施内容

### 1. 現状確認

アーキテクチャ設計書（design.md）を確認しました。

**確認結果:**
- ファイルパス: `.kiro/specs/tdnet-data-collector/docs/design.md`（3106行）
- 不整合レポート: `architecture-discrepancies-20260208.md`を参照

**修正が必要な箇所:**
1. Lambda関数リスト（行46-48）: 3個 → 7個に更新
2. GSI名（行663）: `GSI_DateRange` → `GSI_DatePartition`
3. date_partition形式（複数箇所）: `YYYY-MM-DD` → `YYYY-MM`
   - 行664: GSI定義
   - 行1477: Disclosureインターフェース
   - 行1515: generateDatePartition関数のコメント
   - 行1585-1586: QueryFilterインターフェース（これは日付範囲なのでYYYY-MM-DDのまま）
4. API Keyセキュリティベストプラクティス: 新規セクション追加
5. CloudFormation Outputs: 詳細を追加

### 2. アーキテクチャ設計書の更新

#### 2.1 Lambda関数リストの更新（3個 → 7個）


システム構成図のLambda関数を3個から7個に更新しました。

**変更内容:**
- Lambda: Collector (15分, 512MB)
- Lambda: Query (30秒, 256MB)
- Lambda: Export (5分, 512MB)
- Lambda: Collect (30秒, 256MB) - 新規追加
- Lambda: Collect Status (30秒, 256MB) - 新規追加
- Lambda: Export Status (30秒, 256MB) - 新規追加
- Lambda: PDF Download (30秒, 256MB) - 新規追加

#### 2.2 GSI名の修正（GSI_DateRange → GSI_DatePartition）

DynamoDBテーブル定義のGSI名を実装に合わせて修正しました。

**変更箇所:**
- 行663: `GSI_DateRange` → `GSI_DatePartition`
- パーティションキー: `date_partition` (YYYY-MM形式)
- 用途: 月単位での効率的な検索

#### 2.3 date_partition形式の統一（YYYY-MM-DD → YYYY-MM）

date_partitionの形式を月単位（YYYY-MM）に統一しました。

**変更箇所:**
1. 行664: GSI定義のコメント
   - `YYYY-MM-DD形式` → `YYYY-MM形式`
   - 備考: 「日単位でパーティション分割」→「月単位でパーティション分割」

2. 行1477: Disclosureインターフェースのコメント
   - `date_partition: string; // 日付パーティション（YYYY-MM-DD形式）`
   - → `date_partition: string; // 日付パーティション（YYYY-MM形式）`

3. 行1515-1530: generateDatePartition関数
   - 戻り値: `YYYY-MM-DD形式` → `YYYY-MM形式`
   - 例: `'2024-01-15'` → `'2024-01'`
   - 実装: `substring(0, 10)` → `substring(0, 7)`
   - バリデーション: `new Date(partition)` → `new Date(partition + '-01')`

**注意:** QueryFilterインターフェースの`start_date`と`end_date`は日付範囲指定のため、YYYY-MM-DD形式のまま維持しました。

#### 2.4 API Keyセキュリティベストプラクティスの追加

Secrets Managerセクションの後に、API Keyのセキュリティベストプラクティスを追加しました。

**追加内容:**
- ✅ 推奨: Secrets Manager ARNを環境変数に設定
- ❌ 非推奨: シークレット値を直接環境変数に設定
- セキュリティ上の理由（4点）:
  1. ログ露出の防止
  2. コンソール露出の防止
  3. 監査証跡
  4. ローテーション対応

**コード例:**
```typescript
// ✅ 推奨
environment: {
    API_KEY_SECRET_ARN: apiKeySecret.secretArn,
}

// ❌ 非推奨
environment: {
    API_KEY: apiKeySecret.secretValue.unsafeUnwrap(),
}
```

#### 2.5 CloudFormation Outputsの詳細追加

デプロイ戦略セクションの後に、CloudFormation Outputsの詳細セクションを追加しました。

**追加内容:**
- CDK実装例（13個のOutputs）
- Outputs一覧表（名前、説明、用途）
- Outputsの取得方法（AWS CLI、CDK CLI）

**主要なOutputs:**
1. ApiEndpoint - API Gateway URL
2. DisclosuresTableName - 開示情報テーブル名
3. ExecutionsTableName - 実行状態テーブル名
4. PdfBucketName - PDFバケット名
5. ExportBucketName - エクスポートバケット名
6. DashboardBucketName - ダッシュボードバケット名
7. CollectorFunctionName/Arn - Collector関数
8. QueryFunctionName - Query関数
9. ExportFunctionName - Export関数
10. CloudFrontUrl - CloudFront URL
11. ApiKeySecretArn - APIキーシークレットARN
12. DashboardUrl - CloudWatchダッシュボードURL

### 3. 検証

すべての変更箇所を確認しました。

**修正完了:**
- ✅ Lambda関数リスト: 3個 → 7個
- ✅ GSI名: `GSI_DateRange` → `GSI_DatePartition`
- ✅ date_partition形式: `YYYY-MM-DD` → `YYYY-MM`（3箇所）
- ✅ API Keyセキュリティベストプラクティス: 新規セクション追加
- ✅ CloudFormation Outputs: 詳細セクション追加

**変更されていない箇所（意図的）:**
- QueryFilterの`start_date`/`end_date`: YYYY-MM-DD形式のまま（日付範囲指定のため）
- scrapeTdnetList関数の`@param date`: YYYY-MM-DD形式のまま（日単位の指定のため）

---

## 成果物

### 変更したファイル

1. `.kiro/specs/tdnet-data-collector/docs/design.md`
   - Lambda関数リストを7個に更新
   - GSI名を`GSI_DatePartition`に修正
   - date_partition形式を`YYYY-MM`に統一
   - API Keyセキュリティベストプラクティスを追加
   - CloudFormation Outputsの詳細を追加

### 作成したファイル

1. `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260208-170522-task15-17-architecture-doc-update.md`
   - 本作業記録

---

## 次回への申し送り

### 完了事項

- ✅ アーキテクチャ設計書の5つの不整合をすべて修正
- ✅ 実装との整合性を確保
- ✅ セキュリティベストプラクティスを明記
- ✅ CloudFormation Outputsの詳細を追加

### 注意事項

1. **date_partition形式の統一**
   - 設計書では`YYYY-MM`形式に統一
   - 実装でも`YYYY-MM`形式を使用していることを確認済み
   - QueryFilterの日付範囲指定は`YYYY-MM-DD`形式のまま（意図的）

2. **API Keyセキュリティ**
   - 実装でも`API_KEY_SECRET_ARN`を使用するよう推奨
   - `unsafeUnwrap()`の使用は避けるべき

3. **Lambda関数の追加**
   - 設計書に7個すべての関数を記載
   - 各関数のタイムアウトとメモリサイズを明記

### 今後の対応

- タスク15.17を完了としてマーク
- tasks.mdを更新
- Gitコミット＆プッシュ
