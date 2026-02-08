# 作業記録: CloudWatch Alarms設定実装

**作業日時**: 2026-02-08 20:44:49  
**タスク**: 16.3 CloudWatch Alarmsの設定  
**担当**: AI Assistant

## 作業概要

CloudWatch Alarmsを設定し、Lambda関数とシステム全体の監視体制を構築します。

## 実装内容

### 1. アラーム設定
- Lambda Error Rate > 10% → Critical
- Lambda Duration > 14分（840秒）→ Warning
- CollectionSuccessRate < 95% → Warning
- SNS Topic作成と通知設定

### 2. 実装ファイル
- `cdk/lib/constructs/cloudwatch-alarms.ts` - アラーム設定Construct
- `cdk/lib/tdnet-data-collector-stack.ts` - スタックへの統合
- `cdk/__tests__/cloudwatch-alarms.test.ts` - テスト

## 作業ログ

### 20:44 - 作業開始
- 作業記録作成
- 既存のモニタリング設定を確認



### 20:50 - 実装完了

#### 1. CloudWatch Alarms Construct作成
- **ファイル**: `cdk/lib/constructs/cloudwatch-alarms.ts`
- **機能**:
  - SNS Topic作成（アラート通知用）
  - Lambda関数ごとのアラーム設定:
    - Error Rate > 10% → Critical
    - Duration > 14分（840秒）→ Warning
    - Throttles > 0 → Critical
  - カスタムメトリクスアラーム:
    - CollectionSuccessRate < 95% → Warning
    - NoDataCollected（24時間）→ Critical
    - CollectionFailure > 10件/24時間 → Warning
  - すべてのアラームにSNS通知設定

#### 2. CDKスタックへの統合
- **ファイル**: `cdk/lib/tdnet-data-collector-stack.ts`
- すべてのLambda関数（7個）を監視対象として設定
- 環境別のアラーム名設定（dev/staging/prod）
- CloudFormation Outputsでアラーム数を出力

#### 3. テスト作成
- **ファイル**: `cdk/__tests__/cloudwatch-alarms.test.ts`
- 12個のテストケース作成:
  - SNS Topic作成確認
  - メール通知設定確認
  - Lambda Error Rate/Duration/Throttlesアラーム確認
  - カスタムメトリクスアラーム確認
  - 複数Lambda関数対応確認
  - SNSアクション設定確認
  - デフォルト/カスタム閾値確認
- **テスト結果**: ✅ 12/12 passed

#### 4. 技術的な課題と解決策

**課題1**: CDK IDにトークン（未解決値）を使用できない
- **エラー**: `ValidationError: ID components may not include unresolved tokens: ${Token[TOKEN.20]}-ErrorRateAlarm`
- **原因**: `lambdaFunction.functionName`はデプロイ時に解決される値（トークン）
- **解決策**: 静的なID（`LambdaFunction${index}ErrorRateAlarm`）を使用

**課題2**: テストでトークンを含むプロパティを検証できない
- **エラー**: `AlarmName`と`AlarmDescription`が`Fn::Join`オブジェクトになる
- **原因**: Lambda関数名を含む文字列がCloudFormation組み込み関数に変換される
- **解決策**: `Match.anyValue()`を使用してトークンを許容

## 成果物

### 作成ファイル
1. `cdk/lib/constructs/cloudwatch-alarms.ts` - CloudWatch Alarmsコンストラクト
2. `cdk/__tests__/cloudwatch-alarms.test.ts` - テストファイル

### 変更ファイル
1. `cdk/lib/tdnet-data-collector-stack.ts` - CloudWatch Alarms統合

### アラーム設定詳細

| アラーム種類 | 閾値 | 評価期間 | 重要度 |
|------------|------|---------|--------|
| Lambda Error Rate | 10% | 5分 | Critical |
| Lambda Duration | 840秒（14分） | 5分×2回 | Warning |
| Lambda Throttles | 1回 | 5分 | Critical |
| CollectionSuccessRate | 95% | 1時間 | Warning |
| NoDataCollected | 1件未満 | 24時間 | Critical |
| CollectionFailure | 10件超 | 24時間 | Warning |

### 監視対象Lambda関数（7個）
1. `tdnet-collector-{env}` - データ収集
2. `tdnet-query-{env}` - クエリAPI
3. `tdnet-export-{env}` - エクスポート
4. `tdnet-collector-{env}` - 収集トリガー
5. `tdnet-collect-status-{env}` - 収集状態確認
6. `tdnet-export-status-{env}` - エクスポート状態確認
7. `tdnet-pdf-download-{env}` - PDF署名付きURL生成

## 申し送り事項

### 次のステップ
1. **メール通知設定**: SNS Topicにメールアドレスを追加
   - スタック作成時に`alertEmail`パラメータを指定
   - 例: `alertEmail: 'your-email@example.com'`

2. **Slack通知追加（オプション）**: Lambda経由でSlack通知を実装
   - `monitoring-alerts.md`の「Slack通知の実装」セクション参照

3. **CloudWatch Dashboard作成（タスク16.4）**: 
   - メトリクスの可視化
   - アラーム状態の一覧表示

### 注意事項
- アラーム閾値はデフォルト値を使用（カスタマイズ可能）
- カスタムメトリクス（`TDnet/Collector`）はLambda関数から送信が必要
- SNS Topicのサブスクリプション確認メールに応答が必要

## テスト結果

```
PASS  cdk/__tests__/cloudwatch-alarms.test.ts
  CloudWatchAlarms Construct
    ✓ SNS Topicが作成されること (505 ms)
    ✓ メール通知が設定されること (230 ms)
    ✓ Lambda Error Rateアラームが作成されること (224 ms)
    ✓ Lambda Durationアラームが作成されること (243 ms)
    ✓ Lambda Throttlesアラームが作成されること (245 ms)
    ✓ CollectionSuccessRateアラームが作成されること (274 ms)
    ✓ NoDataCollectedアラームが作成されること (281 ms)
    ✓ CollectionFailureアラームが作成されること (280 ms)
    ✓ 複数のLambda関数に対してアラームが作成されること (295 ms)
    ✓ すべてのアラームにSNSアクションが設定されること (283 ms)
    ✓ デフォルト閾値が正しく設定されること (281 ms)
    ✓ カスタム閾値が正しく設定されること (293 ms)

Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
Time:        4.089 s
```

## 完了日時

2026-02-08 20:50
