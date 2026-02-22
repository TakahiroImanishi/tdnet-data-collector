# Step Functions アーキテクチャ設計

**作成日**: 2026-02-22
**バージョン**: 1.0
**ステータス**: 設計中
**関連タスク**: タスク1.1 - Step Functionsアーキテクチャ設計

## 目次

1. [概要](#概要)
2. [アーキテクチャ選択](#アーキテクチャ選択)
3. [ワークフロー設計](#ワークフロー設計)
4. [Lambda関数分割設計](#lambda関数分割設計)
5. [DynamoDB実行状態管理](#dynamodb実行状態管理)
6. [エラーハンドリング戦略](#エラーハンドリング戦略)
7. [コスト試算](#コスト試算)
8. [移行戦略](#移行戦略)

## 概要

### 背景

現在のデータ収集処理は単一のLambda関数（`collector`）で実装されており、以下の課題があります：

- **タイムアウト問題**: 大量データ収集時（2,700件以上）に15分のタイムアウトに到達
- **可視性の欠如**: 処理の進捗状況が不明瞭（ログベースの確認のみ）
- **エラーハンドリングの複雑さ**: 部分的失敗時のリトライや補償処理が困難
- **並列処理制御の複雑さ**: コード内で並列度を管理（現在5並列）

### 目的

AWS Step Functionsを導入し、以下を実現します：

- **長時間実行の安定化**: 最大1年間の実行時間（Standard Workflows）
- **処理の可視化**: 各ステップの状態、進捗、エラーを可視化
- **柔軟なエラーハンドリング**: ステップごとのリトライ、補償処理
- **並列処理の最適化**: Map状態による動的並列実行
- **コスト最適化**: 無料枠内での運用継続

## アーキテクチャ選択

### Standard vs Express Workflows

| 項目 | Standard Workflows | Express Workflows |
|------|-------------------|-------------------|
| 最大実行時間 | 1年 | 5分 |
| 実行履歴 | CloudWatch Logsに永続化 | オプション |
| 料金 | $25/100万状態遷移 | $1/100万リクエスト |
| 実行開始レート | 2,000/秒 | 100,000/秒 |
| ユースケース | 長時間実行、監査が必要 | 高スループット、短時間実行 |

**選択結果**: **Standard Workflows**

**理由**:
1. **長時間実行対応**: 大量データ収集時（2,700件以上）に15分を超える可能性
2. **実行履歴の永続化**: 監査とトラブルシューティングに必要
3. **コスト効率**: 月間200回の収集で無料枠内（詳細は後述）
4. **可視性**: AWS Management Consoleでの実行状態確認が容易

### ワークフロータイプの特性

**Standard Workflowsの利点**:
- 実行履歴が自動的にCloudWatch Logsに保存
- 各ステップの入出力が記録され、デバッグが容易
- 長時間実行に対応（最大1年間）
- 実行状態の可視化が標準機能

**制約事項**:
- 実行開始レートが2,000/秒（本システムでは問題なし）
- 状態遷移ごとに課金（無料枠: 4,000状態遷移/月）

## ワークフロー設計

### 状態遷移図

```
開始
  ↓
[初期化] collector-init
  ↓
  ├─ パラメータ検証
  ├─ 実行状態初期化（DynamoDB）
  ├─ 日付範囲生成
  └─ TDnet APIからメタデータ取得（総件数、ページ数）
  ↓
[並列処理] Map状態（動的並列実行）
  ↓
  ├─ [データ取得] collector-fetch（ページごと）
  │   ├─ TDnet APIから1ページ分取得
  │   ├─ レート制限適用（2秒間隔）
  │   └─ エラーハンドリング（指数バックオフ）
  │   ↓
  └─ [データ保存] collector-save（開示情報ごと）
      ├─ PDFダウンロード
      ├─ S3アップロード
      ├─ DynamoDB保存
      └─ 進捗更新
  ↓
[集約] collector-aggregate
  ↓
  ├─ 実行結果の集約
  ├─ 統計情報の計算
  └─ 実行状態の更新（completed/failed）
  ↓
完了
```

### ワークフロー詳細

#### 1. 初期化ステップ（collector-init）

**責務**:
- 収集パラメータの検証（日付範囲、max_items）
- 実行状態の初期化（DynamoDB: status=pending）
- 日付範囲の生成（YYYY-MM-DD配列）
- TDnet APIからメタデータ取得（総ページ数の推定）

**入力**:
```json
{
  "execution_id": "exec_1234567890_abc123_12345678",
  "mode": "on-demand",
  "start_date": "2024-01-15",
  "end_date": "2024-01-20",
  "max_items": 1000
}
```

**出力**:
```json
{
  "execution_id": "exec_1234567890_abc123_12345678",
  "dates": ["2024-01-15", "2024-01-16", "2024-01-17", "2024-01-18", "2024-01-19", "2024-01-20"],
  "total_days": 6,
  "max_items": 1000,
  "estimated_total": 500
}
```

**タイムアウト**: 30秒
**メモリ**: 256MB

#### 2. 並列処理ステップ（Map状態）

**責務**:
- 日付ごとにデータ取得・保存を並列実行
- 並列度の動的制御（MaxConcurrency: 3）
- 部分的失敗の許容

**Map状態の設定**:
```json
{
  "Type": "Map",
  "ItemsPath": "$.dates",
  "MaxConcurrency": 3,
  "Iterator": {
    "StartAt": "FetchData",
    "States": {
      "FetchData": { ... },
      "SaveData": { ... }
    }
  },
  "ResultPath": "$.results",
  "Catch": [
    {
      "ErrorEquals": ["States.ALL"],
      "ResultPath": "$.error",
      "Next": "HandleError"
    }
  ]
}
```

**並列度の選択理由**:
- **MaxConcurrency: 3**: TDnetサーバーへの負荷を考慮
- レート制限（2秒間隔）と組み合わせて適切な負荷分散
- Lambda同時実行数の制限を考慮（無料枠: 1,000並列）

#### 3. データ取得ステップ（collector-fetch）

**責務**:
- TDnet APIから1日分のデータを取得（全ページ）
- レート制限の適用（2秒間隔）
- ページネーション処理
- エラーハンドリング（指数バックオフ）

**入力**:
```json
{
  "execution_id": "exec_1234567890_abc123_12345678",
  "date": "2024-01-15",
  "max_items": 1000
}
```

**出力**:
```json
{
  "execution_id": "exec_1234567890_abc123_12345678",
  "date": "2024-01-15",
  "disclosures": [
    {
      "company_code": "1234",
      "company_name": "株式会社サンプル",
      "disclosure_type": "決算短信",
      "title": "2024年3月期 第3四半期決算短信",
      "disclosed_at": "2024-01-15T10:30:00+09:00",
      "pdf_url": "https://www.release.tdnet.info/inbs/140120240115001.pdf"
    }
  ],
  "count": 150
}
```

**タイムアウト**: 5分
**メモリ**: 512MB

#### 4. データ保存ステップ（collector-save）

**責務**:
- 開示情報ごとにPDFダウンロード
- S3へのアップロード
- DynamoDBへのメタデータ保存
- 進捗の更新（DynamoDB実行状態テーブル）

**入力**:
```json
{
  "execution_id": "exec_1234567890_abc123_12345678",
  "date": "2024-01-15",
  "disclosures": [ ... ],
  "count": 150
}
```

**出力**:
```json
{
  "execution_id": "exec_1234567890_abc123_12345678",
  "date": "2024-01-15",
  "success_count": 148,
  "failed_count": 2,
  "failed_items": [
    {
      "company_code": "5678",
      "error": "PDF download timeout"
    }
  ]
}
```

**タイムアウト**: 10分
**メモリ**: 512MB

#### 5. 集約ステップ（collector-aggregate）

**責務**:
- 全日付の実行結果を集約
- 統計情報の計算（成功率、失敗率）
- 実行状態の更新（completed/failed）
- CloudWatchメトリクスの送信

**入力**:
```json
{
  "execution_id": "exec_1234567890_abc123_12345678",
  "results": [
    {
      "date": "2024-01-15",
      "success_count": 148,
      "failed_count": 2
    },
    {
      "date": "2024-01-16",
      "success_count": 200,
      "failed_count": 0
    }
  ]
}
```

**出力**:
```json
{
  "execution_id": "exec_1234567890_abc123_12345678",
  "status": "partial_success",
  "total_success": 348,
  "total_failed": 2,
  "success_rate": 99.43
}
```

**タイムアウト**: 30秒
**メモリ**: 256MB

## Lambda関数分割設計

### 既存collector関数の分解

現在の`collector`関数（約750行）を4つの専用関数に分割します：

| 関数名 | 責務 | 行数（推定） | 既存コードの再利用 |
|--------|------|------------|------------------|
| collector-init | 初期化、パラメータ検証 | 150行 | validateEvent, generateDateRange |
| collector-fetch | データ取得、ページネーション | 200行 | scrapeTdnetList |
| collector-save | PDF保存、メタデータ保存 | 250行 | downloadPdf, saveMetadata |
| collector-aggregate | 結果集約、統計計算 | 100行 | 新規実装 |

### 各Lambda関数の詳細設計

#### 1. collector-init

**ファイルパス**: `src/lambda/collector-init/handler.ts`

**インターフェース**:
```typescript
export interface InitEvent {
  execution_id: string;
  mode: 'batch' | 'on-demand';
  start_date?: string;
  end_date?: string;
  max_items?: number;
}

export interface InitResponse {
  execution_id: string;
  dates: string[];
  total_days: number;
  max_items?: number;
  estimated_total: number;
}
```

**主要機能**:
- イベントバリデーション（既存の`validateEvent`を再利用）
- 日付範囲生成（既存の`generateDateRange`を再利用）
- 実行状態の初期化（既存の`updateExecutionStatus`を再利用）
- TDnet APIからメタデータ取得（総件数の推定）

**エラーハンドリング**:
- ValidationError: 即座に失敗（再試行なし）
- RetryableError: 指数バックオフで3回再試行

#### 2. collector-fetch

**ファイルパス**: `src/lambda/collector-fetch/handler.ts`

**インターフェース**:
```typescript
export interface FetchEvent {
  execution_id: string;
  date: string;
  max_items?: number;
}

export interface FetchResponse {
  execution_id: string;
  date: string;
  disclosures: DisclosureMetadata[];
  count: number;
}
```

**主要機能**:
- TDnet APIから1日分のデータ取得（既存の`scrapeTdnetList`を再利用）
- レート制限の適用（既存の`RateLimiter`を再利用）
- ページネーション処理
- max_itemsによる制限

**エラーハンドリング**:
- NetworkError: 指数バックオフで3回再試行
- RateLimitError: 1秒待機後再試行
- ValidationError: 即座に失敗

#### 3. collector-save

**ファイルパス**: `src/lambda/collector-save/handler.ts`

**インターフェース**:
```typescript
export interface SaveEvent {
  execution_id: string;
  date: string;
  disclosures: DisclosureMetadata[];
  count: number;
}

export interface SaveResponse {
  execution_id: string;
  date: string;
  success_count: number;
  failed_count: number;
  failed_items: Array<{
    company_code: string;
    error: string;
  }>;
}
```

**主要機能**:
- 開示情報ごとにPDFダウンロード（既存の`downloadPdf`を再利用）
- S3へのアップロード
- DynamoDBへのメタデータ保存（既存の`saveMetadata`を再利用）
- 並列処理（並列度5）
- 進捗の更新（既存の`updateExecutionStatus`を再利用）

**エラーハンドリング**:
- 部分的失敗を許容（Promise.allSettled使用）
- 失敗した開示情報をログに記録
- 成功分はコミット、失敗分は次回収集時に再試行

#### 4. collector-aggregate

**ファイルパス**: `src/lambda/collector-aggregate/handler.ts`

**インターフェース**:
```typescript
export interface AggregateEvent {
  execution_id: string;
  results: Array<{
    date: string;
    success_count: number;
    failed_count: number;
  }>;
}

export interface AggregateResponse {
  execution_id: string;
  status: 'success' | 'partial_success' | 'failed';
  total_success: number;
  total_failed: number;
  success_rate: number;
}
```

**主要機能**:
- 全日付の実行結果を集約
- 統計情報の計算（成功率、失敗率）
- 実行状態の更新（completed/failed）
- CloudWatchメトリクスの送信

**エラーハンドリング**:
- DynamoDB書き込みエラー: 指数バックオフで3回再試行
- メトリクス送信エラー: ログに記録（処理は継続）

## DynamoDB実行状態管理

### 既存テーブルの活用

既存の`tdnet_executions`テーブルを継続使用し、Step Functions統合のためのフィールドを追加します。

**既存スキーマ**:
```typescript
interface ExecutionStatus {
  execution_id: string;           // PK
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;               // 0-100
  collected_count: number;
  failed_count: number;
  started_at: string;             // ISO 8601
  updated_at: string;             // ISO 8601
  completed_at?: string;          // ISO 8601
  error_message?: string;
  ttl?: number;                   // 30日後に自動削除
}
```

**追加フィールド**:
```typescript
interface ExecutionStatusWithStepFunctions extends ExecutionStatus {
  step_functions_arn?: string;   // Step Functions実行ARN
  workflow_type: 'lambda' | 'step-functions';  // ワークフロータイプ
}
```

### 進捗追跡方法

**進捗計算ロジック**:
```typescript
// collector-save関数内で進捗を更新
const processed = success_count + failed_count;
const progress = total_count > 0 
  ? Math.floor((processed / total_count) * 100) 
  : 0;

await updateExecutionStatus(
  execution_id,
  'running',
  progress,
  success_count,
  failed_count
);
```

**進捗更新タイミング**:
1. **初期化時**: progress=0, status=pending
2. **実行開始時**: progress=0, status=running
3. **バッチ完了時**: progress=計算値, status=running
4. **完了時**: progress=100, status=completed/failed

### タイムアウト・リトライ戦略

**Step Functionsレベル**:
- **全体タイムアウト**: 24時間（大量データ収集に対応）
- **ステップタイムアウト**: 各Lambda関数のタイムアウト + 1分

**Lambdaレベル**:
- **collector-init**: 30秒
- **collector-fetch**: 5分
- **collector-save**: 10分
- **collector-aggregate**: 30秒

**リトライ設定**:
```json
{
  "Retry": [
    {
      "ErrorEquals": ["RetryableError", "States.TaskFailed"],
      "IntervalSeconds": 2,
      "MaxAttempts": 3,
      "BackoffRate": 2.0
    }
  ]
}
```

## エラーハンドリング戦略

### エラー分類

| エラー種別 | 対応 | Step Functions設定 |
|-----------|------|-------------------|
| ValidationError | 即座に失敗 | Catch → 失敗ステート |
| RetryableError | 指数バックオフで再試行 | Retry（3回、2秒間隔、2倍増） |
| NetworkError | 指数バックオフで再試行 | Retry（3回、2秒間隔、2倍増） |
| RateLimitError | 1秒待機後再試行 | Retry（5回、1秒間隔） |
| PartialFailure | 成功分コミット、失敗分記録 | 処理継続 |

### Step Functionsエラーハンドリング

**ASL（Amazon States Language）設定例**:
```json
{
  "States": {
    "FetchData": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:...:function:collector-fetch",
      "Retry": [
        {
          "ErrorEquals": ["RetryableError", "NetworkError"],
          "IntervalSeconds": 2,
          "MaxAttempts": 3,
          "BackoffRate": 2.0
        },
        {
          "ErrorEquals": ["RateLimitError"],
          "IntervalSeconds": 1,
          "MaxAttempts": 5,
          "BackoffRate": 1.0
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["ValidationError"],
          "ResultPath": "$.error",
          "Next": "HandleValidationError"
        },
        {
          "ErrorEquals": ["States.ALL"],
          "ResultPath": "$.error",
          "Next": "HandleUnknownError"
        }
      ],
      "Next": "SaveData"
    }
  }
}
```

### DLQ連携

**DLQ設定**:
- Step Functions自体にはDLQを設定しない（実行履歴がCloudWatch Logsに保存されるため）
- 各Lambda関数には既存のDLQ設定を継続
- 失敗した実行はCloudWatch Alarmsで通知

**失敗時の補償処理**:
1. 実行状態を`failed`に更新
2. エラーメッセージをDynamoDBに記録
3. CloudWatch Alarmsで通知
4. 手動または自動で再実行

## コスト試算

### Step Functions料金

**Standard Workflows**:
- 料金: $25/100万状態遷移
- 無料枠: 4,000状態遷移/月

**1回の収集あたりの状態遷移数**:
```
1. 初期化ステップ: 1状態遷移
2. Map状態開始: 1状態遷移
3. 日付ごとの処理（6日分の場合）:
   - FetchData: 6状態遷移
   - SaveData: 6状態遷移
4. Map状態終了: 1状態遷移
5. 集約ステップ: 1状態遷移
合計: 16状態遷移
```

**月間コスト試算**:
```
月間収集回数: 200回
状態遷移数: 200回 × 16 = 3,200状態遷移
無料枠: 4,000状態遷移/月
超過分: 0状態遷移
料金: $0
```

**結論**: 月間200回の収集であれば、Step Functionsの料金は無料枠内に収まります。

### Lambda実行時間の変化

**現在（単一Lambda関数）**:
- 実行時間: 5-15分（データ量による）
- メモリ: 512MB
- 料金: Lambda無料枠内（100万リクエスト/月、400,000 GB秒/月）

**移行後（4つのLambda関数）**:
- **collector-init**: 30秒 × 256MB = 7.68 GB秒
- **collector-fetch**: 5分 × 512MB × 6日 = 1,536 GB秒
- **collector-save**: 10分 × 512MB × 6日 = 3,072 GB秒
- **collector-aggregate**: 30秒 × 256MB = 7.68 GB秒
- **合計**: 4,623.36 GB秒/回

**月間コスト試算**:
```
月間収集回数: 200回
GB秒: 200回 × 4,623.36 = 924,672 GB秒
無料枠: 400,000 GB秒/月
超過分: 524,672 GB秒
料金: 524,672 × $0.0000166667 = $8.74
```

**注意**: Lambda実行時間が増加する可能性があるため、本番環境での実測が必要です。

### 総コスト試算

| 項目 | 現在 | 移行後 | 差分 |
|------|------|--------|------|
| Step Functions | $0 | $0（無料枠内） | $0 |
| Lambda | $0（無料枠内） | $8.74 | +$8.74 |
| DynamoDB | $0（無料枠内） | $0（無料枠内） | $0 |
| S3 | $0（無料枠内） | $0（無料枠内） | $0 |
| CloudWatch Logs | $0（無料枠内） | $0（無料枠内） | $0 |
| **合計** | **$0** | **$8.74** | **+$8.74** |

**結論**: 月間$8.74のコスト増加が見込まれますが、以下のメリットがあります：
- 長時間実行の安定化
- 処理の可視化
- エラーハンドリングの改善
- 運用負荷の軽減

## 移行戦略

### 段階的移行計画

**フェーズ1: 設計・実装（2週間）**
1. Lambda関数の分割実装
2. Step Functionsステートマシン定義
3. CDK実装
4. ユニットテスト作成

**フェーズ2: テスト・検証（1週間）**
1. LocalStackでのE2Eテスト
2. 本番環境での小規模検証（100件以下）
3. 本番環境での中規模検証（500件程度）
4. パフォーマンス測定

**フェーズ3: 並行運用（2週間）**
1. 新旧システムの並行運用
2. 新システムをデフォルトに設定
3. 旧システムの監視継続

**フェーズ4: 完全移行（1週間）**
1. 旧collector関数の削除
2. 不要なコードの削除
3. ドキュメント更新

### API互換性の維持

**既存APIエンドポイント**:
- `POST /collect`: データ収集開始
- `GET /collect/{executionId}`: 実行状態取得

**変更点**:
- `/collect`エンドポイント内部でStep Functions実行を開始
- `execution_id`の生成ロジックは変更なし
- レスポンス形式は変更なし

**実装例**:
```typescript
// src/lambda/api/handlers/collect.ts
export async function handler(event: APIGatewayProxyEvent) {
  const execution_id = generateExecutionId();
  
  // Step Functions実行を開始
  const stepFunctionsArn = await startStepFunctionsExecution({
    execution_id,
    mode: event.body.mode,
    start_date: event.body.start_date,
    end_date: event.body.end_date,
  });
  
  // 実行状態を初期化（Step Functions ARNを保存）
  await updateExecutionStatus(execution_id, 'pending', 0, 0, 0, {
    step_functions_arn: stepFunctionsArn,
    workflow_type: 'step-functions',
  });
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      execution_id,
      status: 'pending',
      message: 'Collection started',
    }),
  };
}
```

### ロールバック計画

**ロールバック条件**:
- 本番環境での検証で重大な問題が発生
- コストが予算を大幅に超過
- パフォーマンスが著しく低下

**ロールバック手順**:
1. `/collect`エンドポイントを旧collector関数に戻す
2. Step Functionsステートマシンを無効化
3. 新Lambda関数を削除
4. CDKスタックをロールバック

## 次のステップ

1. **タスク1.2**: ワークフロー詳細設計（ASL定義、エラーハンドリング）
2. **タスク2.1-2.4**: Lambda関数の分割実装
3. **タスク3.1-3.3**: CDK実装
4. **タスク6.1-6.2**: E2Eテスト・本番環境検証

## 関連ドキュメント

- `.kiro/specs/tdnet-data-collector/tasks/tasks-step-functions-migration.md`
- `.kiro/steering/core/tdnet-implementation-rules.md`
- `.kiro/steering/core/error-handling-patterns.md`
- `.kiro/steering/development/lambda-implementation.md`
- `src/lambda/collector/handler.ts`

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-02-22 | 1.0 | 初版作成 |
