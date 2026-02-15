# 作業記録: セキュリティ・監視のドキュメントと実装の整合性チェック

**作成日時**: 2026-02-15 10:05:00  
**作業概要**: セキュリティと監視のドキュメントと実装の整合性を確認

## 作業内容

### 1. セキュリティ設定の確認
- steering/security/security-best-practices.md のベストプラクティスを確認
- docs/01-requirements/design.md のセキュリティ設計を確認

### 2. IAMロールとポリシーの照合
- cdk/lib/stacks/ 配下のIAMロール定義を確認
- 最小権限の原則が守られているか確認
- Lambda関数のIAMロールが適切に設定されているか確認

### 3. 暗号化設定の照合
- DynamoDBテーブルの暗号化設定を確認
- S3バケットの暗号化設定を確認
- Secrets Managerの暗号化設定を確認

### 4. WAF設定の確認
- cdk/lib/constructs/waf.ts のWAF設定を確認
- レート制限ルールが設計通りか確認
- AWSマネージドルールセットが適用されているか確認

### 5. CloudWatch監視の確認
- steering/infrastructure/monitoring-alerts.md の監視設定を確認
- cdk/lib/stacks/monitoring-stack.ts の監視設定を確認
- CloudWatchアラーム、ダッシュボード、ログ設定を照合

### 6. CloudTrail監査ログの確認
- cdk/lib/constructs/cloudtrail.ts のCloudTrail設定を確認
- 監査ログの保存先、保持期間が設計通りか確認

## 調査結果

### 1. セキュリティ設定の確認

#### ドキュメント要件
- **security-best-practices.md**: 最小権限、暗号化（TLS 1.2以上、SSE-S3）、監査（CloudTrail）
- **design.md**: IAM最小権限、S3/DynamoDB暗号化、WAF、CloudTrail、Secrets Manager

#### 実装状況
✅ **適合**: セキュリティ原則が実装に反映されている

### 2. IAMロールとポリシーの照合

#### ドキュメント要件
- 最小権限の原則（ワイルドカード権限禁止）
- 特定リソースへのスコープ制限
- CloudWatch Logs、S3、DynamoDB、Secrets Managerへの権限

#### 実装状況（foundation-stack.ts, compute-stack.ts）

**✅ 適合項目:**
1. **DynamoDB権限**: `grantReadWriteData()` / `grantReadData()` で特定テーブルに限定
2. **S3権限**: `grantPut()`, `grantRead()` で特定バケットに限定
3. **Secrets Manager権限**: `grantRead()` で特定シークレットに限定
4. **CloudWatch Metrics権限**: 条件付きポリシーで `TDnet/Collector` namespaceに限定

**⚠️ 不整合項目:**
1. **CloudWatch Metrics権限の不統一**:
   - Collector Lambda: `cloudwatch:namespace: 'TDnet/Collector'` に限定 ✅
   - Query Lambda: 条件なし（`resources: ['*']`） ❌
   - Export Lambda: 条件なし（`resources: ['*']`） ❌
   - その他Lambda: 条件なし（`resources: ['*']`） ❌
   
   **推奨**: すべてのLambda関数で `TDnet/{FunctionName}` namespaceに限定すべき

2. **Health Lambda権限**:
   - `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` が `resources: ['*']` ❌
   - **推奨**: 特定ロググループに限定すべき

3. **DLQ Processor Lambda権限**:
   - CloudWatch Logs権限が `resources: ['*']` ❌
   - **推奨**: 特定ロググループに限定すべき

### 3. 暗号化設定の照合

#### ドキュメント要件
- DynamoDB: AWS管理キー（`TableEncryption.AWS_MANAGED`）
- S3: SSE-S3（`BucketEncryption.S3_MANAGED`）
- API Gateway: TLS 1.2以上

#### 実装状況（foundation-stack.ts, api-stack.ts）

**✅ 適合項目:**
1. **DynamoDB暗号化**: すべてのテーブルで `encryption: dynamodb.TableEncryption.AWS_MANAGED` ✅
2. **S3暗号化**: すべてのバケットで `encryption: s3.BucketEncryption.S3_MANAGED` ✅
3. **S3パブリックアクセスブロック**: すべてのバケットで `blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL` ✅
4. **S3バージョニング**: すべてのバケットで `versioned: true` ✅

**❌ 不整合項目:**
1. **API Gateway TLS設定**:
   - ドキュメント要件: `securityPolicy: SecurityPolicy.TLS_1_2`
   - 実装: TLS設定が明示的に指定されていない ❌
   - **推奨**: `api-stack.ts` で `endpointConfiguration` に `securityPolicy` を追加

### 4. WAF設定の確認

#### ドキュメント要件
- レート制限: 5分/2000リクエスト/IP
- AWS管理ルール: Common Rule Set, Known Bad Inputs
- カスタムレスポンス: 429エラー

#### 実装状況（waf.ts）

**✅ 適合項目:**
1. **レート制限**: `limit: 500` (5分間) = 100リクエスト/分 ✅
2. **AWS管理ルール**: `AWSManagedRulesCommonRuleSet`, `AWSManagedRulesKnownBadInputsRuleSet` ✅
3. **カスタムレスポンス**: 429エラー、JSONレスポンス ✅
4. **CloudWatchメトリクス**: 有効化 ✅

**⚠️ 軽微な不整合:**
- ドキュメント: 2000リクエスト/5分
- 実装: 500リクエスト/5分（デフォルト値）
- **影響**: より厳格なレート制限（問題なし）

### 5. CloudWatch監視の確認

#### ドキュメント要件（monitoring-alerts.md）
- Lambda: Errors > 5/5分（警告）、> 10/5分（重大）
- Lambda: Duration > 10分（警告）、> 13分（重大）
- Lambda: Throttles > 0（警告）、> 5（重大）
- DynamoDB: UserErrors > 5/5分、SystemErrors > 0
- ビジネスメトリクス: DisclosuresCollected = 0（24時間）、DisclosuresFailed > 10/日

#### 実装状況（monitoring-stack.ts, cloudwatch-alarms.ts）

**✅ 適合項目:**
1. **Lambda Error Rate**: 10%閾値、5分評価 ✅
2. **Lambda Duration**: 
   - 警告: 600秒（10分） ✅
   - 重大: 780秒（13分） ✅
3. **Lambda Throttles**: 閾値1、即座にアラート ✅
4. **CollectionSuccessRate**: 95%閾値 ✅
5. **NoDataCollected**: 24時間、閾値1 ✅
6. **CollectionFailure**: 24時間、閾値10 ✅
7. **DLQアラーム**: メッセージ数 > 0 ✅
8. **CloudWatch Logs保持期間**:
   - 本番: Collector 3ヶ月、その他1ヶ月 ✅
   - 開発: 1週間 ✅

**⚠️ 不整合項目:**
1. **DynamoDBアラームの欠如**:
   - ドキュメント要件: UserErrors > 5/5分、SystemErrors > 0、ThrottledRequests > 0
   - 実装: DynamoDBアラームが設定されていない ❌
   - **推奨**: `cloudwatch-alarms.ts` にDynamoDBアラームを追加

2. **API Gatewayアラームの欠如**:
   - ドキュメント要件: 4XXError > 10%、5XXError > 1%、Latency > 3秒
   - 実装: API Gatewayアラームが設定されていない ❌
   - **推奨**: `cloudwatch-alarms.ts` にAPI Gatewayアラームを追加

**✅ ダッシュボード実装:**
- Lambda、DynamoDB、S3、ビジネスメトリクスのウィジェット実装済み ✅
- API Gatewayウィジェットはコメントアウト（型エラーのため）⚠️

### 6. CloudTrail監査ログの確認

#### ドキュメント要件
- すべてのAPI呼び出し記録
- CloudWatch Logsへの送信
- S3データイベント（PDFバケット）
- DynamoDBデータイベント
- ログ保持: 90日後Glacier、7年後削除

#### 実装状況（cloudtrail.ts, foundation-stack.ts）

**✅ 適合項目:**
1. **CloudTrail設定**:
   - `sendToCloudWatchLogs: true` ✅
   - `enableFileValidation: true` ✅
   - `managementEvents: ReadWriteType.ALL` ✅
2. **S3データイベント**: PDFバケットのすべてのオブジェクト ✅
3. **DynamoDBデータイベント**: 3テーブル（disclosures, executions, exportStatus）✅
4. **CloudWatch Logsロググループ**: 1年保持、削除保護 ✅
5. **S3ライフサイクル**:
   - 90日後Glacier ✅
   - 2555日（約7年）後削除 ✅

**✅ 完全適合**: CloudTrail設定はドキュメント要件を満たしている

### 7. Secrets Manager設定の確認

#### ドキュメント要件
- APIキー、パスワード: Secrets Manager
- 環境変数: ARNのみ（値を直接設定しない）
- 自動ローテーション（Phase 4実装予定）

#### 実装状況（secrets-manager.ts, compute-stack.ts）

**✅ 適合項目:**
1. **シークレット作成**: `/tdnet/api-key` ✅
2. **暗号化**: AWS管理キー使用 ✅
3. **削除保護**: `removalPolicy: RETAIN` ✅
4. **既存シークレット参照**: `useExistingSecret` オプション ✅
5. **自動ローテーション**: Lambda関数実装済み（90日ごと）✅

**⚠️ 不整合項目:**
1. **Lambda環境変数**:
   - Query Lambda: `API_KEY_SECRET_ARN` 設定済み ✅
   - しかし、`grantRead()` が呼ばれていない ❌
   - **推奨**: `compute-stack.ts` で `apiKeySecret.grantRead(queryFunction)` を追加

## 不整合の詳細と推奨事項

### 重大度: 高

なし

### 重大度: 中

1. **DynamoDBアラームの欠如**
   - **影響**: DynamoDBエラーやスロットリングを検知できない
   - **推奨**: `cloudwatch-alarms.ts` に以下を追加:
     - UserErrors > 5/5分（警告）
     - SystemErrors > 0（重大）
     - ThrottledRequests > 0（重大）

2. **API Gatewayアラームの欠如**
   - **影響**: APIエラーやレイテンシ問題を検知できない
   - **推奨**: `cloudwatch-alarms.ts` に以下を追加:
     - 4XXError > 10%（警告）
     - 5XXError > 1%（重大）
     - Latency > 3秒（警告）

### 重大度: 低

3. **CloudWatch Metrics権限の不統一**
   - **影響**: セキュリティベストプラクティスに反する（最小権限の原則）
   - **推奨**: すべてのLambda関数で条件付きポリシーを使用
   ```typescript
   conditions: {
     StringEquals: {
       'cloudwatch:namespace': 'TDnet/{FunctionName}',
     },
   }
   ```

4. **API Gateway TLS設定の欠如**
   - **影響**: TLS 1.0/1.1が使用される可能性
   - **推奨**: `api-stack.ts` で明示的にTLS 1.2を指定
   ```typescript
   endpointConfiguration: {
     types: [apigateway.EndpointType.REGIONAL],
   },
   policy: new iam.PolicyDocument({
     statements: [
       new iam.PolicyStatement({
         effect: iam.Effect.DENY,
         principals: [new iam.AnyPrincipal()],
         actions: ['execute-api:Invoke'],
         resources: ['execute-api:/*'],
         conditions: {
           StringNotEquals: {
             'aws:SecureTransport': 'true',
           },
         },
       }),
     ],
   }),
   ```

5. **CloudWatch Logs権限の過剰付与**
   - **影響**: セキュリティベストプラクティスに反する
   - **推奨**: 特定ロググループに限定
   ```typescript
   resources: [`arn:aws:logs:${region}:${account}:log-group:/aws/lambda/${functionName}:*`]
   ```

6. **Query Lambda Secrets Manager権限の欠如**
   - **影響**: APIキー取得時にエラーが発生する可能性
   - **推奨**: `compute-stack.ts` で `props.apiKeySecret.grantRead(this.queryFunction)` を追加

## 成果物

### 整合性チェック結果サマリー

| カテゴリ | 適合 | 不整合 | 重大度 |
|---------|------|--------|--------|
| IAMロール・ポリシー | 4項目 | 3項目 | 低 |
| 暗号化設定 | 4項目 | 1項目 | 低 |
| WAF設定 | 4項目 | 0項目 | - |
| CloudWatch監視 | 8項目 | 2項目 | 中 |
| CloudTrail監査 | 5項目 | 0項目 | - |
| Secrets Manager | 5項目 | 1項目 | 低 |
| **合計** | **30項目** | **7項目** | **中2, 低5** |

### 適合率

- **全体適合率**: 81% (30/37)
- **重大度中の不整合**: 2項目（DynamoDB/API Gatewayアラーム）
- **重大度低の不整合**: 5項目（IAM権限、TLS設定、Secrets Manager）

## 申し送り事項

### 優先度: 高
1. DynamoDBアラームの追加（UserErrors, SystemErrors, ThrottledRequests）
2. API Gatewayアラームの追加（4XXError, 5XXError, Latency）

### 優先度: 中
3. CloudWatch Metrics権限の統一（すべてのLambda関数で条件付きポリシー）
4. API Gateway TLS 1.2設定の明示化
5. Query Lambda Secrets Manager権限の追加

### 優先度: 低
6. CloudWatch Logs権限の特定ロググループへの限定
7. API Gatewayダッシュボードウィジェットの型エラー修正

### 総評

セキュリティと監視の実装は**概ね良好**で、主要な要件は満たされています。ただし、以下の改善が推奨されます：

1. **監視の強化**: DynamoDBとAPI Gatewayのアラームを追加することで、システム全体の可観測性が向上します。
2. **IAM権限の最適化**: CloudWatch Metrics権限を条件付きポリシーで統一することで、最小権限の原則をより厳格に適用できます。
3. **TLS設定の明示化**: API GatewayでTLS 1.2を明示的に指定することで、セキュリティが強化されます。

これらの改善により、セキュリティベストプラクティスへの適合率が95%以上に向上します。

