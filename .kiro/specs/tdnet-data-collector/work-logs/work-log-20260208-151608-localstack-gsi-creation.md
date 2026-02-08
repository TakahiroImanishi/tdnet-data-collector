# Work Log: LocalStack DynamoDB GSI作成とE2Eテスト完全成功

**タスク:** 15.12.2 LocalStack DynamoDB GSI作成とE2Eテスト完全成功  
**日時:** 2026-02-08 15:16:08  
**ステータス:** ✅ 完了

## タスク概要

### 目的
LocalStackのDynamoDBテーブルに不足していたGSI（Global Secondary Index）を追加し、E2Eテストを100%成功させる。

### 背景
- タスク15.12.1でE2Eテスト環境変数読み込み問題を解決し、24/28テスト成功（85.7%）
- 残り4件の500エラーはGSI未作成が原因
- Query/Export handlerがGSI_CompanyCode_DiscloseDate と GSI_DatePartition を使用するが、LocalStackのテーブルには作成されていなかった

### 目標
- DynamoDBテーブル定義JSONファイルにGSIを追加
- LocalStackセットアップスクリプトを更新してGSI作成を自動化
- E2Eテスト 28/28成功（100%）を達成

---

## 実施内容

### 1. DynamoDBテーブル定義JSONファイルの更新

**ファイル:** `scripts/dynamodb-tables/tdnet_disclosures.json`

**変更内容:**
1. `company_code` 属性定義を追加
2. `GSI_CompanyCode_DiscloseDate` GSIを追加
   - パーティションキー: `company_code`
   - ソートキー: `disclosed_at`
3. 既存の `DatePartitionIndex` を `GSI_DatePartition` にリネーム

**追加したGSI:**
```json
{
  "IndexName": "GSI_CompanyCode_DiscloseDate",
  "KeySchema": [
    { "AttributeName": "company_code", "KeyType": "HASH" },
    { "AttributeName": "disclosed_at", "KeyType": "RANGE" }
  ],
  "Projection": { "ProjectionType": "ALL" },
  "ProvisionedThroughput": {
    "ReadCapacityUnits": 5,
    "WriteCapacityUnits": 5
  }
}
```

### 2. LocalStackセットアップスクリプトの更新

**ファイル:** `scripts/localstack-setup.ps1`

**変更内容:**
1. テーブル作成前に既存テーブルの削除処理を追加
2. JSONファイルベースのテーブル作成に変更（`--cli-input-json "file://..."` 使用）
3. サマリーセクションのGSI名を更新

**主な改善点:**
- 既存テーブルを削除してから再作成することで、GSI定義の変更を確実に反映
- JSONファイルを使用することで、複雑なGSI定義を管理しやすくした
- エラーハンドリングを改善（テーブル存在チェック、削除待機）

### 3. LocalStackの再起動とGSI作成

**実行コマンド:**
```powershell
$env:Path += ";C:\Program Files\Amazon\AWSCLIV2"
.\scripts\localstack-setup.ps1
```

**結果:**
- ✅ テーブル `tdnet_disclosures` を削除
- ✅ テーブル `tdnet_disclosures` を再作成（GSI_CompanyCode_DiscloseDate と GSI_DatePartition 付き）
- ✅ GSI作成を確認（aws dynamodb describe-table）

**GSI確認結果:**
```json
[
  ["GSI_DatePartition", [...]],
  ["GSI_CompanyCode_DiscloseDate", [...]]
]
```

### 4. E2Eテストの修正と実行

**問題1: Export ID正規表現エラー**
- **原因:** テストの正規表現が `[a-z0-9]+` のみを許可していたが、実際のexport_idには `test-req` のようにハイフンが含まれる
- **解決策:** 正規表現を `/^export_\d+_[a-z0-9]+_[a-z0-9\-]+$/` に修正（requestIdPrefixにハイフンを許可）

**問題2: Export status競合状態**
- **原因:** エクスポート処理がバックグラウンドで即座に開始されるため、DynamoDB確認時に `pending` ではなく `processing` になっている
- **解決策:** テストを修正して `pending` または `processing` の両方を許可

**E2Eテスト実行結果:**
```
Test Suites: 2 passed, 2 total
Tests:       28 passed, 28 total
Time:        6.334 s
```

✅ **100%成功！**

---

## 成果物

### 作成・変更したファイル

1. **scripts/dynamodb-tables/tdnet_disclosures.json**
   - `company_code` 属性定義を追加
   - `GSI_CompanyCode_DiscloseDate` GSIを追加
   - `DatePartitionIndex` を `GSI_DatePartition` にリネーム

2. **scripts/localstack-setup.ps1**
   - テーブル削除・再作成ロジックを追加
   - JSONファイルベースのテーブル作成に変更
   - サマリーセクションを更新

3. **src/lambda/export/__tests__/handler.e2e.test.ts**
   - Export ID正規表現を修正（ハイフンを許可）
   - Export status検証を修正（pending/processing両方を許可）

### テスト結果

| テストスイート | 成功 | 失敗 | 合計 |
|--------------|------|------|------|
| Lambda Export Handler E2E | 16 | 0 | 16 |
| Lambda Query Handler E2E | 12 | 0 | 12 |
| **合計** | **28** | **0** | **28** |

**成功率:** 100% ✅

---

## 次回への申し送り

### 完了事項
- ✅ DynamoDBテーブル定義にGSIを追加
- ✅ LocalStackセットアップスクリプトを更新
- ✅ E2Eテスト 28/28成功（100%）を達成
- ✅ タスク15.12.2完了

### 注意事項
1. **LocalStack環境の再構築時:**
   - `scripts/localstack-setup.ps1` を実行すれば、GSI付きテーブルが自動作成される
   - AWS CLI v2のPATH設定が必要（`$env:Path += ";C:\Program Files\Amazon\AWSCLIV2"`）

2. **E2Eテストの実行:**
   - LocalStackが起動していることを確認
   - `.env.local` ファイルが存在することを確認
   - `npm run test:e2e` で実行

3. **次のタスク:**
   - タスク15.14: Phase 2完了確認（最終）
   - すべてのE2Eテストが成功したため、Phase 2移行判断は ✅ Go（条件なし）

---

## 関連ドキュメント

- **タスクリスト:** `.kiro/specs/tdnet-data-collector/tasks.md`
- **LocalStackセットアップガイド:** `docs/localstack-setup.md`
- **E2Eテストガイド:** `docs/e2e-test-guide.md`
- **前回の作業記録:** `work-log-20260208-133144-e2e-test-execution.md`
