# Correctness Properties チェックリスト

このドキュメントは、TDnet Data Collectorプロジェクトの15個のCorrectness Propertiesの実装状況とテスト検証状況を追跡します。

**最終更新:** 2026-02-07

---

## 関連ドキュメント

- **設計書**: `design.md` - Correctness Propertiesの詳細定義
- **要件定義書**: `requirements.md` - 各Propertyに対応する要件
- **テスト戦略**: `../../steering/development/testing-strategy.md` - プロパティテストの実装方法
- **データバリデーション**: `../../steering/development/data-validation.md` - バリデーションルール

---

## 概要

| 総数 | 実装済み | テスト済み | 未実装 |
|------|---------|----------|--------|
| 15   | 0       | 0        | 15     |

**進捗率:** 0% (0/15)

---

## Property 1: 日付範囲収集の完全性

**定義:** 指定された日付範囲内のすべての開示情報が収集される

**対応要件:** 要件1（データ収集機能）、要件5（任意期間データ取得）

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト: `collector.test.ts`
- [ ] プロパティベーステスト: `collector.property.test.ts`
- [ ] 統合テスト: `collector.integration.test.ts`

**テストファイルパス:**
- 未作成

**検証方法:**
```typescript
// プロパティベーステストの例
fc.assert(
  fc.property(
    arbDateRange,
    async ({ start_date, end_date }) => {
      const collected = await collectDisclosures(start_date, end_date);
      const expected = await getTDnetDisclosures(start_date, end_date);
      
      // すべての開示情報が収集されている
      expect(collected.length).toBe(expected.length);
      
      // 各開示情報が存在する
      for (const disclosure of expected) {
        expect(collected).toContainEqual(
          expect.objectContaining({ disclosure_id: disclosure.id })
        );
      }
    }
  ),
  { numRuns: 50 }
);
```

**完了日:** -

**備考:**
- TDnetのHTML構造変更に対する耐性も検証が必要
- 大量データ（1000件以上）の収集テストも実施すべき

---

## Property 2: メタデータとPDFの同時取得

**定義:** 開示情報のメタデータとPDFファイルが必ず同時に取得される

**対応要件:** 要件1（データ収集機能）

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト: `collector.test.ts`
- [ ] 統合テスト: `collector.integration.test.ts`

**テストファイルパス:**
- 未作成

**検証方法:**
```typescript
test('メタデータとPDFが同時に取得される', async () => {
  const disclosure = await collectSingleDisclosure(disclosureId);
  
  // メタデータが存在する
  expect(disclosure.metadata).toBeDefined();
  expect(disclosure.metadata.disclosure_id).toBe(disclosureId);
  
  // PDFファイルが存在する
  const pdfExists = await s3.headObject({
    Bucket: bucketName,
    Key: disclosure.metadata.pdf_s3_key,
  });
  expect(pdfExists).toBeDefined();
  
  // メタデータのpdf_s3_keyとS3のキーが一致する
  expect(disclosure.metadata.pdf_s3_key).toBe(disclosure.pdf_s3_key);
});
```

**完了日:** -

**備考:**
- トランザクション的な整合性を保証する必要がある
- PDFダウンロード失敗時はメタデータも保存しない

---

## Property 3: メタデータの必須フィールド

**定義:** すべてのメタデータレコードが必須フィールドを含む

**対応要件:** 要件2（メタデータ管理）

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト: `validators/disclosure-validator.test.ts`
- [ ] プロパティベーステスト: `validators/disclosure-validator.property.test.ts`

**テストファイルパス:**
- 未作成

**検証方法:**
```typescript
// プロパティベーステストの例
fc.assert(
  fc.property(
    arbDisclosure,
    (disclosure) => {
      const validated = validateDisclosure(disclosure);
      
      // 必須フィールドがすべて存在する
      expect(validated).toHaveProperty('disclosure_id');
      expect(validated).toHaveProperty('company_code');
      expect(validated).toHaveProperty('company_name');
      expect(validated).toHaveProperty('disclosure_type');
      expect(validated).toHaveProperty('title');
      expect(validated).toHaveProperty('disclosed_at');
      expect(validated).toHaveProperty('pdf_s3_key');
      expect(validated).toHaveProperty('downloaded_at');
      expect(validated).toHaveProperty('date_partition');
      
      // 各フィールドが適切な型である
      expect(typeof validated.disclosure_id).toBe('string');
      expect(typeof validated.company_code).toBe('string');
      expect(validated.company_code).toMatch(/^\d{4}$/);
    }
  ),
  { numRuns: 100 }
);
```

**完了日:** -

**備考:**
- date_partitionは自動生成されるため、未設定の場合は生成する

---

## Property 4: 開示IDの一意性

**定義:** すべての開示情報が一意の識別子を持つ

**対応要件:** 要件2（メタデータ管理）

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト: `dynamodb.test.ts`
- [ ] 統合テスト: `dynamodb.integration.test.ts`

**テストファイルパス:**
- 未作成

**検証方法:**
```typescript
test('重複する開示IDは拒否される', async () => {
  const disclosure = createTestDisclosure();
  
  // 1回目の保存は成功
  await saveDisclosure(disclosure);
  
  // 2回目の保存は失敗（ConditionalCheckFailedException）
  await expect(saveDisclosure(disclosure)).rejects.toThrow(
    'ConditionalCheckFailedException'
  );
  
  // DynamoDBに1件のみ存在する
  const items = await queryDisclosureById(disclosure.disclosure_id);
  expect(items.length).toBe(1);
});
```

**完了日:** -

**備考:**
- DynamoDBの条件付き書込（ConditionExpression）で実装

---

## Property 5: 重複収集の冪等性

**定義:** 同じ開示情報を複数回収集しても、データベースには1件のみ保存される

**対応要件:** 要件2（メタデータ管理）

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト: `collector.test.ts`
- [ ] 統合テスト: `collector.integration.test.ts`

**テストファイルパス:**
- 未作成

**検証方法:**
```typescript
test('重複収集は冪等である', async () => {
  const disclosureId = '20240115_7203_001';
  
  // 1回目の収集
  await collectDisclosure(disclosureId);
  const count1 = await countDisclosures();
  
  // 2回目の収集（重複）
  await collectDisclosure(disclosureId);
  const count2 = await countDisclosures();
  
  // 件数は変わらない
  expect(count2).toBe(count1);
  
  // DynamoDBに1件のみ存在する
  const items = await queryDisclosureById(disclosureId);
  expect(items.length).toBe(1);
});
```

**完了日:** -

**備考:**
- 重複検出時はログに記録し、スキップする

---

## Property 6: PDFファイルの整合性

**定義:** ダウンロードされたPDFファイルが破損していない

**対応要件:** 要件3（ファイル管理）

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト: `pdf-validator.test.ts`
- [ ] 統合テスト: `s3.integration.test.ts`

**テストファイルパス:**
- 未作成

**検証方法:**
```typescript
test('PDFファイルの整合性が検証される', async () => {
  const pdfBuffer = await downloadPDF(pdfUrl);
  
  // PDFヘッダーが正しい
  expect(pdfBuffer.slice(0, 4).toString()).toBe('%PDF');
  
  // ファイルサイズが妥当（0バイトでない、100MBを超えない）
  expect(pdfBuffer.length).toBeGreaterThan(0);
  expect(pdfBuffer.length).toBeLessThan(100 * 1024 * 1024);
  
  // S3にアップロード後、ダウンロードして比較
  await uploadToS3(pdfBuffer, s3Key);
  const downloaded = await downloadFromS3(s3Key);
  expect(downloaded).toEqual(pdfBuffer);
});
```

**完了日:** -

**備考:**
- MD5ハッシュ値での検証も検討

---

## Property 7: エラー時の部分的成功

**定義:** 一部の開示情報の収集が失敗しても、成功した分は保存される

**対応要件:** 要件6（エラーハンドリングとロギング）

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト: `collector.test.ts`
- [ ] 統合テスト: `collector.integration.test.ts`

**テストファイルパス:**
- 未作成

**検証方法:**
```typescript
test('部分的失敗でも成功分は保存される', async () => {
  const disclosures = [
    { id: '001', url: 'valid-url-1' },
    { id: '002', url: 'invalid-url' }, // 失敗する
    { id: '003', url: 'valid-url-3' },
  ];
  
  const result = await collectBatch(disclosures);
  
  // 結果サマリー
  expect(result.collected).toBe(2);
  expect(result.failed).toBe(1);
  expect(result.total).toBe(3);
  
  // 成功した2件がDynamoDBに保存されている
  const saved = await queryAllDisclosures();
  expect(saved.length).toBe(2);
  expect(saved.map(d => d.disclosure_id)).toContain('001');
  expect(saved.map(d => d.disclosure_id)).toContain('003');
  expect(saved.map(d => d.disclosure_id)).not.toContain('002');
});
```

**完了日:** -

**備考:**
- 失敗した開示情報はログに記録し、後で再試行可能にする

---

## Property 8: 日付範囲の順序性

**定義:** start_dateはend_date以前でなければならない

**対応要件:** 要件5（任意期間データ取得）

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト: `validators/date-validator.test.ts`
- [ ] プロパティベーステスト: `validators/date-validator.property.test.ts`

**テストファイルパス:**
- 未作成

**検証方法:**
```typescript
// プロパティベーステストの例
fc.assert(
  fc.property(
    fc.date(),
    fc.date(),
    (date1, date2) => {
      const startDate = date1 < date2 ? date1 : date2;
      const endDate = date1 < date2 ? date2 : date1;
      
      // 正しい順序は成功
      expect(() => validateDateRange(startDate, endDate)).not.toThrow();
      
      // 逆順は失敗
      if (startDate < endDate) {
        expect(() => validateDateRange(endDate, startDate)).toThrow(
          ValidationError
        );
      }
    }
  ),
  { numRuns: 100 }
);
```

**完了日:** -

**備考:**
- start_date === end_dateは許容する（同日のデータ収集）

---

## Property 9: APIキー認証の必須性

**定義:** すべてのAPIリクエストが有効なAPIキーを含む

**対応要件:** 要件11（API認証）

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト: `api/auth.test.ts`
- [ ] E2Eテスト: `api.e2e.test.ts`

**テストファイルパス:**
- 未作成

**検証方法:**
```typescript
test('APIキーなしのリクエストは拒否される', async () => {
  const response = await request(app)
    .get('/disclosures')
    .expect(401);
  
  expect(response.body).toEqual({
    status: 'error',
    error: {
      code: 'UNAUTHORIZED',
      message: 'API key is required',
    },
    request_id: expect.any(String),
  });
});

test('無効なAPIキーのリクエストは拒否される', async () => {
  const response = await request(app)
    .get('/disclosures')
    .set('X-API-Key', 'invalid-key')
    .expect(401);
  
  expect(response.body).toEqual({
    status: 'error',
    error: {
      code: 'UNAUTHORIZED',
      message: 'Invalid API key',
    },
    request_id: expect.any(String),
  });
});

test('有効なAPIキーのリクエストは成功する', async () => {
  const response = await request(app)
    .get('/disclosures')
    .set('X-API-Key', process.env.API_KEY)
    .expect(200);
  
  expect(response.body.status).toBe('success');
});
```

**完了日:** -

**備考:**
- X-API-Keyヘッダーまたはapi_keyクエリパラメータをサポート

---

## Property 10: エクスポートファイルの有効期限

**定義:** エクスポートファイルは24時間後に自動削除される

**対応要件:** 要件7（データクエリとエクスポート）、要件12（コスト最適化）

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト: `export.test.ts`
- [ ] 統合テスト: `s3-lifecycle.integration.test.ts`

**テストファイルパス:**
- 未作成

**検証方法:**
```typescript
test('エクスポートファイルは24時間後に削除される', async () => {
  const exportId = await createExport({ format: 'json' });
  
  // エクスポート直後は存在する
  const exists1 = await s3.headObject({
    Bucket: exportBucketName,
    Key: `${exportId}.json`,
  });
  expect(exists1).toBeDefined();
  
  // 有効期限が24時間後に設定されている
  const expiresAt = new Date(exists1.Metadata.expires_at);
  const expectedExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  expect(expiresAt.getTime()).toBeCloseTo(expectedExpiry.getTime(), -3);
  
  // S3ライフサイクルポリシーが設定されている
  const lifecycle = await s3.getBucketLifecycleConfiguration({
    Bucket: exportBucketName,
  });
  expect(lifecycle.Rules).toContainEqual(
    expect.objectContaining({
      Status: 'Enabled',
      Expiration: { Days: 1 },
    })
  );
});
```

**完了日:** -

**備考:**
- S3ライフサイクルポリシーで自動削除を実装

---

## Property 11: 実行状態の進捗単調性

**定義:** 収集実行の進捗（collected, failed）は単調増加する

**対応要件:** 要件4（バッチ処理）

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト: `execution-tracker.test.ts`
- [ ] プロパティベーステスト: `execution-tracker.property.test.ts`

**テストファイルパス:**
- 未作成

**検証方法:**
```typescript
// プロパティベーステストの例
fc.assert(
  fc.property(
    fc.array(fc.boolean(), { minLength: 10, maxLength: 100 }),
    async (results) => {
      const executionId = 'test-exec-001';
      const tracker = new ExecutionTracker(executionId);
      
      let prevCollected = 0;
      let prevFailed = 0;
      
      for (const success of results) {
        if (success) {
          await tracker.incrementCollected();
        } else {
          await tracker.incrementFailed();
        }
        
        const status = await tracker.getStatus();
        
        // 進捗は単調増加
        expect(status.collected).toBeGreaterThanOrEqual(prevCollected);
        expect(status.failed).toBeGreaterThanOrEqual(prevFailed);
        
        prevCollected = status.collected;
        prevFailed = status.failed;
      }
    }
  ),
  { numRuns: 50 }
);
```

**完了日:** -

**備考:**
- DynamoDBのアトミックカウンタ（UpdateExpression ADD）で実装

---

## Property 12: レート制限の遵守

**定義:** TDnetへのリクエスト間隔が設定値以上である

**対応要件:** 要件9（レート制限とマナー）

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト: `rate-limiter.test.ts`
- [ ] プロパティベーステスト: `rate-limiter.property.test.ts`

**テストファイルパス:**
- 未作成

**検証方法:**
```typescript
// プロパティベーステストの例
fc.assert(
  fc.property(
    fc.integer({ min: 5, max: 20 }),
    async (requestCount) => {
      const rateLimiter = new RateLimiter(2000); // 2秒間隔
      const timestamps: number[] = [];
      
      for (let i = 0; i < requestCount; i++) {
        await rateLimiter.acquire();
        timestamps.push(Date.now());
      }
      
      // すべての連続するリクエスト間隔が2秒以上
      for (let i = 1; i < timestamps.length; i++) {
        const interval = timestamps[i] - timestamps[i - 1];
        expect(interval).toBeGreaterThanOrEqual(1900); // 100msの誤差許容
      }
    }
  ),
  { numRuns: 10 } // 時間がかかるため少なめ
);
```

**完了日:** -

**備考:**
- デフォルト2秒、環境変数で設定可能

---

## Property 13: ログレベルの適切性

**定義:** エラーログにはスタックトレースが含まれ、情報ログには含まれない

**対応要件:** 要件6（エラーハンドリングとロギング）

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト: `logger.test.ts`

**テストファイルパス:**
- 未作成

**検証方法:**
```typescript
test('エラーログにはスタックトレースが含まれる', () => {
  const mockLogger = createMockLogger();
  const error = new Error('Test error');
  
  logger.error('Error occurred', { error });
  
  const logEntry = mockLogger.getLastLog();
  expect(logEntry.level).toBe('error');
  expect(logEntry.stack).toBeDefined();
  expect(logEntry.stack).toContain('Error: Test error');
});

test('情報ログにはスタックトレースが含まれない', () => {
  const mockLogger = createMockLogger();
  
  logger.info('Info message', { data: 'test' });
  
  const logEntry = mockLogger.getLastLog();
  expect(logEntry.level).toBe('info');
  expect(logEntry.stack).toBeUndefined();
});
```

**完了日:** -

**備考:**
- 構造化ログ（JSON形式）を使用

---

## Property 14: 暗号化の有効性

**定義:** S3とDynamoDBで保管時の暗号化が有効である

**対応要件:** 要件13（セキュリティとコンプライアンス）

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] 統合テスト: `encryption.integration.test.ts`

**テストファイルパス:**
- 未作成

**検証方法:**
```typescript
test('S3バケットで暗号化が有効である', async () => {
  const encryption = await s3.getBucketEncryption({
    Bucket: pdfBucketName,
  });
  
  expect(encryption.ServerSideEncryptionConfiguration).toBeDefined();
  expect(encryption.ServerSideEncryptionConfiguration.Rules).toContainEqual(
    expect.objectContaining({
      ApplyServerSideEncryptionByDefault: {
        SSEAlgorithm: 'AES256',
      },
    })
  );
});

test('DynamoDBテーブルで暗号化が有効である', async () => {
  const table = await dynamodb.describeTable({
    TableName: tableName,
  });
  
  expect(table.Table.SSEDescription).toBeDefined();
  expect(table.Table.SSEDescription.Status).toBe('ENABLED');
});
```

**完了日:** -

**備考:**
- S3: SSE-S3（AES256）
- DynamoDB: AWS管理キー

---

## Property 15: テストカバレッジの維持

**定義:** コードカバレッジが80%以上である

**対応要件:** 要件14（テストとQA）

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] CI/CDパイプライン: `.github/workflows/test.yml`

**テストファイルパス:**
- `.github/workflows/test.yml`

**検証方法:**
```yaml
# .github/workflows/test.yml
- name: Run tests with coverage
  run: npm run test:coverage

- name: Check coverage threshold
  run: |
    COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
    if (( $(echo "$COVERAGE < 80" | bc -l) )); then
      echo "Coverage $COVERAGE% is below 80%"
      exit 1
    fi
```

**完了日:** -

**備考:**
- Jestのカバレッジレポートを使用
- CI/CDで自動チェック

---

## 実装優先順位

### Phase 1: 基本機能（優先度: High）

1. **Property 1**: 日付範囲収集の完全性
2. **Property 2**: メタデータとPDFの同時取得
3. **Property 3**: メタデータの必須フィールド
4. **Property 4**: 開示IDの一意性
5. **Property 5**: 重複収集の冪等性
6. **Property 6**: PDFファイルの整合性
7. **Property 12**: レート制限の遵守

### Phase 2: 拡張機能（優先度: Medium）

8. **Property 7**: エラー時の部分的成功
9. **Property 8**: 日付範囲の順序性
10. **Property 9**: APIキー認証の必須性
11. **Property 10**: エクスポートファイルの有効期限
12. **Property 11**: 実行状態の進捗単調性

### Phase 3: 最適化（優先度: Low）

13. **Property 13**: ログレベルの適切性
14. **Property 14**: 暗号化の有効性
15. **Property 15**: テストカバレッジの維持

---

## テスト実装ガイドライン

### ユニットテスト

- **ツール**: Jest
- **カバレッジ目標**: 80%以上
- **命名規則**: `{module-name}.test.ts`
- **配置**: `test/unit/`

### プロパティベーステスト

- **ツール**: fast-check
- **実行回数**: 最低100回（デフォルト）
- **命名規則**: `{module-name}.property.test.ts`
- **配置**: `test/unit/`

### 統合テスト

- **ツール**: Jest + AWS SDK
- **環境**: LocalStack（ローカル）、AWS（CI/CD）
- **命名規則**: `{module-name}.integration.test.ts`
- **配置**: `test/integration/`

### E2Eテスト

- **ツール**: Jest + Supertest
- **環境**: デプロイ済みAPI
- **命名規則**: `{module-name}.e2e.test.ts`
- **配置**: `test/e2e/`

---

## 更新履歴

| 日付 | Property | 変更内容 | 担当者 |
|------|----------|---------|--------|
| 2026-02-07 | - | 初版作成 | - |

---

## 関連ドキュメント

- **要件定義書**: `requirements.md`
- **設計書**: `design.md`
- **テスト戦略**: `../../steering/development/testing-strategy.md`
- **実装チェックリスト**: `implementation-checklist.md`
