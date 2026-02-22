# 作業記録: 本番環境でのデータ収集検証

**作業日時**: 2026-02-14 23:05:35  
**タスク番号**: 31.2.6.7  
**作業者**: Kiro AI  
**優先度**: 🔴 Critical

## 作業概要

本番環境でデータ収集テストを実行し、以下を検証する：
- データ収集が成功すること
- Shift_JISデコードエラーが発生しないこと
- CloudWatch PutMetricData権限エラーが発生しないこと
- メタデータがDynamoDBに保存されること
- PDFファイルがS3に保存されること

## 前提条件

- タスク31.2.6.5完了（本番環境デプロイ完了）
- API Gateway URLが取得済み
- APIキーが取得済み

## 実施手順

### 1. 環境情報の確認

本番環境のAPI Gateway URLとAPIキーを確認する。

### 2. データ収集テストの実行

POST /collect で2026-02-13のデータ収集を実行する。

### 3. 実行状態の確認

GET /collect/{execution_id} で実行状態を確認する。

### 4. CloudWatch Logsの確認

Lambda Collectorのログを確認し、エラーがないことを確認する。

### 5. DynamoDBの確認

収集されたデータがDynamoDBに保存されていることを確認する。

### 6. S3の確認

PDFファイルがS3に保存されていることを確認する。

## 実施内容


### 1. 環境情報の確認

#### API Gateway情報
- **API Endpoint**: `https://g7fy393l2j.execute-api.ap-northeast-1.amazonaws.com/prod`
- **API Key**: `l2yePlH5s01Ax2y6whl796IaG5TYjuhD39vXRYzL`

#### 前提条件の確認
- ✅ タスク31.2.6.5完了（本番環境デプロイ完了）
- ✅ タスク31.2.6.3完了（Shift_JISデコード修正）
- ✅ タスク31.2.6.4完了（IAMロール権限追加）

#### 前回の問題点
1. **Shift_JISデコード問題（Critical）** - 修正済み
   - TextDecoderの`shift_jis`サポート不足
   - `iconv-lite`ライブラリを使用するように修正

2. **IAMロール権限不足（High）** - 修正済み
   - CloudWatch PutMetricData権限を追加

### 2. データ収集テストの実行

2026-02-13のデータ収集を実行します。


#### データ収集実行結果

**実行時刻**: 2026-02-14 23:06:43 (JST)

**リクエスト**:
```json
{
  "start_date": "2026-02-13",
  "end_date": "2026-02-13"
}
```

**レスポンス**:
```json
{
  "status": "success",
  "data": {
    "execution_id": "exec_1771078000961_2ahwrh_8c466f7f",
    "status": "pending",
    "message": "Data collection started successfully",
    "started_at": "2026-02-14T14:06:43.253Z"
  }
}
```

### 3. 実行状態の確認

**確認時刻**: 2026-02-14 23:07:13 (JST) - 30秒後

**実行結果**:
```json
{
  "status": "success",
  "data": {
    "execution_id": "exec_1771078000961_2ahwrh_8c466f7f",
    "status": "failed",
    "progress": 100,
    "collected_count": 0,
    "failed_count": 100,
    "error_message": "Collection failed",
    "started_at": "2026-02-14T14:06:43.118Z",
    "completed_at": "2026-02-14T14:06:43.118Z"
  }
}
```

**結果**: ❌ データ収集失敗（100件中100件失敗）

### 4. CloudWatch Logsの確認

**ログストリーム**: `2026/02/14/[$LATEST]1fadc1f342744160a9aa1f18f8a6319d`

**エラーメッセージ**:
```
'cp932' codec can't encode character '\ufffd' in position 1032: illegal multibyte sequence
```

### 5. 問題の分析

#### 根本原因

**Shift_JISデコード問題が未解決**

前回の分析（work-log-20260214-221221-data-collection-failure-analysis.md）で特定された問題と同じエラーが発生しています：

1. **TextDecoderの`shift_jis`サポート不足**
   - Lambda環境（Node.js 20.x）でShift_JISデコードが失敗
   - 不正な文字（`\ufffd`）が生成され、HTMLパーサーが失敗
   - 100件すべてのデータ収集が失敗

2. **修正が本番環境に適用されていない**
   - タスク31.2.6.3で`iconv-lite`を使用する修正が実施されたはず
   - しかし、本番環境では依然として同じエラーが発生
   - 修正が本番環境にデプロイされていない可能性

#### 確認が必要な項目

1. **修正コードの確認**
   - `src/lambda/collector/scrape-tdnet-list.ts`の`decodeShiftJIS`関数が`iconv-lite`を使用しているか
   - `package.json`に`iconv-lite`が依存関係として追加されているか

2. **デプロイ状況の確認**
   - 最新のコードが本番環境にデプロイされているか
   - Lambda関数のバージョンが最新か

3. **ビルド状況の確認**
   - TypeScriptビルドが成功しているか
   - `dist/`ディレクトリに最新のコードが含まれているか

## 次のステップ

1. ✅ データ収集テスト実行
2. ✅ 実行状態確認
3. ✅ CloudWatch Logs確認
4. ✅ 問題の分析
5. ⏳ 修正コードの確認
6. ⏳ 本番環境への再デプロイ
7. ⏳ データ収集テストの再実行


### 6. 修正コードの確認

#### 確認結果

1. ✅ **ソースコードの修正確認**
   - `src/lambda/collector/scrape-tdnet-list.ts`で`iconv-lite`を使用
   - `import * as iconv from 'iconv-lite';`が実装済み

2. ✅ **依存関係の確認**
   - `package.json`に`iconv-lite: ^0.6.3`が追加済み

3. ⚠️ **ビルド状況の確認**
   - CDKはLambda関数を自動的にバンドルするため、`dist/`ディレクトリは不要
   - しかし、本番環境では古いコードが実行されている可能性

#### 結論

**修正コードは実装済みだが、本番環境にデプロイされていない**

前回のデプロイ（タスク31.2.6.5）以降、以下の修正が実施されました：
- タスク31.2.6.3: Shift_JISデコード修正（`iconv-lite`使用）
- タスク31.2.6.4: IAMロール権限追加（CloudWatch PutMetricData）

しかし、これらの修正が本番環境にデプロイされていないため、依然として同じエラーが発生しています。

### 7. 本番環境への再デプロイ

最新のコードを本番環境にデプロイします。


#### データ収集テスト結果（3回目）

**実行時刻**: 2026-02-14 23:21:28 (JST)

**Execution ID**: `exec_1771078888103_a58po2_3701f5cb`

**実行結果**:
```json
{
  "status": "failed",
  "progress": 100,
  "collected_count": 0,
  "failed_count": 100,
  "error_message": "Collection failed"
}
```

**結果**: ❌ データ収集失敗（100件中100件失敗）

### 8. 新しい問題の発見

#### CloudWatch Logsの分析

**重要な発見**:
1. ✅ **Shift_JISデコード問題は解決済み**
   - `'cp932' codec`エラーは出現していない
   - `iconv-lite`による修正が正常に動作

2. ❌ **新しいエラー: 企業コードバリデーション失敗**
   - `Invalid companyCode: 30530`
   - `Invalid companyCode: 32210`
   - 100件すべてが企業コードバリデーションで失敗

3. ⚠️ **IAMロール権限不足（副次的問題）**
   - CloudWatch PutMetricData権限がない
   - メトリクス送信に失敗（警告レベル）

#### 根本原因

**`src/utils/disclosure-id.ts`の企業コードバリデーションが厳しすぎる**

```typescript
if (!companyCode || !/^\d{4}$/.test(companyCode)) {
  throw new ValidationError(`Invalid companyCode: ${companyCode}`);
}
```

**問題点**:
- 正規表現が4桁のみを許可（`/^\d{4}$/`）
- 実際のTDnetでは5桁の企業コードも存在（30530, 32210など）
- すべての5桁企業コードがバリデーションエラーになる

#### 修正方針

**企業コードバリデーションを4-5桁に変更**

```typescript
if (!companyCode || !/^\d{4,5}$/.test(companyCode)) {
  throw new ValidationError(`Invalid companyCode: ${companyCode}`);
}
```

**推定工数**: 10分

### 9. 修正の実施

企業コードバリデーションを修正します。


#### 修正内容

**ファイル**: `src/utils/disclosure-id.ts`

**変更前**:
```typescript
if (!companyCode || !/^\d{4}$/.test(companyCode)) {
  throw new ValidationError(`Invalid companyCode: ${companyCode}`);
}
```

**変更後**:
```typescript
if (!companyCode || !/^[0-9A-Z]{4,5}$/.test(companyCode)) {
  throw new ValidationError(`Invalid companyCode: ${companyCode}`);
}
```

**対応パターン**:
- 4桁数字: `1234`
- 5桁数字: `30530`, `32210`
- 英数字混在: `222A0`

### 10. 本番環境への再デプロイ（2回目）

企業コードバリデーション修正を本番環境にデプロイします。

