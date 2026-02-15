# 05-operations - 運用ガイド

**最終更新**: 2026-02-15

## 📋 概要

TDnet Data Collectorの運用に関するドキュメント集です。監視、コスト管理、トラブルシューティング、バックアップ、日常運用タスクをカバーしています。

---

## 📁 ファイル一覧

### 1. [operations-manual.md](./operations-manual.md)
**運用マニュアル（包括的ガイド）**

日常運用のすべてを網羅した包括的なマニュアルです。

- デプロイ手順（開発環境・本番環境）
- 日常運用タスク（毎日・週次・月次）
- ログ確認方法（CloudWatch Logs、AWS CLI）
- アラート対応手順（5種類のアラーム対応）
- トラブルシューティング（よくある問題と解決策）
- 緊急時対応（ロールバック、データ再収集、システム停止）
- メンテナンス（月次・四半期・年次）
- セキュリティ運用（アクセス管理、監査ログ、インシデント対応）
- コスト管理（予算設定、コスト最適化）

**対象者**: システム管理者、運用担当者  
**推奨**: 最初に読むべきドキュメント

---

### 2. [monitoring-guide.md](./monitoring-guide.md)
**監視ガイド**

システムの監視戦略、メトリクス、KPI、外部依存監視をまとめたガイドです。

- 主要KPI（Top 5 KPI、収集成功率、パフォーマンス、品質、可用性）
- CloudWatchメトリクス（カスタムメトリクス3個、AWS標準メトリクス）
- 外部依存監視（TDnet監視、CloudWatch Synthetics、Lambda関数内監視）
- アラート設定（可用性、レスポンス時間、エラー率）
- ダッシュボード（CloudWatchダッシュボード作成）
- 障害発生時の対応フロー

**対象者**: 運用担当者、システム管理者  
**推奨**: 監視設定時に参照

---

### 3. [cost-monitoring.md](./cost-monitoring.md)
**コスト監視ガイド**

AWS無料枠内での運用を維持するためのコスト監視ガイドです。

- 月間コスト見積もり（サービス別、無料枠適用後）
- コスト最適化の提案（WAF、CloudWatch、Secrets Manager）
- AWS Budgets設定（月次予算、アラート閾値）
- Cost Explorerの使用方法（サービス別、日次トレンド、タグベース）
- CloudWatchダッシュボードでのコスト監視
- 月次コストレポートの自動生成
- コスト最適化のベストプラクティス
- コスト異常の検知と対応

**対象者**: システム管理者、運用担当者  
**推奨**: 月次レビュー時に参照

---

### 4. [troubleshooting.md](./troubleshooting.md)
**トラブルシューティングガイド**

開発・運用中に発生する可能性のある問題と解決策をまとめたガイドです。

- Lambda関連（タイムアウト、メモリ不足）
- DynamoDB関連（ConditionalCheckFailedException、スロットリング）
- S3関連（AccessDenied、NoSuchKey）
- スクレイピング関連（403 Forbidden、HTMLパースエラー）
- API Gateway関連（429 Too Many Requests、502 Bad Gateway）
- CDK/デプロイ関連（cdk deploy失敗）
- 監視・ログ関連（CloudWatch Logsにログが表示されない）
- ネットワーク関連（ECONNRESET）
- FAQ（よくある質問と回答）

**対象者**: 開発者、運用担当者、システム管理者  
**推奨**: 問題発生時に参照

---

### 5. [backup-strategy.md](./backup-strategy.md)
**バックアップ戦略**

データの再収集可能性と監査ログの長期保存を基本方針としたバックアップ戦略です。

- バックアップ方針（データ再収集による復旧）
- DynamoDBポイントインタイムリカバリ（過去35日間）
- S3バージョニング（すべてのバケット）
- CloudTrail監査ログ（7年間保存）
- 災害復旧手順（3つのシナリオ）
- バックアップ戦略の評価（長所・短所・推奨事項）

**対象者**: システム管理者  
**推奨**: 災害復旧計画策定時に参照

---

### 6. [lambda-power-tuning.md](./lambda-power-tuning.md)
**Lambda Power Tuning ガイド**

Lambda関数の最適なメモリサイズを測定するツールの使用方法です。

- インストール（Lambda Power Tuning State Machineのデプロイ）
- 使用方法（Collector、Query、Export Lambda関数の最適化）
- パラメータ説明（powerValues、num、payload、strategy）
- 結果の確認（実行状態、可視化URL）
- 推奨メモリサイズの適用（environment-config.ts更新）
- ベストプラクティス（定期的な再測定、実際のワークロードでテスト）
- トラブルシューティング

**対象者**: システム管理者、開発者  
**推奨**: パフォーマンス最適化時に参照

---

## 📖 推奨される読み順

### 初めての運用担当者

1. **operations-manual.md** - 運用全体の流れを理解
2. **monitoring-guide.md** - 監視設定と確認方法を理解
3. **troubleshooting.md** - よくある問題と解決策を把握
4. **cost-monitoring.md** - コスト管理方法を理解

### システム管理者

1. **operations-manual.md** - デプロイ手順とメンテナンスを理解
2. **backup-strategy.md** - バックアップとリストア手順を理解
3. **lambda-power-tuning.md** - パフォーマンス最適化方法を理解
4. **cost-monitoring.md** - コスト最適化戦略を理解

### 問題発生時

1. **troubleshooting.md** - 該当する問題の解決策を確認
2. **operations-manual.md** - 緊急時対応手順を確認
3. **monitoring-guide.md** - 障害発生時の対応フローを確認

---

## 🔗 関連ドキュメント

- **上位ドキュメント**: [../README.md](../README.md) - docsフォルダ全体の構造
- **デプロイメント**: [../04-deployment/](../04-deployment/) - デプロイ手順
- **スクリプト**: [../06-scripts/](../06-scripts/) - 運用スクリプト
- **Steering Files**: [../../.kiro/steering/](../../.kiro/steering/) - 実装ルール

---

## 📝 メンテナンス

このフォルダのドキュメントは以下のタイミングで更新してください：

- 新しい運用手順が追加された時
- トラブルシューティング事例が増えた時
- 監視設定が変更された時
- コスト構造が変更された時
- 四半期ごとの定期レビュー時

---

**最終更新**: 2026-02-15  
**管理者**: Kiro AI Assistant
