# Work Log: DynamoDB Table Definitions

**作業日時:** 2026-02-07 21:12:11  
**タスク:** task3.1 - DynamoDBテーブルをCDKで定義  
**担当:** Kiro

## タスク概要

### 目的
TDnet Data Collectorで使用するDynamoDBテーブルをAWS CDKで定義する。

### 背景
- Phase 1の基本機能として、開示情報メタデータと実行状態を保存するDynamoDBテーブルが必要
- 要件2.5, 13.3に基づき、適切なインデックス設計と暗号化を実装

### 目標
以下の2つのテーブルをCDKで定義：

1. **tdnet_disclosures** - 開示情報メタデータ
   - パーティションキー: disclosure_id
   - GSI_CompanyCode_DiscloseDate: company_code (PK) + disclosed_at (SK)
   - GSI_DatePartition: date_partition (PK) + disclosed_at (SK)
   - オンデマンドモード、暗号化有効化

2. **tdnet_executions** - 実行状態管理
   - パーティションキー: execution_id
   - GSI_Status_StartedAt: status (PK) + started_at (SK)
   - TTL有効化（30日後に自動削除）
   - オンデマンドモード、暗号化有効化

## 実施内容

### 実施した作業

#### 1. DynamoDBテーブル定義の実装

**ファイル:** `cdk/lib/tdnet-data-collector-stack.ts`

**実装内容:**

1. **tdnet_disclosures テーブル**
   - パーティションキー: `disclosure_id` (STRING)
   - ビリングモード: PAY_PER_REQUEST（オンデマンド）
   - 暗号化: AWS_MANAGED（AWS管理キー）
   - ポイントインタイムリカバリ: 有効
   - 削除ポリシー: RETAIN（本番環境保護）

   **GSI設定:**
   - `GSI_CompanyCode_DiscloseDate`
     - パーティションキー: `company_code` (STRING)
     - ソートキー: `disclosed_at` (STRING)
     - 投影タイプ: ALL（すべての属性）
   
   - `GSI_DatePartition`
     - パーティションキー: `date_partition` (STRING)
     - ソートキー: `disclosed_at` (STRING)
     - 投影タイプ: ALL

2. **tdnet_executions テーブル**
   - パーティションキー: `execution_id` (STRING)
   - ビリングモード: PAY_PER_REQUEST（オンデマンド）
   - 暗号化: AWS_MANAGED（AWS管理キー）
   - TTL属性: `ttl`（30日後に自動削除）
   - ポイントインタイムリカバリ: 有効
   - 削除ポリシー: RETAIN（本番環境保護）

   **GSI設定:**
   - `GSI_Status_StartedAt`
     - パーティションキー: `status` (STRING)
     - ソートキー: `started_at` (STRING)
     - 投影タイプ: ALL

3. **CloudFormation Outputs**
   - `DisclosuresTableName`: テーブル名をエクスポート
   - `ExecutionsTableName`: テーブル名をエクスポート

#### 2. TypeScript型チェック

- ✅ `getDiagnostics` で型エラーなしを確認
- ✅ CDKコンストラクトが正しく定義されている

### 設計上の考慮事項

#### コスト最適化
- **オンデマンドモード**: 予測不可能なトラフィックに対応し、無料枠を最大限活用
- **AWS管理キー**: カスタムKMSキーよりコストが低い
- **TTL設定**: 実行状態を30日後に自動削除し、ストレージコストを削減

#### パフォーマンス最適化
- **GSI_DatePartition**: 月単位のクエリを高速化（YYYY-MM形式）
- **GSI_CompanyCode_DiscloseDate**: 企業別の開示情報検索を高速化
- **GSI_Status_StartedAt**: 実行状態の監視クエリを高速化

#### セキュリティ
- **暗号化**: すべてのテーブルでAWS管理キーによる暗号化を有効化
- **ポイントインタイムリカバリ**: データ損失に対する保護
- **削除保護**: RETAIN ポリシーで誤削除を防止

#### データ整合性
- **date_partition**: JST基準のYYYY-MM形式で月単位のパーティショニング
- **TTL**: 実行状態の自動クリーンアップで古いデータを削除

### 問題と解決策

**問題なし** - 実装は順調に完了しました。


## 成果物

### 作成・変更したファイル

1. **cdk/lib/tdnet-data-collector-stack.ts**
   - DynamoDBテーブル定義を追加
   - tdnet_disclosures テーブル（2つのGSI付き）
   - tdnet_executions テーブル（1つのGSI、TTL有効化）
   - CloudFormation Outputs追加

### 検証結果

- ✅ TypeScript型チェック: エラーなし
- ✅ CDKコンストラクト: 正しく定義
- ✅ 要件2.5準拠: DynamoDBテーブル設計
- ✅ 要件13.3準拠: 暗号化有効化

## 次回への申し送り

### 完了した作業
- ✅ task3.1: DynamoDBテーブルをCDKで定義

### 次のタスク
- [ ] task3.2: DynamoDBテーブル構造の検証テスト（オプション）
- [ ] task4.1: S3バケットをCDKで定義

### 注意点

1. **デプロイ前の確認**
   - CDK Synthで CloudFormation テンプレートを生成して確認
   - テーブル名が正しいことを確認（tdnet_disclosures, tdnet_executions）

2. **GSIの使用方法**
   - `GSI_DatePartition`: 月単位のクエリに使用（例: "2024-01"）
   - `GSI_CompanyCode_DiscloseDate`: 企業別の開示情報検索に使用
   - `GSI_Status_StartedAt`: 実行状態の監視に使用

3. **TTLの設定**
   - `ttl` 属性にUnixタイムスタンプ（秒）を設定
   - 実行状態は30日後に自動削除される

4. **コスト管理**
   - オンデマンドモードは予測不可能なトラフィックに適している
   - 定常的なトラフィックが予測できる場合は、プロビジョニングモードへの変更を検討

### 関連ドキュメント
- 要件定義書: 要件2.5（データベース）、要件13.3（暗号化）
- 実装ルール: date_partition設計原則
- パフォーマンス最適化: DynamoDBクエリ最適化

---

**作業完了時刻:** 2026-02-07 21:12:11  
**所要時間:** 約15分  
**ステータス:** ✅ 完了
