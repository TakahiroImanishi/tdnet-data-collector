# 作業記録: データ収集失敗の原因調査と修正

**作業日時**: 2026-02-14 17:52:19  
**タスク**: 31.2.2 データ収集失敗の原因調査と修正（Critical）  
**担当**: Kiro AI Assistant  
**関連タスク**: 31.2（スモークテスト実施）

## 作業概要

POST /collect で2件の失敗が発生している問題を調査し、修正する。

## 前提条件

- API Endpoint: `https://g7fy393l2j.execute-api.ap-northeast-1.amazonaws.com/prod`
- API Key: `l2yePlH5s01Ax2y6whl796IaG5TYjuhD39vXRYzL`
- 前回実行: execution_id: exec_1771057588638_najqxw_0a2dccb0
- 実行結果: status: failed, collected_count: 0, failed_count: 2

## 調査項目

1. CloudWatch Logsの詳細確認（全ログストリーム）
2. 環境変数の確認（TDNET_BASE_URL、S3_BUCKET、DYNAMODB_TABLE）
3. IAMロールの権限確認（S3、DynamoDB、CloudWatch Logs）
4. TDnet APIへのアクセステスト（手動実行）
5. エラー原因の特定と修正
6. 修正後のデプロイとスモークテスト再実行

## 作業ログ

### 17:52 - 作業記録作成

作業記録ファイルを作成し、調査を開始。



### 17:55 - CloudWatch Logs確認

**実施内容:**
- Lambda関数のログストリームを確認
- ログ内容: INIT_START, START, END, REPORT のみ
- エラーログが全く出力されていない

**発見事項:**
- Lambda関数は実行されたが、構造化ログが出力されていない
- Duration: 2401.08 ms, Memory Used: 178 MB
- ログレベルがINFOに設定されているため、詳細なログが出力されていない可能性

### 17:56 - 環境変数確認

**実施内容:**
```powershell
aws lambda get-function-configuration --function-name tdnet-collector-prod --region ap-northeast-1
```

**発見事項:**
```json
{
  "S3_BUCKET": "tdnet-data-collector-pdfs-prod-803879841964",
  "DYNAMODB_TABLE": "tdnet_disclosures_prod",
  "ENVIRONMENT": "prod",
  "NODE_OPTIONS": "--enable-source-maps",
  "DYNAMODB_EXECUTIONS_TABLE": "tdnet_executions_prod",
  "LOG_LEVEL": "INFO"
}
```

**問題発見:**
- ❌ `TDNET_BASE_URL`環境変数が設定されていない
- これが原因でTDnetにアクセスできていない

### 17:58 - コード確認

**確認箇所:**
- `src/lambda/collector/scrape-tdnet-list.ts` の `buildTdnetUrl` 関数
- デフォルト値: `process.env.TDNET_BASE_URL || 'https://www.release.tdnet.info/inbs'`
- 環境変数が未設定の場合、デフォルト値が使用される

**問題:**
- CDKスタック定義（`cdk/lib/stacks/compute-stack.ts`）で`TDNET_BASE_URL`が設定されていない

### 18:00 - 修正実施

**修正内容:**

1. **TDNET_BASE_URL環境変数の追加**
   - ファイル: `cdk/lib/stacks/compute-stack.ts`
   - 変更: Collector Lambda関数の環境変数に`TDNET_BASE_URL: 'https://www.release.tdnet.info/inbs'`を追加

2. **ログレベルをDEBUGに変更（一時的）**
   - ファイル: `cdk/lib/config/environment-config.ts`
   - 変更: `prodConfig.collector.logLevel`を`'INFO'`から`'DEBUG'`に変更
   - 理由: 詳細なエラー情報を取得するため



### 18:02 - IAMロール権限確認

**実施内容:**
```powershell
aws iam get-role-policy --role-name TdnetCompute-prod-CollectorFunctionServiceRoleE40F9-1O0qKouRDKN8 --policy-name CollectorFunctionServiceRoleDefaultPolicyC45D8C88
```

**確認結果:**
- ✅ DynamoDB: BatchGetItem, BatchWriteItem, PutItem, Query, Scan, UpdateItem
- ✅ S3: PutObject, GetObject, ListBucket
- ✅ CloudWatch: PutMetricData（TDnet/Collector名前空間）
- ✅ SQS: SendMessage（DLQ）

**結論:** IAMロールの権限は正しく設定されている

### 18:03 - 修正のデプロイ準備

**修正内容まとめ:**
1. ✅ TDNET_BASE_URL環境変数の追加（`cdk/lib/stacks/compute-stack.ts`）
2. ✅ ログレベルをDEBUGに変更（`cdk/lib/config/environment-config.ts`）

**次のステップ:**
1. CDKスタックのデプロイ（Compute Stackのみ）
2. Lambda関数の環境変数確認
3. データ収集テストの再実行
4. CloudWatch Logsの詳細確認



### 18:05 - デプロイ完了

**実施内容:**
```powershell
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack compute
```

**デプロイ結果:**
- ✅ TdnetCompute-prod: UPDATE_COMPLETE
- ✅ CollectorFunction: 環境変数更新完了
- ✅ HealthFunction: 新規作成完了
- ✅ StatsFunction: 新規作成完了

**環境変数確認:**
```json
{
  "S3_BUCKET": "tdnet-data-collector-pdfs-prod-803879841964",
  "DYNAMODB_TABLE": "tdnet_disclosures_prod",
  "ENVIRONMENT": "prod",
  "TDNET_BASE_URL": "https://www.release.tdnet.info/inbs",
  "NODE_OPTIONS": "--enable-source-maps",
  "DYNAMODB_EXECUTIONS_TABLE": "tdnet_executions_prod",
  "LOG_LEVEL": "DEBUG"
}
```

**確認結果:**
- ✅ TDNET_BASE_URL: 正しく設定されている
- ✅ LOG_LEVEL: DEBUGに変更されている

### 18:06 - データ収集テスト再実行

**実施内容:**
```powershell
$headers = @{ "x-api-key" = "l2yePlH5s01Ax2y6whl796IaG5TYjuhD39vXRYzL" }
$body = @{
    start_date = "2026-02-14"
    end_date = "2026-02-14"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://g7fy393l2j.execute-api.ap-northeast-1.amazonaws.com/prod/collect" -Method POST -Headers $headers -Body $body -ContentType "application/json"
```



**テスト結果:**
```json
{
  "status": "success",
  "data": {
    "execution_id": "exec_1771059530305_mvypwm_c02205bc",
    "status": "failed",
    "collected_count": 0,
    "failed_count": 1
  }
}
```

**問題:** まだ失敗している

### 18:08 - CloudWatch Logs再確認

**実施内容:**
```powershell
aws logs get-log-events --log-group-name "/aws/lambda/tdnet-collector-prod" --log-stream-name '2026/02/14/[$LATEST]dce3a5d2ad7544deb9a698c82472b5ad'
```

**発見事項:**
- ログ内容: INIT_START, START, END, REPORT のみ
- Duration: 1481.05 ms, Memory Used: 172 MB
- **構造化ログが全く出力されていない**

**問題:** loggerが初期化されていないか、ログ出力前にエラーが発生している

### 18:10 - TDnet URL手動テスト

**実施内容:**
```powershell
Invoke-WebRequest -Uri "https://www.release.tdnet.info/inbs/I_list_001_2026-02-14.html"
Invoke-WebRequest -Uri "https://www.release.tdnet.info/inbs/I_list_001_2024-02-14.html"
```

**結果:**
```
Error: Not Found
The requested URL /inbs/I_list_001_2026-02-14.html was not found on this server.
```

**重大な問題発見:**
- ❌ TDnetのURLフォーマットが間違っている
- 現在のURL: `https://www.release.tdnet.info/inbs/I_list_001_YYYY-MM-DD.html`
- このフォーマットでは404エラーが返される

**根本原因:**
1. TDNET_BASE_URLは正しく設定されたが、URLフォーマットが実際のTDnet APIと一致していない
2. TDnetの実際のURLフォーマットを調査する必要がある
3. `buildTdnetUrl`関数のURL構築ロジックを修正する必要がある

### 18:04 - TDnet URL構造の確認（ユーザー提供情報）

**実施内容:**
- ユーザーからTDnetの正しいURL構造を確認
- 検索ページのキャプチャーを確認
- `I_main_00.html` のHTMLソースコードを分析

**確認結果:**
- ✅ メインページ: `https://www.release.tdnet.info/inbs/I_main_00.html`
- ✅ 実際のデータページ: `https://www.release.tdnet.info/inbs/I_list_001_YYYYMMDD.html`
- ✅ 日付フォーマット: YYYYMMDD（ハイフンなし、8桁）
  - 例: `I_list_001_20260214.html` (2026年2月14日)
  - 例: `I_list_001_20260213.html` (2026年2月13日)
- ✅ リクエスト方法: GET（POSTではない）
- ✅ メインページはiframeで実際のリストページを読み込む

**問題の根本原因:**
- ❌ 現在のURL: `I_list_001_2026-02-14.html` (ハイフン区切り)
- ✅ 正しいURL: `I_list_001_20260214.html` (ハイフンなし)

**修正内容:**
1. `buildTdnetUrl`関数を修正
   - 日付フォーマットを `YYYY-MM-DD` → `YYYYMMDD` に変換
   - `date.replace(/-/g, '')` で実装

### 18:07 - コード修正実施

**修正ファイル:**
- `src/lambda/collector/scrape-tdnet-list.ts`

**修正内容:**
```typescript
function buildTdnetUrl(date: string): string {
  const baseUrl = process.env.TDNET_BASE_URL || 'https://www.release.tdnet.info/inbs';
  // YYYY-MM-DD → YYYYMMDD に変換
  const dateWithoutHyphens = date.replace(/-/g, '');
  return `${baseUrl}/I_list_001_${dateWithoutHyphens}.html`;
}
```

**変更点:**
- ✅ 日付からハイフンを削除（`replace(/-/g, '')`）
- ✅ URL形式を `I_list_001_YYYYMMDD.html` に修正
- ✅ コメントを更新（実際のURL形式を記載）

### 18:12 - テスト実行

**実施内容:**
- ユニットテストを実行して修正を検証
- すべてのテストが通過（35 passed）

### 18:14 - デプロイ実施

**実施内容:**
```powershell
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack compute
```

**デプロイ結果:**
- ✅ TdnetCompute-prod: UPDATE_COMPLETE
- ✅ CollectorFunction: コード更新完了

### 18:15 - データ収集テスト（2026-02-13）

**実施内容:**
```powershell
POST /collect
{
  "start_date": "2026-02-13",
  "end_date": "2026-02-13"
}
```

**テスト結果:**
- execution_id: exec_1771060555322_e7ml1w_2c29934b
- status: completed
- collected_count: 0
- failed_count: 0

**問題発見:**
- ✅ URL修正は成功（`I_list_001_20260213.html`）
- ✅ HTMLは正しく取得できる（手動確認済み）
- ❌ HTMLパーサーが0件を返している

### 18:17 - HTMLパーサーの問題調査

**実施内容:**
- 実際のTDnet HTMLを取得して構造を確認
- URL: `https://www.release.tdnet.info/inbs/I_list_001_20260213.html`

**確認結果:**
- ✅ HTMLは正常に取得できる（7460 bytes）
- ✅ 開示情報データが存在する（約40件）
- ❌ 現在のパーサーは `<table class="disclosure-list">` を探している
- ❌ 実際のHTMLにはそのようなクラスが存在しない

**実際のHTML構造:**
```
時刻    コード    会社名    内容    XBRL    上場取引所
22:00   93380    Ｇ－ＩＮＦＯＲＩＣＨ    株式会社 BCJ-102 による...    東
20:15   99270    ワットマン    ＭＢＯの実施に関する...    XBRL    東
```

**根本原因:**
- HTMLパーサー（`src/scraper/html-parser.ts`）が実際のTDnet HTML構造と一致していない
- テーブルのクラス名、セレクター、データ構造が異なる

## 問題まとめ

### 解決済み
1. ✅ TDNET_BASE_URL環境変数の追加
2. ✅ LOG_LEVELをDEBUGに変更
3. ✅ IAMロールの権限確認（問題なし）

### 未解決（Critical）
1. ❌ TDnet URLフォーマットの調査と修正
   - 現在のフォーマット: `/inbs/I_list_001_YYYY-MM-DD.html`
   - 実際のフォーマット: 不明（404エラー）
   - 対応: TDnetの公式ドキュメントまたは実際のWebサイトを確認

2. ❌ 構造化ログが出力されない問題
   - Lambda関数は実行されているが、logger.info()が呼ばれていない
   - 可能性: 早期エラー（バリデーションエラー、初期化エラー）
   - 対応: try-catchブロックの外側にログを追加

## 次のステップ

1. TDnetの実際のURLフォーマットを調査
   - TDnet公式サイト: https://www.release.tdnet.info/
   - 開示情報リストページのURL構造を確認
   - 日付フォーマット、パスの確認

2. `buildTdnetUrl`関数の修正
   - 正しいURLフォーマットに変更
   - テストケースの更新

3. デプロイと再テスト
   - Compute Stackの再デプロイ
   - データ収集テストの再実行
   - CloudWatch Logsの詳細確認



## 成果物

### 修正ファイル
1. `cdk/lib/stacks/compute-stack.ts`
   - TDNET_BASE_URL環境変数を追加

2. `cdk/lib/config/environment-config.ts`
   - prodConfig.collector.logLevelをDEBUGに変更（一時的）

### デプロイ結果
- ✅ TdnetCompute-prod: UPDATE_COMPLETE
- ✅ CollectorFunction: 環境変数更新完了
- ✅ HealthFunction: 新規作成完了
- ✅ StatsFunction: 新規作成完了

## 申し送り事項

### Critical問題（未解決）
1. **HTMLパーサーの修正が必要**
   - 現在のパーサー: `<table class="disclosure-list">` を探している
   - 実際のHTML: そのようなクラスが存在しない
   - 対応: `src/scraper/html-parser.ts` を実際のHTML構造に合わせて修正
   - 関連ファイル: `src/scraper/html-parser.ts`
   - 優先度: 🔴 Critical

2. **LOG_LEVELをINFOに戻す**
   - 現在: DEBUG（調査用）
   - 対応: `cdk/lib/config/environment-config.ts` で prodConfig.collector.logLevel を 'INFO' に戻す
   - タイミング: HTMLパーサー修正後

### 完了事項
1. ✅ TDNET_BASE_URL環境変数の追加
2. ✅ TDnet URL形式の修正（`I_list_001_YYYYMMDD.html`）
3. ✅ ユニットテストの修正と検証
4. ✅ Compute Stackのデプロイ
5. ✅ 実際のTDnet HTMLの取得確認

### 次のタスク
- タスク31.2.2を継続: HTMLパーサーの修正
- タスク31.2.3: ログレベルをINFOに戻す（HTMLパーサー修正後）

