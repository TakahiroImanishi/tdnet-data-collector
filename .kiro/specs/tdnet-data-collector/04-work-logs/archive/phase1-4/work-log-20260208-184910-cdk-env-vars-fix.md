# 作業記録: CDK環境変数設定の修正

**作業日時**: 2026-02-08 18:49:10  
**タスク**: 15.24 CDK環境変数設定の修正（残存112件のテスト失敗解消）  
**担当**: AI Assistant

## 作業概要

残存する112件のテスト失敗を解消するため、CDK環境変数設定を修正します。

## 実施内容

### 1. テスト失敗状況の確認


テスト失敗の原因を特定しました：
- 通常のテスト（非E2E）で`API_KEY_SECRET_ARN`環境変数が未設定
- jest.config.jsにsetupFilesAfterEnvが未設定

### 2. jest.setup.jsの作成

テスト環境用の環境変数を設定するセットアップファイルを作成しました：

```javascript
// 主要な環境変数
- NODE_ENV = 'test'
- API_KEY_SECRET_ARN = 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:test-api-key'
- API_KEY = 'test-api-key-12345'
- DYNAMODB_TABLE_NAME = 'test-disclosures-table'
- S3_BUCKET_NAME = 'test-pdfs-bucket'
- EXPORT_BUCKET_NAME = 'test-exports-bucket'
```

### 3. jest.config.jsの更新

setupFilesAfterEnvを有効化しました。

### 4. テスト実行


修正完了：112件 → 75件に減少

### 5. AWS SDK v3モックの修正

`export-to-s3.test.ts`のモック設定を修正：
- `S3Client.prototype.send`が`PutObjectCommand`インスタンスを正しく処理
- `sendCall.input.Body` → `sendCall.input?.Body || ''`に修正（オプショナルチェーン）
- すべてのテストケース（JSON、CSV、エスケープ、タグ）を修正

### 6. テスト再実行

修正完了：112件 → 75件 → 66件に減少

`export-to-s3.test.ts`のすべてのテスト（10件）が成功しました。

### 7. 残存する66件の失敗の分析

全テストスイート実行結果:
- Test Suites: 11 failed, 33 passed, 44 total
- Tests: 66 failed, 690 passed, 756 total

次のステップ:
1. 失敗している11個のテストスイートを特定
2. 各テストスイートの失敗原因を分析
3. 同様のAWS SDK v3モック問題がないか確認
4. 必要に応じて修正を適用

## 問題と解決策

### 問題1: AWS SDK v3のモック設定
- **原因**: `S3Client.prototype.send`を直接モックする方法では、`PutObjectCommand`インスタンスの`input`プロパティにアクセスできない
- **解決策**: `jest.mock`で`S3Client`コンストラクタ自体をモックし、`send`メソッドに渡された`PutObjectCommand`インスタンスを保存

### 問題2: モック変数の初期化順序
- **原因**: `jest.mock`は巻き上げられるため、`const mockSend = jest.fn()`を後で定義すると参照エラー
- **解決策**: `mockSend`を`jest.mock`より前に定義し、importを`jest.mock`の後に配置

### 問題3: CSV改行テストの検証方法
- **原因**: CSVで改行を含む値は複数行にまたがるため、`lines[1]`だけでは不完全
- **解決策**: `body`全体に対して`toContain`で検証

## 成果物

- `jest.setup.js`: テスト環境用の環境変数設定
- `jest.config.js`: setupFilesAfterEnvを有効化
- `src/lambda/export/__tests__/export-to-s3.test.ts`: AWS SDK v3モック修正（10件すべて成功）

## 申し送り事項

残存する66件のテスト失敗について:
- 他のテストファイルでも同様のAWS SDK v3モック問題がある可能性
- DynamoDB、S3、その他のAWSサービスのモックも確認が必要
- 失敗しているテストスイートを特定し、同様の修正パターンを適用する必要あり

**進捗**: 112件 → 75件 → 66件（46件改善、残り66件）

**次のタスク**: 残存する66件のテスト失敗を個別に調査し、修正を適用する必要があります。