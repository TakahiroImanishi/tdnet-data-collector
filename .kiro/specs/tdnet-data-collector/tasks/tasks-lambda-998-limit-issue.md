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
  - **完了日時**: 2026-02-22 15:24:46
  - **結果**: 指定された実行IDのログが見つからなかったが、コード分析により重要な発見あり
  - **作業記録**: `work-log-20260222-152446-lambda-998-limit-root-cause.md`

- [ ] 1.2 CloudWatch Metricsでパフォーマンスを確認
  - Lambda関数のメモリ使用量
  - Lambda関数の実行時間
  - DynamoDBのスロットリング
  - DynamoDBの書き込みキャパシティ

- [x] 1.3 Lambda関数のコードレビュー
  - BatchWrite実装の確認 → PutItemを使用（BatchWriteではない）
  - エラーハンドリングの確認 → 重複エラーは無視される
  - 実行状況更新ロジックの確認 → 日付単位での更新のみ
  - **完了日時**: 2026-02-22 15:24:46
  - **発見事項**:
    - DynamoDB PutItemを使用（BatchWriteの25項目制限は無関係）
    - 重複チェック（ConditionExpression）で重複は無視される
    - S3 PutObjectに再試行ロジックがない
  - **根本原因の仮説（更新）**:
    - 🔴 最も可能性が高い: 重複データの大量発生（999件目以降がすべて重複と判定）
    - ⚠️ 次に可能性が高い: S3 PutObjectのエラー（999件目でエラー発生）

**成果物**:
- 根本原因の特定レポート（部分的完了）
- 作業記録: `work-log-20260222-152446-lambda-998-limit-root-cause.md`
- コード分析結果: handler.ts, saveMetadata.ts, download-pdf.ts
- 次のアクション: DynamoDB/S3件数確認、重複ログ検索、最新実行の再実行

---

### タスク2: ログ出力の強化（緊急）

**優先度**: 🔴 Critical  
**期限**: 即座  
**担当**: AI Assistant

**背景**:
タスク1の調査で、CloudWatch Logsに実行ログが出力されていないことが判明しました。ログがないため、998件で停止する瞬間のエラーメッセージや処理状況を確認できません。

**実施内容**:

#### 2.1 処理進捗ログの追加

Lambda Collector関数に詳細な進捗ログを追加します。

```typescript
// src/lambda/collector/handler.ts

async function processDisclosuresInParallel(
  disclosureMetadata: DisclosureMetadata[],
  execution_id: string,
  concurrency: number = 5
): Promise<{ success: number; failed: number }> {
  const results = { success: 0, failed: 0 };
  const totalCount = disclosureMetadata.length;

  // 並列度を制限して処理
  for (let i = 0; i < disclosureMetadata.length; i += concurrency) {
    const batch = disclosureMetadata.slice(i, i + concurrency);
    const batchNumber = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(totalCount / concurrency);
    
    // バッチ開始ログ
    logger.info('Processing batch', {
      execution_id,
      batch_number: batchNumber,
      total_batches: totalBatches,
      batch_size: batch.length,
      processed_so_far: results.success + results.failed,
      total_count: totalCount,
      progress_percent: Math.floor(((results.success + results.failed) / totalCount) * 100)
    });

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
    
    // バッチ完了ログ
    logger.info('Batch completed', {
      execution_id,
      batch_number: batchNumber,
      batch_success: settled.filter(r => r.status === 'fulfilled').length,
      batch_failed: settled.filter(r => r.status === 'rejected').length,
      total_success: results.success,
      total_failed: results.failed,
      progress_percent: Math.floor(((results.success + results.failed) / totalCount) * 100)
    });
  }

  // 最終結果ログ
  logger.info('All batches completed', {
    execution_id,
    total_success: results.success,
    total_failed: results.failed,
    total_count: totalCount,
    success_rate: Math.floor((results.success / totalCount) * 100)
  });

  return results;
}
```

#### 2.2 個別処理ログの追加

各開示情報の処理開始・完了をログに記録します。

```typescript
// src/lambda/collector/handler.ts

async function processDisclosure(
  metadata: DisclosureMetadata,
  execution_id: string,
  sequence: number
): Promise<void> {
  const disclosure_id = generateDisclosureId(
    metadata.disclosed_at,
    metadata.company_code,
    sequence
  );

  // 処理開始ログ
  logger.info('Processing disclosure started', {
    execution_id,
    disclosure_id,
    sequence,
    company_code: metadata.company_code,
    company_name: metadata.company_name,
    title: metadata.title
  });

  try {
    // PDFをダウンロードしてS3に保存
    const s3_key = await downloadPdf(
      disclosure_id,
      metadata.pdf_url,
      metadata.disclosed_at
    );

    // メタデータをDynamoDBに保存
    const disclosure: Disclosure = {
      disclosure_id,
      company_code: metadata.company_code,
      company_name: metadata.company_name,
      disclosure_type: metadata.disclosure_type,
      title: metadata.title,
      disclosed_at: metadata.disclosed_at,
      pdf_url: metadata.pdf_url,
      pdf_s3_key: s3_key,
      downloaded_at: new Date().toISOString(),
      date_partition: '',
    };

    await saveMetadata(disclosure, s3_key);

    // 処理完了ログ
    logger.info('Processing disclosure completed', {
      execution_id,
      disclosure_id,
      sequence,
      s3_key
    });
  } catch (error) {
    // エラーログ（詳細）
    logger.error(
      'Processing disclosure failed',
      createErrorContext(error as Error, {
        execution_id,
        disclosure_id,
        sequence,
        company_code: metadata.company_code,
        title: metadata.title,
        pdf_url: metadata.pdf_url
      })
    );
    throw error;
  }
}
```

#### 2.3 重複検出ログの強化

重複が検出された場合のログを強化します。

```typescript
// src/lambda/collector/save-metadata.ts

export async function saveMetadata(disclosure: Disclosure, s3_key: string): Promise<void> {
  try {
    // ... DynamoDB保存処理 ...
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      // 重複検出ログ（詳細）
      logger.warn('Duplicate disclosure detected', {
        disclosure_id: disclosure.disclosure_id,
        company_code: disclosure.company_code,
        company_name: disclosure.company_name,
        disclosed_at: disclosure.disclosed_at,
        s3_key,
        message: 'この開示情報は既にDynamoDBに保存されています'
      });
      return; // 重複は無視
    }

    // その他のエラー
    logger.error('Failed to save metadata', {
      disclosure_id: disclosure.disclosure_id,
      company_code: disclosure.company_code,
      error_type: error.constructor?.name || 'Unknown',
      error_message: error.message || String(error),
      s3_key
    });

    await sendErrorMetric(
      error.constructor?.name || 'Unknown',
      'SaveMetadata',
      { DisclosureId: disclosure.disclosure_id }
    );

    throw error;
  }
}
```

#### 2.4 S3アップロードログの追加

S3アップロードの詳細ログを追加します。

```typescript
// src/lambda/collector/download-pdf.ts

export async function downloadPdf(
  disclosure_id: string,
  pdf_url: string,
  disclosed_at: string
): Promise<string> {
  try {
    logger.info('Downloading PDF started', { 
      disclosure_id, 
      pdf_url 
    });

    // レート制限を適用
    await rateLimiter.waitIfNeeded();

    // PDFをダウンロード
    const pdfBuffer = await retryWithBackoff(/* ... */);

    // PDFファイル整合性検証
    validatePdfFile(pdfBuffer);

    // S3パス生成
    const s3Key = generateS3Key(disclosure_id, disclosed_at);

    logger.info('Uploading PDF to S3', {
      disclosure_id,
      s3_key: s3Key,
      size_bytes: pdfBuffer.length
    });

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

    logger.info('PDF uploaded to S3 successfully', {
      disclosure_id,
      s3_key: s3Key,
      size_bytes: pdfBuffer.length
    });

    await sendSuccessMetric(1, 'DownloadPdf', {
      DisclosureId: disclosure_id,
    });

    return s3Key;
  } catch (error) {
    logger.error('Failed to download PDF', {
      disclosure_id,
      pdf_url,
      error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      error_message: error instanceof Error ? error.message : String(error),
      stack_trace: error instanceof Error ? error.stack : undefined
    });

    await sendErrorMetric(
      error instanceof Error ? error.constructor.name : 'Unknown',
      'DownloadPdf',
      { DisclosureId: disclosure_id }
    );

    throw error;
  }
}
```

**成果物**:
- 修正されたLambda関数コード（handler.ts, save-metadata.ts, download-pdf.ts）
- テスト結果（ユニットテスト14件すべて成功）
- 作業記録: `work-log-20260222-153600-lambda-logging-enhancement.md`
- **完了日時**: 2026-02-22 15:38:00

**検証方法**:
1. ユニットテストでログ出力を確認 ✅
2. LocalStackでE2Eテストを実行し、ログ出力を確認（次のステップ）
3. 本番環境で小規模テスト（10件）を実行し、CloudWatch Logsを確認（次のステップ）

---

## 実施スケジュール

| タスク | 優先度 | 期限 | 状態 |
|--------|--------|------|------|
| タスク1: 根本原因の特定 | 🔴 Critical | 即座 | ✅ 完了（部分的） |
| タスク2: ログ出力の強化 | 🔴 Critical | 即座 | ✅ 完了 |

---

### タスク3: ログ出力の検証とデバッグ（緊急）

**優先度**: 🔴 Critical  
**期限**: 即座  
**担当**: AI Assistant

**背景**:
2026年2月22日の調査で、以下の事実が判明しました：
- TDnetから2,694件のデータ取得成功 ✅
- DynamoDB/S3には998件しか保存されていない ❌
- タスク2で追加したログ（`Processing batch`, `Batch completed`等）が出力されていない ❌

**実施内容**:

#### 3.1 ログ出力の検証

**目的**: タスク2で追加したログが本番環境で正しく出力されるか確認

**手順**:
1. 本番環境で小規模テスト（10件）を実行
   ```powershell
   .\scripts\manual-data-collection.ps1 -StartDate "2026-02-12" -EndDate "2026-02-12" -MaxItems 10
   ```

2. CloudWatch Logsで以下のログを確認
   - `Total disclosures to process: 10`
   - `Processing batch 1/2`
   - `Batch completed`
   - `All batches completed`

3. ログが出力されない場合の対処
   - Lambda関数を再デプロイ
   - または、Lambda関数のキャッシュをクリア

#### 3.2 998件で停止する原因の特定

**ログが正しく出力される場合**:
- 998件目と999件目の処理ログを比較
- 重複検出ログの件数を確認
- エラーログの有無を確認

**ログが出力されない場合**:
- Lambda関数が998件で異常終了している可能性
- メモリ不足またはタイムアウトの可能性
- Lambda関数のメトリクスを確認（メモリ使用量、実行時間）

**成果物**:
- [ ] 小規模テスト（10件）の実行結果 → ❌ AWS認証エラーで実行不可
- [ ] CloudWatch Logsの確認結果
- [ ] 998件で停止する具体的な原因の特定
- [x] 作業記録: `work-log-20260222-170302-lambda-998-limit-10-items-test.md`

**実行状況**:
- **実行日時**: 2026-02-22 17:03:30
- **結果**: ❌ 失敗（AWS認証エラー）
- **エラー**: `UnrecognizedClientException: The security token included in the request is invalid`
- **原因**: AWS認証トークンの有効期限切れ

**対処方法**:
1. AWS SSOで再認証: `aws sso login --profile [your-profile]`
2. または、環境変数で直接APIキーを設定: `$env:TDNET_API_KEY = 'your-api-key'`
3. または、AWS認証情報を更新: `aws configure`

**完了条件**:
- ログが正しく出力されることを確認
- 998件で停止する具体的な原因を特定

**ブロッカー**: AWS認証情報の更新が必要

---

### タスク4: 998件制限問題の修正実装（緊急）

**優先度**: 🔴 Critical  
**期限**: タスク3完了後、即座  
**担当**: AI Assistant

**前提条件**: タスク3で根本原因が特定されていること

**実施内容**:

タスク3の結果に基づいて、以下のいずれかの修正を実施します。

#### パターンA: 重複データが原因の場合

**修正内容**:
- `generateDisclosureId`のロジックを見直し
- 重複チェックの条件を確認
- 必要に応じて、disclosure_idの生成方法を変更

#### パターンB: S3 PutObjectエラーが原因の場合

**修正内容**:
- `download-pdf.ts`に再試行ロジックを追加
- S3アップロードのエラーハンドリングを強化
- エラー時のログ出力を追加

#### パターンC: メモリ不足が原因の場合

**修正内容**:
- Lambda関数のメモリを512MB→1024MBに増加
- バッチサイズを5→3に削減
- 処理済みデータのメモリ解放を追加

#### パターンD: タイムアウトが原因の場合

**修正内容**:
- Lambda関数のタイムアウトを15分→30分に増加
- または、Step Functionsへの移行を検討（tasks-step-functions-migration.md参照）

**成果物**:
- [ ] 修正されたLambda関数コード
- [ ] ユニットテストの更新と実行（全て成功）
- [ ] 本番環境へのデプロイ
- [ ] 修正後の動作確認（2,694件すべて保存されることを確認）
- [ ] 作業記録: `work-log-20260222-HHMMSS-998-limit-fix.md`

**完了条件**:
- 2,694件すべてのデータがDynamoDB/S3に保存される
- ユニットテストがすべて成功
- 本番環境で動作確認完了

---

## 関連ドキュメント

- 調査記録: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-164736-investigate-998-limit-20260213.md`
- 作業記録: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-152446-lambda-998-limit-root-cause.md`
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
4. **監視不能**: ログが出力されないため、問題の検知が困難

### 次のステップ

1. タスク2を即座に開始し、ログ出力を強化
2. 強化されたログで最新実行を再実行
3. CloudWatch Logsで998件で停止する瞬間のエラーメッセージを確認
4. 根本原因を特定し、修正方針を決定

