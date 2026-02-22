# Step Functions アーキテクチャ設計

**作成日**: 2026-02-22
**バージョン**: 1.0
**ステータス**: 設計中

## 概要

現在の単一Lambda関数によるデータ収集処理をAWS Step Functionsを使用したオーケストレーション型アーキテクチャに移行します。

## 現状の問題点

### 1. タイムアウト問題
- Lambda最大実行時間: 15分
- 大量データ収集時（2,000件以上）に処理が完了しない
- 例: 2026-02-13のデータ収集で625件/2,700件時点でタイムアウト

### 2. 可視性の欠如
- 処理の進捗状況が不明瞭
- エラー発生箇所の特定が困難
- 部分的失敗の追跡が難しい

### 3. エラーハンドリングの複雑さ
- リトライロジックがアプリケーションコードに埋め込まれている
- 部分的失敗時の補償処理が困難
- エラー種別ごとの対応が複雑

### 4. スケーラビリティの制限
- 並列処理の制御が複雑
- レート制限の実装が煩雑
- 動的なスケーリングが困難

## 新アーキテクチャ

### アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway                               │
│                     POST /collect                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                   API Lambda (既存)                              │
│              Step Functions実行開始                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Step Functions State Machine                    │
│                    (Standard Workflows)                          │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. 初期化 (collector-init Lambda)                       │   │
│  │    - パラメータ検証                                      │   │
│  │    - 実行状態初期化 (DynamoDB)                          │   │
│  │    - TDnet APIメタデータ取得 (総件数、ページ数)        │   │
│  └────────────────┬────────────────────────────────────────┘   │
│                   │                                               │
│                   ↓                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 2. データ取得ループ (Map State)                         │   │
│  │    MaxConcurrency: 5 (並列実行制限)                    │   │
│  │                                                           │   │
│  │    ┌──────────────────────────────────────────┐        │   │
│  │    │ 2.1 データ取得 (collector-fetch Lambda)  │        │   │
│  │    │     - TDnet API呼び出し (1ページ分)      │        │   │
│  │    │     - レート制限適用 (1req/sec)          │        │   │
│  │    │     - Retry: 指数バックオフ (3回)        │        │   │
│  │    └──────────────┬───────────────────────────┘        │   │
│  │                   │                                       │   │
│  │                   ↓                                       │   │
│  │    ┌──────────────────────────────────────────┐        │   │
│  │    │ 2.2 データ保存 (collector-save Lambda)   │        │   │
│  │    │     - DynamoDB保存                        │        │   │
│  │    │     - S3 PDFアップロード                  │        │   │
│  │    │     - バリデーション                      │        │   │
│  │    │     - Retry: 指数バックオフ (3回)        │        │   │
│  │    └───────────────────────────────────────────┘        │   │
│  │                                                           │   │
│  └────────────────┬────────────────────────────────────────┘   │
│                   │                                               │
│                   ↓                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 3. 集約 (collector-aggregate Lambda)                    │   │
│  │    - 実行結果の集約                                      │   │
│  │    - 統計情報の計算                                      │   │
│  │    - 実行状態更新 (completed/failed)                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DynamoDB Tables                               │
│  - disclosures (既存)                                            │
│  - execution-states (新規)                                       │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                         S3 Bucket                                │
│                    PDF Storage (既存)                            │
└─────────────────────────────────────────────────────────────────┘
```

### コンポーネント詳細

#### 1. Step Functions State Machine

**タイプ**: Standard Workflows

**理由**:
- 長時間実行が可能（最大1年）
- 実行履歴が永続化される（監査要件）
- 複雑なエラーハンドリングが可能
- 無料枠: 4,000状態遷移/月（十分）

**状態遷移**:
1. Initialize (Task) → collector-init Lambda
2. Map (Map State) → 並列データ取得・保存
   - ItemsPath: $.pages (ページ配列)
   - MaxConcurrency: 5
3. Aggregate (Task) → collector-aggregate Lambda
4. Success/Fail (Succeed/Fail)

#### 2. Lambda関数

##### 2.1 collector-init
- **責務**: 収集処理の初期化
- **入力**: `{ start_date, end_date, max_items }`
- **出力**: `{ execution_id, total_count, pages: [1, 2, ..., N] }`
- **タイムアウト**: 30秒
- **メモリ**: 256MB

##### 2.2 collector-fetch
- **責務**: TDnet APIから1ページ分のデータ取得
- **入力**: `{ page_number, start_date, end_date }`
- **出力**: `{ page_number, items: [...], count }`
- **タイムアウト**: 60秒
- **メモリ**: 256MB
- **リトライ**: 指数バックオフ（3回）

##### 2.3 collector-save
- **責務**: データの保存
- **入力**: `{ items: [...] }`
- **出力**: `{ saved_count, failed_count, failed_items: [...] }`
- **タイムアウト**: 120秒
- **メモリ**: 512MB
- **リトライ**: 指数バックオフ（3回）

##### 2.4 collector-aggregate
- **責務**: 実行結果の集約
- **入力**: `{ execution_id, results: [...] }`
- **出力**: `{ total_collected, total_failed, status }`
- **タイムアウト**: 30秒
- **メモリ**: 256MB

#### 3. DynamoDB実行状態テーブル

**テーブル名**: `tdnet-execution-states-{env}`

**スキーマ**:
```typescript
{
  execution_id: string;        // PK
  status: 'running' | 'completed' | 'failed';
  start_time: string;          // ISO 8601
  end_time?: string;           // ISO 8601
  progress: number;            // 0-100
  collected_count: number;
  failed_count: number;
  total_count: number;
  error_message?: string;
  parameters: {
    start_date: string;
    end_date: string;
    max_items: number;
  };
  ttl: number;                 // 30日後削除
}
```

**GSI**: 不要（execution_idでのみクエリ）

## エラーハンドリング戦略

### 1. リトライ戦略

| Lambda関数 | エラー種別 | リトライ回数 | バックオフ |
|-----------|-----------|------------|----------|
| collector-init | ネットワークエラー | 3 | 指数 (2s, 4s, 8s) |
| collector-fetch | ネットワークエラー | 3 | 指数 (2s, 4s, 8s) |
| collector-fetch | レート制限 (429) | 5 | 固定 (1s) |
| collector-save | ネットワークエラー | 3 | 指数 (2s, 4s, 8s) |
| collector-save | スロットリング | 3 | 指数 (1s, 2s, 4s) |

### 2. エラー分類

| エラー種別 | 対応 | Step Functions設定 |
|-----------|------|------------------|
| ネットワークエラー | リトライ | Retry (ErrorEquals: States.TaskFailed) |
| 認証エラー (401/403) | 即座に失敗 | Catch → Fail State |
| レート制限 (429) | 待機後リトライ | Retry (IntervalSeconds: 1) |
| データ検証エラー | ログ記録、継続 | 部分的失敗を許容 |
| タイムアウト | 部分的成功を記録 | Catch → Aggregate State |

### 3. 部分的失敗の処理

Map状態で一部のアイテムが失敗しても、成功したアイテムは保存されます。

```json
{
  "Type": "Map",
  "ItemsPath": "$.pages",
  "MaxConcurrency": 5,
  "Catch": [
    {
      "ErrorEquals": ["States.ALL"],
      "ResultPath": "$.error",
      "Next": "HandlePartialFailure"
    }
  ]
}
```

## パフォーマンス最適化

### 1. 並列実行制御

- **MaxConcurrency**: 5
- **理由**: TDnetレート制限（1req/sec）とLambda同時実行数のバランス
- **効果**: 5ページを並列処理、各ページ1秒間隔で取得

### 2. バッチサイズ

- **1ページあたりのアイテム数**: 100件（TDnet API制限）
- **Map状態のアイテム数**: ページ数（例: 2,700件 → 27ページ）

### 3. 実行時間試算

| データ量 | ページ数 | 並列度 | 取得時間 | 保存時間 | 合計時間 |
|---------|---------|-------|---------|---------|---------|
| 100件 | 1 | 1 | 1秒 | 5秒 | 約10秒 |
| 500件 | 5 | 5 | 5秒 | 25秒 | 約35秒 |
| 2,700件 | 27 | 5 | 27秒 | 135秒 | 約3分 |

## コスト試算

### Step Functions料金

**Standard Workflows**: $25 / 100万状態遷移

**1回の収集あたりの状態遷移**:
- Initialize: 1
- Map (27ページ): 27 × 2 (fetch + save) = 54
- Aggregate: 1
- 合計: 約56状態遷移

**月間コスト** (1日1回収集):
- 30回 × 56状態遷移 = 1,680状態遷移
- 無料枠: 4,000状態遷移/月
- **コスト**: $0（無料枠内）

### Lambda料金

**既存との比較**:
- 既存: 1関数 × 15分 × 512MB = 7,680MB秒
- 新規: 4関数 × 平均30秒 × 平均384MB = 約46,080MB秒（27ページ分）

**月間コスト** (1日1回収集):
- 30回 × 46,080MB秒 = 1,382,400MB秒
- 無料枠: 400,000GB秒/月 = 400,000,000MB秒
- **コスト**: $0（無料枠内）

### 合計コスト

**月間**: $0（無料枠内）

## 移行戦略

### フェーズ1: 並行運用（2週間）

1. 新システムをデプロイ
2. `/collect`エンドポイントで新旧システムを選択可能に
3. 新システムで小規模データ収集を実施
4. 問題がなければ中規模・大規模データで検証

### フェーズ2: 切り替え（1週間）

1. 新システムをデフォルトに設定
2. 旧システムは`legacy=true`パラメータで利用可能
3. 監視を強化

### フェーズ3: 廃止（1週間後）

1. 旧システムの利用状況を確認
2. 問題がなければ旧collector Lambda関数を削除
3. ドキュメント更新

## 監視・運用

### CloudWatch Metrics

- Step Functions実行回数
- 実行成功/失敗率
- 実行時間
- 各Lambda関数のメトリクス

### CloudWatch Alarms

- Step Functions実行失敗
- 実行時間超過（10分以上）
- Lambda関数エラー率（5%以上）

### CloudWatch Logs Insights

```sql
-- 実行時間の分析
fields @timestamp, execution_id, duration
| filter @type = "ExecutionSucceeded"
| stats avg(duration), max(duration), min(duration) by bin(5m)

-- エラー分析
fields @timestamp, execution_id, error
| filter @type = "ExecutionFailed"
| stats count() by error
```

## セキュリティ

### IAMロール

**Step Functions実行ロール**:
- Lambda関数の呼び出し権限
- CloudWatch Logsへの書き込み権限
- X-Rayへのトレース権限

**Lambda実行ロール**:
- DynamoDB読み書き権限
- S3読み書き権限
- Secrets Manager読み取り権限
- CloudWatch Logsへの書き込み権限

### 暗号化

- Step Functions実行履歴: CloudWatch Logsで暗号化
- DynamoDB: 保管時暗号化（既存）
- S3: 保管時暗号化（既存）

## 制約事項

### Step Functions制限

- 最大実行時間: 1年（Standard Workflows）
- 最大実行履歴サイズ: 25,000イベント
- Map状態の最大並列度: 40

### Lambda制限

- 最大実行時間: 15分
- 最大メモリ: 10GB
- 最大同時実行数: 1,000（リージョンごと）

## 今後の拡張

### 1. Express Workflowsへの移行

大量の収集リクエストが発生する場合、Express Workflowsへの移行を検討：
- 料金: $1 / 100万リクエスト（Standard比で1/25）
- 最大実行時間: 5分（短時間実行に最適）

### 2. EventBridgeスケジューラー統合

定期的なデータ収集を自動化：
- 毎日午前9時に前日分のデータを収集
- EventBridge Rule → Step Functions

### 3. SNS通知

実行完了・失敗時にSNS通知：
- Step Functions → SNS → Email/Slack

## 関連ドキュメント

- [AWS Step Functions Developer Guide](https://docs.aws.amazon.com/step-functions/)
- [AWS Step Functions Best Practices](https://docs.aws.amazon.com/step-functions/latest/dg/bp-express.html)
- `error-handling-patterns.md`
- `tdnet-implementation-rules.md`
