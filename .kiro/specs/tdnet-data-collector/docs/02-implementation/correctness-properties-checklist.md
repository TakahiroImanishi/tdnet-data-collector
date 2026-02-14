# Correctness Properties チェックリスト

**最終更新:** 2026-02-15

## 関連ドキュメント

- `design.md` - Correctness Propertiesの詳細定義
- `../../steering/development/testing-strategy.md` - テスト実装方法

---

TDnet Data Collectorプロジェクトの15個のCorrectness Propertiesの実装状況とテスト検証状況を追跡します。

---

## Property 1: 日付範囲収集の完全性

**定義:** 指定された日付範囲内のすべての開示情報が収集される

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト
- [ ] プロパティベーステスト
- [ ] 統合テスト

**検証方法:**
```typescript
fc.assert(
  fc.property(arbDateRange, async ({ start_date, end_date }) => {
    const collected = await collectDisclosures(start_date, end_date);
    const expected = await getTDnetDisclosures(start_date, end_date);
    expect(collected.length).toBe(expected.length);
  })
);
```

---

## Property 2: メタデータとPDFの同時取得

**定義:** 開示情報のメタデータとPDFファイルが必ず同時に取得される

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト
- [ ] 統合テスト

**検証方法:**
```typescript
test('メタデータとPDFが同時に取得される', async () => {
  const disclosure = await collectSingleDisclosure(disclosureId);
  expect(disclosure.metadata).toBeDefined();
  const pdfExists = await s3.headObject({ Bucket: bucketName, Key: disclosure.metadata.pdf_s3_key });
  expect(pdfExists).toBeDefined();
});
```

---

## Property 3: メタデータの必須フィールド

**定義:** すべてのメタデータレコードが必須フィールドを含む

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト
- [ ] プロパティベーステスト

**検証方法:**
```typescript
fc.assert(
  fc.property(arbDisclosure, (disclosure) => {
    const validated = validateDisclosure(disclosure);
    expect(validated).toHaveProperty('disclosure_id');
    expect(validated).toHaveProperty('company_code');
    expect(validated.company_code).toMatch(/^\d{4}$/);
  })
);
```

---

## Property 4: 開示IDの一意性

**定義:** すべての開示情報が一意の識別子を持つ

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト
- [ ] 統合テスト

**検証方法:**
```typescript
test('重複する開示IDは拒否される', async () => {
  const disclosure = createTestDisclosure();
  await saveDisclosure(disclosure);
  await expect(saveDisclosure(disclosure)).rejects.toThrow('ConditionalCheckFailedException');
});
```

---

## Property 5: 重複収集の冪等性

**定義:** 同じ開示情報を複数回収集しても、データベースには1件のみ保存される

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト
- [ ] 統合テスト

**検証方法:**
```typescript
test('重複収集は冪等である', async () => {
  await collectDisclosure(disclosureId);
  const count1 = await countDisclosures();
  await collectDisclosure(disclosureId);
  const count2 = await countDisclosures();
  expect(count2).toBe(count1);
});
```

---

## Property 6: PDFファイルの整合性

**定義:** ダウンロードされたPDFファイルが破損していない

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト
- [ ] 統合テスト

**検証方法:**
```typescript
test('PDFファイルの整合性が検証される', async () => {
  const pdfBuffer = await downloadPDF(pdfUrl);
  expect(pdfBuffer.slice(0, 4).toString()).toBe('%PDF');
  expect(pdfBuffer.length).toBeGreaterThan(0);
});
```

---

## Property 7: エラー時の部分的成功

**定義:** 一部の開示情報の収集が失敗しても、成功した分は保存される

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト
- [ ] 統合テスト

**検証方法:**
```typescript
test('部分的失敗でも成功分は保存される', async () => {
  const disclosures = [
    { id: '001', url: 'valid-url-1' },
    { id: '002', url: 'invalid-url' },
    { id: '003', url: 'valid-url-3' },
  ];
  const result = await collectBatch(disclosures);
  expect(result.collected).toBe(2);
  expect(result.failed).toBe(1);
});
```

---

## Property 8: 日付範囲の順序性

**定義:** start_dateはend_date以前でなければならない

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト
- [ ] プロパティベーステスト

**検証方法:**
```typescript
fc.assert(
  fc.property(fc.date(), fc.date(), (date1, date2) => {
    const startDate = date1 < date2 ? date1 : date2;
    const endDate = date1 < date2 ? date2 : date1;
    expect(() => validateDateRange(startDate, endDate)).not.toThrow();
  })
);
```

---

## Property 9: APIキー認証の必須性

**定義:** すべてのAPIリクエストが有効なAPIキーを含む

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト
- [ ] E2Eテスト

**検証方法:**
```typescript
test('APIキーなしのリクエストは拒否される', async () => {
  const response = await request(app).get('/disclosures').expect(401);
  expect(response.body.error.code).toBe('UNAUTHORIZED');
});
```

---

## Property 10: エクスポートファイルの有効期限

**定義:** エクスポートファイルは24時間後に自動削除される

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト
- [ ] 統合テスト

**検証方法:**
```typescript
test('エクスポートファイルは24時間後に削除される', async () => {
  const exportId = await createExport({ format: 'json' });
  const exists = await s3.headObject({ Bucket: exportBucketName, Key: `${exportId}.json` });
  const expiresAt = new Date(exists.Metadata.expires_at);
  const expectedExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  expect(expiresAt.getTime()).toBeCloseTo(expectedExpiry.getTime(), -3);
});
```

---

## Property 11: 実行状態の進捗単調性

**定義:** 収集実行の進捗（collected, failed）は単調増加する

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト
- [ ] プロパティベーステスト

**検証方法:**
```typescript
fc.assert(
  fc.property(fc.array(fc.boolean()), async (results) => {
    const tracker = new ExecutionTracker('test-exec-001');
    let prevCollected = 0;
    for (const success of results) {
      if (success) await tracker.incrementCollected();
      const status = await tracker.getStatus();
      expect(status.collected).toBeGreaterThanOrEqual(prevCollected);
      prevCollected = status.collected;
    }
  })
);
```

---

## Property 12: レート制限の遵守

**定義:** TDnetへのリクエスト間隔が設定値以上である

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト
- [ ] プロパティベーステスト

**検証方法:**
```typescript
fc.assert(
  fc.property(fc.integer({ min: 5, max: 20 }), async (requestCount) => {
    const rateLimiter = new RateLimiter(2000);
    const timestamps: number[] = [];
    for (let i = 0; i < requestCount; i++) {
      await rateLimiter.acquire();
      timestamps.push(Date.now());
    }
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i] - timestamps[i - 1]).toBeGreaterThanOrEqual(1900);
    }
  })
);
```

---

## Property 13: ログレベルの適切性

**定義:** エラーログにはスタックトレースが含まれ、情報ログには含まれない

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] ユニットテスト

**検証方法:**
```typescript
test('エラーログにはスタックトレースが含まれる', () => {
  const mockLogger = createMockLogger();
  logger.error('Error occurred', { error: new Error('Test error') });
  const logEntry = mockLogger.getLastLog();
  expect(logEntry.stack).toBeDefined();
});
```

---

## Property 14: 暗号化の有効性

**定義:** S3とDynamoDBで保管時の暗号化が有効である

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] 統合テスト

**検証方法:**
```typescript
test('S3バケットで暗号化が有効である', async () => {
  const encryption = await s3.getBucketEncryption({ Bucket: pdfBucketName });
  expect(encryption.ServerSideEncryptionConfiguration).toBeDefined();
});
```

---

## Property 15: テストカバレッジの維持

**定義:** コードカバレッジが80%以上である

**実装状況:** ❌ 未実装

**テスト実装:**
- [ ] CI/CDパイプライン

**検証方法:**
```yaml
- name: Check coverage threshold
  run: |
    COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
    if (( $(echo "$COVERAGE < 80" | bc -l) )); then exit 1; fi
```

---

## 関連ドキュメント

- `requirements.md` - 要件定義書
- `design.md` - 設計書
- `../../steering/development/testing-strategy.md` - テスト戦略
- `implementation-checklist.md` - 実装チェックリスト
