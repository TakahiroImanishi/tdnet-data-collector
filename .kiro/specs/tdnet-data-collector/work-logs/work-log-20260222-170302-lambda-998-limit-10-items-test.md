# Lambda 998制限問題 - 10件テスト実行

**作業日時**: 2026-02-22 17:03:02  
**タスク**: tasks-lambda-998-limit-issue.md - タスク3.1  
**目的**: ログ出力の検証とデバッグ（10件の小規模テスト）

## 作業概要

タスク2で追加したログが本番環境で正しく出力されるか確認するため、10件の小規模テストを実施します。

## 実施内容

### 1. テスト実行

**コマンド**:
```powershell
.\scripts\manual-data-collection.ps1 -StartDate "2026-02-12" -EndDate "2026-02-12" -MaxItems 10
```

**期待される結果**:
- TDnetから10件のデータ取得
- DynamoDBに10件保存
- S3に10件のPDF保存
- CloudWatch Logsに以下のログが出力される:
  - `Total disclosures to process: 10`
  - `Processing batch 1/2`
  - `Batch completed`
  - `All batches completed`

### 2. CloudWatch Logs確認

**確認項目**:
- [ ] バッチ処理ログ（`Processing batch`, `Batch completed`）
- [ ] 個別処理ログ（`Processing disclosure started`, `Processing disclosure completed`）
- [ ] 重複検出ログ（`Duplicate disclosure detected`）
- [ ] エラーログ（`Failed to process disclosure`）

### 3. データ確認

**確認項目**:
- [ ] DynamoDBに10件保存されているか
- [ ] S3に10件のPDF保存されているか
- [ ] 実行状況テーブル（`tdnet_executions_prod`）が更新されているか

## 実行結果

### テスト実行 - 失敗

**実行時刻**: 2026-02-22 17:03:30

**エラー内容**:
```
❌ APIキーの取得に失敗しました
原因: ネットワークエラー（最大リトライ回数に到達）
```

**根本原因**:
AWS認証情報のトークンが無効（`UnrecognizedClientException`）

**AWS CLI設定**:
```
access_key : ****************3IOE
secret_key : ****************a7wn
region     : ap-northeast-1
```

**問題**:
- AWS Secrets Managerへのアクセスが拒否される
- `aws secretsmanager get-secret-value`コマンドが失敗
- エラー: `The security token included in the request is invalid`

## 対処方法

### オプション1: AWS SSOで再認証

```powershell
aws sso login --profile [your-profile]
```

### オプション2: 環境変数で直接APIキーを設定

```powershell
$env:TDNET_API_KEY = 'your-api-key-here'
.\scripts\manual-data-collection.ps1 -StartDate "2026-02-12" -EndDate "2026-02-12" -MaxItems 10
```

### オプション3: AWS認証情報を更新

```powershell
aws configure
# Access Key ID, Secret Access Key, Regionを再入力
```

## 次のステップ

1. ✅ AWS SSO再認証完了（`aws sso login --profile imanishi-awssso`）
2. ✅ 10件テスト実行開始
3. ❌ MaxItems機能が動作していない（285件以上収集中）

## 問題発見: MaxItems機能が動作していない

**現象**:
```
進捗: 22% | 収集: 285 件 | 失敗: 0 件 | 状態: running
```

**原因**:
- `manual-data-collection.ps1`は`max_items`パラメータをAPI（`/collect`）に送信している
- しかし、Lambda Collector関数（`src/lambda/collector/handler.ts`）が`max_items`パラメータを処理していない
- `CollectorEvent`インターフェースに`max_items`フィールドが存在しない
- `scrapeTdnetList`関数に`max_items`パラメータが渡されていない

**修正方針**:
1. `CollectorEvent`インターフェースに`max_items?: number`を追加
2. `scrapeTdnetList`関数に`maxItems`パラメータを追加
3. `collectDisclosuresForDateRange`関数で`max_items`を処理
4. スクレイピング結果を`max_items`で制限

## 申し送り事項

- MaxItems機能の実装が必要
- 実装後、ユニットテストを更新して再実行
- 実装後、10件テストを再実行してCloudWatch Logsを確認



## MaxItems機能の実装完了

**実装日時**: 2026-02-22 17:12:00

### 実装内容

1. **CollectorEventインターフェースの修正**
   - `max_items?: number`フィールドを追加

2. **handleOnDemandMode関数の修正**
   - `max_items`パラメータを追加
   - `collectDisclosuresForDateRange`に渡す

3. **collectDisclosuresForDateRange関数の修正**
   - `max_items`パラメータを追加
   - スクレイピング結果を`max_items`で制限
   - 残り件数を計算して、制限に達したらループを終了
   - ログに`max_items`情報を追加

4. **カウント累積ロジックの修正**
   - `collected_count`と`failed_count`を累積するように修正
   - コールバックでは更新せず、`results`から累積

### テスト結果

```
Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
```

すべてのユニットテストが成功しました。

### 次のステップ

1. CDKデプロイ（本番環境）
2. 10件テストの再実行
3. CloudWatch Logsでログ出力を確認

