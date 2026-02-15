# 作業記録: PDFファイル保存不足の原因調査

**作業日時**: 2026-02-15 09:32:48  
**タスク**: 31.10 PDFファイル保存不足の原因調査（Critical）  
**担当**: Kiro AI Agent

## 背景

2026-02-15の本番環境検証で、データ収集とS3保存に重大な不整合が発見されました：
- Lambda Collectorログ: 2,694件収集成功
- S3バケット: 998件のPDFファイルのみ保存
- 不足: 約1,696件（63%）のPDFファイルが保存されていない

## 調査項目

1. CloudWatch Logsで詳細なエラーログを確認
2. DynamoDBとS3の整合性確認
3. Lambda Collector処理フローの確認
4. 根本原因の特定と修正方針の決定

## 調査結果

### 31.10.1 CloudWatch Logsの詳細分析


#### コード分析結果

**処理フロー**:
1. `processDisclosuresInParallel` で並列度5で処理
2. 各開示情報に対して `processDisclosure` を実行
3. `downloadPdf` でPDFをダウンロードしてS3に保存
4. `saveMetadata` でメタデータをDynamoDBに保存
5. `Promise.allSettled` で部分的失敗を許容

**エラーハンドリング**:
- `downloadPdf`: エラー時にログ記録 + 例外スロー
- `saveMetadata`: エラー時にログ記録 + 例外スロー（重複は警告のみ）
- `processDisclosure`: エラー時にログ記録 + 例外再スロー
- `processDisclosuresInParallel`: `Promise.allSettled` で失敗をカウント

**想定される問題**:
1. PDFダウンロードが失敗しているが、ログに記録されていない可能性
2. メタデータだけが保存されている可能性（DynamoDBには保存されたがPDFは保存されていない）
3. S3 PutObject権限が不足している可能性
4. TDnetサイトからのPDFダウンロードが失敗している可能性（404、403など）

次に、CloudWatch Logsを確認するためのスクリプトを作成します。


#### 調査スクリプト作成

以下の2つのスクリプトを作成しました：

1. **scripts/analyze-cloudwatch-logs.ps1**
   - Lambda CollectorのCloudWatch Logsを分析
   - PDF保存失敗のエラーを検索
   - 収集成功件数と失敗件数を確認
   - S3 PutObject エラーを検索
   - エラータイプを集計

2. **scripts/check-dynamodb-s3-consistency.ps1**
   - DynamoDBのレコード数をカウント
   - pdf_s3_keyが設定されているレコード数をカウント
   - S3バケットのオブジェクト数をカウント
   - 整合性チェック結果を表示

これらのスクリプトを実行することで、以下の情報が得られます：
- PDF保存失敗の具体的なエラーメッセージ
- エラーの種類と頻度
- DynamoDBとS3の不整合の詳細


### 31.10.2 DynamoDBとS3の整合性確認

#### 調査方法

以下のスクリプトを実行して、DynamoDBとS3の整合性を確認します：

```powershell
# DynamoDBとS3の整合性確認
scripts/check-dynamodb-s3-consistency.ps1
```

このスクリプトは以下の情報を提供します：
1. DynamoDBのレコード数
2. pdf_s3_keyが設定されているレコード数
3. pdf_s3_keyが未設定のレコード数（メタデータのみ保存）
4. S3バケットのオブジェクト数
5. 整合性チェック結果

#### 想定される結果

本番環境検証の結果から、以下の不整合が予想されます：
- DynamoDBレコード数: 2,694件
- S3オブジェクト数: 998件
- 不整合: 約1,696件（63%）のPDFファイルが保存されていない

この不整合の原因として、以下の可能性が考えられます：
1. **PDFダウンロードが失敗しているが、メタデータは保存されている**
   - `downloadPdf` がエラーをスローした後、`saveMetadata` が実行されていない
   - しかし、コードを確認した結果、`processDisclosure` 関数では `downloadPdf` → `saveMetadata` の順で実行されるため、この可能性は低い

2. **メタデータ保存時にpdf_s3_keyが設定されていない**
   - `saveMetadata` 関数では、`s3_key` パラメータを受け取ってDynamoDBに保存している
   - しかし、`downloadPdf` が失敗した場合、`s3_key` が返されないため、`saveMetadata` は実行されない

3. **並列処理での競合状態**
   - 並列度5で処理しているため、一部の処理が失敗している可能性
   - `Promise.allSettled` を使用しているため、失敗した処理は `results.failed` にカウントされる

#### 次のステップ

1. CloudWatch Logsを確認して、PDF保存失敗の具体的なエラーメッセージを確認
2. Lambda Collector処理フローを再確認して、エラーハンドリングの問題を特定


### 31.10.3 Lambda Collector処理フローの確認

#### コード分析

**processDisclosure関数の処理フロー**:

```typescript
async function processDisclosure(metadata, execution_id, sequence) {
  try {
    // 1. 開示IDを生成
    const disclosure_id = generateDisclosureId(...);
    
    // 2. PDFをダウンロードしてS3に保存
    const s3_key = await downloadPdf(disclosure_id, metadata.pdf_url, metadata.disclosed_at);
    
    // 3. メタデータをDynamoDBに保存
    await saveMetadata(disclosure, s3_key);
    
    logger.info('Successfully processed disclosure', ...);
  } catch (error) {
    logger.error('Failed to process disclosure', ...);
    throw error; // エラーを再スロー
  }
}
```

**重要な発見**:

1. **PDFダウンロードが失敗した場合、メタデータは保存されない**
   - `downloadPdf` がエラーをスローすると、`saveMetadata` は実行されない
   - したがって、「メタデータのみ保存、PDFなし」という状況は発生しない

2. **逆のケースが発生している可能性**
   - `downloadPdf` が成功してS3にPDFを保存
   - しかし、`saveMetadata` が失敗してDynamoDBに保存されない
   - この場合、S3にはPDFが存在するが、DynamoDBにはレコードがない

3. **本番環境の状況と矛盾**
   - 本番環境: DynamoDB 2,694件、S3 998件
   - これは「DynamoDBにレコードがあるが、S3にPDFがない」という状況
   - つまり、上記の分析とは逆の状況が発生している

#### 新たな仮説

**仮説1: PDFダウンロードが失敗しているが、エラーが記録されていない**
- `downloadPdf` 内でエラーが発生しているが、ログに記録されていない可能性
- または、エラーが発生しても例外がスローされず、空の `s3_key` が返されている可能性

**仮説2: 並列処理での競合状態**
- 並列度5で処理しているため、一部の処理が失敗している
- `Promise.allSettled` を使用しているため、失敗した処理は `results.failed` にカウントされる
- しかし、Lambda Collectorログでは「2,694件収集成功」と記録されている
- これは `results.success` のカウントが正しくない可能性を示唆

**仮説3: collected_countのカウントロジックに問題がある**
- `processDisclosuresInParallel` 関数で `results.success++` がカウントされる条件を確認
- `Promise.allSettled` で `result.status === 'fulfilled'` の場合にカウント
- しかし、`processDisclosure` 内で例外がスローされた場合、`result.status === 'rejected'` になる
- したがって、カウントロジックは正しい

#### 最も可能性の高い原因

**原因: PDFダウンロードが失敗しているが、メタデータは保存されている**

コードを再確認した結果、以下の問題が発見されました：

```typescript
// saveMetadata関数（save-metadata.ts）
export async function saveMetadata(disclosure: Disclosure, s3_key: string): Promise<void> {
  try {
    // date_partitionを事前生成
    const date_partition = generateDatePartition(disclosure.disclosed_at);
    
    const item = {
      disclosure_id: disclosure.disclosure_id,
      company_code: disclosure.company_code,
      company_name: disclosure.company_name,
      disclosure_type: disclosure.disclosure_type,
      title: disclosure.title,
      disclosed_at: disclosure.disclosed_at,
      date_partition,
      pdf_url: disclosure.pdf_url,
      s3_key,  // ← ここでs3_keyを保存
      collected_at: new Date().toISOString(),
    };
    
    // DynamoDBに保存
    await dynamoClient.send(new PutItemCommand({
      TableName: getDynamoTable(),
      Item: marshall(item),
      ConditionExpression: 'attribute_not_exists(disclosure_id)',
    }));
    
    logger.info('Metadata saved successfully', ...);
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      // 重複は警告レベルで記録（エラーではない）
      logger.warn('Duplicate disclosure detected', ...);
      return; // 重複は無視 ← ここが問題！
    }
    
    logger.error('Failed to save metadata', ...);
    throw error;
  }
}
```

**問題点**:
- `ConditionalCheckFailedException` が発生した場合、エラーをスローせずに `return` している
- これは重複チェックのための正常な動作
- しかし、`processDisclosure` 関数では、`saveMetadata` が成功したと判断される
- したがって、`results.success++` がカウントされる

**しかし、これは本番環境の状況を説明できない**:
- 重複チェックが発生した場合、DynamoDBには既存のレコードが存在する
- したがって、「DynamoDBにレコードがあるが、S3にPDFがない」という状況は発生しない

#### 結論

コード分析だけでは根本原因を特定できません。CloudWatch Logsを確認して、実際のエラーメッセージを確認する必要があります。


### 31.10.4 根本原因の特定と修正方針の決定

#### 調査結果の統合

コード分析とCloudWatch Logs分析の準備を完了しました。以下の3つの原因が考えられます：

**原因A: collected_countのカウントロジックに問題がある（最も可能性が高い）**
- `scrapeTdnetList` で取得したメタデータ件数（2,694件）をログ出力
- しかし、実際に処理が成功したのは998件のみ
- `collected_count` のカウントロジックに問題がある可能性

**原因B: PDFダウンロードが失敗しているが、エラーが記録されていない**
- `downloadPdf` 内でエラーが発生しているが、ログに記録されていない
- または、エラーが発生しても例外がスローされず、空の `s3_key` が返されている

**原因C: TDnetサイトからのPDFダウンロードが失敗している**
- TDnetサイトが404、403、500などのエラーを返している
- レート制限により一部のPDFダウンロードがスキップされている

#### 修正方針

1. **即座に実施**: CloudWatch Logsの確認
   - `scripts/analyze-cloudwatch-logs.ps1` を実行
   - エラーメッセージを確認
   - 根本原因を特定

2. **原因特定後**: 修正タスクを追加
   - タスク31.10.5: カウントロジックの修正
   - タスク31.10.6: エラーハンドリングの強化
   - タスク31.10.7: データ整合性の回復

3. **修正後**: 再デプロイと検証
   - 修正をデプロイ
   - 初回データ収集を再実行
   - 整合性チェックを実施

#### 改善記録

詳細な調査結果と修正方針を以下の改善記録に記録しました：
- `.kiro/specs/tdnet-data-collector/improvements/task-31-improvement-02-20260215-093730.md`

## 成果物

1. **調査スクリプト**:
   - `scripts/analyze-cloudwatch-logs.ps1` - CloudWatch Logs分析
   - `scripts/check-dynamodb-s3-consistency.ps1` - DynamoDBとS3の整合性確認

2. **改善記録**:
   - `task-31-improvement-02-20260215-093730.md` - 根本原因分析と修正方針

## 申し送り事項

- CloudWatch Logsの確認は、ユーザーが実行する必要があります（AWS認証情報が必要）
- 調査スクリプトは英語メッセージに変更済み（文字エンコーディング問題を回避）
- 根本原因が特定されるまで、本番環境での新規データ収集は推奨しません
- 次のステップ: ユーザーがCloudWatch Logsを確認し、根本原因を特定する
