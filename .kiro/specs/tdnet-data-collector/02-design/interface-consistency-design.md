# 設計書: コードインターフェース整合性点検

**作成日**: 2026-02-23  
**バージョン**: 1.0  
**ステータス**: 実施中

## 1. 目的

TDnet Data Collectorプロジェクト全体のコードインターフェース（型定義、関数シグネチャ、API契約）が一致していることを確認し、不整合を検出・修正する。

## 2. 背景

### 問題
- インターフェースの不一致により実行時エラーやテスト失敗が発生
- 型定義とランタイムコードの乖離
- Lambda間のデータ受け渡しでの型不一致
- テストコードと実装コードの期待値の相違

### 影響
- 実行時エラー（型エラー、必須フィールド欠落）
- テスト失敗（モック定義の不一致）
- 保守性の低下（型安全性の欠如）
- デプロイ後の障害リスク

## 3. 点検範囲

### 3.1 Lambda関数インターフェース

#### Step Functions関連Lambda
| Lambda | 入力型 | 出力型 | 連携先 |
|--------|--------|--------|--------|
| collector-init | EventBridge/手動 | InitOutput | collector-fetch |
| collector-fetch | FetchInput | FetchOutput | collector-aggregate |
| collector-aggregate | AggregateInput | AggregateOutput | collector-save |
| collector-save | SaveInput | SaveOutput | - |

**点検項目**:
- 各Lambdaの`handler.ts`の型定義
- State Machine定義の`Parameters`との一致
- 型定義ファイル（`src/types/*.ts`）との一致

#### API Gateway統合Lambda
| Lambda | 入力型 | 出力型 | 備考 |
|--------|--------|--------|------|
| query | APIGatewayProxyEvent | APIGatewayProxyResult | クエリパラメータ検証 |
| export | APIGatewayProxyEvent | APIGatewayProxyResult | 日付範囲検証 |
| get-disclosure | APIGatewayProxyEvent | APIGatewayProxyResult | disclosure_id検証 |
| collect-status | APIGatewayProxyEvent | APIGatewayProxyResult | Step Functions有効/無効分岐 |
| stats | APIGatewayProxyEvent | APIGatewayProxyResult | 統計情報取得 |
| health | APIGatewayProxyEvent | APIGatewayProxyResult | ヘルスチェック |

**点検項目**:
- API Gateway統合リクエスト形式との一致
- レスポンス形式の統一
- エラーレスポンスの一貫性

#### 非同期Lambda
| Lambda | 入力型 | トリガー | 備考 |
|--------|--------|----------|------|
| dlq-processor | SQSEvent | SQS DLQ | エラーメッセージ処理 |
| api-key-rotation | EventBridgeEvent | EventBridge | 定期実行 |

**点検項目**:
- イベント形式との一致
- エラーハンドリングの実装

### 3.2 AWS統合インターフェース

#### DynamoDB
**Disclosures Table**:
- PK: `disclosure_id` (String)
- GSI: `date_partition-disclosed_at-index`
  - PK: `date_partition` (String, YYYY-MM形式)
  - SK: `disclosed_at` (String, ISO8601形式)

**ExecutionState Table**（Step Functions有効時）:
- PK: `execution_id` (String)
- 属性: `status`, `start_date`, `end_date`, `total_count`, `processed_count`, `error_count`, `created_at`, `updated_at`

**点検項目**:
- `src/types/disclosure.ts`の型定義との一致
- `src/types/execution-state.ts`の型定義との一致
- DynamoDB操作（putItem, getItem, query, updateItem）のパラメータ型
- GSIクエリの正確性

#### S3
**バケット構造**:
- PDFファイル: `disclosures/{disclosure_id}.pdf`
- エクスポートファイル: `exports/{export_id}.json`

**点検項目**:
- `putObject`/`getObject`のパラメータ型
- 署名付きURL生成のパラメータ
- キー形式の一貫性

#### Secrets Manager
**シークレット**:
- API Key: `{StackName}/tdnet-api-key`

**点検項目**:
- `src/utils/secrets-manager.ts`の`getApiKey()`返り値型
- 使用箇所での型期待値
- `updateSecret`のパラメータ型

#### CloudWatch
**メトリクス**:
- `CollectorErrors`, `CollectorDuration`, `CollectorInvocations`
- ディメンション: `FunctionName`, `Environment`

**ログ**:
- 構造化ログフィールド: `level`, `message`, `timestamp`, `context`, `error_type`, `error_message`, `stack_trace`

**点検項目**:
- `src/utils/cloudwatch-metrics.ts`の関数シグネチャ
- メトリクス名・ディメンション・単位の一貫性
- `src/utils/logger.ts`のログフィールド統一

### 3.3 エラーハンドリング・バリデーション

#### カスタムエラークラス
- `ValidationError`, `NetworkError`, `RateLimitError`, `NotFoundError`, `ServerError`
- エラー分類: Retryable / Non-Retryable

**点検項目**:
- `src/errors/index.ts`の定義
- 各Lambdaでの使用方法の一貫性
- エラー分類の正確性

#### 再試行ユーティリティ
- `retryWithBackoff(operation, options)`

**点検項目**:
- `src/utils/retry.ts`のシグネチャ
- 各Lambdaでの使用方法

#### Zodスキーマ
- `src/validators/*.ts`

**点検項目**:
- 型定義との一致
- バリデーションルールの正確性

### 3.4 テストコード

#### ユニットテスト
**点検項目**:
- AWS SDKモックの返り値型
- テストデータ（`__tests__/fixtures/*.ts`）の型
- 期待値の型

#### 統合テスト
**点検項目**:
- LocalStack環境のスキーマ定義
- 本番環境との一致

#### E2Eテスト
**点検項目**:
- Step Functionsの入出力型
- State Machine定義との一致

### 3.5 CDK・運用スクリプト

#### 環境変数
**点検項目**:
- CDKスタックでの定義
- Lambdaコードでの参照（`process.env.*`）
- 型定義（`src/types/env.ts`）の一致

#### IAMポリシー
**点検項目**:
- CDKでの権限定義
- Lambdaコードでの実際の操作との一致

#### CDK Outputs
**点検項目**:
- スタックの出力定義
- 運用スクリプトでの参照との一致

#### 運用スクリプト
**点検項目**:
- `get-stack-outputs.ps1`の期待値
- API呼び出しのリクエスト形式
- API Gatewayの期待値との一致

## 4. 点検方法

### 4.1 自動点検
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

### 4.2 手動点検
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

### 4.3 サブエージェント分割実行
5つのサブエージェントに点検タスクを分割し、並列実行:

1. **Lambda関数インターフェース点検**
2. **AWS統合インターフェース点検**
3. **エラーハンドリング・バリデーション点検**
4. **テストコードインターフェース点検**
5. **CDK・運用スクリプトインターフェース点検**

各サブエージェントは以下を実施:
- 担当範囲の点検
- 不整合の検出・記録
- 作業記録の作成

## 5. 不整合の分類

### 優先度
| 優先度 | 説明 | 例 |
|--------|------|-----|
| Critical | 実行時エラーを引き起こす | 型エラー、必須フィールド欠落 |
| High | テスト失敗を引き起こす | モック定義の不一致 |
| Medium | 型安全性を損なう | `any`型の使用 |
| Low | 可読性・保守性に影響 | 命名規則の不統一 |

### 修正方針
1. 不整合箇所の特定・記録
2. 影響範囲の調査
3. 修正計画の策定
4. 修正実施
5. テスト実行・確認
6. ドキュメント更新

## 6. 成果物

### 6.1 点検結果
- **不整合リスト**: 検出された不整合の一覧
- **優先順位付け**: Critical → High → Medium → Low
- **影響範囲**: 各不整合が影響するファイル・機能

### 6.2 修正タスク
- **tasks.md更新**: 修正タスクの追加
- **修正計画**: 各不整合に対する修正方針
- **スケジュール**: 修正の実施順序

### 6.3 ドキュメント
- **作業記録**: 点検プロセスの記録
- **型定義仕様書**: インターフェース仕様の明確化
- **改善提案**: 再発防止策

## 7. 完了条件

- [ ] すべての点検項目が確認済み
- [ ] 検出された不整合がすべて記録済み
- [ ] 修正タスクがtasks.mdに追加済み
- [ ] `npm run type-check`が成功
- [ ] `npm run lint`が成功
- [ ] `npm test`が成功
- [ ] `npm run test:e2e`が成功（LocalStack環境）
- [ ] 作業記録が完成
- [ ] Git commit & push完了

## 8. 再発防止策

### 8.1 CI/CDパイプライン
- 型チェック（`npm run type-check`）の自動実行
- Lint（`npm run lint`）の自動実行
- ユニットテスト（`npm test`）の自動実行

### 8.2 開発プロセス
- 新規Lambda追加時のチェックリスト参照
- コードレビュー時の型定義確認
- 定期的な整合性点検（リリース前、大規模リファクタリング後）

### 8.3 ドキュメント
- インターフェース仕様書の維持
- 型定義の明確化
- 変更履歴の記録

## 9. 関連ドキュメント

- `.kiro/specs/tdnet-data-collector/03-tasks/tasks-interface-consistency-check.md`
- `.kiro/steering/core/tdnet-implementation-rules.md`
- `.kiro/steering/core/error-handling-patterns.md`
- `.kiro/steering/development/testing-strategy.md`
- `.kiro/steering/development/lambda-guide.md`
- `.kiro/steering/development/step-functions-guide.md`
