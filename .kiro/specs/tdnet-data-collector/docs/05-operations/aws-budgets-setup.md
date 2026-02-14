# AWS Budgets 設定手順書

## 概要

AWS Budgetsを使用して、TDnet Data Collectorプロジェクトのコストを監視し、予算超過を防ぐためのアラートを設定します。

## 前提条件

- AWSアカウントへのアクセス権限
- AWS Budgetsの作成権限
- SNSトピックの作成権限（アラート通知用）

## 設定手順

### 1. SNS通知トピックの作成

予算アラートを受信するためのSNSトピックを作成します。

```bash
# SNSトピックの作成
aws sns create-topic --name tdnet-budget-alerts

# メールアドレスをサブスクライブ
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-northeast-1:YOUR_ACCOUNT_ID:tdnet-budget-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

**注意**: サブスクライブ後、メールで確認リンクが送信されるので、必ず確認してください。

### 2. 月次予算の設定

#### AWS Management Consoleでの設定

1. **AWS Budgetsコンソールにアクセス**
   - https://console.aws.amazon.com/billing/home#/budgets

2. **予算の作成**
   - 「予算を作成」をクリック
   - 予算タイプ: 「コスト予算」を選択

3. **予算の詳細設定**
   - 予算名: `tdnet-data-collector-monthly`
   - 期間: 月次
   - 予算額: `$5.00`（AWS無料枠を考慮した目標額）
   - 開始月: 現在の月

4. **アラート閾値の設定**

   **アラート1: 50%到達時（警告）**
   - しきい値: 50%
   - 通知先: 作成したSNSトピック
   - メッセージ: 「TDnet Data Collector: 月次予算の50%に到達しました」

   **アラート2: 80%到達時（注意）**
   - しきい値: 80%
   - 通知先: 作成したSNSトピック
   - メッセージ: 「TDnet Data Collector: 月次予算の80%に到達しました。コスト確認が必要です」

   **アラート3: 100%到達時（緊急）**
   - しきい値: 100%
   - 通知先: 作成したSNSトピック
   - メッセージ: 「TDnet Data Collector: 月次予算を超過しました。即座の対応が必要です」

5. **予算の確認と作成**
   - 設定内容を確認
   - 「予算を作成」をクリック

#### AWS CLIでの設定

```bash
# 予算設定ファイルの作成
cat > budget-monthly.json << 'EOF'
{
  "BudgetName": "tdnet-data-collector-monthly",
  "BudgetType": "COST",
  "TimeUnit": "MONTHLY",
  "BudgetLimit": {
    "Amount": "5.0",
    "Unit": "USD"
  },
  "CostFilters": {},
  "CostTypes": {
    "IncludeTax": true,
    "IncludeSubscription": true,
    "UseBlended": false,
    "IncludeRefund": false,
    "IncludeCredit": false,
    "IncludeUpfront": true,
    "IncludeRecurring": true,
    "IncludeOtherSubscription": true,
    "IncludeSupport": true,
    "IncludeDiscount": true,
    "UseAmortized": false
  }
}
EOF

# 予算の作成
aws budgets create-budget \
  --account-id YOUR_ACCOUNT_ID \
  --budget file://budget-monthly.json

# アラート設定ファイルの作成（50%）
cat > notification-50.json << 'EOF'
{
  "Notification": {
    "NotificationType": "ACTUAL",
    "ComparisonOperator": "GREATER_THAN",
    "Threshold": 50,
    "ThresholdType": "PERCENTAGE"
  },
  "Subscribers": [
    {
      "SubscriptionType": "SNS",
      "Address": "arn:aws:sns:ap-northeast-1:YOUR_ACCOUNT_ID:tdnet-budget-alerts"
    }
  ]
}
EOF

# アラートの作成（50%）
aws budgets create-notification \
  --account-id YOUR_ACCOUNT_ID \
  --budget-name tdnet-data-collector-monthly \
  --notification file://notification-50.json \
  --subscribers SubscriptionType=SNS,Address=arn:aws:sns:ap-northeast-1:YOUR_ACCOUNT_ID:tdnet-budget-alerts
```

### 3. 年次予算の設定

年間のコスト上限を設定します。

1. **予算の作成**
   - 予算名: `tdnet-data-collector-yearly`
   - 期間: 年次
   - 予算額: `$60.00`（月次$5.00 × 12ヶ月）

2. **アラート閾値の設定**
   - 75%到達時: 警告
   - 90%到達時: 注意
   - 100%到達時: 緊急

## 予算額の推奨設定

### 無料枠内での運用（推奨）

| サービス | 無料枠 | 想定使用量 | 月次コスト |
|---------|--------|-----------|-----------|
| Lambda | 100万リクエスト/月 | 50万リクエスト | $0.00 |
| DynamoDB | 25GB、25WCU/RCU | 10GB、10WCU/RCU | $0.00 |
| S3 | 5GB | 2GB | $0.00 |
| CloudWatch Logs | 5GB | 2GB | $0.00 |
| **合計** | - | - | **$0.00-$2.00** |

### 本番運用時の想定コスト

| サービス | 想定使用量 | 月次コスト |
|---------|-----------|-----------|
| Lambda | 200万リクエスト | $0.40 |
| DynamoDB | 30GB、50WCU/RCU | $2.50 |
| S3 | 10GB | $0.23 |
| CloudWatch Logs | 10GB | $0.50 |
| API Gateway | 100万リクエスト | $3.50 |
| **合計** | - | **$7.13** |

**推奨予算設定**:
- 開発環境: $5.00/月
- 本番環境: $10.00/月（バッファ含む）

## アラート通知の確認

### メール通知の例

```
件名: AWS Budgets: tdnet-data-collector-monthly が予算の 50% に到達しました

本文:
AWS アカウント: YOUR_ACCOUNT_ID
予算名: tdnet-data-collector-monthly
期間: 2026年2月
予算額: $5.00
現在のコスト: $2.50 (50%)

詳細を確認するには、以下のリンクをクリックしてください:
https://console.aws.amazon.com/billing/home#/budgets
```

## トラブルシューティング

### アラートが届かない場合

1. **SNSサブスクリプションの確認**
   ```bash
   aws sns list-subscriptions-by-topic \
     --topic-arn arn:aws:sns:ap-northeast-1:YOUR_ACCOUNT_ID:tdnet-budget-alerts
   ```
   - ステータスが「Confirmed」であることを確認

2. **予算アラートの設定確認**
   ```bash
   aws budgets describe-notifications-for-budget \
     --account-id YOUR_ACCOUNT_ID \
     --budget-name tdnet-data-collector-monthly
   ```

3. **メールのスパムフォルダを確認**
   - AWS通知メールがスパムに分類されていないか確認

### 予算の変更

```bash
# 予算額の更新
aws budgets update-budget \
  --account-id YOUR_ACCOUNT_ID \
  --new-budget file://budget-monthly-updated.json
```

## ベストプラクティス

1. **複数のアラート閾値を設定**
   - 早期警告（50%）、注意（80%）、緊急（100%）

2. **定期的な予算の見直し**
   - 月次でコストを確認し、予算額を調整

3. **タグベースの予算管理**
   - 環境別（dev/prod）にタグを付けて予算を分離

4. **コスト異常検知の有効化**
   - AWS Cost Anomaly Detectionを併用

## 関連ドキュメント

- [コスト監視ガイド](./cost-monitoring.md)
- [外部依存監視ガイド](./external-dependency-monitoring.md)
- [AWS Budgets公式ドキュメント](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)
