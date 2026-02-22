# 作業記録: エラーハンドリングとセキュリティの整合性チェック

**作業日時**: 2026-02-15 00:08:52  
**作業概要**: エラーハンドリングとセキュリティの設計と実装の整合性確認  
**担当**: Subagent C (Context Gatherer)

---

## 1. 確認項目チェックリスト

### 1.1 カスタムエラークラス
- [x] `src/errors/index.ts` の確認
- [x] Steering Files との比較

### 1.2 再試行ロジック
- [x] `src/utils/retry.ts` の確認
- [x] Steering Files との比較

### 1.3 構造化ログ
- [x] `src/utils/logger.ts` の確認
- [x] Steering Files との比較

### 1.4 CloudWatch Alarms
- [x] `cdk/lib/constructs/cloudwatch-alarms.ts` の確認
- [x] Steering Files との比較

### 1.5 Secrets Manager
- [x] `cdk/lib/constructs/secrets-manager.ts` の確認
- [x] Steering Files との比較

### 1.6 WAF設定
- [x] `cdk/lib/stacks/api-stack.ts` の確認（WAF実装）
- [x] Steering Files との比較

### 1.7 テストカバレッジ
- [ ] カバレッジレポートの確認（未実施）

---

## 2. 発見された不整合

### 🔴 Critical（重大）

#### C-1: WAF Construct が存在しない
**ファイル**: `cdk/lib/constructs/waf.ts`  
**問題**: Steering Files では独立した WAF Construct の存在を想定しているが、実際には `api-stack.ts` に直接実装されている。

**現状**:
- WAF 設定は `cdk/lib/stacks/api-stack.ts` (L94-180) に直接記述
- 再利用可能な Construct として分離されていない

**影響**:
- コードの再利用性が低い
- テストが困難
- 他のスタックで WAF を使用する場合に重複コードが発生

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

---

### 🟠 High（高）

#### H-1: エラーログ構造の不整合
**ファイル**: `src/utils/logger.ts`  
**問題**: `createErrorContext` 関数の出力構造が Steering Files の要件と完全に一致していない。

**Steering Files 要件**:
```typescript
logger.error('Operation failed', {
    error_type: 'NetworkError',
    error_message: error.message,
    context: { disclosure_id: 'TD20240115001', retry_count: 2 },
    stack_trace: error.stack
});
```

**現状実装** (`src/utils/logger.ts` L186-195):
```typescript
export function createErrorContext(
  error: Error,
  additionalContext?: LogContext
): LogContext {
  return {
    error_type: error.constructor.name,
    error_message: error.message,
    stack_trace: error.stack,
    ...additionalContext,  // ← context でラップされていない
  };
}
```

**影響**:
- ログ構造が Steering Files の標準と異なる
- CloudWatch Logs Insights でのクエリが困難になる可能性

**修正提案**:
```typescript
export function createErrorContext(
  error: Error,
  additionalContext?: LogContext
): LogContext {
  return {
    error_type: error.constructor.name,
    error_message: error.message,
    context: additionalContext || {},  // ← context でラップ
    stack_trace: error.stack,
  };
}
```

#### H-2: CloudWatch Alarms の閾値が Steering Files と異なる
**ファイル**: `cdk/lib/constructs/cloudwatch-alarms.ts`  
**問題**: Lambda Duration アラームの閾値が Steering Files の要件と異なる。

**Steering Files 要件** (`monitoring-alerts.md`):
| メトリクス | 警告 | 重大 |
|-----------|------|------|
| Duration | > 10分 | > 13分 |

**現状実装** (`cloudwatch-alarms.ts` L27):
```typescript
const durationThreshold = props.durationThreshold ?? 840; // 14分 = 840秒
```

**影響**:
- アラートが遅れて発火する可能性
- 13分でタイムアウトする前に検知できない

**修正提案**:
```typescript
// 警告アラーム: 10分 (600秒)
const durationWarningThreshold = props.durationWarningThreshold ?? 600;
// 重大アラーム: 13分 (780秒)
const durationCriticalThreshold = props.durationCriticalThreshold ?? 780;
```

#### H-3: DLQ アラームの閾値が不整合
**ファイル**: `cdk/lib/constructs/cloudwatch-alarms.ts`  
**問題**: DLQ アラームが実装されていない。

**Steering Files 要件** (`error-handling-patterns.md`):
- DLQ設定（SQS/Lambda）
- CloudWatch Alarms（エラー率、DLQメッセージ数）

**現状実装**:
- Lambda Error Rate アラーム: ✅ 実装済み
- Lambda Throttles アラーム: ✅ 実装済み
- DLQ メッセージ数アラーム: ❌ 未実装

**影響**:
- DLQ にメッセージが溜まっても検知できない
- 失敗したメッセージの処理が遅れる

**修正提案**:
```typescript
// DLQ アラームを追加
const dlqAlarm = new cloudwatch.Alarm(this, 'DLQAlarm', {
  alarmName: `${functionName}-dlq-messages-${props.environment}`,
  alarmDescription: 'DLQ has messages',
  metric: dlq.metricApproximateNumberOfMessagesVisible(),
  threshold: 1,
  evaluationPeriods: 1,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
});
```

---

### 🟡 Medium（中）

#### M-1: Secrets Manager のローテーション実装が不完全
**ファイル**: `cdk/lib/constructs/secrets-manager.ts`  
**問題**: ローテーション用 Lambda 関数のコードパスが存在しない。

**現状実装** (`secrets-manager.ts` L68):
```typescript
code: lambda.Code.fromAsset('dist/src/lambda/api-key-rotation'),
```

**影響**:
- ローテーション有効化時にデプロイが失敗する
- Phase 4 実装時に問題が発生する

**修正提案**:
1. `src/lambda/api-key-rotation/index.ts` を作成
2. または、ローテーション機能を Phase 4 まで無効化
```typescript
const { environment, enableRotation = false, ... } = props; // デフォルトを false に変更
```

#### M-2: WAF レート制限が Steering Files と異なる
**ファイル**: `cdk/lib/stacks/api-stack.ts`  
**問題**: WAF レート制限の設定が Steering Files の要件と異なる。

**Steering Files 要件** (`security-best-practices.md`):
- レート制限: 5分間で2000リクエスト/IP

**現状実装** (`api-stack.ts` L111):
```typescript
rateBasedStatement: {
  limit: 2000,  // ← 5分間ではなく、1分間あたり
  aggregateKeyType: 'IP',
},
```

**影響**:
- レート制限が Steering Files の意図と異なる
- AWS WAF の `limit` は「5分間あたり」のリクエスト数を指定するため、実装は正しい可能性がある

**確認事項**:
- AWS WAF の `limit` パラメータの仕様を確認
- Steering Files の記述を明確化（「5分間で2000リクエスト」= 400リクエスト/分）

#### M-3: エラー分類ヘルパー関数の不整合
**ファイル**: `src/utils/retry.ts`  
**問題**: `isRetryableError` 関数が Steering Files の要件を完全にカバーしていない。

**Steering Files 要件** (`error-handling-patterns.md`):
| 分類 | 対応 | 例 |
|------|------|-----|
| **Retryable** | 再試行 | ECONNRESET, ETIMEDOUT, 5xx, ThrottlingException, 429 |

**現状実装** (`retry.ts` L115-138):
```typescript
export function isRetryableError(error: unknown): boolean {
  // RetryableErrorまたはそのサブクラス
  if (error instanceof RetryableError) {
    return true;
  }

  // ネットワークエラー
  const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
  if (networkErrors.some((code) => error.message.includes(code))) {
    return true;
  }

  // HTTPタイムアウト
  if (error.message.includes('timeout')) {
    return true;
  }

  // AWS一時的エラー
  const awsErrors = ['ThrottlingException', 'ServiceUnavailable', 'RequestTimeout'];
  if (awsErrors.some((code) => error.message.includes(code))) {
    return true;
  }

  return false;
}
```

**不足している判定**:
- HTTP 5xx エラー（500, 503 など）
- HTTP 429 エラー（Too Many Requests）

**影響**:
- HTTP エラーレスポンスが再試行されない可能性

**修正提案**:
```typescript
// HTTP ステータスコードのチェックを追加
if (error.response?.status >= 500 || error.response?.status === 429) {
  return true;
}
```

---

### 🟢 Low（低）

#### L-1: カスタムエラークラスのドキュメントが不足
**ファイル**: `src/errors/index.ts`  
**問題**: `DownloadError` クラスが Steering Files で言及されているが、実装されていない。

**Steering Files 参照** (`error-handling-implementation.md`):
```typescript
throw new DownloadError('PDF download failed', { cause: error });
```

**現状実装**:
- `DownloadError` クラスが存在しない

**影響**:
- Steering Files の例が実行できない
- エラー分類が不明確

**修正提案**:
```typescript
/**
 * ダウンロードエラー
 */
export class DownloadError extends RetryableError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
  }
}
```

#### L-2: Logger の Lambda 環境判定ロジックが冗長
**ファイル**: `src/utils/logger.ts`  
**問題**: Lambda 環境判定が2つの条件を使用しているが、統一されていない。

**現状実装** (`logger.ts` L35):
```typescript
const isLambdaEnvironment = !!process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production';
```

**影響**:
- 本番環境でも Winston を使用する可能性
- ログ出力が不安定になる可能性

**修正提案**:
```typescript
const isLambdaEnvironment = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
```

---

## 3. テストカバレッジ確認

### 未実施項目
- [ ] カバレッジレポートの生成と確認
- [ ] 目標値（80%）との比較

### 確認コマンド
```powershell
npm run test:coverage
```

---

## 4. 修正優先度と推奨順序

### Phase 1: Critical（即座に対応）
1. **C-1**: WAF Construct の分離（再利用性向上）

### Phase 2: High（早急に対応）
1. **H-1**: エラーログ構造の修正（標準化）
2. **H-2**: CloudWatch Alarms 閾値の修正（監視精度向上）
3. **H-3**: DLQ アラームの実装（失敗検知）

### Phase 3: Medium（計画的に対応）
1. **M-1**: Secrets Manager ローテーション実装の完成（Phase 4）
2. **M-2**: WAF レート制限の仕様確認と修正
3. **M-3**: エラー分類ヘルパー関数の拡張

### Phase 4: Low（時間があれば対応）
1. **L-1**: カスタムエラークラスの追加（DownloadError）
2. **L-2**: Logger の環境判定ロジック簡略化

---

## 5. 成果物

### 作成ファイル
- [x] `work-log-20260215-000852-error-security-consistency.md`

### 確認済みファイル
1. `.kiro/steering/core/error-handling-patterns.md`
2. `.kiro/steering/development/error-handling-implementation.md`
3. `.kiro/steering/security/security-best-practices.md`
4. `.kiro/steering/infrastructure/monitoring-alerts.md`
5. `src/errors/index.ts`
6. `src/utils/retry.ts`
7. `src/utils/logger.ts`
8. `cdk/lib/constructs/cloudwatch-alarms.ts`
9. `cdk/lib/constructs/secrets-manager.ts`
10. `cdk/lib/stacks/api-stack.ts` (WAF実装)

---

## 6. 申し送り事項

### 次のステップ
1. **Critical 不整合の修正**: WAF Construct の分離を優先的に実施
2. **High 不整合の修正**: エラーログ構造、CloudWatch Alarms 閾値、DLQ アラームの実装
3. **テストカバレッジ確認**: `npm run test:coverage` を実行し、80% 目標達成を確認
4. **Steering Files の更新**: 不整合が発見された箇所の Steering Files を更新（必要に応じて）

### 注意事項
- WAF レート制限の仕様（M-2）については、AWS 公式ドキュメントで確認が必要
- Secrets Manager ローテーション（M-1）は Phase 4 実装予定のため、現時点では無効化を推奨
- すべての修正は UTF-8 BOM なしで実施すること

---

## 7. 整合性チェック結果サマリー

| カテゴリ | 確認項目 | 状態 | 不整合数 |
|---------|---------|------|---------|
| エラーハンドリング | カスタムエラークラス | ⚠️ 部分的 | 1 (Low) |
| エラーハンドリング | 再試行ロジック | ⚠️ 部分的 | 1 (Medium) |
| エラーハンドリング | 構造化ログ | ⚠️ 部分的 | 2 (High, Low) |
| 監視 | CloudWatch Alarms | ⚠️ 部分的 | 2 (High) |
| セキュリティ | Secrets Manager | ⚠️ 部分的 | 1 (Medium) |
| セキュリティ | WAF設定 | ⚠️ 部分的 | 2 (Critical, Medium) |
| テスト | カバレッジ | ❌ 未確認 | - |

**合計不整合**: 10件（Critical: 1, High: 3, Medium: 3, Low: 2, 未確認: 1）

---

**作業完了日時**: 2026-02-15 00:08:52
