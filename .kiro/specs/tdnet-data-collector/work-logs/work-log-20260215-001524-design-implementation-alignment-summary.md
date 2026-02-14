# 設計と実装の整合性チェック - 統合レポート

**作業日時**: 2026-02-15 00:15:24  
**担当**: メインエージェント  
**サブエージェント**: A（データモデル・API）、B（Lambda・CDK）、C（エラーハンドリング・セキュリティ）

## エグゼクティブサマリー

Phase 3完了時点での設計書と実装の整合性を3つの領域で確認しました。

### 発見された不整合の総数

| 優先度 | サブエージェントA | サブエージェントB | サブエージェントC | 合計 |
|--------|------------------|------------------|------------------|------|
| 🔴 Critical | 3件 | 1件 | 1件 | **5件** |
| 🟠 High | 4件 | 2件 | 3件 | **9件** |
| 🟡 Medium | 3件 | 2件 | 3件 | **8件** |
| 🟢 Low | 2件 | 0件 | 2件 | **4件** |
| **合計** | **12件** | **5件** | **9件** | **26件** |

### 影響度評価

- **破壊的変更が必要**: 3件（フィールド名変更）
- **セキュリティリスク**: 3件（不要な権限、WAF設定）
- **コスト影響**: 1件（CloudWatch Logs保持期間）
- **機能不足**: 4件（month パラメータ、DLQアラーム、レート制限ヘッダー、DownloadError）

## Critical不整合（即座に対応）

### C-1: Disclosureモデルのフィールド不一致（サブエージェントA）

**問題**: 
- `pdf_url` と `s3_key` が必須フィールドだが、API仕様ではオプショナル
- `s3_key` と `pdf_s3_key` のフィールド名不一致
- `collected_at` と `downloaded_at` のフィールド名不一致

**影響**: 
- データ収集時にPDFがまだダウンロードされていない場合、バリデーションエラー
- APIレスポンスとモデルの変換でエラー
- **破壊的変更**: 既存データの移行が必要

**修正提案**:
1. `src/models/disclosure.ts` のフィールド定義を修正
   - `pdf_url?: string` （オプショナル）
   - `s3_key` → `pdf_s3_key?: string` （リネーム、オプショナル）
   - `collected_at` → `downloaded_at?: string` （リネーム、オプショナル）
2. `src/types/index.ts` の型定義を確認・修正
3. 全Lambda関数でフィールド名の変更に対応
4. DynamoDBデータ移行スクリプトを作成

**推定工数**: 8-12時間

---

### C-2: CloudWatch Logsの保持期間設定が実装されていない（サブエージェントB）

**問題**: Lambda関数のログ保持期間が設定されていない（デフォルトは無期限）

**影響**: 
- コスト増加（ログの無期限保存）
- ストレージ使用量の増加

**修正提案**:
```typescript
// cdk/lib/stacks/monitoring-stack.ts に追加
const collectorLogGroup = new logs.LogGroup(this, 'CollectorLogGroup', {
  logGroupName: `/aws/lambda/${props.lambdaFunctions.collector.functionName}`,
  retention: props.environment === 'prod' 
    ? logs.RetentionDays.THREE_MONTHS 
    : logs.RetentionDays.ONE_WEEK,
  removalPolicy: props.environment === 'prod'
    ? cdk.RemovalPolicy.RETAIN
    : cdk.RemovalPolicy.DESTROY,
});
// 他の8個のLambda関数も同様に設定
```

**推定工数**: 2-3時間

---

### C-3: WAF Construct が存在しない（サブエージェントC）

**問題**: WAF設定が `api-stack.ts` に直接実装されており、再利用可能なConstructとして分離されていない

**影響**: 
- コードの再利用性が低い
- テストが困難
- 他のスタックでWAFを使用する場合に重複コード

**修正提案**:
```typescript
// cdk/lib/constructs/waf.ts を新規作成
export class WafConstruct extends Construct {
  public readonly webAcl: wafv2.CfnWebACL;
  
  constructor(scope: Construct, id: string, props: WafConstructProps) {
    // WAF設定をapi-stack.tsから移動
  }
}
```

**推定工数**: 3-4時間

---

### C-4: OpenAPI仕様のフィールド名不一致（サブエージェントA）

**問題**: OpenAPI仕様では `pdf_s3_key` だが、実装では `s3_key`

**影響**: 
- APIレスポンスとOpenAPI仕様が一致しない
- クライアント側でフィールド名の不一致によるエラー

**修正提案**: C-1と同時に修正（`s3_key` → `pdf_s3_key`）

**推定工数**: C-1に含む

---

### C-5: DynamoDBスキーマとモデルの不一致（サブエージェントA）

**問題**: `disclosed_at` フィールドがDynamoDBスキーマに明示的に定義されていない

**影響**: 
- GSIのソートキーとして使用される `disclosed_at` が保存されない可能性
- クエリ時にGSIが正しく機能しない

**修正提案**: 
- DynamoDBはスキーマレスなので実際には問題ないが、ドキュメントで明確化
- モデル定義とDynamoDB定義の対応関係を明示的にドキュメント化

**推定工数**: 1-2時間（ドキュメント化のみ）

---

## High不整合（早急に対応）

### H-1: API_KEY_SECRET_ARN環境変数が5個のLambda関数で不要（サブエージェントB）

**問題**: Query, Export, Collect, ExportStatus, PdfDownload LambdaでAPI_KEY_SECRET_ARNが設定されているが、実装では使用されていない

**理由**: 2026-02-14にLambda関数でのSecrets Manager APIキー検証を削除（API Gateway認証のみ使用）

**影響**: 
- 不要な環境変数設定
- 不要なSecrets Manager権限付与（セキュリティリスク）

**修正提案**:
```typescript
// cdk/lib/stacks/compute-stack.ts
// Query, Export, Collect, ExportStatus, PdfDownload Lambdaから以下を削除:
// environment: { API_KEY_SECRET_ARN: props.apiKeySecret.secretArn }
// props.apiKeySecret.grantRead(this.xxxFunction);
```

**推定工数**: 1-2時間

---

### H-2: Secrets Manager権限が5個のLambda関数で不要（サブエージェントB）

**問題**: Query, Export, Collect, ExportStatus, PdfDownload LambdaにSecrets Manager読み取り権限が付与されているが、実装では使用されていない

**影響**: 最小権限の原則に違反、セキュリティリスク

**修正提案**: H-1と同時に修正（`grantRead(apiKeySecret)` を削除）

**推定工数**: H-1に含む

---

### H-3: エラーログ構造の不整合（サブエージェントC）

**問題**: `createErrorContext` 関数の出力構造がSteering Filesの要件と完全に一致していない

**Steering Files 要件**:
```typescript
logger.error('Operation failed', {
    error_type: 'NetworkError',
    error_message: error.message,
    context: { disclosure_id: 'TD20240115001', retry_count: 2 },
    stack_trace: error.stack
});
```

**現状実装**:
```typescript
return {
  error_type: error.constructor.name,
  error_message: error.message,
  stack_trace: error.stack,
  ...additionalContext,  // ← context でラップされていない
};
```

**影響**: 
- ログ構造がSteering Filesの標準と異なる
- CloudWatch Logs Insightsでのクエリが困難

**修正提案**:
```typescript
return {
  error_type: error.constructor.name,
  error_message: error.message,
  context: additionalContext || {},  // ← context でラップ
  stack_trace: error.stack,
};
```

**推定工数**: 1-2時間

---

### H-4: CloudWatch Alarmsの閾値が不整合（サブエージェントC）

**問題**: Lambda Duration アラームの閾値が Steering Files の要件と異なる

**Steering Files 要件**: 警告 > 10分、重大 > 13分  
**現状実装**: 14分（840秒）

**影響**: アラートが遅れて発火、13分でタイムアウトする前に検知できない

**修正提案**:
```typescript
// 警告アラーム: 10分 (600秒)
const durationWarningThreshold = props.durationWarningThreshold ?? 600;
// 重大アラーム: 13分 (780秒)
const durationCriticalThreshold = props.durationCriticalThreshold ?? 780;
```

**推定工数**: 1-2時間

---

### H-5: DLQアラームの実装不足（サブエージェントC）

**問題**: DLQメッセージ数のアラームが実装されていない

**影響**: DLQにメッセージが溜まっても検知できない

**修正提案**:
```typescript
const dlqAlarm = new cloudwatch.Alarm(this, 'DLQAlarm', {
  alarmName: `${functionName}-dlq-messages-${props.environment}`,
  alarmDescription: 'DLQ has messages',
  metric: dlq.metricApproximateNumberOfMessagesVisible(),
  threshold: 1,
  evaluationPeriods: 1,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
});
```

**推定工数**: 1-2時間

---

### H-6: APIレスポンス形式の不一致（サブエージェントA）

**問題**: API設計書には `status` フィールドがないが、OpenAPI仕様には存在

**影響**: API設計書とOpenAPI仕様の不一致

**修正提案**: 
1. OpenAPI仕様から `status` フィールドを削除（API設計書に合わせる）
2. または、実装を修正して `status: 'success'` を追加

**推定工数**: 1-2時間

---

### H-7: `month` パラメータの実装不足（サブエージェントA）

**問題**: OpenAPI仕様では `month` パラメータ（YYYY-MM形式）が定義されているが、実装では処理されていない

**影響**: 
- `month` パラメータを使用したクエリが機能しない
- `date_partition` GSIを使用した効率的なクエリができない

**修正提案**: `src/lambda/query/handler.ts` に `month` パラメータの処理を追加

**推定工数**: 2-3時間

---

### H-8: `collected_at` vs `downloaded_at` フィールド名の不一致（サブエージェントA）

**問題**: モデル定義では `collected_at`、API設計書では `downloaded_at`

**影響**: フィールド名の不一致により、APIレスポンスとモデルの変換でエラー

**修正提案**: C-1と同時に修正（`collected_at` → `downloaded_at`）

**推定工数**: C-1に含む

---

### H-9: エラー分類ヘルパー関数の不整合（サブエージェントC）

**問題**: `isRetryableError` 関数がHTTP 5xxエラーとHTTP 429エラーをカバーしていない

**影響**: HTTPエラーレスポンスが再試行されない可能性

**修正提案**:
```typescript
// HTTP ステータスコードのチェックを追加
if (error.response?.status >= 500 || error.response?.status === 429) {
  return true;
}
```

**推定工数**: 1時間

---

## Medium不整合（計画的に対応）

### M-1: Collect Status LambdaでS3_BUCKET環境変数が不要（サブエージェントB）

**問題**: Collect Status LambdaでS3_BUCKET環境変数が設定されているが、実装では使用されていない

**影響**: 不要な環境変数設定、不要なS3権限付与

**修正提案**: CDKから `S3_BUCKET` 環境変数と `grantRead(pdfsBucket)` 権限を削除

**推定工数**: 30分

---

### M-2: DLQ設定がCollector Lambdaのみ（サブエージェントB）

**問題**: Collector LambdaのみDLQが設定されている

**評価**: API Lambda関数はAPI Gateway統合のため、DLQは不要かもしれない（要確認）

**修正提案**: 設計書の意図を明確化し、必要に応じて他のLambda関数にもDLQを設定

**推定工数**: 2-3時間（設計判断含む）

---

### M-3: Secrets Managerのローテーション実装が不完全（サブエージェントC）

**問題**: ローテーション用Lambda関数のコードパスが存在しない

**影響**: ローテーション有効化時にデプロイが失敗する

**修正提案**: 
1. `src/lambda/api-key-rotation/index.ts` を作成
2. または、ローテーション機能をPhase 4まで無効化

**推定工数**: 4-6時間（Phase 4で実施予定）

---

### M-4: WAFレート制限が不整合（サブエージェントC）

**問題**: WAFレート制限の設定がSteering Filesの要件と異なる可能性

**確認事項**: AWS WAFの `limit` パラメータの仕様を確認

**推定工数**: 1-2時間（調査含む）

---

### M-5: エラーレスポンス形式の不一致（サブエージェントA）

**問題**: `request_id` が `context.awsRequestId` から取得されているが、API Gatewayの `requestId` と異なる場合がある

**修正提案**: API Gatewayの `requestContext.requestId` を使用することを推奨

**推定工数**: 1-2時間

---

### M-6: `file_size` フィールドの型不一致（サブエージェントA）

**問題**: OpenAPI仕様では `file_size` に最大値（10MB）が定義されているが、モデル定義やバリデーションでは最大値チェックがない

**影響**: 10MBを超えるPDFファイルがダウンロードされた場合、バリデーションエラーが発生しない

**修正提案**: モデル定義にファイルサイズのバリデーションを追加

**推定工数**: 1-2時間

---

### M-7: `total_count` フィールドの不一致（サブエージェントA）

**問題**: OpenAPI仕様の `CollectionStatusResponse` では `total_count` フィールドが定義されているが、API設計書では記載がない

**修正提案**: API設計書に `total_count` フィールドを追加

**推定工数**: 30分

---

### M-8: エラー分類ヘルパー関数の不整合（サブエージェントC）

**問題**: `isRetryableError` 関数がHTTP 5xxエラーとHTTP 429エラーをカバーしていない

**修正提案**: H-9と同じ（重複）

**推定工数**: H-9に含む

---

## Low不整合（時間があれば対応）

### L-1: レート制限ヘッダーの実装不足（サブエージェントA）

**問題**: OpenAPI仕様ではレート制限ヘッダーが定義されているが、実装では返されていない

**影響**: クライアント側でレート制限の状態を把握できない

**修正提案**: Lambda関数でレート制限ヘッダーを返却する処理を追加、または、OpenAPI仕様から削除

**推定工数**: 2-3時間

---

### L-2: `format` パラメータのデフォルト値の不一致（サブエージェントA）

**問題**: OpenAPI仕様に `default: json` の記載がない

**修正提案**: OpenAPI仕様に `default: json` を追加

**推定工数**: 10分

---

### L-3: カスタムエラークラスのドキュメントが不足（サブエージェントC）

**問題**: `DownloadError` クラスがSteering Filesで言及されているが、実装されていない

**修正提案**:
```typescript
export class DownloadError extends RetryableError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
  }
}
```

**推定工数**: 30分

---

### L-4: Loggerの環境判定ロジックが冗長（サブエージェントC）

**問題**: Lambda環境判定が2つの条件を使用しているが、統一されていない

**修正提案**:
```typescript
const isLambdaEnvironment = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
```

**推定工数**: 10分

---

## 修正実施計画

### Phase 1: Critical不整合の修正（即座に実施）

**優先度**: 🔴 最高  
**推定工数**: 14-21時間  
**担当**: サブエージェント並列実行

#### タスク1: Disclosureモデルのフィールド修正（C-1, C-4, H-8）
- **サブエージェントA**: フィールド定義修正、型定義修正、Lambda関数対応
- **推定工数**: 8-12時間
- **破壊的変更**: データ移行スクリプト作成

#### タスク2: CloudWatch Logsの保持期間設定（C-2）
- **サブエージェントB**: monitoring-stack.tsにLogGroup追加（9個のLambda関数）
- **推定工数**: 2-3時間

#### タスク3: WAF Construct分離（C-3）
- **サブエージェントC**: waf.ts新規作成、api-stack.ts修正
- **推定工数**: 3-4時間

#### タスク4: DynamoDBスキーマドキュメント化（C-5）
- **サブエージェントA**: ドキュメント作成
- **推定工数**: 1-2時間

---

### Phase 2: High不整合の修正（早急に実施）

**優先度**: 🟠 高  
**推定工数**: 9-15時間  
**担当**: サブエージェント並列実行

#### タスク5: 不要な環境変数とSecrets Manager権限の削除（H-1, H-2）
- **サブエージェントB**: compute-stack.ts修正（5個のLambda関数）
- **推定工数**: 1-2時間

#### タスク6: エラーログ構造の修正（H-3）
- **サブエージェントC**: logger.ts修正、全Lambda関数テスト
- **推定工数**: 1-2時間

#### タスク7: CloudWatch Alarmsの閾値修正（H-4）
- **サブエージェントC**: cloudwatch-alarms.ts修正
- **推定工数**: 1-2時間

#### タスク8: DLQアラームの実装（H-5）
- **サブエージェントC**: cloudwatch-alarms.ts修正
- **推定工数**: 1-2時間

#### タスク9: APIレスポンス形式の統一（H-6）
- **サブエージェントA**: OpenAPI仕様修正、または実装修正
- **推定工数**: 1-2時間

#### タスク10: `month` パラメータの実装（H-7）
- **サブエージェントA**: query/handler.ts修正、テスト追加
- **推定工数**: 2-3時間

#### タスク11: エラー分類ヘルパー関数の拡張（H-9）
- **サブエージェントC**: retry.ts修正、テスト追加
- **推定工数**: 1時間

---

### Phase 3: Medium不整合の修正（計画的に実施）

**優先度**: 🟡 中  
**推定工数**: 10-17時間  
**担当**: サブエージェント並列実行

#### タスク12: 不要な環境変数の削除（M-1）
- **サブエージェントB**: compute-stack.ts修正
- **推定工数**: 30分

#### タスク13: DLQ設定の方針確認（M-2）
- **メインエージェント**: 設計判断、必要に応じてCDK修正
- **推定工数**: 2-3時間

#### タスク14: Secrets Managerローテーション実装（M-3）
- **Phase 4で実施予定**: api-key-rotation/index.ts作成
- **推定工数**: 4-6時間

#### タスク15: WAFレート制限の仕様確認（M-4）
- **サブエージェントC**: AWS公式ドキュメント確認、必要に応じて修正
- **推定工数**: 1-2時間

#### タスク16: エラーレスポンス形式の修正（M-5）
- **サブエージェントA**: Lambda関数修正
- **推定工数**: 1-2時間

#### タスク17: ファイルサイズバリデーション追加（M-6）
- **サブエージェントA**: disclosure.ts修正、テスト追加
- **推定工数**: 1-2時間

#### タスク18: API設計書の更新（M-7）
- **サブエージェントA**: api-design.md修正
- **推定工数**: 30分

---

### Phase 4: Low不整合の修正（時間があれば実施）

**優先度**: 🟢 低  
**推定工数**: 3-4時間  
**担当**: サブエージェント並列実行

#### タスク19: レート制限ヘッダーの実装（L-1）
- **サブエージェントA**: Lambda関数修正、またはOpenAPI仕様修正
- **推定工数**: 2-3時間

#### タスク20: OpenAPI仕様のデフォルト値追加（L-2）
- **サブエージェントA**: openapi.yaml修正
- **推定工数**: 10分

#### タスク21: DownloadErrorクラスの追加（L-3）
- **サブエージェントC**: errors/index.ts修正
- **推定工数**: 30分

#### タスク22: Logger環境判定ロジックの簡略化（L-4）
- **サブエージェントC**: logger.ts修正
- **推定工数**: 10分

---

## 総推定工数

| Phase | 優先度 | 推定工数 | 並列実行 | 実質工数 |
|-------|--------|---------|---------|---------|
| Phase 1 | 🔴 Critical | 14-21時間 | 3サブエージェント | 5-7時間 |
| Phase 2 | 🟠 High | 9-15時間 | 3サブエージェント | 3-5時間 |
| Phase 3 | 🟡 Medium | 10-17時間 | 3サブエージェント | 4-6時間 |
| Phase 4 | 🟢 Low | 3-4時間 | 3サブエージェント | 1-2時間 |
| **合計** | - | **36-57時間** | - | **13-20時間** |

---

## 次のステップ

1. **Phase 1の実施**: Critical不整合の修正（サブエージェント並列実行）
2. **テスト実行**: 修正後の全テスト実行（npm test）
3. **デプロイ検証**: 開発環境へのデプロイとスモークテスト
4. **Phase 2の実施**: High不整合の修正
5. **Phase 3の実施**: Medium不整合の修正（時間があれば）
6. **Phase 4の実施**: Low不整合の修正（時間があれば）

---

## 申し送り事項

### 破壊的変更の注意
- **C-1（Disclosureモデルのフィールド修正）**: 既存データの移行が必要
- DynamoDBデータ移行スクリプトを作成し、本番環境への適用前に十分なテストを実施

### セキュリティリスクの軽減
- **H-1, H-2（不要なSecrets Manager権限）**: 早急に削除してセキュリティリスクを軽減

### コスト削減
- **C-2（CloudWatch Logs保持期間）**: 早急に設定してコストを削減

### Phase 4実装との連携
- **M-3（Secrets Managerローテーション）**: Phase 4で実施予定のため、現時点では無効化を推奨

---

**作業完了日時**: 2026-02-15 00:15:24
