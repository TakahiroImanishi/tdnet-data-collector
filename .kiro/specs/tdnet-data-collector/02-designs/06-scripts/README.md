# 06-scripts - スクリプトドキュメント

**最終更新**: 2026-02-15

## 📋 概要

TDnet Data Collectorの運用スクリプトに関するドキュメント集です。デプロイスクリプト、セットアップスクリプト、データ操作スクリプト、監視スクリプトの使用方法をカバーしています。

---

## 📁 ファイル一覧

### 1. [scripts-overview.md](./scripts-overview.md)
**スクリプト概要**

すべての運用スクリプトの概要と分類をまとめたドキュメントです。

- スクリプト分類（デプロイ、セットアップ、データ操作、監視）
- 各スクリプトの目的と使用タイミング
- スクリプト実行の前提条件
- スクリプト実行時の注意事項

**対象者**: すべての運用担当者  
**推奨**: 最初に読むべきドキュメント

---

### 2. [deployment-scripts.md](./deployment-scripts.md)
**デプロイスクリプト**

デプロイ関連のスクリプトの詳細な使用方法です。

**対象スクリプト**:
- `deploy-all.ps1` - 全スタックの一括デプロイ
- `deploy-foundation.ps1` - Foundationスタックのデプロイ
- `deploy-compute.ps1` - Computeスタックのデプロイ
- `deploy-api.ps1` - APIスタックのデプロイ
- `deploy-monitoring.ps1` - Monitoringスタックのデプロイ
- `deploy-split-stacks.ps1` - 分割スタックの順次デプロイ
- `deploy-dashboard.ps1` - Webダッシュボードのデプロイ

**内容**:
- 各スクリプトの使用方法
- パラメータ説明
- 実行例
- トラブルシューティング

**対象者**: システム管理者、開発者  
**推奨**: デプロイ実行前に参照

---

### 3. [setup-scripts.md](./setup-scripts.md)
**セットアップスクリプト**

環境セットアップ関連のスクリプトの詳細な使用方法です。

**対象スクリプト**:
- `create-api-key-secret.ps1` - APIキーシークレット作成
- `generate-env-file.ps1` - 環境変数ファイル生成
- `localstack-setup.ps1` - LocalStack環境セットアップ
- `fetch-data-range.ps1` - 期間指定データ収集
- `manual-data-collection.ps1` - 手動データ収集
- `migrate-disclosure-fields.ts` - DynamoDBフィールド移行
- `check-iam-permissions.ps1` - IAM権限確認

**内容**:
- 各スクリプトの使用方法
- パラメータ説明
- 実行例
- トラブルシューティング

**対象者**: システム管理者、開発者  
**推奨**: 初期セットアップ時、データ操作時に参照

---

## 📖 推奨される読み順

### 初めての開発者

1. **scripts-overview.md** - スクリプト全体の概要を理解
2. **setup-scripts.md** - 開発環境セットアップ方法を理解
3. **deployment-scripts.md** - デプロイ手順を理解

### システム管理者

1. **scripts-overview.md** - スクリプト全体の概要を理解
2. **deployment-scripts.md** - 本番デプロイ手順を理解
3. **setup-scripts.md** - データ操作・監視スクリプトを理解

### デプロイ実行時

1. **deployment-scripts.md** - 該当するデプロイスクリプトの使用方法を確認
2. **scripts-overview.md** - 前提条件と注意事項を確認

### データ操作時

1. **setup-scripts.md** - データ操作スクリプトの使用方法を確認
2. **scripts-overview.md** - 実行時の注意事項を確認

---

## 🔗 関連ドキュメント

- **上位ドキュメント**: [../README.md](../README.md) - docsフォルダ全体の構造
- **デプロイメント**: [../04-deployment/](../04-deployment/) - デプロイガイド
- **運用**: [../05-operations/](../05-operations/) - 運用マニュアル
- **Steering Files**: [../../.kiro/steering/](../../.kiro/steering/) - 実装ルール
- **実際のスクリプト**: [../../../scripts/](../../../scripts/) - スクリプト本体

---

## 📝 スクリプト実行の基本ルール

### 前提条件

すべてのスクリプト実行前に以下を確認してください：

- [ ] PowerShell 7.x以上がインストールされている
- [ ] AWS CLIが設定済み（`aws configure`）
- [ ] 適切なIAM権限がある
- [ ] Node.js 20.x以上がインストールされている（一部スクリプト）
- [ ] 実行するスクリプトのドキュメントを読んでいる

### 実行時の注意事項

- **本番環境**: 必ず事前にテスト環境で動作確認
- **バックアップ**: データ操作前に必ずバックアップを取得
- **ログ記録**: 実行結果をログファイルに保存
- **エラー処理**: エラー発生時は即座に実行を停止
- **ドライラン**: 可能な場合は `-WhatIf` オプションで事前確認

### トラブルシューティング

スクリプト実行時に問題が発生した場合：

1. エラーメッセージを確認
2. 該当スクリプトのドキュメントを参照
3. [../05-operations/troubleshooting.md](../05-operations/troubleshooting.md) を確認
4. 解決しない場合はシステム管理者に連絡

---

## 📝 メンテナンス

このフォルダのドキュメントは以下のタイミングで更新してください：

- 新しいスクリプトが追加された時
- スクリプトのパラメータが変更された時
- 使用方法が変更された時
- トラブルシューティング事例が増えた時
- 四半期ごとの定期レビュー時

---

**最終更新**: 2026-02-15  
**管理者**: Kiro AI Assistant
