# 作業記録: WAF Construct分離とDynamoDBスキーマドキュメント化

**作成日時**: 2026-02-15 06:51:00  
**作業概要**: タスク31.3.3〜31.3.4の実施

## タスク概要

### タスク31.3.3: WAF Construct分離
- `cdk/lib/constructs/waf.ts` を新規作成
- WafConstructクラスを実装（レート制限: 500リクエスト/5分）
- `api-stack.ts` からWAF設定を移動
- CDKテスト追加

### タスク31.3.4: DynamoDBスキーマドキュメント化
- `docs/database-schema.md` を作成
- モデル定義とDynamoDB定義の対応関係を明示
- テーブル構造の図解

## 実施内容

### 1. 既存コード調査


### 2. WAF Construct分離（タスク31.3.3）

#### 既存実装確認
- `cdk/lib/constructs/waf.ts` は既に実装済み
- `api-stack.ts` で正しく使用されている
- レート制限: 500リクエスト/5分（100リクエスト/分相当）
- AWS Managed Rules適用済み（Common Rule Set、Known Bad Inputs）

#### CDKテスト作成
**ファイル**: `cdk/__tests__/constructs/waf.test.ts`

**テストケース**:
1. WAF Web ACLが作成される
2. Web ACLの基本設定が正しい
3. レート制限ルールが設定される（デフォルト: 500リクエスト/5分）
4. カスタムレート制限が設定できる
5. AWS Managed Rules - Common Rule Setが設定される
6. AWS Managed Rules - Known Bad Inputsが設定される
7. カスタムエラーレスポンスが設定される
8. WAF AssociationがAPI Gatewayに関連付けられる
9. CloudFormation OutputsにWeb ACL ARNとIDが出力される
10. 3つのルールが正しい優先順位で設定される

**テスト結果**: ✅ 全10テスト成功（3.546秒）

### 3. DynamoDBスキーマドキュメント化（タスク31.3.4）

#### ドキュメント作成
**ファイル**: `docs/database-schema.md`

**内容**:
1. **概要**: 3つのDynamoDBテーブルの概要
2. **tdnet_disclosures テーブル**
   - モデル定義（Disclosure型）
   - DynamoDB定義（キー構造、属性一覧）
   - GSI: GSI_CompanyCode_DiscloseDate、GSI_DatePartition
   - CDK実装コード
3. **tdnet_executions テーブル**
   - モデル定義（ExecutionStatus型）
   - DynamoDB定義（キー構造、属性一覧）
   - GSI: GSI_Status_StartedAt
   - TTL設定（30日）
   - CDK実装コード
4. **tdnet_export_status テーブル**
   - モデル定義（ExportStatus型）
   - DynamoDB定義（キー構造、属性一覧）
   - GSI: GSI_Status_RequestedAt
   - TTL設定（30日）
   - CDK実装コード
5. **設計原則**
   - コスト最適化
   - データ整合性
   - クエリパフォーマンス
   - 運用性
6. **関連ドキュメント**: 関連ファイルへのリンク

#### ドキュメント特徴
- モデル定義とDynamoDB定義の対応関係を明示
- 表形式で見やすく整理
- CDK実装コードを含む
- バリデーションルールを記載
- 設計原則を明確化

## 成果物

### 作成ファイル
1. `cdk/__tests__/constructs/waf.test.ts` - WAF Constructテスト（10テストケース）
2. `docs/database-schema.md` - DynamoDBスキーマドキュメント

### テスト結果
- WAF Constructテスト: ✅ 全10テスト成功

## 申し送り事項

### 完了事項
- ✅ タスク31.3.3: WAF Construct分離（既に実装済み、テスト追加）
- ✅ タスク31.3.4: DynamoDBスキーマドキュメント化

### 注意事項
1. WAF Constructは既に実装済みで、api-stack.tsで正しく使用されている
2. DynamoDBスキーマドキュメントは、モデル定義とDynamoDB定義の対応関係を明示
3. 全テーブルでPoint-in-Time Recovery有効化（データ保護）
4. executionsとexport_statusテーブルはTTL設定（30日後自動削除）

### 次のステップ
- tasks.mdの更新（タスク31.3.3〜31.3.4を完了にマーク）
- Git commit & push
