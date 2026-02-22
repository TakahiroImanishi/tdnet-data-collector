# 作業記録: タスク27.1.4-5 コスト・リスク管理ドキュメント作成

**作業日時**: 2026-02-14 08:33:39  
**担当**: AI Assistant  
**タスク**: タスク27.1.4（コスト管理の準備）、タスク27.1.5（リスク管理の文書化）

## 作業概要

コスト管理とリスク管理のドキュメントを作成し、運用準備を整える。

## 作業内容

### 1. AWS Budgetsの設定手順書作成
- [x] `docs/aws-budgets-setup.md` 作成
  - AWS Budgetsの設定手順
  - 予算額の設定（月次、年次）
  - アラート閾値の設定（50%, 80%, 100%）
  - SNS通知設定

### 2. コストアラートの設定手順書作成
- [x] `docs/cost-monitoring.md` 作成
  - コストアラートの設定手順
  - Cost Explorerの使用方法
  - 月次コストレポートの作成方法
  - コスト最適化のベストプラクティス

### 3. 技術的リスクと対策をREADMEに追記
- [x] README.mdに技術的リスクセクション追加
  - TDnetのHTML構造変更リスク
  - AWS Lambda実行時間制限リスク
  - DynamoDBスロットリングリスク
  - 各リスクの対策を明記

### 4. 外部依存リスクの監視方法をドキュメント化
- [x] `docs/external-dependency-monitoring.md` 作成
  - TDnet可用性の監視方法
  - エラー率の監視
  - アラート設定

## 問題と解決策

特に問題なく作業完了。

## 成果物

### 作成したドキュメント

1. **docs/aws-budgets-setup.md** (約2,000行)
   - AWS Budgetsの設定手順（Console/CLI両方）
   - SNS通知トピックの作成
   - 月次・年次予算の設定
   - アラート閾値の設定（50%, 80%, 100%）
   - 予算額の推奨設定（開発環境: $5/月、本番環境: $10/月）
   - トラブルシューティング
   - ベストプラクティス

2. **docs/cost-monitoring.md** (約2,500行)
   - Cost Explorerの使用方法
   - CloudWatchダッシュボードでのコスト監視
   - 月次コストレポートの作成（AWS Cost and Usage Reports）
   - Lambda関数での自動レポート生成
   - コスト最適化のベストプラクティス（Lambda、DynamoDB、S3、CloudWatch Logs、API Gateway）
   - コスト異常の検知と対応フロー
   - 定期的なコストレビューチェックリスト

3. **docs/external-dependency-monitoring.md** (約3,000行)
   - TDnet Webサイトの可用性監視
   - CloudWatch Syntheticsによる監視（Canaryスクリプト）
   - Lambda関数内でのカスタムメトリクス記録
   - CloudWatchダッシュボードの作成
   - アラート設定（可用性、レスポンス時間、エラー率）
   - 障害発生時の対応フロー
   - 定期的な監視レビューチェックリスト

4. **README.md** (リスク管理セクション追加)
   - 技術的リスクと対策
     - TDnetのHTML構造変更リスク
     - AWS Lambda実行時間制限リスク
     - DynamoDBスロットリングリスク
   - 外部依存リスク（TDnet可用性）
   - コスト管理（AWS無料枠超過リスク）
   - セキュリティリスク

### ドキュメントの特徴

- **実用性重視**: すぐに実行できるコマンド例を豊富に記載
- **段階的な説明**: 初心者でも理解できるステップバイステップの手順
- **トラブルシューティング**: よくある問題と解決方法を記載
- **ベストプラクティス**: AWS公式のベストプラクティスに準拠
- **コード例**: TypeScript/CDKのコード例を豊富に記載
- **相互参照**: 関連ドキュメントへのリンクを明記

## 申し送り事項

### 次のステップ

1. **AWS Budgetsの実際の設定**
   - `docs/aws-budgets-setup.md` の手順に従ってAWS Budgetsを設定
   - SNSトピックの作成とメールサブスクリプション
   - 月次予算の設定（開発環境: $5、本番環境: $10）

2. **CloudWatch Syntheticsの実装**
   - `docs/external-dependency-monitoring.md` のCanaryスクリプトをCDKに実装
   - TDnetメインページとリストページの監視を開始

3. **コスト監視の自動化**
   - `docs/cost-monitoring.md` の月次レポート生成Lambda関数を実装
   - EventBridgeスケジュールで毎月1日に自動実行

4. **定期的なレビュー**
   - 週次: CloudWatch Syntheticsの成功率確認
   - 月次: コストレポートの確認と予算の見直し

### 注意事項

- AWS Budgetsの設定は、AWSアカウントのルートユーザーまたは適切な権限を持つIAMユーザーで実行してください
- SNS通知のメールアドレスは、必ず確認リンクをクリックして有効化してください
- CloudWatch Syntheticsは、Lambda関数として実行されるため、コストが発生します（無料枠: 100 Canary実行/月）
- コスト監視のLambda関数は、Cost Explorer APIを使用するため、APIコストが発生します（$0.01/リクエスト）
