# Lambda 998件制限問題 - 根本原因特定作業記録

**作業日時**: 2026-02-22 15:24:46  
**作業者**: AI Assistant  
**関連タスク**: `.kiro/specs/tdnet-data-collector/tasks/tasks-lambda-998-limit-issue.md` - タスク1.1  
**優先度**: 🔴 Critical

## 作業概要

Lambda Collector関数が2,694件のデータを取得したにもかかわらず、998件でデータ保存が停止する問題の根本原因を特定するため、CloudWatch Logsを詳細に分析します。

## 調査項目

1. Lambda関数の最終ログを確認
2. タイムアウトエラーの有無
3. メモリ不足の警告
4. DynamoDBエラー（ThrottlingException等）
5. 998件付近のログパターン

## 調査対象

- **実行ID**: `b6c62399-9e75-4bc4-9b43-51786ffc440f`
- **ログループ**: `/aws/lambda/tdnet-collector-prod`
- **実行時刻**: 2026-02-22 05:58:00 - 06:20:00 JST (2026-02-21 20:58:00 - 21:20:00 UTC)
- **プロファイル**: `imanishi-awssso`
- **リージョン**: `ap-northeast-1`

## 調査手順

### 1. CloudWatch Logs分析スクリプト実行

調査スクリプト: `scripts/check-lambda-998-limit.ps1`

このスクリプトは以下の分析を実行します：
- Lambda関数の最終ログ確認
- REPORTメッセージからメモリ使用量・実行時間を抽出
- タイムアウトエラーの検索
- メモリ不足警告の検索
- DynamoDBエラー（ThrottlingException等）の検索
- 998件付近のログパターン分析

---

## 調査結果

### スクリプト実行


```powershell
./scripts/check-lambda-998-limit.ps1
```

**結果**: 指定された実行ID `b6c62399-9e75-4bc4-9b43-51786ffc440f` のログが見つかりませんでした。

**原因**:
- ログの保持期間が設定されていない（無期限保持）
- 実行日時が2026-02-22 05:58:00 JSTだが、ログが既に削除されているか、実行IDが異なる可能性

### 2. ログループ確認

```powershell
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/tdnet" --profile imanishi-awssso --region ap-northeast-1
```

**結果**: `/aws/lambda/tdnet-collector-prod` は存在（2.4MB）

### 3. 最新ログストリーム確認

```powershell
aws logs describe-log-streams --log-group-name "/aws/lambda/tdnet-collector-prod" --order-by LastEventTime --descending --max-items 5
```

**結果**: 2026-02-22の最新ログストリームを確認

### 4. DynamoDB実行状況テーブル確認

```powershell
aws dynamodb scan --table-name tdnet_executions_prod --limit 5
```

**結果**: テーブルが空（実行履歴なし）

---

## コード分析結果

### handler.ts の分析

Lambda Collector関数のコードを詳細に確認した結果、以下の点が判明しました。

#### 1. 並列処理の実装

```typescript
async function processDisclosuresInParallel(
  disclosureMetadata: DisclosureMetadata[],
  execution_id: string,
  concurrency: number = 5
): Promise<{ success: number; failed: number }> {
  const results = { success: 0, failed: 0 };

  // 並列度を制限して処理
  for (let i = 0; i < disclosureMetadata.length; i += concurrency) {
    const batch = disclosureMetadata.slice(i, i + concurrency);
    const promises = batch.map((metadata, index) =>
      processDisclosure(metadata, execution_id, i + index + 1)
    );

    const settled = await Promise.allSettled(promises);

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.success++;
      } else {
        results.failed++;
        logger.error('Failed to process disclosure', {
          execution_id,
          error: result.reason,
        });
      }
    }
  }

  return results;
}
```

**問題点**:
- ✅ 並列度5で処理（問題なし）
- ✅ Promise.allSettledで部分的失敗を許容（問題なし）
- ❌ **エラーハンドリングが不十分**: エラーが発生してもログに記録するだけで、処理は継続される

#### 2. 単一開示情報の処理

```typescript
async function processDisclosure(
  metadata: DisclosureMetadata,
  execution_id: string,
  sequence: number
): Promise<void> {
  try {
    // 開示IDを生成
    const disclosure_id = generateDisclosureId(
      metadata.disclosed_at,
      metadata.company_code,
      sequence
    );

    // PDFをダウンロードしてS3に保存
    const s3_key = await downloadPdf(
      disclosure_id,
      metadata.pdf_url,
      metadata.disclosed_at
    );

    // メタデータをDynamoDBに保存
    await saveMetadata(disclosure, s3_key);

    logger.info('Successfully processed disclosure', {
      execution_id,
      disclosure_id,
      s3_key,
    });
  } catch (error) {
    logger.error(
      'Failed to process disclosure',
      createErrorContext(error as Error, {
        execution_id,
        company_code: metadata.company_code,
        title: metadata.title,
      })
    );
    throw error; // エラーを再スロー
  }
}
```

**問題点**:
- ✅ エラーを再スローして上位に伝播（問題なし）
- ❌ **DynamoDB/S3のエラーが発生した場合、その開示情報の処理が失敗する**

#### 3. 実行状況更新の実装

```typescript
// 実行状態を初期化（pending）
await updateExecutionStatus(execution_id, 'pending', 0);

// 実行状態を更新（running）
await updateExecutionStatus(execution_id, 'running', 0);

// 各日付のデータを順次収集
for (let i = 0; i < dates.length; i++) {
  // ... 処理 ...
  
  // 進捗率を更新（日付単位）
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

**問題点**:
- ✅ 実行状況を定期的に更新（日付単位）
- ❌ **開示情報単位での更新がない**: 998件で停止した場合、最後の更新が反映されない可能性

---

## 根本原因の仮説（更新）

### 仮説1: DynamoDB BatchWriteの制限（可能性: 🔴 高）

**根拠**:
- `saveMetadata`関数がDynamoDBへの書き込みを行う
- 998件 ≈ 40バッチ（25項目/バッチ）
- 40バッチ目で何らかのエラーが発生している可能性

**次のステップ**:
- `saveMetadata.ts`のコードを確認
- DynamoDB BatchWriteの実装を確認
- エラーハンドリングとリトライロジックを確認

### 仮説2: S3 PutObjectの制限（可能性: ⚠️ 中）

**根拠**:
- `downloadPdf`関数がS3へのアップロードを行う
- 998件のPDFアップロード後にエラーが発生している可能性
- S3のレート制限（3,500 PUT/秒）は十分だが、並列度5での処理中にエラーが発生する可能性

**次のステップ**:
- `download-pdf.ts`のコードを確認
- S3 PutObjectの実装を確認
- エラーハンドリングとリトライロジックを確認

### 仮説3: Lambda関数のメモリ不足（可能性: 🟢 低）

**根拠**:
- メモリ: 512MB（設定値）
- 2,694件のデータを処理中にメモリ不足の可能性は低い
- ただし、メモリリークがある場合は998件付近で枯渇する可能性

**次のステップ**:
- CloudWatch Logsでメモリ使用量を確認（REPORTメッセージ）
- メモリリークの可能性を調査

### 仮説4: 実行状況更新の失敗（可能性: 🟢 低）

**根拠**:
- `updateExecutionStatus`が失敗しても、データ収集は継続されるはず
- ただし、実行状況が更新されないため、ユーザーが進捗を確認できない

---

## 次のアクション

### 1. saveMetadata.tsの確認（最優先）

DynamoDB BatchWriteの実装を確認し、998件で停止する原因を特定します。

### 2. download-pdf.tsの確認（優先）

S3 PutObjectの実装を確認し、エラーハンドリングを検証します。

### 3. CloudWatch Logsの再調査

最新の実行ログを確認し、エラーメッセージを探します。

---

## 申し送り事項

1. **ログが見つからない問題**: 指定された実行IDのログが見つかりませんでした。最新の実行を再度実行して、リアルタイムでログを確認する必要があります。

2. **DynamoDB実行状況テーブルが空**: 実行履歴が保存されていないため、過去の実行状況を確認できません。

3. **コード分析の結果**: 998件で停止する直接的な制限は見当たりませんが、DynamoDB BatchWriteまたはS3 PutObjectのエラーハンドリングに問題がある可能性が高いです。

4. **次のステップ**: `saveMetadata.ts`と`download-pdf.ts`のコードを確認し、エラーハンドリングとリトライロジックを検証します。



---

## 詳細コード分析

### saveMetadata.ts の分析

```typescript
export async function saveMetadata(disclosure: Disclosure, s3_key: string): Promise<void> {
  try {
    // ... DynamoDB PutItem処理 ...
    
    await retryWithBackoff(
      async () => {
        try {
          await dynamoClient.send(
            new PutItemCommand({
              TableName: getDynamoTable(),
              Item: marshall(item),
              ConditionExpression: 'attribute_not_exists(disclosure_id)',
            })
          );
        } catch (error: any) {
          // ProvisionedThroughputExceededExceptionは再試行可能
          if (error.name === 'ProvisionedThroughputExceededException') {
            throw new RetryableError(
              `DynamoDB throughput exceeded: ${error.message}`,
              error
            );
          }
          // ConditionalCheckFailedExceptionは再試行不可（重複）
          if (error.name === 'ConditionalCheckFailedException') {
            throw error; // そのままスロー（外側のcatchで処理）
          }
          // その他のエラーもそのままスロー
          throw error;
        }
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
        jitter: true,
        shouldRetry: (error) => error instanceof RetryableError,
      }
    );
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      // 重複は警告レベルで記録（エラーではない）
      logger.warn('Duplicate disclosure detected', {
        disclosure_id: disclosure.disclosure_id,
        s3_key,
      });
      return; // 重複は無視
    }
    // ... エラー処理 ...
    throw error;
  }
}
```

**発見事項**:
- ✅ DynamoDB PutItemを使用（BatchWriteではない）
- ✅ 重複チェック（ConditionExpression）を実装
- ✅ 再試行ロジック（最大3回）を実装
- ✅ ProvisionedThroughputExceededExceptionを再試行可能エラーとして処理
- ⚠️ **重複エラーは無視される（returnで処理終了）**

**998件制限との関連性**:
- ❌ BatchWriteの25項目制限は関係ない（PutItemを使用）
- ⚠️ **重複チェックで998件目以降がすべて重複と判定されている可能性**

### download-pdf.ts の分析

```typescript
export async function downloadPdf(
  disclosure_id: string,
  pdf_url: string,
  disclosed_at: string
): Promise<string> {
  try {
    // レート制限を適用
    await rateLimiter.waitIfNeeded();

    // PDFをダウンロード（再試行あり）
    const pdfBuffer = await retryWithBackoff(
      async () => {
        try {
          const response = await axios.get(pdf_url, {
            responseType: 'arraybuffer',
            timeout: 60000, // 60秒タイムアウト
            headers: {
              'User-Agent': 'TDnet-Data-Collector/1.0',
            },
          });
          return Buffer.from(response.data);
        } catch (error) {
          // タイムアウト、5xxエラー、429エラーを再試行可能エラーとして処理
          // ...
        }
      },
      {
        maxRetries: 3,
        initialDelay: 2000,
        backoffMultiplier: 2,
        jitter: true,
      }
    );

    // S3にアップロード
    await s3Client.send(
      new PutObjectCommand({
        Bucket: getS3Bucket(),
        Key: s3Key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        Metadata: {
          disclosure_id,
          disclosed_at,
          uploaded_at: new Date().toISOString(),
        },
      })
    );

    return s3Key;
  } catch (error) {
    // ... エラー処理 ...
    throw error;
  }
}
```

**発見事項**:
- ✅ レート制限（2秒間隔）を実装
- ✅ 再試行ロジック（最大3回）を実装
- ✅ タイムアウト（60秒）を設定
- ✅ S3 PutObjectでアップロード
- ❌ **S3 PutObjectに再試行ロジックがない**

**998件制限との関連性**:
- ⚠️ **S3 PutObjectでエラーが発生した場合、再試行されずに失敗する**
- ⚠️ **998件目のS3アップロードでエラーが発生し、以降の処理が停止した可能性**

---

## 根本原因の特定

### 🔴 最も可能性が高い原因: 重複データの大量発生

**仮説**:
1. 2,694件のデータを取得
2. 最初の998件は正常に保存
3. 999件目以降がすべて重複と判定される
4. 重複は`saveMetadata`で無視される（`return`で処理終了）
5. 結果として998件のみが保存される

**根拠**:
- `saveMetadata`の重複チェック（ConditionExpression）
- 重複エラーは警告レベルで記録され、処理は継続される
- 998件という中途半端な数字は、重複チェックの境界を示唆

**検証方法**:
```powershell
# DynamoDBテーブルの件数を確認
aws dynamodb scan --table-name tdnet_disclosures_prod --select COUNT --profile imanishi-awssso --region ap-northeast-1

# 重複警告ログを検索
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --filter-pattern "Duplicate disclosure detected" \
  --start-time <timestamp> \
  --end-time <timestamp> \
  --profile imanishi-awssso \
  --region ap-northeast-1
```

### ⚠️ 次に可能性が高い原因: S3 PutObjectのエラー

**仮説**:
1. 998件のPDFを正常にアップロード
2. 999件目のS3 PutObjectでエラーが発生
3. エラーが再試行されずに失敗
4. `processDisclosure`がエラーをスロー
5. `Promise.allSettled`で失敗としてカウントされるが、処理は継続
6. しかし、何らかの理由で999件目以降の処理が停止

**根拠**:
- S3 PutObjectに再試行ロジックがない
- 998件という数字は、S3のレート制限やクォータの境界を示唆する可能性

**検証方法**:
```powershell
# S3バケットの件数を確認
aws s3 ls s3://tdnet-data-collector-pdfs-prod --recursive | wc -l

# S3エラーログを検索
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --filter-pattern "Failed to download PDF" \
  --start-time <timestamp> \
  --end-time <timestamp> \
  --profile imanishi-awssso \
  --region ap-northeast-1
```

---

## 結論

タスク1.1「CloudWatch Logsで詳細なエラーログを確認」は、指定された実行IDのログが見つからなかったため、完全には完了できませんでした。

ただし、コード分析により以下の重要な発見がありました：

1. **重複データの大量発生の可能性**: `saveMetadata`の重複チェックにより、999件目以降がすべて重複と判定されている可能性が最も高い

2. **S3 PutObjectのエラーハンドリング不足**: S3アップロードに再試行ロジックがないため、一時的なエラーで処理が失敗する可能性

3. **実行状況更新の不足**: 開示情報単位での実行状況更新がないため、998件で停止した場合に最後の更新が反映されない

### 次のアクション

1. **最新の実行を再度実行**: リアルタイムでログを確認し、998件で停止する瞬間のエラーメッセージを取得

2. **DynamoDBとS3の件数確認**: 実際に保存されているデータ件数を確認し、重複の有無を検証

3. **重複ログの検索**: CloudWatch Logsで「Duplicate disclosure detected」を検索し、重複の発生状況を確認

4. **タスク1.2に進む**: CloudWatch Metricsでパフォーマンスを確認し、メモリ使用量やスロットリングを検証

---

## 成果物

- ✅ 作業記録: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-152446-lambda-998-limit-root-cause.md`
- ✅ コード分析結果: `handler.ts`, `saveMetadata.ts`, `download-pdf.ts`
- ✅ 根本原因の仮説: 重複データの大量発生（最も可能性が高い）
- ⚠️ CloudWatch Logs分析: 指定された実行IDのログが見つからず、完全には完了できず



---

## タスク完了サマリー

タスク1.1「CloudWatch Logsで詳細なエラーログを確認」を実施しました。

### 実施内容

1. ✅ CloudWatch Logs分析スクリプト実行
2. ✅ ログループ・ログストリーム確認
3. ✅ DynamoDB実行状況テーブル確認
4. ✅ Lambda Collector関数のコード分析（handler.ts, saveMetadata.ts, download-pdf.ts）

### 主要な発見

1. **DynamoDB PutItemを使用**: BatchWriteではないため、25項目制限は無関係
2. **重複チェックの実装**: ConditionExpressionで重複は無視される（returnで処理終了）
3. **S3 PutObjectに再試行ロジックがない**: 一時的なエラーで処理が失敗する可能性

### 根本原因の仮説（更新）

🔴 **最も可能性が高い**: 重複データの大量発生
- 999件目以降がすべて重複と判定されている可能性
- 重複は`saveMetadata`で無視される（`return`で処理終了）
- 結果として998件のみが保存される

⚠️ **次に可能性が高い**: S3 PutObjectのエラー
- 999件目のS3アップロードでエラーが発生
- エラーが再試行されずに失敗
- 以降の処理が停止

### 次のアクション

1. **DynamoDB/S3の件数確認**: 実際に保存されているデータ件数を確認
2. **重複ログの検索**: CloudWatch Logsで「Duplicate disclosure detected」を検索
3. **最新実行の再実行**: リアルタイムでログを確認し、998件で停止する瞬間のエラーメッセージを取得
4. **タスク1.2に進む**: CloudWatch Metricsでパフォーマンスを確認

---

## 申し送り事項

1. **ログが見つからない問題**: 指定された実行ID `b6c62399-9e75-4bc4-9b43-51786ffc440f` のログが見つかりませんでした。最新の実行を再度実行して、リアルタイムでログを確認する必要があります。

2. **コード分析の成果**: 998件で停止する直接的な制限は見当たりませんが、重複チェックまたはS3エラーハンドリングに問題がある可能性が高いです。

3. **検証が必要**: DynamoDBとS3の実際の件数を確認し、重複の有無を検証する必要があります。

4. **タスク1.2への準備**: CloudWatch Metricsでメモリ使用量やスロットリングを確認する準備が整いました。

