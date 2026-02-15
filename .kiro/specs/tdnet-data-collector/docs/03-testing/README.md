# 03-testing - テストドキュメント

**最終更新**: 2026-02-15

## フォルダの目的

テスト環境構築、E2Eテスト、負荷テスト、スモークテストに関するドキュメントを管理します。

---

## ファイル一覧

### 1. localstack-setup.md
**目的**: LocalStack環境構築ガイド

**内容**:
- LocalStackのインストール手順
- Docker Compose設定
- セットアップスクリプトの実行方法
- DynamoDB/S3リソースの作成
- トラブルシューティング

**対象者**: 開発者（ローカル環境でのテスト実施）

---

### 2. e2e-test-guide.md
**目的**: E2Eテスト実行ガイド

**内容**:
- LocalStack環境でのE2Eテスト実行方法
- 実装済みテストケース一覧（28テストケース）
- Query Lambda E2Eテスト（12テストケース）
- Export Lambda E2Eテスト（16テストケース）
- APIキー認証テスト
- 環境変数設定

**対象者**: 開発者（機能追加・変更時のテスト実施）

---

### 3. smoke-test-guide.md
**目的**: スモークテスト手順書

**内容**:
- デプロイ後の基本機能確認手順
- インフラ確認（CloudFormation、Lambda、DynamoDB、S3）
- API動作確認（ヘルスチェック、統計情報、開示情報検索）
- データ収集テスト
- エクスポート機能テスト
- 監視・アラート確認
- Webダッシュボード確認

**対象者**: 開発者・運用担当者（デプロイ後の動作確認）

---

### 4. load-testing-guide.md
**目的**: 負荷テストガイド

**内容**:
- 負荷テストシナリオ（5シナリオ）
  - 大量データ収集（100件以上）
  - 同時API呼び出し（10並列）
  - エクスポート同時実行（5並列）
  - レート制限の確認
  - エラーハンドリングの確認
- テスト実行方法
- パフォーマンス目標
- トラブルシューティング

**対象者**: 開発者・運用担当者（パフォーマンス確認）

---

## 推奨される読み順

### 初回セットアップ時
1. **localstack-setup.md** - LocalStack環境を構築
2. **e2e-test-guide.md** - E2Eテストを実行して動作確認

### 開発中
- **e2e-test-guide.md** - 機能追加・変更時にE2Eテストを実行

### デプロイ後
1. **smoke-test-guide.md** - デプロイ後の基本機能を確認
2. **load-testing-guide.md** - パフォーマンスを確認（必要に応じて）

---

## 関連ドキュメント

- **上位ドキュメント**: [../README.md](../README.md) - ドキュメント全体の構造
- **デプロイ**: [../04-deployment/](../04-deployment/) - デプロイ手順
- **運用**: [../05-operations/](../05-operations/) - 運用ガイド
- **Steering Files**: [../../../../.kiro/steering/development/testing-strategy.md](../../../../.kiro/steering/development/testing-strategy.md) - テスト戦略

---

## テスト実行コマンド早見表

```powershell
# LocalStack起動
docker-compose up -d

# LocalStackセットアップ
.\scripts\localstack-setup.ps1

# E2Eテスト実行
npm run test:e2e

# スモークテスト実行（デプロイ後）
.\scripts\smoke-test.ps1 -Environment dev

# LocalStack停止
docker-compose down
```

---

**最終更新**: 2026-02-15  
**作成者**: TDnet Data Collector Team
