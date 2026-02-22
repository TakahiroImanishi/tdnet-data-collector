# Lambda Collector 998件制限問題の改善タスク

**作成日時**: 2026-02-22 15:11:30  
**発見日時**: 2026-02-22 14:58:09  
**優先度**: 🔴 Critical  
**影響範囲**: データ収集機能全体

## 問題の概要

Lambda Collector関数が2,694件のデータを取得したにもかかわらず、998件でデータ保存が停止する問題が発生しています。この問題は複数回の実行で再現性が確認されています。

## 発見された問題

### 1. データ処理が998件で停止

**現象**:
- TDnetから2,694件のデータ取得に成功
- DynamoDBへの保存が998件で停止
- S3へのPDF保存も998件で停止
- 残り1,696件が未処理のまま

**再現性**: ✅ 確認済み（複数回の実行で同じ現象）

**影響**:
- データ収集の完全性が損なわれる
- 約37%のデータが欠落（998/2,694）
- ユーザーが不完全なデータを参照する可能性

### 2. 実行状況テーブルが更新されない

**現象**:
- `tdnet_executions_prod`テーブルの`progress`が0のまま
- `collected_count`が0のまま
- `updated_at`が実行開始直後から更新されない

**影響**:
- ユーザーが実行状況を確認できない
- 進捗モニタリングが機能しない
- デバッグが困難

### 3. 重複データ警告が多数発生

**現象**:
```
Duplicate disclosure detected: 20260213_43240_799
Duplicate disclosure detected: 20260213_43240_798
```

**影響**:
- ログが重複警告で埋まる
- 実際のエラーが見つけにくい
- 処理速度の低下（重複チェックのオーバーヘッド）

## 根本原因の仮説

### 仮説1: DynamoDB BatchWriteの制限

**可能性**: 🔴 高

**根拠**:
- DynamoDB BatchWriteItemは最大25項目まで
- 998件 = 25項目 × 39バッチ + 23項目（最終バッチ）
- 40バッチ目で何らかのエラーが発生している可能性

**検証方法**:
```typescript
// src/lambda/collector/handler.ts
// BatchWriteの実行回数とエラーをログに記録
logger.info('BatchWrite executed', { 
  batch_number, 
  items_count, 
  total_written 
});
```

### 仮説2: Lambda関数のメモリ不足

**可能性**: ⚠️ 中

**根拠**:
- メモリ: 512MB
- 2,694件のデータを処理中にメモリ不足の可能性
- メモリ不足時、Lambdaは警告なく処理を停止することがある

**検証方法**:
```bash
# CloudWatch Logsでメモリ使用量を確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --filter-pattern "Memory Size" \
  --region ap-northeast-1
```

### 仮説3: レート制限による処理遅延

**可能性**: 🟢 低

**根拠**:
- TDnetへのリクエストは2秒/回
- 2,694件 × 2秒 = 約90分（タイムアウト15分を超過）
- ただし、998件は約33分で処理可能（タイムアウト内）

**検証方法**:
- 処理時間のログを確認
- タイムアウトエラーの有無を確認

### 仮説4: DynamoDB書き込みキャパシティ不足

**可能性**: 🟢 低

**根拠**:
- オンデマンド課金モード使用
- 自動スケーリングされるはず
- ただし、急激な書き込み増加時にスロットリングの可能性

**検証方法**:
```bash
# CloudWatch Metricsでスロットリングを確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=tdnet_disclosures_prod \
  --start-time 2026-02-22T05:58:00Z \
  --end-time 2026-02-22T06:15:00Z \
  --period 60 \
  --statistics Sum
```

## 改善タスク

### タスク1: 根本原因の特定（緊急）

**優先度**: 🔴 Critical  
**期限**: 即座  
**担当**: AI Assistant

**実施内容**:
- [x] 1.1 CloudWatch Logsで詳細なエラーログを確認
  - Lambda関数の最終ログを確認
  - タイムアウトエラーの有無
  - メモリ不足の警告
  - DynamoDBエラー（ThrottlingException等）

- [ ] 1.2 CloudWatch Metricsでパフォーマンスを確認
  - Lambda関数のメモリ使用量
  - Lambda関数の実行時間
  - DynamoDBのスロットリング
  - DynamoDBの書き込みキャパシティ

- [ ] 1.3 Lambda関数のコードレビュー
  - BatchWrite実装の確認
  - エラーハンドリングの確認
  - 実行状況更新ロジックの確認

**成果物**:
- 根本原因の特定レポート
- 作業記録: `work-log-[YYYYMMDD-HHMMSS]-lambda-998-limit-root-cause.md`

---

### タスク2: 緊急修正（根本原因特定後）

**優先度**: 🔴 Critical  
**期限**: 根本原因特定後24時間以内  
**担当**: AI Assistant

**実施内容**:

#### 2.1 BatchWrite実装の修正（仮説1が正しい場合）

```typescript
// src/lambda/collector/handler.ts

// 修正前: 一度に全データをBatchWrite
const batchWritePromises = chunks.map(chunk => 
  dynamodb.batchWriteItem({ RequestItems: { [tableName]: chunk } })
);

// 修正後: エラーハンドリングとリトライを追加
const batchWriteWithRetry = async (chunk: any[], retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await dynamodb.batchWriteItem({
        RequestItems: { [tableName]: chunk }
      });
      
      // UnprocessedItemsがある場合は再試行
      if (result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0) {
        logger.warn('Unprocessed items detected', {
          count: result.UnprocessedItems[tableName]?.length || 0,
          retry_attempt: i + 1
        });
        
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          continue;
        }
      }
      
      return result;
    } catch (error) {
      logger.error('BatchWrite failed', {
        error_type: error.name,
        error_message: error.message,
        retry_attempt: i + 1,
        chunk_size: chunk.length
      });
      
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

#### 2.2 メモリ設定の最適化（仮説2が正しい場合）

```typescript
// cdk/lib/stacks/compute-stack.ts

// 修正前
const collectorFunction = new lambda.Function(this, 'CollectorFunction', {
  memorySize: 512,
  // ...
});

// 修正後
const collectorFunction = new lambda.Function(this, 'CollectorFunction', {
  memorySize: 1024, // 512MB → 1024MBに増量
  // ...
});
```

#### 2.3 実行状況更新ロジックの修正

```typescript
// src/lambda/collector/handler.ts

// 定期的に実行状況を更新
let processedCount = 0;
const updateInterval = 100; // 100件ごとに更新

for (const disclosure of disclosures) {
  await processDisclosure(disclosure);
  processedCount++;
  
  if (processedCount % updateInterval === 0) {
    await updateExecutionStatus({
      execution_id,
      status: 'running',
      progress: Math.floor((processedCount / totalCount) * 100),
      collected_count: processedCount,
      failed_count: failedCount
    });
  }
}
```

**成果物**:
- 修正されたLambda関数コード
- 修正されたCDKスタック
- テスト結果
- 作業記録: `work-log-[YYYYMMDD-HHMMSS]-lambda-998-limit-fix.md`

---

### タスク3: テストと検証

**優先度**: 🔴 Critical  
**期限**: 修正後即座  
**担当**: AI Assistant

**実施内容**:
- [ ] 3.1 開発環境でのテスト
  - LocalStackでの動作確認
  - 1,000件以上のデータでテスト
  - エラーハンドリングの確認

- [ ] 3.2 本番環境でのテスト
  - 小規模データ（100件）でテスト
  - 中規模データ（1,000件）でテスト
  - 大規模データ（2,694件）でテスト

- [ ] 3.3 モニタリング
  - CloudWatch Logsでエラー確認
  - CloudWatch Metricsでパフォーマンス確認
  - 実行状況テーブルの更新確認

**成功基準**:
- ✅ 2,694件すべてのデータが保存される
- ✅ 実行状況テーブルが正しく更新される
- ✅ エラーログが発生しない
- ✅ 処理時間がタイムアウト内に収まる

**成果物**:
- テスト結果レポート
- 作業記録: `work-log-[YYYYMMDD-HHMMSS]-lambda-998-limit-test.md`

---

### タスク4: 長期的な改善

**優先度**: ⚠️ Medium  
**期限**: 1週間以内  
**担当**: 未定

**実施内容**:

#### 4.1 バッチ処理の最適化

- [ ] バッチサイズの動的調整
  - メモリ使用量に応じてバッチサイズを調整
  - DynamoDBのスロットリングに応じて調整

- [ ] 並列処理の最適化
  - 現在5並列 → 10並列に増加
  - Lambda同時実行数の制限を確認

#### 4.2 タイムアウト設定の見直し

```typescript
// cdk/lib/stacks/compute-stack.ts

// 修正前
const collectorFunction = new lambda.Function(this, 'CollectorFunction', {
  timeout: Duration.minutes(15), // 15分
  // ...
});

// 修正後
const collectorFunction = new lambda.Function(this, 'CollectorFunction', {
  timeout: Duration.minutes(30), // 30分に延長
  // ...
});
```

#### 4.3 進捗モニタリングの強化

- [ ] CloudWatch Dashboardの作成
  - 処理件数のグラフ
  - エラー率のグラフ
  - 処理時間のグラフ

- [ ] CloudWatch Alarmsの設定
  - 処理件数が閾値を下回った場合にアラート
  - エラー率が閾値を超えた場合にアラート

#### 4.4 ドキュメント更新

- [ ] トラブルシューティングガイドの作成
  - 998件制限問題の原因と対策
  - 同様の問題が発生した場合の対応手順

- [ ] 運用マニュアルの更新
  - データ収集の監視方法
  - 異常検知時の対応フロー

**成果物**:
- 最適化されたLambda関数
- CloudWatch Dashboard
- CloudWatch Alarms
- トラブルシューティングガイド
- 作業記録: `work-log-[YYYYMMDD-HHMMSS]-lambda-998-limit-optimization.md`

---

## 実施スケジュール

| タスク | 優先度 | 期限 | 状態 |
|--------|--------|------|------|
| タスク1: 根本原因の特定 | 🔴 Critical | 即座 | ⏳ 未着手 |
| タスク2: 緊急修正 | 🔴 Critical | 24時間以内 | ⏳ 未着手 |
| タスク3: テストと検証 | 🔴 Critical | 修正後即座 | ⏳ 未着手 |
| タスク4: 長期的な改善 | ⚠️ Medium | 1週間以内 | ⏳ 未着手 |

## 関連ドキュメント

- 作業記録: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-145809-api-key-production-execution.md`
- Lambda関数: `src/lambda/collector/handler.ts`
- CDKスタック: `cdk/lib/stacks/compute-stack.ts`
- 実装ルール: `.kiro/steering/core/tdnet-implementation-rules.md`
- エラーハンドリング: `.kiro/steering/core/error-handling-patterns.md`

## 備考

### 緊急性の理由

この問題は本番環境でのデータ収集に直接影響するため、最優先で対応する必要があります。

1. **データ完全性の損失**: 約37%のデータが欠落
2. **ユーザー影響**: 不完全なデータを参照する可能性
3. **再現性**: 複数回の実行で同じ現象が発生
4. **監視不能**: 実行状況が更新されないため、問題の検知が困難

### 次のステップ

1. タスク1を即座に開始し、根本原因を特定
2. 根本原因に基づいてタスク2の修正内容を決定
3. タスク3でテストと検証を実施
4. タスク4で長期的な改善を計画

