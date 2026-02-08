# Lambda Collector Architecture

このドキュメントでは、TDnet Data CollectorプロジェクトのLambda Collector関数のアーキテクチャを説明します。

## 目次

1. [概要](#概要)
2. [アーキテクチャ図](#アーキテクチャ図)
3. [コンポーネント構成](#コンポーネント構成)
4. [データフロー](#データフロー)
5. [エラーハンドリングフロー](#エラーハンドリングフロー)
6. [実行モード](#実行モード)
7. [パフォーマンス特性](#パフォーマンス特性)

---

## 概要

Lambda Collectorは、TDnet（適時開示情報閲覧サービス）から上場企業の開示情報を自動収集するサーバーレス関数です。

### 主要機能

- **バッチモード**: 前日の開示情報を自動収集（日次実行）
- **オンデマンドモード**: 指定期間の開示情報を手動収集
- **並列処理**: 複数の開示情報を並行してダウンロード・保存
- **部分的失敗の許容**: 一部の開示情報が失敗しても処理を継続
- **実行状態管理**: 進捗率をリアルタイムで追跡

### 技術スタック

- **ランタイム**: Node.js 20.x
- **言語**: TypeScript
- **メモリ**: 512MB
- **タイムアウト**: 15分
- **並列度**: 5（同時ダウンロード数）

---

## アーキテクチャ図

### システム全体図

```
┌─────────────────────────────────────────────────────────────────┐
│                        Lambda Collector                          │
│                                                                   │
│  ┌──────────────┐                                                │
│  │   Handler    │ ← Event (batch/on-demand)                      │
│  └──────┬───────┘                                                │
│         │                                                         │
│         ├─→ Validate Event                                       │
│         │                                                         │
│         ├─→ Update Execution Status (pending → running)          │
│         │                                                         │
│         ├─→ Generate Date Range                                  │
│         │                                                         │
│         └─→ For each date:                                       │
│             ┌────────────────────────────────────────┐           │
│             │  1. Scrape TDnet List                  │           │
│             │     ↓                                   │           │
│             │  2. Process Disclosures (parallel)     │           │
│             │     ├─→ Generate Disclosure ID         │           │
│             │     ├─→ Download PDF → S3              │           │
│             │     └─→ Save Metadata → DynamoDB       │           │
│             │     ↓                                   │           │
│             │  3. Update Progress                    │           │
│             └────────────────────────────────────────┘           │
│                                                                   │
│         └─→ Update Execution Status (completed/failed)           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ↓                    ↓                    ↓
    ┌────────┐          ┌─────────┐         ┌──────────┐
    │ TDnet  │          │   S3    │         │ DynamoDB │
    │  Web   │          │ Bucket  │         │  Tables  │
    └────────┘          └─────────┘         └──────────┘
```

### コンポーネント構成図

```
src/lambda/collector/
│
├── handler.ts                    # メインハンドラー
│   ├── handler()                 # Lambda エントリーポイント
│   ├── validateEvent()           # イベントバリデーション
│   ├── handleBatchMode()         # バッチモード処理
│   ├── handleOnDemandMode()      # オンデマンドモード処理
│   └── collectDisclosuresForDateRange()  # 日付範囲処理
│
├── scrape-tdnet-list.ts          # TDnetスクレイピング
│   └── scrapeTdnetList()         # 開示情報リスト取得
│
├── download-pdf.ts               # PDFダウンロード
│   └── downloadPdf()             # PDF取得 → S3保存
│
├── save-metadata.ts              # メタデータ保存
│   └── saveMetadata()            # DynamoDB保存
│
└── update-execution-status.ts    # 実行状態管理
    ├── updateExecutionStatus()   # 状態更新
    └── getExecutionStatus()      # 状態取得
```

---

## コンポーネント構成

### 1. Handler（handler.ts）

**責務**: Lambda関数のメインエントリーポイント。イベント処理、モード判定、エラーハンドリング。

**主要関数**:

| 関数名 | 説明 | 入力 | 出力 |
|--------|------|------|------|
| `handler()` | Lambda エントリーポイント | `CollectorEvent`, `Context` | `CollectorResponse` |
| `validateEvent()` | イベントバリデーション | `CollectorEvent` | `void` (throws on error) |
| `handleBatchMode()` | バッチモード処理 | `execution_id` | `CollectorResponse` |
| `handleOnDemandMode()` | オンデマンドモード処理 | `execution_id`, `start_date`, `end_date` | `CollectorResponse` |
| `collectDisclosuresForDateRange()` | 日付範囲処理 | `execution_id`, `start_date`, `end_date` | `CollectorResponse` |
| `processDisclosuresInParallel()` | 並列処理 | `disclosureMetadata[]`, `execution_id`, `concurrency` | `{ success, failed }` |
| `processDisclosure()` | 単一開示処理 | `metadata`, `execution_id`, `sequence` | `void` |

**エラーハンドリング**:
- イベントバリデーションエラー → `ValidationError` (Non-Retryable)
- ネットワークエラー → ログ記録 + 部分的失敗として継続
- 全体失敗 → `status: 'failed'` を返却

### 2. Scrape TDnet List（scrape-tdnet-list.ts）

**責務**: TDnet Webサイトから指定日の開示情報リストを取得。

**主要関数**:

| 関数名 | 説明 | 入力 | 出力 |
|--------|------|------|------|
| `scrapeTdnetList()` | 開示情報リスト取得 | `date` (YYYY-MM-DD) | `DisclosureMetadata[]` |

**処理フロー**:
1. TDnet URLを構築（日付パラメータ付き）
2. HTMLを取得（axios + レート制限）
3. HTMLをパース（cheerio）
4. メタデータを抽出（会社コード、タイトル、PDF URL、開示日時）
5. バリデーション（必須フィールドチェック）

**エラーハンドリング**:
- ネットワークエラー → 再試行（最大3回、指数バックオフ）
- HTMLパースエラー → ログ記録 + 空配列を返却
- レート制限エラー → 待機後に再試行

### 3. Download PDF（download-pdf.ts）

**責務**: PDFファイルをダウンロードしてS3に保存。

**主要関数**:

| 関数名 | 説明 | 入力 | 出力 |
|--------|------|------|------|
| `downloadPdf()` | PDF取得 → S3保存 | `disclosure_id`, `pdf_url`, `disclosed_at` | `s3_key` |

**処理フロー**:
1. PDFをダウンロード（axios + ストリーム）
2. S3キーを生成（`pdfs/{YYYY}/{MM}/{disclosure_id}.pdf`）
3. S3にアップロード（PutObjectCommand）
4. S3キーを返却

**エラーハンドリング**:
- ダウンロードエラー → 再試行（最大3回）
- S3アップロードエラー → 再試行（AWS SDK自動再試行）
- タイムアウト → 30秒でタイムアウト

### 4. Save Metadata（save-metadata.ts）

**責務**: 開示情報メタデータをDynamoDBに保存。

**主要関数**:

| 関数名 | 説明 | 入力 | 出力 |
|--------|------|------|------|
| `saveMetadata()` | DynamoDB保存 | `disclosure`, `s3_key` | `void` |

**処理フロー**:
1. `date_partition` を生成（`disclosed_at` から YYYY-MM 形式）
2. DynamoDBに保存（PutItemCommand + ConditionExpression）
3. 重複チェック（`disclosure_id` が既存の場合はスキップ）

**エラーハンドリング**:
- 重複エラー（`ConditionalCheckFailedException`） → ログ記録 + スキップ
- スロットリングエラー → 再試行（AWS SDK自動再試行）
- バリデーションエラー → ログ記録 + エラーをスロー

### 5. Update Execution Status（update-execution-status.ts）

**責務**: Lambda実行状態をDynamoDBに保存・更新。

**主要関数**:

| 関数名 | 説明 | 入力 | 出力 |
|--------|------|------|------|
| `updateExecutionStatus()` | 状態更新 | `execution_id`, `status`, `progress`, ... | `ExecutionStatus` |
| `getExecutionStatus()` | 状態取得 | `execution_id` | `ExecutionStatus \| null` |

**状態遷移**:
```
pending → running → completed
                 ↘ failed
```

**進捗率の計算**:
- 日付単位で進捗率を更新（例: 3日中2日完了 → 66%）
- 進捗率は0-100の範囲に自動制限

**TTL設定**:
- `completed` / `failed` 状態の場合、30日後に自動削除

---

## データフロー

### バッチモード（前日のデータ収集）

```
1. Lambda起動
   ↓
2. イベントバリデーション
   ↓
3. 前日の日付を計算（JST基準）
   ↓
4. 実行状態を初期化（pending → running）
   ↓
5. TDnetから開示情報リストを取得
   ↓
6. 各開示情報を並列処理（並列度5）
   ├─→ 開示IDを生成
   ├─→ PDFをダウンロード → S3に保存
   └─→ メタデータをDynamoDB に保存
   ↓
7. 進捗率を更新（100%）
   ↓
8. 実行状態を更新（completed）
   ↓
9. メトリクスをCloudWatchに送信
   ↓
10. レスポンスを返却
```

### オンデマンドモード（指定期間のデータ収集）

```
1. Lambda起動
   ↓
2. イベントバリデーション（start_date, end_date）
   ↓
3. 日付範囲を生成（例: 2024-01-15 〜 2024-01-20）
   ↓
4. 実行状態を初期化（pending → running）
   ↓
5. 各日付を順次処理
   ├─→ TDnetから開示情報リストを取得
   ├─→ 各開示情報を並列処理（並列度5）
   │   ├─→ 開示IDを生成
   │   ├─→ PDFをダウンロード → S3に保存
   │   └─→ メタデータをDynamoDB に保存
   └─→ 進捗率を更新（日付単位）
   ↓
6. 実行状態を更新（completed）
   ↓
7. メトリクスをCloudWatchに送信
   ↓
8. レスポンスを返却
```

### データ保存フロー

```
開示情報メタデータ
   ↓
1. 開示IDを生成
   disclosure_id = TD{YYYYMMDD}{company_code}{sequence}
   例: TD202401151234001
   ↓
2. PDFをダウンロード
   pdf_url → axios → Buffer
   ↓
3. S3に保存
   s3_key = pdfs/{YYYY}/{MM}/{disclosure_id}.pdf
   例: pdfs/2024/01/TD202401151234001.pdf
   ↓
4. DynamoDBに保存
   {
     disclosure_id: "TD202401151234001",
     company_code: "1234",
     company_name: "株式会社サンプル",
     title: "決算短信",
     disclosed_at: "2024-01-15T10:30:00Z",
     date_partition: "2024-01",  // JST基準で生成
     s3_key: "pdfs/2024/01/TD202401151234001.pdf",
     collected_at: "2024-01-15T11:00:00Z"
   }
```

---

## エラーハンドリングフロー

### エラー分類と処理方針

```
┌─────────────────────────────────────────────────────────────┐
│                    エラー発生                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├─→ Retryable Error（再試行可能）
                     │   ├─→ ネットワークエラー
                     │   ├─→ タイムアウト
                     │   ├─→ 5xx エラー
                     │   ├─→ レート制限
                     │   └─→ AWS一時的エラー
                     │   ↓
                     │   再試行（指数バックオフ、最大3回）
                     │   ↓
                     │   成功 → 処理継続
                     │   失敗 → ログ記録 + 部分的失敗
                     │
                     └─→ Non-Retryable Error（再試行不可）
                         ├─→ バリデーションエラー
                         ├─→ 認証エラー
                         ├─→ 404 Not Found
                         └─→ 設定エラー
                         ↓
                         ログ記録 + エラーをスロー
                         ↓
                         Lambda実行失敗
```

### 部分的失敗の処理

```
並列処理（5並行）
├─→ 開示情報1: 成功 ✓
├─→ 開示情報2: 失敗 ✗ → ログ記録 + カウント
├─→ 開示情報3: 成功 ✓
├─→ 開示情報4: 成功 ✓
└─→ 開示情報5: 失敗 ✗ → ログ記録 + カウント
↓
結果: { success: 3, failed: 2 }
↓
ステータス: partial_success
↓
メトリクス送信:
- DisclosuresCollected: 3
- DisclosuresFailed: 2
```

### エラーログ構造

```json
{
  "timestamp": "2024-01-15T10:30:00.123Z",
  "level": "error",
  "message": "Failed to process disclosure",
  "error_type": "NetworkError",
  "error_message": "Connection timeout",
  "context": {
    "execution_id": "exec_1705315800000_abc123_12345678",
    "disclosure_id": "TD202401151234001",
    "company_code": "1234",
    "retry_count": 3
  },
  "stack_trace": "NetworkError: Connection timeout\n    at ..."
}
```

### CloudWatchメトリクス

```
名前空間: TDnetDataCollector

メトリクス:
- LambdaExecutionTime (Milliseconds)
  - Dimensions: FunctionName=Collector, Mode=batch
- DisclosuresCollected (Count)
  - Dimensions: Mode=batch
- DisclosuresFailed (Count)
  - Dimensions: Mode=batch
- LambdaError (Count)
  - Dimensions: ErrorType=NetworkError, FunctionName=Collector
```

---

## 実行モード

### バッチモード

**トリガー**: EventBridge（毎日午前9時 JST）

**イベント**:
```json
{
  "mode": "batch"
}
```

**処理内容**:
- 前日（JST基準）の開示情報を収集
- 自動実行（手動介入不要）

**使用例**:
```typescript
const response = await handler({ mode: 'batch' }, context);
// 前日のデータを自動収集
```

### オンデマンドモード

**トリガー**: 手動実行（AWS Console、CLI、API）

**イベント**:
```json
{
  "mode": "on-demand",
  "start_date": "2024-01-15",
  "end_date": "2024-01-20"
}
```

**処理内容**:
- 指定期間の開示情報を収集
- 手動実行（過去データの再収集など）

**使用例**:
```typescript
const response = await handler({
  mode: 'on-demand',
  start_date: '2024-01-15',
  end_date: '2024-01-20',
}, context);
// 2024-01-15 〜 2024-01-20 のデータを収集
```

### バリデーションルール

| 項目 | バッチモード | オンデマンドモード |
|------|-------------|-------------------|
| `mode` | 必須（"batch"） | 必須（"on-demand"） |
| `start_date` | 不要 | 必須（YYYY-MM-DD形式） |
| `end_date` | 不要 | 必須（YYYY-MM-DD形式） |
| 日付範囲 | - | 過去1年以内 |
| 日付順序 | - | start_date ≤ end_date |
| 未来日 | - | end_date ≤ 明日 |

---

## パフォーマンス特性

### 処理時間

| 項目 | 目標値 | 実測値（参考） |
|------|--------|---------------|
| 1日分の収集（50件） | < 2分 | 約1分30秒 |
| 1週間分の収集（350件） | < 10分 | 約8分 |
| 1ヶ月分の収集（1500件） | < 15分 | 約12分 |

### メモリ使用量

| 項目 | 設定値 | 実測値（参考） |
|------|--------|---------------|
| メモリサイズ | 512MB | 約300MB（ピーク時） |
| メモリ使用率 | - | 約60% |

### 並列度

| 項目 | 設定値 | 理由 |
|------|--------|------|
| 同時ダウンロード数 | 5 | TDnetサーバーへの負荷を考慮 |
| Lambda同時実行数 | 制限なし | バッチモードは1日1回のみ |

### コスト試算（月間）

**前提条件**:
- バッチモード: 1日1回実行（30回/月）
- 1回あたり50件の開示情報を収集
- 実行時間: 平均2分
- メモリ: 512MB

**Lambda料金**:
- リクエスト料金: 30回 × $0.20/100万リクエスト ≈ $0.000006
- 実行時間料金: 30回 × 2分 × 512MB × $0.0000166667/GB秒 ≈ $0.05
- **合計**: 約 $0.05/月

**S3料金**:
- ストレージ: 1500件 × 1MB × $0.023/GB ≈ $0.03/月
- PUT リクエスト: 1500件 × $0.005/1000リクエスト ≈ $0.008/月
- **合計**: 約 $0.04/月

**DynamoDB料金**:
- 書き込み: 1500件 × 1KB × $1.25/100万書き込み ≈ $0.002/月
- ストレージ: 1500件 × 1KB × $0.25/GB ≈ $0.0004/月
- **合計**: 約 $0.003/月

**総コスト**: 約 $0.10/月（AWS無料枠内）

---

## 関連ドキュメント

### 実装ガイド

- [Lambda Implementation Guide](../../.kiro/steering/development/lambda-implementation.md)
- [Error Handling Patterns](../../.kiro/steering/core/error-handling-patterns.md)
- [Error Handling Implementation](../../.kiro/steering/development/error-handling-implementation.md)
- [TDnet Scraping Patterns](../../.kiro/steering/development/tdnet-scraping-patterns.md)

### 運用ガイド

- [Lambda Error Logging Guide](../guides/lambda-error-logging.md)
- [Batch Metrics Guide](../guides/batch-metrics.md)
- [Monitoring and Alerts](../../.kiro/steering/infrastructure/monitoring-alerts.md)
- [Performance Optimization](../../.kiro/steering/infrastructure/performance-optimization.md)

### API仕様

- [Requirements](../../.kiro/specs/tdnet-data-collector/docs/requirements.md)
- [Design](../../.kiro/specs/tdnet-data-collector/docs/design.md)
- [Tasks](../../.kiro/specs/tdnet-data-collector/tasks.md)

---

## トラブルシューティング

### Lambda実行がタイムアウトする

**原因**: 大量の開示情報を処理している、またはネットワークが遅い。

**解決策**:
1. タイムアウトを延長（15分 → 20分）
2. 並列度を調整（5 → 3）
3. 日付範囲を分割して複数回実行

### メモリ不足エラー

**原因**: PDFファイルが大きい、または並列度が高すぎる。

**解決策**:
1. メモリサイズを増加（512MB → 1024MB）
2. 並列度を削減（5 → 3）
3. ストリーム処理を使用（バッファリングを避ける）

### 部分的失敗が多い

**原因**: TDnetサーバーが不安定、またはレート制限に引っかかっている。

**解決策**:
1. 再試行回数を増加（3回 → 5回）
2. バックオフ時間を延長（2秒 → 5秒）
3. 並列度を削減（5 → 2）

### DynamoDB書き込みエラー

**原因**: スロットリング、または重複キー。

**解決策**:
1. DynamoDBのWCUを増加
2. 重複チェックを強化（ConditionExpression）
3. バッチ書き込みを使用（BatchWriteItem）

---

## 今後の改善予定

### Phase 2: PDF解析機能

- PDFからテキストを抽出
- 財務データを構造化
- 自然言語処理（NLP）による分類

### Phase 3: API機能

- RESTful API（API Gateway + Lambda）
- 開示情報の検索・フィルタリング
- ページネーション対応

### Phase 4: 通知機能

- 新規開示情報のリアルタイム通知
- メール通知（SES）
- Slack通知（Webhook）

### Phase 5: 分析機能

- 開示情報のトレンド分析
- 企業別の開示頻度分析
- ダッシュボード（QuickSight）
