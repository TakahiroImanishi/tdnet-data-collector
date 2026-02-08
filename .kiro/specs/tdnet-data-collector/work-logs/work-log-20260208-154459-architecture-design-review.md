# 作業記録: アーキテクチャ設計書レビューと更新

**作成日時**: 2026-02-08 15:44:59  
**タスク**: アーキテクチャ設計書レビューと更新  
**関連タスク**: `.kiro/specs/tdnet-data-collector/tasks.md`

---

## タスク概要

### 目的
実装コードとアーキテクチャ設計書の整合性を確認し、差分があれば設計書を更新する。

### 背景
- 実装が進む中で、設計書と実装の間に差分が生じている可能性がある
- 正確な設計書を維持することで、プロジェクトの理解と保守性を向上させる

### 目標
1. CDKスタック定義、Lambda関数、DynamoDB、S3の実装を確認
2. 設計書との差分を特定
3. 設計書を実装に合わせて更新

---

## 実施内容

### 1. 実装コードの確認

#### 確認対象
- [x] `cdk/lib/` 配下のスタック定義
- [x] Lambda関数の構成（メモリ、タイムアウト、環境変数）
- [x] DynamoDBテーブル設計（GSI含む）
- [x] S3バケット設定
- [x] IAMロール・ポリシー

#### 確認結果

**CDKスタック構成:**
- ファイル: `cdk/lib/tdnet-data-collector-stack.ts` (1193行)
- スタッククラス: `TdnetDataCollectorStack`

**DynamoDBテーブル (3個):**
1. `tdnet_disclosures` - 開示情報メタデータ
   - パーティションキー: `disclosure_id`
   - GSI: `GSI_CompanyCode_DiscloseDate` (company_code + disclosed_at)
   - GSI: `GSI_DatePartition` (date_partition + disclosed_at)
2. `tdnet_executions` - 実行状態管理
   - パーティションキー: `execution_id`
   - GSI: `GSI_Status_StartedAt` (status + started_at)
   - TTL: 有効 (30日後に自動削除)
3. `tdnet_export_status` - エクスポート状態管理
   - パーティションキー: `export_id`
   - GSI: `GSI_Status_RequestedAt` (status + requested_at)
   - TTL: 有効 (30日後に自動削除)

**S3バケット (4個):**
1. `tdnet-data-collector-pdfs-{account}` - PDFファイル保存
   - ライフサイクル: 90日後にStandard-IA、365日後にGlacier
2. `tdnet-data-collector-exports-{account}` - エクスポートファイル
   - ライフサイクル: 7日後に自動削除
3. `tdnet-dashboard-{account}` - Webダッシュボード
4. `tdnet-cloudtrail-logs-{account}` - 監査ログ
   - ライフサイクル: 90日後にGlacier、2555日(7年)後に削除

**Lambda関数 (7個):**
1. `tdnet-collector` - データ収集 (15分, 512MB)
2. `tdnet-query` - データクエリ (30秒, 256MB)
3. `tdnet-export` - データエクスポート (5分, 512MB)
4. `tdnet-collect` - 収集トリガー (30秒, 256MB)
5. `tdnet-collect-status` - 収集状態取得 (30秒, 256MB)
6. `tdnet-export-status` - エクスポート状態取得 (30秒, 256MB)
7. `tdnet-pdf-download` - PDF署名付きURL生成 (30秒, 256MB)

**API Gateway:**
- REST API: `tdnet-data-collector-api`
- エンドポイント:
  - `GET /disclosures` → queryFunction
  - `POST /exports` → exportFunction
  - `GET /exports/{export_id}` → exportStatusFunction
  - `POST /collect` → collectFunction
  - `GET /collect/{execution_id}` → collectStatusFunction
  - `GET /disclosures/{disclosure_id}/pdf` → pdfDownloadFunction

**AWS WAF:**
- Web ACL: `tdnet-web-acl`
- ルール: レート制限(2000req/5min)、AWSマネージドルール

### 2. 設計書との差分確認

#### 差分リスト

**重大な差分:**

1. **設計書が存在しない**
   - 期待: `.kiro/specs/tdnet-data-collector/design/architecture.md`
   - 実際: ファイルが存在しない（`design/`ディレクトリ自体が存在しない）
   - 実際の場所: `.kiro/specs/tdnet-data-collector/docs/design.md`

2. **DynamoDB GSIの命名差異**
   - 設計書: `GSI_DateRange` (date_partition + disclosed_at)
   - 実装: `GSI_DatePartition` (date_partition + disclosed_at)
   - 影響: 命名のみの差異、機能は同じ

3. **Lambda関数の追加**
   - 設計書に記載なし: `tdnet-export-status`, `tdnet-pdf-download`
   - 実装: 7個のLambda関数が存在
   - 理由: API設計の詳細化により追加された

4. **API Keyの環境変数設定方法**
   - 設計書: `API_KEY_SECRET_ARN` (ARNのみ)
   - 実装: 
     - queryFunction, exportFunction: `API_KEY_SECRET_ARN` (ARN)
     - exportStatusFunction, pdfDownloadFunction: `API_KEY` (値を直接展開)
   - 影響: セキュリティベストプラクティスの不一致

5. **date_partitionの形式**
   - 設計書: YYYY-MM-DD形式（日単位）
   - 実装コメント: YYYY-MM形式（月単位）
   - 影響: 設計書とコメントの不一致

**軽微な差異:**

6. **CloudFormation Outputsの追加**
   - 実装には詳細なOutputsが定義されているが、設計書には記載が少ない

7. **IAM権限の詳細**
   - 実装にはCloudWatch PutMetricData権限が明示的に付与されている
   - 設計書には記載が簡略化されている

### 3. 設計書の更新

#### 更新内容

**実施する更新:**

1. **ファイルパスの修正**
   - 設計書の正しい場所を確認: `.kiro/specs/tdnet-data-collector/docs/design.md`
   - タスク指示のパスを修正する必要がある

2. **DynamoDB GSI名の修正**
   - `GSI_DateRange` → `GSI_DatePartition` に修正

3. **Lambda関数リストの更新**
   - 7個のLambda関数すべてを記載
   - 各関数の役割、タイムアウト、メモリサイズを明記

4. **API Keyの環境変数設定の統一**
   - セキュリティベストプラクティスに従い、すべての関数で`API_KEY_SECRET_ARN`を使用するよう推奨
   - 実装の不一致を指摘

5. **date_partitionの形式を明確化**
   - YYYY-MM形式（月単位）であることを明記
   - 設計書の記述を修正

6. **API Gatewayエンドポイントの完全なリスト**
   - 6個のエンドポイントすべてを記載

7. **CloudFormation Outputsの追加**
   - 実装されているOutputsを設計書に反映

---

## 成果物

- [ ] 更新されたアーキテクチャ設計書: `.kiro/specs/tdnet-data-collector/design/architecture.md`

---

## 次回への申し送り

### 残課題
（完了時に記録）

### 注意点
（完了時に記録）

---

## 問題と解決策

（問題が発生した場合に記録）
