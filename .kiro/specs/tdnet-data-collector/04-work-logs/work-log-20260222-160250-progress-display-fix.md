# 作業記録: 進捗表示の修正

**作業日時**: 2026-02-22 16:02:50  
**作業者**: Kiro AI Assistant  
**作業概要**: collector Lambda関数の進捗表示問題を調査・修正

## 問題の特定

### 現象
- `scripts/manual-data-collection.ps1`実行時、進捗が0%のまま停止
- CloudWatch Logsでは正常にデータ収集が進行中（進捗11%、300件/2694件処理済み）

### 原因
`src/lambda/collector/handler.ts`の`collectDisclosuresForDateRange`関数で、進捗更新が日付単位でしか行われていない。

```typescript
// 現在の実装（問題あり）
for (let i = 0; i < dates.length; i++) {
  const date = dates[i];
  // ... データ収集処理 ...
  
  // 進捗率を更新（日付単位）← ここが問題
  const progress = Math.floor(((i + 1) / dates.length) * 100);
  await updateExecutionStatus(
    execution_id,
    'running',
    progress,
    collected_count,
    failed_count
  );
}
```

1日に2694件のデータがある場合、その日の処理が完了するまで進捗が0%のまま。

## 解決策

バッチ処理の進捗をリアルタイムで更新するように修正:

1. `processDisclosuresInParallel`関数内で、各バッチ完了時に進捗を更新
2. 進捗率を開示情報の件数ベースで計算（日付ベースではなく）

## 実装


### 修正内容

#### 1. `collectDisclosuresForDateRange`関数の修正

- `total_count`変数を追加して、全開示情報の件数を追跡
- `processDisclosuresInParallel`に進捗更新コールバックを渡すように変更
- コールバック内で、バッチ完了時に進捗率を計算してDynamoDBに更新

```typescript
// 総件数を更新
total_count += disclosureMetadata.length;

// 並列処理（並列度5）
// 進捗更新コールバックを渡す
const results = await processDisclosuresInParallel(
  disclosureMetadata,
  execution_id,
  5,
  async (batchSuccess: number, batchFailed: number) => {
    // バッチ完了時に進捗を更新
    collected_count += batchSuccess;
    failed_count += batchFailed;
    
    const processed = collected_count + failed_count;
    const progress = total_count > 0 
      ? Math.floor((processed / total_count) * 100) 
      : 0;
    
    await updateExecutionStatus(
      execution_id,
      'running',
      progress,
      collected_count,
      failed_count
    );
  }
);
```

#### 2. `processDisclosuresInParallel`関数の修正

- `onBatchComplete`コールバックパラメータを追加
- 各バッチ完了時にコールバックを呼び出し

```typescript
async function processDisclosuresInParallel(
  disclosureMetadata: DisclosureMetadata[],
  execution_id: string,
  concurrency: number = 5,
  onBatchComplete?: (batchSuccess: number, batchFailed: number) => Promise<void>
): Promise<{ success: number; failed: number }>
```

## 検証

### デプロイ

```powershell
./scripts/deploy-prod.ps1
```

デプロイ成功:
- TdnetCompute-prod: CollectorFunction更新完了
- 他のスタックは変更なし

## 成果物

- `src/lambda/collector/handler.ts`: 進捗表示ロジックを修正

## 申し送り事項

### 次回データ収集時の確認事項

1. `scripts/manual-data-collection.ps1`を実行して進捗表示が正常に動作することを確認
2. CloudWatch Logsで進捗更新ログが出力されていることを確認
3. DynamoDBの`tdnet_executions_prod`テーブルで実行ステータスが更新されていることを確認

### 想定される動作

- バッチ処理（5件ずつ）完了時に進捗率が更新される
- 進捗率は開示情報の件数ベースで計算される（日付ベースではない）
- 例: 2694件の場合、5件処理ごとに約0.2%ずつ進捗が増加

### 注意事項

- 現在実行中のデータ収集（execution_id: 01320b8b-6d95-4fa1-8361-f1fdfc2d27d0）は旧バージョンのコードで実行されているため、進捗表示は修正されない
- 次回のデータ収集から新しいロジックが適用される
