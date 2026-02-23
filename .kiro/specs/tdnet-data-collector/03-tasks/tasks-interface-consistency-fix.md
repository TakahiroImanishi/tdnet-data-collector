# タスク: インターフェース整合性修正

**作成日時**: 2026-02-23 14:01:47  
**優先度**: Critical → 高 → 中 → 低  
**カテゴリ**: バグ修正・品質改善  
**関連**: tasks-interface-consistency-check.md

## 概要

コードインターフェース整合性点検で検出された不整合を優先順位順に修正する。

## 修正タスク一覧

### Critical（即座に修正が必要）

#### タスク1: Step Functions Map Iterator コンテキスト修正
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

#### タスク2: collector-aggregate パラメータ名統一
**優先度**: Critical  
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

### 高（次回リリースで修正）

#### タスク3: Secrets Manager統合実装
**優先度**: 高  
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

#### タスク4: Zodスキーマ活用実装
**優先度**: 高  
**工数見積**: 6時間  
**担当**: 未定

**問題**:
- Zodスキーマが定義されているが実際には使用されていない
- 各Lambda関数で独自のバリデーションを重複実装

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

#### タスク5: エラークラス統一実装
**優先度**: 高  
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

### 中（計画的に対応）

#### タスク6: export/handler.ts 型定義確認
**優先度**: 中  
**工数見積**: 1時間  
**担当**: 未定

**問題**: `ExportEvent`が`APIGatewayProxyEvent`を継承していない可能性

**影響範囲**: `src/lambda/export/handler.ts`

**修正内容**:
1. `ExportEvent`の型定義を確認
2. 必要に応じて`extends APIGatewayProxyEvent`を追加

**完了条件**:
- [ ] 型定義確認済み
- [ ] 必要に応じて修正
- [ ] ユニットテストが成功

---

#### タスク7: 再試行ロジック実装
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

#### タスク8: 環境変数型定義ファイル作成
**優先度**: 中  
**工数見積**: 2時間  
**担当**: 未定

**問題**: `src/types/env.ts`が存在しない

**影響範囲**: 全Lambda関数

**修正内容**:
1. `src/types/env.ts`を作成
   ```typescript
   export interface EnvironmentVariables {
     DYNAMODB_TABLE_NAME: string;
     S3_BUCKET_NAME: string;
     LOG_LEVEL: string;
     ENVIRONMENT: string;
     // ...
   }
   ```

2. 各Lambda関数で型定義をインポート
3. `process.env.*`の参照を型安全に

**完了条件**:
- [ ] `src/types/env.ts`作成済み
- [ ] 各Lambda関数で使用
- [ ] 型チェックが成功

---

#### タスク9: エラー分類テスト追加
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

#### タスク10: 非同期Lambda 実装状況確認
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

#### タスク11: 環境変数命名規則統一
**優先度**: 低  
**工数見積**: 1時間  
**担当**: 未定

**問題**: `DYNAMODB_TABLE` vs `DYNAMODB_TABLE_NAME`

**修正内容**:
1. 新規Lambda関数では`_NAME`サフィックスを統一
2. 既存Lambda関数は動作しているため変更不要

**完了条件**:
- [ ] 命名規則ドキュメント更新

---

#### タスク12: テストコード軽微な不整合修正
**優先度**: 低  
**工数見積**: 1時間  
**担当**: 未定

**問題**: 未使用変数、テーブル名の環境サフィックス等

**修正内容**:
1. 未使用変数削除
2. その他軽微な修正

**完了条件**:
- [ ] 軽微な不整合修正済み

---

## 実施順序

### フェーズ1: Critical修正（即座に実施）
1. タスク1: Step Functions Map Iterator コンテキスト修正
2. タスク2: collector-aggregate パラメータ名統一

### フェーズ2: 高優先度修正（次回リリース）
3. タスク3: Secrets Manager統合実装
4. タスク4: Zodスキーマ活用実装
5. タスク5: エラークラス統一実装

### フェーズ3: 中優先度修正（計画的に対応）
6. タスク6: export/handler.ts 型定義確認
7. タスク7: 再試行ロジック実装
8. タスク8: 環境変数型定義ファイル作成
9. タスク9: エラー分類テスト追加

### フェーズ4: 低優先度修正（必要に応じて対応）
10. タスク10: 非同期Lambda 実装状況確認
11. タスク11: 環境変数命名規則統一
12. タスク12: テストコード軽微な不整合修正

## 全体工数見積

- **Critical**: 5時間
- **高**: 11時間
- **中**: 9時間
- **低**: 3時間
- **合計**: 28時間

## 関連ドキュメント

- `.kiro/specs/tdnet-data-collector/03-tasks/tasks-interface-consistency-check.md`
- `.kiro/specs/tdnet-data-collector/02-design/interface-consistency-design.md`
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-135718-interface-consistency-check.md`
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-135836-subagent1-lambda-interface-check.md`
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-135843-subagent2-aws-integration-check.md`
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-135848-subagent3-error-validation-check.md`
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-135855-subagent4-test-interface-check.md`
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-135903-subagent5-cdk-scripts-check.md`
