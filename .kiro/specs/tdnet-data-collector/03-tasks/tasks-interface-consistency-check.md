# タスク: コードインターフェース整合性の網羅的点検

**作成日時**: 2026-02-23 13:55:19  
**優先度**: 高  
**カテゴリ**: 品質保証・リファクタリング

## 目的

プロジェクト全体でコードのインターフェース（型定義、関数シグネチャ、API契約）が一致していることを確認し、不整合を修正する。

## 背景

- インターフェースの不一致により実行時エラーやテスト失敗が発生している可能性
- 型定義とランタイムコードの乖離
- Lambda間のデータ受け渡しでの型不一致
- テストコードと実装コードの期待値の相違

## 点検対象

### 1. Lambda関数間のインターフェース

#### 1.1 Step Functions関連Lambda
- [ ] **collector-init → collector-fetch**
  - `handler.ts`の出力型
  - `collector-fetch`の入力型（`FetchInput`）
  - State Machine定義の`Parameters`
  
- [ ] **collector-fetch → collector-aggregate**
  - `handler.ts`の出力型（`FetchOutput`）
  - `collector-aggregate`の入力型（`AggregateInput`）
  - State Machine定義の`Parameters`
  
- [ ] **collector-aggregate → collector-save**
  - `handler.ts`の出力型（`AggregateOutput`）
  - `collector-save`の入力型（`SaveInput`）
  - State Machine定義の`Parameters`

#### 1.2 API Gateway統合Lambda
- [ ] **query Lambda**
  - API Gateway統合リクエスト形式
  - `handler.ts`の入力型（`APIGatewayProxyEvent`）
  - レスポンス形式（`APIGatewayProxyResult`）
  
- [ ] **export Lambda**
  - API Gateway統合リクエスト形式
  - `handler.ts`の入力型
  - レスポンス形式

- [ ] **get-disclosure Lambda**
  - API Gateway統合リクエスト形式
  - `handler.ts`の入力型
  - レスポンス形式

- [ ] **collect-status Lambda**
  - API Gateway統合リクエスト形式
  - `handler.ts`の入力型（Step Functions有効/無効時の分岐）
  - レスポンス形式

- [ ] **stats Lambda**
  - API Gateway統合リクエスト形式
  - `handler.ts`の入力型
  - レスポンス形式

- [ ] **health Lambda**
  - API Gateway統合リクエスト形式
  - `handler.ts`の入力型
  - レスポンス形式

#### 1.3 非同期Lambda
- [ ] **dlq-processor Lambda**
  - SQSイベント形式
  - `handler.ts`の入力型（`SQSEvent`）
  
- [ ] **api-key-rotation Lambda**
  - EventBridgeイベント形式
  - `handler.ts`の入力型

### 2. DynamoDB関連インターフェース

#### 2.1 Disclosures Table
- [ ] **スキーマ定義**
  - `src/types/disclosure.ts`の型定義
  - DynamoDB項目構造
  - GSI定義（`date_partition-disclosed_at-index`）
  
- [ ] **書き込み操作**
  - `collector-save`の`putItem`パラメータ
  - `src/utils/dynamodb.ts`のヘルパー関数
  
- [ ] **読み込み操作**
  - `query`の`query`パラメータ
  - `get-disclosure`の`getItem`パラメータ
  - `stats`の`query`パラメータ

#### 2.2 ExecutionState Table（Step Functions有効時）
- [ ] **スキーマ定義**
  - `src/types/execution-state.ts`の型定義
  - DynamoDB項目構造
  
- [ ] **書き込み操作**
  - `collector-init`の`putItem`パラメータ
  - `collector-save`の`updateItem`パラメータ
  
- [ ] **読み込み操作**
  - `collect-status`の`getItem`パラメータ

### 3. S3関連インターフェース

- [ ] **PDFファイル保存**
  - `collector-save`の`putObject`パラメータ
  - バケット名、キー形式
  
- [ ] **PDFファイル取得**
  - `get-disclosure`の`getObject`パラメータ
  - 署名付きURL生成パラメータ
  
- [ ] **エクスポートファイル保存**
  - `export`の`putObject`パラメータ
  - 署名付きURL生成パラメータ

### 4. Secrets Manager関連インターフェース

- [ ] **API Key取得**
  - `src/utils/secrets-manager.ts`の`getApiKey()`
  - 返り値の型（`string`）
  - 使用箇所での型期待値
  
- [ ] **API Key更新**
  - `api-key-rotation`の`updateSecret`パラメータ
  - シークレット値の形式

### 5. CloudWatch関連インターフェース

- [ ] **メトリクス送信**
  - `src/utils/cloudwatch-metrics.ts`の関数シグネチャ
  - 各Lambdaでの使用方法
  - メトリクス名、ディメンション、単位の一貫性
  
- [ ] **ログ出力**
  - `src/utils/logger.ts`の関数シグネチャ
  - 構造化ログのフィールド名統一

### 6. エラーハンドリング関連インターフェース

- [ ] **カスタムエラークラス**
  - `src/errors/index.ts`の定義
  - 各Lambdaでの使用方法
  - エラー分類（Retryable/Non-Retryable）の一貫性
  
- [ ] **再試行ユーティリティ**
  - `src/utils/retry.ts`の`retryWithBackoff`シグネチャ
  - 各Lambdaでの使用方法

### 7. バリデーション関連インターフェース

- [ ] **Zodスキーマ**
  - `src/validators/*.ts`の定義
  - 各Lambdaでの使用方法
  - 型定義との一致

### 8. テストコード関連インターフェース

#### 8.1 ユニットテスト
- [ ] **モック定義**
  - AWS SDKモックの返り値型
  - 実際のAWS APIレスポンス型との一致
  
- [ ] **テストデータ**
  - `__tests__/fixtures/*.ts`のデータ型
  - 実際のデータ型との一致

#### 8.2 統合テスト
- [ ] **LocalStack環境**
  - DynamoDB/S3のスキーマ定義
  - 本番環境との一致
  
- [ ] **E2Eテスト**
  - Step Functionsの入出力型
  - 実際のState Machine定義との一致

### 9. CDK関連インターフェース

- [ ] **環境変数**
  - CDKスタックでの定義
  - Lambdaコードでの参照（`process.env.*`）
  - 型定義（`src/types/env.ts`）
  
- [ ] **IAMポリシー**
  - CDKでの権限定義
  - Lambdaコードでの実際の操作
  
- [ ] **CDK Outputs**
  - スタックの出力定義
  - 運用スクリプトでの参照

### 10. 運用スクリプト関連インターフェース

- [ ] **get-stack-outputs.ps1**
  - CDK Outputsの期待値
  - 実際のスタック出力との一致
  
- [ ] **API呼び出し**
  - スクリプトのリクエスト形式
  - API Gatewayの期待値
  - Lambdaの入力型

## 点検方法

### 自動点検
```powershell
# TypeScript型チェック
npm run type-check

# ESLint実行
npm run lint

# ユニットテスト実行
npm test

# E2Eテスト実行（LocalStack必須）
npm run test:e2e
```

### 手動点検
1. **型定義ファイルの確認**
   - `src/types/*.ts`の全ファイルレビュー
   - 使用箇所との整合性確認

2. **Lambda関数の入出力確認**
   - 各`handler.ts`の型定義
   - State Machine定義との照合
   - API Gateway統合設定との照合

3. **AWS SDK呼び出しの確認**
   - パラメータ型の確認
   - レスポンス型の確認

4. **テストコードの確認**
   - モック定義の型確認
   - 期待値の型確認

## 修正方針

### 優先順位
1. **Critical**: 実行時エラーを引き起こす不整合（型エラー、必須フィールド欠落）
2. **High**: テスト失敗を引き起こす不整合
3. **Medium**: 型安全性を損なう不整合（`any`型の使用等）
4. **Low**: コードの可読性・保守性に影響する不整合

### 修正手順
1. 不整合箇所の特定・記録
2. 影響範囲の調査
3. 修正計画の策定
4. 修正実施
5. テスト実行・確認
6. ドキュメント更新

## 成果物

- [ ] **不整合リスト**: `work-logs/work-log-[YYYYMMDD-HHMMSS]-interface-inconsistencies.md`
- [ ] **修正計画**: 各不整合に対する修正方針
- [ ] **修正実施**: コード修正・テスト実行
- [ ] **検証結果**: すべてのテストが成功することを確認
- [ ] **ドキュメント更新**: 型定義・インターフェース仕様書の更新

## 完了条件

- [ ] すべての点検項目が確認済み
- [ ] 検出された不整合がすべて修正済み
- [ ] `npm run type-check`が成功
- [ ] `npm run lint`が成功
- [ ] `npm test`が成功
- [ ] `npm run test:e2e`が成功（LocalStack環境）
- [ ] 作業記録が作成済み
- [ ] Git commit & push完了

## 関連ドキュメント

- `.kiro/steering/core/tdnet-implementation-rules.md`
- `.kiro/steering/core/error-handling-patterns.md`
- `.kiro/steering/development/testing-strategy.md`
- `.kiro/steering/development/lambda-guide.md`
- `.kiro/steering/development/step-functions-guide.md`

## 備考

- この点検は定期的（リリース前、大規模リファクタリング後）に実施することを推奨
- 新規Lambda追加時は必ずこのチェックリストを参照
- CI/CDパイプラインに型チェック・Lintを組み込むことを検討
