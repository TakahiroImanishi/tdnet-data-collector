# 作業記録: セキュリティ実装チェック（タスク7）

**作業日時**: 2026-02-22 12:13:36  
**タスク**: タスク7 - セキュリティ実装チェック  
**担当**: Kiro (subagent)

## 目的

セキュリティベストプラクティスの適用状況を確認し、脆弱性を特定する。

## 実施内容

### 1. 調査対象ファイル

#### CDKスタック
- `cdk/lib/stacks/foundation-stack.ts` - 基盤リソース（DynamoDB, S3, Secrets Manager）
- `cdk/lib/stacks/compute-stack.ts` - Lambda関数とDLQ
- `cdk/lib/stacks/api-stack.ts` - API Gateway, WAF
- `cdk/lib/stacks/monitoring-stack.ts` - CloudWatch, CloudTrail

#### セキュリティ構成
- `cdk/lib/constructs/waf.ts` - WAF Web ACL
- `cdk/lib/constructs/cloudtrail.ts` - CloudTrail監査ログ
- `cdk/lib/constructs/secrets-manager.ts` - Secrets Manager
- `cdk/lib/constructs/cloudfront.ts` - CloudFront Distribution
- `cdk/lib/constructs/lambda-dlq.ts` - DLQ

#### Lambda関数
- `src/lambda/collector/handler.ts` - データ収集
- `src/lambda/query/handler.ts` - 検索API
- `src/utils/logger.ts` - 構造化ログ
- `src/errors/index.ts` - カスタムエラークラス

#### CI/CD
- `.github/workflows/security-audit.yml` - セキュリティ監査ワークフロー

### 2. セキュリティ実装状況の詳細分析

## ✅ 実装済み項目

### 2.1 IAM権限の最小権限原則

#### ✅ 適切な実装
- **DynamoDB権限**: テーブル単位で権限付与（`grantReadWriteData`, `grantReadData`）
- **S3権限**: バケット単位で権限付与（`grantPut`, `grantRead`）
- **Secrets Manager権限**: シークレット単位で権限付与（`grantRead`）
- **Lambda Invoke権限**: 関数単位で権限付与（`grantInvoke`）

#### ⚠️ 条件付きワイルドカード使用（許容範囲）
- **CloudWatch Metrics**: `resources: ['*']`を使用
  - **理由**: CloudWatch PutMetricDataはリソースARNをサポートしていない
  - **緩和策**: `conditions`で名前空間を制限（`cloudwatch:namespace: 'TDnet'`）
  - **評価**: セキュリティベストプラクティスに準拠（条件付きアクセス）

**該当箇所**:
```typescript
// cdk/lib/stacks/compute-stack.ts (全Lambda関数)
this.collectorFunction.addToRolePolicy(
  new cdk.aws_iam.PolicyStatement({
    effect: cdk.aws_iam.Effect.ALLOW,
    actions: ['cloudwatch:PutMetricData'],
    resources: ['*'],
    conditions: {
      StringEquals: {
        'cloudwatch:namespace': 'TDnet',
      },
    },
  })
);
```

#### ✅ ワイルドカード権限なし
- S3: `s3:*`なし
- DynamoDB: `dynamodb:*`なし
- Lambda: `lambda:*`なし
- IAM: `iam:*`なし

### 2.2 暗号化（保存時・転送時）

#### ✅ DynamoDB暗号化
```typescript
// cdk/lib/stacks/foundation-stack.ts
encryption: dynamodb.TableEncryption.AWS_MANAGED
```
- **方式**: AWS管理キー（デフォルト）
- **評価**: ⭐⭐⭐⭐⭐ 適切

#### ✅ S3暗号化
```typescript
// cdk/lib/stacks/foundation-stack.ts
encryption: s3.BucketEncryption.S3_MANAGED
```
- **方式**: SSE-S3（サーバー側暗号化）
- **評価**: ⭐⭐⭐⭐⭐ 適切

#### ✅ API Gateway HTTPS強制
```typescript
// cdk/lib/stacks/api-stack.ts
viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
```
- **評価**: ⭐⭐⭐⭐⭐ 適切

#### ⚠️ TLS 1.2強制（部分的）
- **API Gateway**: デフォルトでTLS 1.2が有効（カスタムドメイン未使用）
- **CloudFront**: デフォルト証明書使用時はTLS 1.2を強制できない
  - **CDK Nag抑制**: `AwsSolutions-CFR4`（理由記載あり）
  - **推奨**: 本番環境ではRoute 53 + ACM証明書でTLS 1.2を強制

### 2.3 Secrets Manager使用状況

#### ✅ APIキー管理
```typescript
// cdk/lib/constructs/secrets-manager.ts
secretName: '/tdnet/api-key'
```
- **保存場所**: AWS Secrets Manager
- **暗号化**: AWS管理キー
- **アクセス制御**: Lambda関数に`grantRead`で最小権限付与
- **評価**: ⭐⭐⭐⭐⭐ 適切

#### ✅ 環境変数にシークレット直接設定なし
- Lambda環境変数にはARNのみ設定（値は設定しない）
- 実行時にSDKで動的取得

#### 🔄 自動ローテーション（Phase 4実装予定）
- `enableRotation`パラメータ実装済み
- ローテーション用Lambda関数の雛形実装済み
- 90日ごとのローテーションスケジュール設定可能

### 2.4 WAF設定

#### ✅ WAF Web ACL実装
```typescript
// cdk/lib/constructs/waf.ts
```

**実装済みルール**:
1. **レート制限**: 500リクエスト/5分/IP（100リクエスト/分相当）
2. **AWS Managed Rules - Common Rule Set**: 一般的な攻撃パターンをブロック
3. **AWS Managed Rules - Known Bad Inputs**: 既知の悪意ある入力をブロック

**カスタムエラーレスポンス**:
```json
{
  "error_code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please try again later."
}
```

**評価**: ⭐⭐⭐⭐⭐ 適切

### 2.5 CloudTrail監査ログ

#### ✅ CloudTrail設定
```typescript
// cdk/lib/constructs/cloudtrail.ts
```

**記録対象**:
- ✅ すべての管理イベント（`ReadWriteType.ALL`）
- ✅ S3データイベント（PDFバケット）
- ✅ DynamoDBデータイベント（全テーブル）
- ✅ CloudWatch Logsへの送信有効化
- ✅ ログファイルの整合性検証有効化（`enableFileValidation: true`）

**ログ保持期間**:
- CloudWatch Logs: 1年間（`RetentionDays.ONE_YEAR`）
- S3: 7年間（ライフサイクルポリシー: 90日後Glacier、2555日後削除）

**評価**: ⭐⭐⭐⭐⭐ 適切

### 2.6 脆弱性スキャン設定

#### ✅ GitHub Actions - Security Audit
```yaml
# .github/workflows/security-audit.yml
```

**実行タイミング**:
- 毎週月曜日午前9時（JST）
- mainブランチへのpush時
- 手動実行可能

**実行内容**:
- `npm audit --audit-level=moderate`
- 監査レポート生成（JSON形式）
- GitHub Step Summaryに結果表示
- 監査レポートをArtifactとして30日間保存

**評価**: ⭐⭐⭐⭐☆ 良好（CDK Nag未統合）

### 2.7 セキュリティベストプラクティス適用状況

#### ✅ S3バケット設定
```typescript
// cdk/lib/stacks/foundation-stack.ts
blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
versioned: true
```
- パブリックアクセスブロック: 有効
- バージョニング: 有効
- ライフサイクルポリシー: 設定済み

#### ✅ DynamoDB設定
```typescript
pointInTimeRecovery: true
removalPolicy: cdk.RemovalPolicy.RETAIN
```
- ポイントインタイムリカバリ: 有効
- 削除保護: 有効（本番環境）

#### ✅ Lambda設定
```typescript
tracing: lambda.Tracing.ACTIVE
deadLetterQueue: this.dlq.queue
retryAttempts: 2
```
- X-Rayトレーシング: 有効
- DLQ: 設定済み（非同期Lambda）
- 再試行: 2回

#### ✅ API Gateway設定
```typescript
apiKeyRequired: true
throttle: { rateLimit: 100, burstLimit: 200 }
quota: { limit: 10000, period: apigateway.Period.MONTH }
```
- APIキー認証: 必須
- レート制限: 100リクエスト/秒
- クォータ: 10,000リクエスト/月

#### ✅ 構造化ログ
```typescript
// src/utils/logger.ts
export function createErrorContext(error: Error, additionalContext?: LogContext): LogContext {
  return {
    error_type: error.constructor.name,
    error_message: error.message,
    context: additionalContext || {},
    stack_trace: error.stack,
  };
}
```
- エラー分類: 実装済み（`src/errors/index.ts`）
- 構造化ログ: 実装済み（error_type, error_message, context, stack_trace）
- 機密情報マスク: 実装済み（APIキー等）

## ⚠️ 改善推奨事項

### 1. CDK Nag統合（優先度: 高）

**現状**:
- `cdk-nag`パッケージはインストール済み（`package.json`）
- CloudFrontでのみ`NagSuppressions`使用
- CDKアプリケーションレベルでの`AwsSolutionsChecks`適用なし

**推奨**:
```typescript
// cdk/bin/tdnet-data-collector-split.ts
import { AwsSolutionsChecks } from 'cdk-nag';

const app = new cdk.App();

// ... スタック作成 ...

// CDK Nag適用
AwsSolutionsChecks.check(app);

app.synth();
```

**効果**:
- セキュリティベストプラクティスの自動検証
- デプロイ前の脆弱性検出
- コンプライアンス準拠の確認

### 2. Secrets Managerローテーション有効化（優先度: 中）

**現状**:
- ローテーション機能実装済み（`enableRotation`パラメータ）
- デフォルトで無効化（`enableRotation: false`）

**推奨**:
```typescript
// cdk/lib/stacks/foundation-stack.ts
this.secretsManager = new SecretsManagerConstruct(this, 'SecretsManager', {
  environment: env,
  enableRotation: true, // 有効化
  rotationDays: 90,
  useExistingSecret: true,
});
```

**効果**:
- APIキーの定期的なローテーション
- セキュリティリスクの低減

### 3. CloudFront TLS 1.2強制（優先度: 中）

**現状**:
- デフォルトCloudFront証明書使用
- TLS 1.2を強制できない

**推奨**:
- Route 53でカスタムドメイン設定
- ACM証明書発行
- CloudFront Distributionで`minimumProtocolVersion: SecurityPolicy.TLS_1_2`設定

**効果**:
- TLS 1.2以上を強制
- セキュリティ強化

### 4. Lambda環境変数の暗号化（優先度: 低）

**現状**:
- Lambda環境変数は暗号化されている（AWS管理キー）
- カスタムKMSキー未使用

**推奨**:
```typescript
// cdk/lib/stacks/compute-stack.ts
environmentEncryption: new kms.Key(this, 'LambdaEnvKey', {
  description: 'KMS key for Lambda environment variables',
  enableKeyRotation: true,
})
```

**効果**:
- より強固な暗号化
- キーローテーション管理

### 5. VPC内Lambda配置（優先度: 低）

**現状**:
- Lambda関数はVPC外で実行
- インターネット経由でAWSサービスにアクセス

**推奨**:
- VPC作成
- プライベートサブネット配置
- VPCエンドポイント設定（DynamoDB, S3, Secrets Manager）

**効果**:
- ネットワーク分離
- セキュリティ強化

**注意**: コスト増加（NAT Gateway、VPCエンドポイント）

## 総合評価

### セキュリティスコア: ⭐⭐⭐⭐☆ (4.5/5)

#### 強み
1. ✅ IAM最小権限原則の徹底
2. ✅ 暗号化の全面的な適用（DynamoDB, S3, 転送時）
3. ✅ Secrets Managerによる機密情報管理
4. ✅ WAF設定（レート制限、AWS Managed Rules）
5. ✅ CloudTrail監査ログの包括的な記録
6. ✅ 構造化ログとエラーハンドリング
7. ✅ S3パブリックアクセスブロック
8. ✅ DynamoDBポイントインタイムリカバリ
9. ✅ API Gateway認証・レート制限
10. ✅ GitHub Actions セキュリティ監査

#### 改善点
1. ⚠️ CDK Nag未統合（デプロイ前検証なし）
2. ⚠️ Secrets Managerローテーション無効化
3. ⚠️ CloudFront TLS 1.2強制なし（カスタムドメイン未使用）
4. ℹ️ Lambda環境変数のカスタムKMS未使用
5. ℹ️ VPC内Lambda配置なし

## 脆弱性

### 検出された脆弱性: なし

**確認項目**:
- ✅ ハードコードされたシークレットなし
- ✅ パブリックアクセス可能なS3バケットなし
- ✅ 過度に広範なIAM権限なし（条件付きワイルドカードのみ）
- ✅ 暗号化されていないデータなし
- ✅ 認証なしのAPIエンドポイントなし（/healthを除く）

## 申し送り事項

### 1. CDK Nag統合の実施
- `cdk/bin/tdnet-data-collector-split.ts`に`AwsSolutionsChecks.check(app)`を追加
- デプロイ前にセキュリティチェックを自動化

### 2. Secrets Managerローテーション有効化の検討
- Phase 4実装時に有効化
- ローテーション用Lambda関数の実装完了

### 3. 本番環境でのカスタムドメイン設定
- Route 53 + ACM証明書でTLS 1.2を強制
- CloudFront Distributionのセキュリティ強化

### 4. 定期的なセキュリティレビュー
- 月次でIAM権限見直し
- 四半期でCloudTrailログ確認
- 年次でセキュリティ監査実施

## 参考資料

- `.kiro/steering/security/security-best-practices.md`
- `cdk/lib/stacks/foundation-stack.ts`
- `cdk/lib/stacks/compute-stack.ts`
- `cdk/lib/stacks/api-stack.ts`
- `cdk/lib/constructs/waf.ts`
- `cdk/lib/constructs/cloudtrail.ts`
- `cdk/lib/constructs/secrets-manager.ts`
- `.github/workflows/security-audit.yml`

## 完了日時

2026-02-22 12:13:36
