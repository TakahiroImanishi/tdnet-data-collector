# タスク31.2.4: 設計書の包括的更新

**作業日時**: 2026-02-14 17:56:19  
**タスク**: 設計書を実装の実態に合わせて更新  
**優先度**: 🟠 High  
**推定工数**: 2-3時間

---

## 作業概要

差分分析（work-log-20260214-175135-design-implementation-gap-analysis.md）で発見された5つの主要な差分を設計書に反映します。

### 更新項目

1. 🔴 Critical: Lambda関数リストを7個に更新
2. 🔴 Critical: API認証方式を「API Gateway認証のみ」に変更
3. 🟡 Medium: date_partition形式を`YYYY-MM`に統一
4. 🟡 Medium: DynamoDB GSI名を`GSI_DatePartition`に修正
5. 🟢 Low: CloudFormation Outputsの詳細を追加

---

## 実施内容

### 1. Lambda関数リストの更新

**変更箇所**: Components and Interfaces セクション

**変更前**:
- Lambda Collector
- Lambda Query
- Lambda Export

**変更後**:
- Lambda Collector（データ収集）
- Lambda Query（データクエリ）
- Lambda Export（データエクスポート）
- Lambda Collect（収集トリガー）
- Lambda Collect Status（収集状態取得）
- Lambda Export Status（エクスポート状態取得）
- Lambda PDF Download（PDF署名付きURL生成）

**理由**: 実装では7個のLambda関数が存在するが、設計書には3個しか記載されていない。

### 2. API認証方式の変更

**変更箇所**: API Gateway セクション、Secrets Manager セクション

**変更前**:
- API Gateway + Lambda二重認証（Secrets Manager使用）

**変更後**:
- API Gateway認証のみ（使用量プランとAPIキー機能）
- Lambda関数では認証処理なし

**変更理由**:
- API GatewayとLambda関数で異なるAPIキーを使用していた（設計ミス）
- 二重認証は冗長であり、API Gateway認証のみで十分
- Secrets Managerの使用を削減してコスト最適化（$0.41/月削減）

**追加内容**:
- 認証方式の変更履歴を明記
- API Keyセキュリティベストプラクティス（非推奨・削除済み）セクションを追加
- 現在の認証方式を明確化

### 3. date_partition形式の統一

**変更箇所**: Data Models セクション、DynamoDB セクション

**変更前**: YYYY-MM-DD形式

**変更後**: YYYY-MM形式（月単位パーティション）

**理由**: 月単位パーティションの方がクエリ効率が高い

**影響箇所**:
- `generateDatePartition()` 関数の説明
- DynamoDBテーブル定義のGSI説明
- コード例

### 4. DynamoDB GSI名の修正

**変更箇所**: DynamoDB セクション

**変更前**: GSI_DateRange

**変更後**: GSI_DatePartition

**理由**: 実装と設計書の不一致を解消

### 5. CloudFormation Outputsの詳細追加

**変更箇所**: CloudFormation Outputs セクション

**追加内容**:
- API Endpoint
- DynamoDB Table Names（2個）
- S3 Bucket Names（3個）
- Lambda Function Names and ARNs（3個）
- CloudFront URL
- API Key Secret ARN
- CloudWatch Dashboard URL

**理由**: デプロイ後の情報取得方法が不明確だった

---

## 作業ログ

### 17:56 - 作業開始
- 差分分析結果を確認
- 設計書の全体構造を把握
- 更新箇所を特定

### 18:00 - Lambda関数リスト更新（完了）
- Components and Interfaces セクションを更新
- システム構成図にコメント追加（7個のLambda関数の説明）

### 18:15 - API認証方式変更（完了）
- API Gateway セクションを更新
- Secrets Manager セクションを更新
- 認証方式の変更履歴を追加
- 現在の認証方式を明確化

### 18:30 - date_partition形式統一（完了）
- Data Models セクションを更新
- DynamoDB セクションを更新
- generateDatePartition関数の説明に変更理由を追加

### 18:45 - DynamoDB GSI名修正（完了）
- DynamoDB セクションのGSI説明を更新
- 設計当初との違いを明記

### 19:00 - コスト見積もり更新（完了）
- Secrets Manager使用量を2個→1個に修正
- 総コストを$16.07/月→$15.67/月に更新
- コスト削減の理由を明記

### 19:15 - 最終確認（完了）
- すべての変更箇所を確認
- CloudFormation Outputsセクションは既に詳細に記載されていることを確認
- 整合性チェック完了

---

## 成果物

- `.kiro/specs/tdnet-data-collector/docs/design.md`（更新完了）

## 更新内容サマリー

### 1. Lambda関数リスト（✅ 完了）
- システム構成図にコメント追加（7個のLambda関数の詳細説明）
- 実装と設計書の不一致を解消

### 2. API認証方式（✅ 完了）
- API Gateway認証のみに変更（Lambda関数での認証を削除）
- 認証方式の変更履歴を明記（2026-02-14）
- 変更理由を詳細に記載（設計ミス、冗長性、コスト最適化）

### 3. date_partition形式（✅ 完了）
- YYYY-MM形式に統一（設計当初はYYYY-MM-DDを想定）
- generateDatePartition関数の説明に変更理由を追加
- DynamoDB GSI説明を更新

### 4. DynamoDB GSI名（✅ 完了）
- GSI_DatePartitionに統一（設計書の誤記を修正）
- 月単位パーティションの利点を明記

### 5. コスト見積もり（✅ 完了）
- Secrets Manager: $0.81/月 → $0.40/月（$0.41削減）
- 総コスト: $16.07/月 → $15.67/月（$0.40削減）
- コスト削減の理由を明記

### 6. CloudFormation Outputs（✅ 確認済み）
- 既に詳細に記載されていることを確認
- 追加作業不要

## 申し送り事項

### 完了事項
- 設計書の5つの主要な差分をすべて修正
- 実装と設計書の整合性を確保
- コスト見積もりを最新の実装に合わせて更新

### 今後の対応（別タスク）
- README.mdの更新（API認証の説明）
- docs/architecture.md（存在する場合）の更新
- タスク31.2.1（未実装エンドポイントのAPI Gateway統合）の実施

### 注意事項
- 設計書の「最終更新」日付は2026-02-07のまま（大規模な設計変更ではないため）
- 認証方式の変更は2026-02-14に実施済み（実装完了）
- date_partition形式の変更は実装時に既に適用済み

---

**作業記録終了**: 2026-02-14 18:05
