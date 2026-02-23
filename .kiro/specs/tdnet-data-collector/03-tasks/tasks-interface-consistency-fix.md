# タスク: インターフェース整合性修正

**作成日時**: 2026-02-23 14:01:47  
**優先度**: Critical → 高 → 中 → 低  
**カテゴリ**: バグ修正・品質改善  
**関連**: tasks-interface-consistency-check.md

## 概要

コードインターフェース整合性点検で検出された不整合を優先順位順に修正する。

## 点検結果サマリー

**点検実施日時**: 2026-02-23 15:30:00  
**点検方法**: 5つのサブエージェントによる並列点検  
**点検領域**: Lambda関数間、AWS統合、共通ユーティリティ、テストコード、CDK/スクリプト

**検出された不整合**: 17件
- Critical（即座に修正が必要）: 4件
- High/Medium（早急に修正推奨）: 8件
- Low（改善推奨）: 5件

**点検作業記録**:
- `work-log-20260223-153125-subagent1-lambda-interface-check.md`
- `work-log-20260223-153155-subagent2-aws-integration-check.md`
- `work-log-20260223-153145-subagent3-utils-interface-check.md`
- `work-log-20260223-153140-subagent4-test-interface-check.md`
- `work-log-20260223-153046-subagent5-cdk-scripts-check.md`

## 修正タスク一覧

### Critical（即座に修正が必要）

#### タスク1: Step Functions Map Iterator コンテキスト修正
**点検結果**: [C-1] Subagent 1で検出
**優先度**: Critical  
**工数見積**: 4時間  
**担当**: 未定

**問題**:
- Map Iteratorに渡される要素が日付文字列のみ
- `start_date`, `end_date`, `max_items`, `execution_id`が欠落
- State Machine定義が存在しないパスを参照

**影響範囲**:
- `src/lambda/collector-init/handler.ts`
- `src/lambda/collector-fetch/handler.ts`
- `src/lambda/collector-save/handler.ts`
- `scripts/step-functions/state-machine-definition.json`

**修正内容**:
1. collector-initの`pages`配列を各要素をオブジェクトに変更
   ```typescript
   pages: dates.map(date => ({
     page_number: date,
     start_date: event.start_date,
     end_date: event.end_date,
     max_items: maxItems,
     execution_id: event.execution_id,
   }))
   ```

2. State Machine定義のMap Iteratorを修正
   ```json
   "Parameters": {
     "page_number.$": "$.page_number",
     "start_date.$": "$.start_date",
     "end_date.$": "$.end_date",
     "max_items.$": "$.max_items",
     "execution_id.$": "$.execution_id"
   }
   ```

3. 関連テストを更新
   - `src/lambda/collector-init/__tests__/handler.test.ts`
   - `src/__tests__/e2e/step-functions-collector.e2e.test.ts`

4. E2Eテストで動作確認

**完了条件**:
- [ ] collector-init出力型が修正済み
- [ ] State Machine定義が修正済み
- [ ] ユニットテストが成功
- [ ] E2Eテストが成功
- [ ] 作業記録作成

---

#### タスク2: Logger createErrorContext関数の実装
**点検結果**: [C-3] Subagent 2で検出  
**優先度**: Critical  
**工数見積**: 1時間  
**担当**: 未定

**問題**:
- `src/utils/logger.ts`に`createErrorContext`関数が存在しない
- 複数のLambda関数でインポートエラー発生
  - `src/lambda/collector-save/handler.ts`
  - `src/lambda/collector-fetch/handler.ts`
  - `src/lambda/stats/handler.ts`
  - `src/lambda/collector-init/handler.ts`

**影響範囲**:
- `src/utils/logger.ts`
- 上記4つのLambda関数

**修正内容**:
1. `createErrorContext`関数を実装
   ```typescript
   export function createErrorContext(
     error: Error,
     additionalContext?: LogContext
   ): LogContext {
     return {
       error_type: error.constructor.name,
       error_message: error.message,
       context: additionalContext || {},
       stack_trace: error.stack,
     };
   }
   ```

2. 型チェック実行
   ```bash
   npm run type-check
   ```

3. 関連テストを実行

**完了条件**:
- [ ] `createErrorContext`関数実装済み
- [ ] 型チェックが成功
- [ ] ユニットテストが成功
- [ ] 作業記録作成

---

#### タスク3: ExecutionStatus型の統一
**点検結果**: [C-4] Subagent 2で検出  
**優先度**: Critical  
**工数見積**: 2時間  
**担当**: 未定

**問題**:
- `src/types/index.ts`と`src/lambda/collector/update-execution-status.ts`で異なる定義
- フィールド名不一致: `success_count` vs `collected_count`

**影響範囲**:
- `src/types/index.ts`
- `src/lambda/collector/update-execution-status.ts`
- 関連するすべてのLambda関数

**修正内容**:
1. `src/types/index.ts`の`ExecutionStatus`型を正式版とする
2. `src/lambda/collector/update-execution-status.ts`の独自型定義を削除
3. フィールド名を`success_count`に統一
4. 関連するすべてのLambda関数を更新
5. 関連テストを更新

**完了条件**:
- [ ] 型定義が統一済み
- [ ] すべてのLambda関数が更新済み
- [ ] 型チェックが成功
- [ ] ユニットテストが成功
- [ ] 作業記録作成

---

#### タスク4: CollectorInit実行ID追加
**点検結果**: [C-2] Subagent 1で検出  
**優先度**: Critical  
**工数見積**: 1時間  
**担当**: 未定

**問題**:
- State MachineからInitEventに`execution_id`が渡されていない
- InitEventは`execution_id`を必須としている

**影響範囲**:
- `scripts/step-functions/state-machine-definition.json`

**修正内容**:
1. State Machine定義のCollectorInit呼び出しを修正
   ```json
   "Parameters": {
     "FunctionName": "tdnet-collector-init",
     "Payload": {
       "start_date.$": "$.start_date",
       "end_date.$": "$.end_date",
       "execution_id.$": "$$.Execution.Name"
     }
   }
   ```

2. E2Eテストで動作確認

**完了条件**:
- [ ] State Machine定義が修正済み
- [ ] E2Eテストが成功
- [ ] 作業記録作成

---

### 高（次回リリースで修正）

#### タスク5: collector-aggregate パラメータ名統一
**点検結果**: [H-1] Subagent 1で検出  
**優先度**: 高  
**工数見積**: 1時間  
**担当**: 未定

**問題**:
- State Machine定義: `map_results`
- Lambda入力型: `results`

**影響範囲**:
- `src/lambda/collector-aggregate/handler.ts`
- `scripts/step-functions/state-machine-definition.json`

**修正内容**:
1. Lambda入力型を`map_results`に変更
   ```typescript
   interface AggregateEvent {
     execution_id: string;
     map_results: Array<{ ... }>;  // resultsから変更
   }
   ```

2. handler内の参照を更新
   ```typescript
   const { execution_id, map_results } = event;
   ```

3. 関連テストを更新
   - `src/lambda/collector-aggregate/__tests__/handler.test.ts`

**完了条件**:
- [ ] Lambda入力型が修正済み
- [ ] handler実装が修正済み
- [ ] ユニットテストが成功
- [ ] 作業記録作成

---

#### タスク6: SaveResponse失敗詳細の保持
**点検結果**: [H-2] Subagent 1で検出  
**優先度**: 高  
**工数見積**: 2時間  
**担当**: 未定

**問題**:
- SaveResponseの`failed_items`がAggregateEventに含まれていない
- 失敗した開示情報の詳細が集約時に失われる

**影響範囲**:
- `src/lambda/collector-aggregate/handler.ts`
- `src/lambda/collector-save/handler.ts`

**修正内容**:
1. AggregateEventに`failed_items`を追加
   ```typescript
   interface AggregateEvent {
     execution_id: string;
     map_results: Array<{
       saveResult?: {
         page_number: string;
         saved_count: number;
         failed_count: number;
         failed_items?: Array<{
           disclosure_id: string;
           error: string;
         }>;
       };
     }>;
   }
   ```

2. collector-aggregateで失敗詳細を集約
3. 関連テストを更新

**完了条件**:
- [ ] AggregateEvent型が修正済み
- [ ] collector-aggregate実装が修正済み
- [ ] ユニットテストが成功
- [ ] 作業記録作成

---

#### タスク7: DynamoDB APIレベルの統一
**点検結果**: [M-3] Subagent 2で検出  
**優先度**: 高  
**工数見積**: 4時間  
**担当**: 未定

**問題**:
- 低レベルAPI（DynamoDBClient + marshall/unmarshall）と高レベルAPI（DynamoDBDocumentClient）が混在
- コードの一貫性欠如

**影響範囲**:
- `src/lambda/collector/save-metadata.ts`
- `src/lambda/query/query-disclosures.ts`
- その他DynamoDB操作を行うLambda関数

**修正内容**:
1. すべてのDynamoDB操作をDynamoDBDocumentClientに統一
2. `marshall`/`unmarshall`の使用を削除
3. 型定義を`Record<string, any>`に統一
4. 関連テストを更新

**完了条件**:
- [ ] すべてのLambda関数が修正済み
- [ ] ユニットテストが成功
- [ ] E2Eテストが成功
- [ ] 作業記録作成

---

#### タスク8: 環境変数型定義ファイル作成
**点検結果**: [M-9] Subagent 5で検出  
**優先度**: 高  
**工数見積**: 3時間  
**担当**: 未定

**問題**:
- `src/types/env.ts`が存在しない
- 環境変数の型安全性が保証されていない
- 必須環境変数の検証が実装されていない

**影響範囲**:
- 全Lambda関数

**修正内容**:
1. `src/types/env.ts`を作成
   ```typescript
   export interface LambdaEnvironment {
     // AWS設定
     AWS_REGION: string;
     AWS_LAMBDA_FUNCTION_NAME: string;
     
     // DynamoDB
     DYNAMODB_DISCLOSURES_TABLE: string;
     DYNAMODB_EXECUTIONS_TABLE: string;
     DYNAMODB_EXPORT_STATUS_TABLE: string;
     
     // S3
     S3_PDFS_BUCKET: string;
     S3_EXPORTS_BUCKET: string;
     
     // 外部API
     TDNET_BASE_URL: string;
     
     // ログ設定
     LOG_LEVEL: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
     ENVIRONMENT: 'local' | 'dev' | 'prod';
     
     // Step Functions（オプション）
     STATE_MACHINE_ARN?: string;
     EXECUTION_STATE_TABLE?: string;
     
     // その他
     NODE_OPTIONS: string;
   }
   
   export function validateEnvironment(required: (keyof LambdaEnvironment)[]): void {
     const missing = required.filter(key => !process.env[key]);
     if (missing.length > 0) {
       throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
     }
   }
   ```

2. 各Lambda関数で型定義をインポート
3. `process.env.*`の参照を型安全に

**完了条件**:
- [ ] `src/types/env.ts`作成済み
- [ ] 各Lambda関数で使用
- [ ] 型チェックが成功
- [ ] 作業記録作成

---

#### タスク9: Secrets Manager参照の統一
**点検結果**: [M-10] Subagent 5で検出  
**優先度**: 高  
**工数見積**: 2時間  
**担当**: 未定

**問題**:
- Lambda関数で`API_KEY_SECRET_NAME`環境変数が未設定
- 運用スクリプトとLambda関数で異なるシークレット名を参照する可能性

**影響範囲**:
- `cdk/lib/stacks/api-stack.ts`
- Lambda関数（query, export等）

**修正内容**:
1. CDKで`API_KEY_SECRET_NAME`環境変数を設定
   ```typescript
   queryFunction.addEnvironment('API_KEY_SECRET_NAME', secretsManager.apiKeySecret.secretName);
   ```

2. Lambda関数で環境変数を参照
   ```typescript
   const secretName = process.env.API_KEY_SECRET_NAME;
   if (!secretName) {
     throw new Error('API_KEY_SECRET_NAME environment variable is not set');
   }
   ```

3. 関連テストを更新

**完了条件**:
- [ ] CDK設定修正済み
- [ ] Lambda関数修正済み
- [ ] ユニットテストが成功
- [ ] 作業記録作成

---

#### タスク10: API Gateway認証の二重検証削除
**点検結果**: [M-11] Subagent 5で検出  
**優先度**: 高  
**工数見積**: 1時間  
**担当**: 未定

**問題**:
- Lambda関数内でAPIキー検証を実装しているが、API Gatewayで既に検証済み
- 環境変数`API_KEY`が未設定（CDKで設定されていない）

**影響範囲**:
- `src/lambda/query/handler.ts`
- `src/lambda/export/handler.ts`

**修正内容**:
1. `validateApiKey`関数を削除
2. handler関数から`validateApiKey`呼び出しを削除
3. 関連テストを更新

**完了条件**:
- [ ] query Lambda修正済み
- [ ] export Lambda修正済み
- [ ] ユニットテストが成功
- [ ] 作業記録作成

---

### 中（計画的に対応）

#### タスク11: Secrets Manager統合実装
**優先度**: 中  
**工数見積**: 3時間  
**担当**: 未定

**問題**:
- Lambda関数（query, export）が環境変数`API_KEY`を直接参照
- `getApiKey()`関数は実装済みだが未使用
- APIキーローテーション時に再デプロイが必要

**影響範囲**:
- `src/lambda/query/handler.ts`
- `src/lambda/export/handler.ts`
- `cdk/lib/stacks/api-stack.ts`

**修正内容**:
1. `validateApiKey()`を非同期化
   ```typescript
   async function validateApiKey(event: APIGatewayProxyEvent): Promise<void> {
     const apiKey = event.headers?.['x-api-key'] || event.headers?.['X-Api-Key'];
     const expectedApiKey = await getApiKey(); // Secrets Managerから動的取得
     if (!apiKey || apiKey !== expectedApiKey) {
       throw new AuthenticationError('Invalid API key');
     }
   }
   ```

2. handler関数を非同期化（既に非同期の場合は不要）

3. CDKでSecrets Manager統合設定
   - Lambda関数にSecrets Manager読み取り権限を付与
   - 環境変数`API_KEY_SECRET_NAME`を設定

4. 関連テストを更新
   - モックを`getApiKey()`に対応

**完了条件**:
- [ ] query Lambda修正済み
- [ ] export Lambda修正済み
- [ ] CDK設定修正済み
- [ ] ユニットテストが成功
- [ ] E2Eテストが成功
- [ ] 作業記録作成

---

#### タスク12: Zodスキーマ活用実装
**点検結果**: [M-12] Subagent 3で検出  
**優先度**: 中  
**工数見積**: 6時間  
**担当**: 未定

**問題**:
- Zodスキーマが定義されているが実際には使用されていない
- 各Lambda関数で独自のバリデーションを重複実装
- 型定義とZodスキーマの二重管理

**影響範囲**:
- `src/validators/*.ts`
- 全Lambda関数の`handler.ts`

**修正内容**:
1. 各Lambda関数でZodスキーマをインポート
   ```typescript
   import { disclosureSchema, queryFilterSchema } from '../../validators/disclosure-schema';
   ```

2. 手動バリデーションをZodスキーマに置き換え
   ```typescript
   // 修正前
   if (!event.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(event.startDate)) {
     throw new ValidationError('Invalid startDate');
   }
   
   // 修正後
   const validated = queryFilterSchema.parse(event);
   ```

3. 型定義を`DisclosureZod`に統一

4. 関連テストを更新

**完了条件**:
- [ ] collector-init修正済み
- [ ] collector-fetch修正済み
- [ ] query修正済み
- [ ] export修正済み
- [ ] その他Lambda修正済み
- [ ] ユニットテストが成功
- [ ] 作業記録作成

---

#### タスク13: エラークラス統一実装
**優先度**: 中  
**工数見積**: 2時間  
**担当**: 未定

**問題**:
- Step Functions統合Lambdaでカスタムエラークラスが未使用

**影響範囲**:
- `src/lambda/collector-aggregate/handler.ts`
- `src/lambda/collector-save/handler.ts`

**修正内容**:
1. カスタムエラークラスをインポート
   ```typescript
   import { ValidationError, RetryableError } from '../../errors';
   ```

2. 汎用Errorをカスタムエラークラスに置き換え
   ```typescript
   // 修正前
   throw new Error('Invalid input');
   
   // 修正後
   throw new ValidationError('Invalid input');
   ```

3. エラーハンドリングを統一

4. 関連テストを更新

**完了条件**:
- [ ] collector-aggregate修正済み
- [ ] collector-save修正済み
- [ ] ユニットテストが成功
- [ ] 作業記録作成

---

#### タスク14: ExecutionStatus型の拡張
**点検結果**: [M-5] Subagent 1で検出  
**優先度**: 中  
**工数見積**: 1時間  
**担当**: 未定

**問題**:
- `types/index.ts`: `status: 'pending' | 'running' | 'completed' | 'failed'`
- `collect-status/handler.ts`: Step Functions統合時に`succeeded`, `timed_out`, `aborted`が追加される

**影響範囲**:
- `src/types/index.ts`
- `src/lambda/collect-status/handler.ts`

**修正内容**:
1. `types/index.ts`の`ExecutionStatus`型を更新
   ```typescript
   status: 'pending' | 'running' | 'completed' | 'failed' | 'succeeded' | 'timed_out' | 'aborted';
   ```

2. 関連テストを更新

**完了条件**:
- [ ] 型定義が更新済み
- [ ] 型チェックが成功
- [ ] ユニットテストが成功
- [ ] 作業記録作成

---

#### タスク15: ExportEvent型の追加
**点検結果**: [M-6] Subagent 1で検出  
**優先度**: 中  
**工数見積**: 1時間  
**担当**: 未定

**問題**: `export/handler.ts`で`ExportEvent`型を使用しているが、`types/index.ts`に定義されていない

**影響範囲**: `src/lambda/export/handler.ts`

**修正内容**:
1. `ExportEvent`の型定義を確認
2. 必要に応じて`extends APIGatewayProxyEvent`を追加

**完了条件**:
- [ ] 型定義確認済み
- [ ] 必要に応じて修正
- [ ] ユニットテストが成功

---

#### タスク16: 環境変数命名規則の統一
**点検結果**: [M-4] Subagent 2, 5で検出  
**優先度**: 中  
**工数見積**: 2時間  
**担当**: 未定

**問題**:
- `DYNAMODB_TABLE` vs `DYNAMODB_TABLE_NAME`
- `S3_BUCKET` vs `S3_BUCKET_NAME`

**影響範囲**:
- CDKスタック
- 全Lambda関数

**修正内容**:
1. 環境変数名を統一（`DYNAMODB_DISCLOSURES_TABLE`, `S3_PDFS_BUCKET`等）
2. CDK定義を更新
3. Lambda関数を更新
4. 関連テストを更新

**完了条件**:
- [ ] CDK定義が更新済み
- [ ] Lambda関数が更新済み
- [ ] 型チェックが成功
- [ ] ユニットテストが成功
- [ ] 作業記録作成

---

#### タスク17: 再試行ロジック実装
**優先度**: 中  
**工数見積**: 3時間  
**担当**: 未定

**問題**: 一部Lambda関数で外部API/AWS SDK呼び出しに再試行が未実装

**影響範囲**: collector-aggregate, collector-save等

**修正内容**:
1. `retryWithBackoff`をインポート
2. AWS SDK呼び出しを`retryWithBackoff`でラップ
3. 関連テストを更新

**完了条件**:
- [ ] collector-aggregate修正済み
- [ ] collector-save修正済み
- [ ] ユニットテストが成功

---

#### タスク18: エラー分類テスト追加
**優先度**: 中  
**工数見積**: 3時間  
**担当**: 未定

**問題**: collector-aggregate, collector-save等でエラー分類テストが不足

**影響範囲**: テストファイル

**修正内容**:
1. `error-handling-patterns.md`のテストパターンを適用
2. Retryable/Non-Retryable/Partial Failureのテストを追加

**完了条件**:
- [ ] collector-aggregateテスト追加
- [ ] collector-saveテスト追加
- [ ] テストが成功

---

### 低（必要に応じて対応）

#### タスク19: 未使用エラークラスの整理
**点検結果**: [L-2] Subagent 3で検出  
**優先度**: 低  
**工数見積**: 0.5時間  
**担当**: 未定

**問題**:
- `RateLimitError`, `ConfigurationError`, `DownloadError`が定義されているが使用されていない

**影響範囲**:
- `src/errors/index.ts`

**修正内容**:
1. 使用予定を確認
2. 不要な場合は削除、必要な場合は保持

**完了条件**:
- [ ] 使用予定確認済み
- [ ] 必要に応じて削除
- [ ] 作業記録作成

---

#### タスク20: CloudWatch Logs保持期間の設定
**点検結果**: [L-6] Subagent 5で検出  
**優先度**: 低  
**工数見積**: 1時間  
**担当**: 未定

**問題**: 本番環境でLogGroupsをCDKで管理していない

**影響範囲**:
- `cdk/lib/stacks/monitoring-stack.ts`

**修正内容**:
1. 本番環境でもLogGroupsを作成し、保持期間を設定
2. 既存のLogGroupsがある場合は手動で削除が必要

**完了条件**:
- [ ] CDK設定修正済み
- [ ] デプロイ確認済み
- [ ] 作業記録作成

---

#### タスク21: Step Functions ARNの取得方法改善
**点検結果**: [L-5] Subagent 5で検出  
**優先度**: 低  
**工数見積**: 0.5時間  
**担当**: 未定

**問題**: 運用スクリプトでStateMachine名を推測している

**影響範囲**:
- `scripts/cancel-step-functions-execution.ps1`

**修正内容**:
1. Step Functions有効時のみStateMachineArnを使用
2. 無効時は適切なエラーメッセージを表示

**完了条件**:
- [ ] スクリプト修正済み
- [ ] 動作確認済み
- [ ] 作業記録作成

---

#### タスク22: DisclosureMetadata vs Disclosure型のドキュメント化
**点検結果**: [L-7] Subagent 1で検出  
**優先度**: 低  
**工数見積**: 0.5時間  
**担当**: 未定

**問題**: 類似した型が2つ存在し、用途が不明確

**影響範囲**:
- `src/scraper/html-parser.ts`
- `src/types/index.ts`

**修正内容**:
1. 用途をドキュメント化
   - `DisclosureMetadata`: スクレイピング結果（PDF未ダウンロード）
   - `Disclosure`: DynamoDB保存用（PDF S3キー含む）

**完了条件**:
- [ ] JSDocコメント追加済み
- [ ] README更新済み
- [ ] 作業記録作成

---

#### タスク23: 非同期Lambda 実装状況確認
**優先度**: 低  
**工数見積**: 1時間  
**担当**: 未定

**問題**: dlq-processor, api-key-rotationファイルが存在しない

**修正内容**:
1. 実装が必要か確認
2. 不要な場合はドキュメントから削除

**完了条件**:
- [ ] 実装状況確認済み
- [ ] 必要に応じて実装またはドキュメント更新

---

#### タスク24: Logger文字化けの修正
**点検結果**: [L-1] Subagent 3で検出  
**優先度**: 低  
**工数見積**: 0.5時間  
**担当**: 未定

**問題**: `src/utils/logger.ts`のコメントが文字化けしている

**影響範囲**:
- `src/utils/logger.ts`

**修正内容**:
1. UTF-8 BOM無しで再保存
2. 文字化けしたコメントを修正

**完了条件**:
- [ ] ファイルが修正済み
- [ ] 作業記録作成

---

## 実施順序

### フェーズ1: Critical修正（即座に実施）
1. タスク1: Step Functions Map Iterator コンテキスト修正（4時間）
2. タスク2: Logger createErrorContext関数の実装（1時間）
3. タスク3: ExecutionStatus型の統一（2時間）
4. タスク4: CollectorInit実行ID追加（1時間）

### フェーズ2: 高優先度修正（次回リリース）
5. タスク5: collector-aggregate パラメータ名統一（1時間）
6. タスク6: SaveResponse失敗詳細の保持（2時間）
7. タスク7: DynamoDB APIレベルの統一（4時間）
8. タスク8: 環境変数型定義ファイル作成（3時間）
9. タスク9: Secrets Manager参照の統一（2時間）
10. タスク10: API Gateway認証の二重検証削除（1時間）

### フェーズ3: 中優先度修正（計画的に対応）
11. タスク11: Secrets Manager統合実装（3時間）
12. タスク12: Zodスキーマ活用実装（6時間）
13. タスク13: エラークラス統一実装（2時間）
14. タスク14: ExecutionStatus型の拡張（1時間）
15. タスク15: ExportEvent型の追加（1時間）
16. タスク16: 環境変数命名規則の統一（2時間）
17. タスク17: 再試行ロジック実装（3時間）
18. タスク18: エラー分類テスト追加（3時間）

### フェーズ4: 低優先度修正（必要に応じて対応）
19. タスク19: 未使用エラークラスの整理（0.5時間）
20. タスク20: CloudWatch Logs保持期間の設定（1時間）
21. タスク21: Step Functions ARNの取得方法改善（0.5時間）
22. タスク22: DisclosureMetadata vs Disclosure型のドキュメント化（0.5時間）
23. タスク23: 非同期Lambda 実装状況確認（1時間）
24. タスク24: Logger文字化けの修正（0.5時間）

## 全体工数見積

- **Critical**: 8時間（4タスク）
- **高**: 13時間（6タスク）
- **中**: 21時間（8タスク）
- **低**: 4時間（6タスク）
- **合計**: 46時間（24タスク）

## 優先度別タスク数

| 優先度 | タスク数 | 工数 |
|--------|---------|------|
| Critical | 4 | 8時間 |
| 高 | 6 | 13時間 |
| 中 | 8 | 21時間 |
| 低 | 6 | 4時間 |
| **合計** | **24** | **46時間** |

## 関連ドキュメント

### 点検タスク
- `.kiro/specs/tdnet-data-collector/03-tasks/tasks-interface-consistency-check.md`
- `.kiro/specs/tdnet-data-collector/02-design/interface-consistency-design.md`

### 点検作業記録（2026-02-23 15:30実施）
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-153125-subagent1-lambda-interface-check.md`
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-153155-subagent2-aws-integration-check.md`
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-153145-subagent3-utils-interface-check.md`
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-153140-subagent4-test-interface-check.md`
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-153046-subagent5-cdk-scripts-check.md`

### 旧点検作業記録（参考）
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-135718-interface-consistency-check.md`
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-135836-subagent1-lambda-interface-check.md`
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-135843-subagent2-aws-integration-check.md`
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-135848-subagent3-error-validation-check.md`
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-135855-subagent4-test-interface-check.md`
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-135903-subagent5-cdk-scripts-check.md`
