# 品質チェック: セキュリティ実装

作成日時: 2026-02-22 08:49:32

## チェック結果

### IAM権限

**実装状況:**
- ✅ 最小権限原則を適用
- ✅ リソース固有のARNを使用（DynamoDB、S3、Secrets Manager）
- ✅ CloudWatch PutMetricDataのみ`resources: ['*']`を使用（条件付き制限あり）

**詳細:**
1. **DynamoDB権限**: `grantReadData()`, `grantReadWriteData()`を使用し、特定テーブルのARNに限定
2. **S3権限**: `grantPut()`, `grantRead()`を使用し、特定バケットのARNに限定
3. **Secrets Manager権限**: `grantRead()`を使用し、特定シークレットのARNに限定
4. **CloudWatch Metrics**: `resources: ['*']`を使用しているが、条件で`cloudwatch:namespace: 'TDnet'`に制限（許容範囲）
5. **Lambda関数**: 各関数に必要最小限の権限のみ付与

**問題点:**
- ❌ **npm audit未実行**: package.jsonやCI/CDパイプラインにnpm audit実行の設定なし
- ⚠️ CloudWatch Logsの`resources: ['*']`（lambda-dlq.ts）: 特定ロググループに限定すべき

### 暗号化

**保存時暗号化:**
- ✅ **DynamoDB**: `TableEncryption.AWS_MANAGED`（AWS管理キー）
- ✅ **S3**: `BucketEncryption.S3_MANAGED`（SSE-S3）
- ✅ **Secrets Manager**: AWS管理キーを使用（デフォルト）
- ✅ **S3バケット**: すべてのバケット（pdfs, exports, dashboard, cloudtrail-logs）で暗号化有効

**転送時暗号化:**
- ✅ **API Gateway**: HTTPS強制（デフォルト）
- ⚠️ **TLS 1.2以上の明示的設定なし**: API Gatewayで`securityPolicy: SecurityPolicy.TLS_1_2`の設定が見当たらない

**問題点:**
- ⚠️ API GatewayでTLS 1.2以上の明示的な設定が必要（設計ドキュメントに記載あり）

### シークレット管理

**実装状況:**
- ✅ **Secrets Manager使用**: `/tdnet/api-key`シークレットを作成
- ✅ **環境変数にARNのみ設定**: `API_KEY_SECRET_ARN`として環境変数に設定（値は直接設定していない）
- ✅ **既存シークレット参照**: `useExistingSecret: true`で既存シークレットを参照可能
- ⚠️ **自動ローテーション無効**: `enableRotation: false`（Phase 4で実装予定）

**問題点:**
- ⚠️ APIキーの自動ローテーションが無効（Phase 4実装予定のため、現時点では許容）

### WAF設定

**実装状況:**
- ✅ **WAF Web ACL作成**: API Gatewayを保護
- ✅ **レート制限**: 500リクエスト/5分（100リクエスト/分相当）
- ✅ **AWS Managed Rules適用**:
  - AWSManagedRulesCommonRuleSet
  - AWSManagedRulesKnownBadInputsRuleSet
- ✅ **カスタムエラーレスポンス**: 429エラー時にJSON形式のエラーメッセージ
- ✅ **CloudWatchメトリクス有効**: すべてのルールでメトリクス収集

**問題点:**
- なし（設計通り実装済み）

### CloudTrail監査ログ

**実装状況:**
- ✅ **CloudTrail有効化**: `tdnet-audit-trail-{env}`
- ✅ **CloudWatch Logs送信**: 1年間保持、削除保護（RETAIN）
- ✅ **ログファイル整合性検証**: `enableFileValidation: true`
- ✅ **管理イベント記録**: すべての管理イベント（READ/WRITE）
- ✅ **S3データイベント記録**: PDFバケットのすべてのオブジェクト
- ✅ **DynamoDBデータイベント記録**: 3テーブル（disclosures, executions, exportStatus）
- ✅ **S3ログバケット**: 専用バケット（cloudtrail-logs）、暗号化、バージョニング有効

**問題点:**
- なし（設計通り実装済み）

### 脆弱性スキャン

**実装状況:**
- ❌ **npm audit未実行**: package.jsonのscriptsセクションにnpm audit実行なし
- ❌ **CI/CDパイプラインなし**: GitHub Actionsなどでの自動脆弱性スキャン設定なし
- ❌ **依存関係更新プロセスなし**: Dependabotなどの自動更新設定なし

**問題点:**
- ❌ npm auditの定期実行が必要
- ❌ CI/CDパイプラインでの自動脆弱性スキャンが必要
- ❌ 依存関係の自動更新プロセスが必要

### CloudWatch Alarms

**実装状況:**
- ✅ **Lambda Error Rate**: 10%超過でアラート
- ✅ **Lambda Duration**: 10分（Warning）、13分（Critical）
- ✅ **Lambda Throttles**: スロットリング発生時にアラート
- ✅ **CollectionSuccessRate**: 95%未満でアラート
- ✅ **データ収集停止**: 24時間データ収集なしでアラート
- ✅ **収集失敗**: 24時間で10件以上の失敗でアラート
- ✅ **DLQメッセージ**: DLQにメッセージ送信時にアラート
- ✅ **SNS Topic**: アラート通知用トピック作成

**問題点:**
- なし（設計通り実装済み）

### その他のセキュリティ設定

**S3バケット:**
- ✅ **パブリックアクセスブロック**: すべてのバケットで`BlockPublicAccess.BLOCK_ALL`
- ✅ **バージョニング**: すべてのバケットで有効
- ✅ **削除保護**: `RemovalPolicy.RETAIN`（本番環境）
- ✅ **ライフサイクルポリシー**: PDFバケット（90日後IA、365日後Glacier）、エクスポートバケット（7日後削除）

**DynamoDB:**
- ✅ **Point-in-Time Recovery**: すべてのテーブルで有効
- ✅ **TTL設定**: executionsテーブル、exportStatusテーブルで有効

**Lambda:**
- ✅ **DLQ設定**: collectorFunction（非同期呼び出し）でDLQ有効
- ✅ **再試行回数**: 2回（適切）
- ✅ **予約済み同時実行数**: collectorFunctionで1に制限（レート制限のため）

## 総合評価

**✅ 良好（一部改善推奨あり）**

セキュリティベストプラクティスの大部分が適切に実装されています。IAM権限の最小権限原則、暗号化、CloudTrail監査ログ、WAF設定、CloudWatch Alarmsはすべて設計通りに実装されています。

ただし、以下の改善が必要です：
1. npm auditの定期実行（脆弱性スキャン）
2. API GatewayでのTLS 1.2以上の明示的設定
3. CloudWatch Logsの権限をより限定的に設定

## 改善推奨

### 1. npm audit実行の追加 - 優先度: 高

**問題:**
- package.jsonやCI/CDパイプラインにnpm audit実行の設定なし
- 依存関係の脆弱性を定期的にチェックする仕組みがない

**推奨対応:**
```json
// package.json
{
  "scripts": {
    "audit": "npm audit --audit-level=moderate",
    "audit:fix": "npm audit fix",
    "pretest": "npm run audit"
  }
}
```

**CI/CDパイプライン（GitHub Actions）:**
```yaml
# .github/workflows/security-audit.yml
name: Security Audit
on:
  schedule:
    - cron: '0 0 * * 1' # 毎週月曜日
  push:
    branches: [main, develop]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm audit --audit-level=moderate
```

### 2. API Gateway TLS 1.2設定 - 優先度: 中

**問題:**
- API GatewayでTLS 1.2以上の明示的な設定が見当たらない
- 設計ドキュメント（security-best-practices.md）には記載あり

**推奨対応:**
```typescript
// cdk/lib/stacks/api-stack.ts
this.api = new apigateway.RestApi(this, 'TdnetApi', {
  // ... 既存設定 ...
  deployOptions: {
    // ... 既存設定 ...
  },
  // TLS 1.2以上を強制
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
});
```

または、カスタムドメイン使用時:
```typescript
const domainName = new apigateway.DomainName(this, 'CustomDomain', {
  domainName: 'api.example.com',
  certificate: certificate,
  securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
});
```

### 3. CloudWatch Logs権限の限定 - 優先度: 低

**問題:**
- lambda-dlq.tsで`resources: ['*']`を使用

**推奨対応:**
```typescript
// cdk/lib/constructs/lambda-dlq.ts
this.processorFunction.addToRolePolicy(
  new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
    resources: [
      `arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/${this.processorFunction.functionName}:*`,
    ],
  })
);
```

### 4. Dependabot設定 - 優先度: 中

**問題:**
- 依存関係の自動更新プロセスがない

**推奨対応:**
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

## 関連ファイル

### セキュリティ設定ファイル
- `cdk/lib/stacks/foundation-stack.ts` - DynamoDB、S3、Secrets Manager
- `cdk/lib/stacks/compute-stack.ts` - Lambda関数、IAM権限
- `cdk/lib/stacks/api-stack.ts` - API Gateway、WAF
- `cdk/lib/stacks/monitoring-stack.ts` - CloudTrail、CloudWatch Alarms
- `cdk/lib/constructs/waf.ts` - WAF Web ACL
- `cdk/lib/constructs/cloudtrail.ts` - CloudTrail設定
- `cdk/lib/constructs/secrets-manager.ts` - Secrets Manager
- `cdk/lib/constructs/cloudwatch-alarms.ts` - CloudWatch Alarms

### 設計ドキュメント
- `.kiro/steering/security/security-best-practices.md` - セキュリティベストプラクティス

## 申し送り

1. **npm audit実行**: package.jsonに追加し、CI/CDパイプラインで自動実行する設定が必要
2. **API Gateway TLS 1.2設定**: カスタムドメイン使用時に`SecurityPolicy.TLS_1_2`を設定
3. **CloudWatch Logs権限**: lambda-dlq.tsの権限をより限定的に設定
4. **Dependabot設定**: 依存関係の自動更新プロセスを導入

全体的にセキュリティ実装は良好ですが、脆弱性スキャンの自動化が最優先の改善項目です。
