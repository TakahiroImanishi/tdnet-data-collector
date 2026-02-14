# CI/CD Workflow Guide

**作成日**: 2026-02-08  
**目的**: GitHub ActionsでのE2Eテスト自動実行ワークフローの使用方法

---

## 概要

TDnet Data Collectorプロジェクトには、2つのGitHub Actionsワークフローが用意されています：

1. **ci.yml** - 包括的なCI/CDパイプライン（コード品質 + E2E）
2. **e2e-test.yml** - E2Eテスト専用（詳細レポート + アーティファクト管理）

---

## ワークフローの比較

| 項目 | ci.yml | e2e-test.yml |
|------|--------|--------------|
| **目的** | 包括的なCI/CD | E2Eテスト専用 |
| **実行内容** | Lint + Format + Build + Unit + E2E | E2Eテストのみ |
| **LocalStack** | GitHub Actions Services | Docker Compose |
| **レポート** | 基本的な統計 | 詳細なJSON解析 |
| **アーティファクト** | テスト結果 | テスト結果 + ログ + 環境情報 |
| **実行時間** | 15-30分 | 10-20分 |
| **推奨用途** | プルリクエスト時 | E2Eテスト開発・デバッグ時 |

---

## e2e-test.yml の特徴

### 1. 堅牢なLocalStack起動

```yaml
- name: Start LocalStack
  run: docker-compose up -d

- name: Wait for LocalStack to be ready
  run: |
    timeout 120 bash -c 'until curl -f http://localhost:4566/_localstack/health; do 
      sleep 5
    done'
```

### 2. 自動リソース作成

- DynamoDBテーブル（2つ）を自動作成
- S3バケット（2つ）を自動作成
- エラーハンドリング（既存リソースの場合は警告のみ）

### 3. 詳細なテストレポート

- JSON形式のテスト結果を解析
- GitHub Summaryに統計情報を表示
- 失敗したテストの詳細を表示

### 4. 包括的なアーティファクト収集

- LocalStackログを保存
- テスト結果（JSON）を保存
- 環境情報（Node.js、npm、OS、コミット）を保存
- 保存期間: 30日

### 5. 自動クリーンアップ

- テスト成功・失敗に関わらず実行
- ボリュームも削除（-v）
- 次回実行時にクリーンな状態から開始

---

## 使用方法

### 自動実行（推奨）

ワークフローは以下のタイミングで自動実行されます：

1. **プルリクエスト作成時**
   ```bash
   git checkout -b feature/new-feature
   git push origin feature/new-feature
   # GitHub上でプルリクエストを作成
   ```

2. **プルリクエスト更新時**
   ```bash
   git commit -m "Update feature"
   git push origin feature/new-feature
   ```

3. **mainブランチへのプッシュ時**
   ```bash
   git push origin main
   ```

### 手動実行

GitHub Actionsの画面から手動実行も可能です：

1. GitHubリポジトリの「Actions」タブを開く
2. 「E2E Tests with LocalStack」ワークフローを選択
3. 「Run workflow」ボタンをクリック
4. ブランチを選択して「Run workflow」を実行

---

## テスト結果の確認

### GitHub Summary

ワークフロー実行後、GitHub Summaryに以下の情報が表示されます：

```
# 🧪 E2E Test Results

## Summary

- **Total Tests**: 28
- **Passed**: ✅ 28
- **Failed**: ❌ 0
- **Duration**: 15.3s

## ✅ All Tests Passed!
```

### アーティファクトのダウンロード

1. ワークフロー実行ページを開く
2. 「Artifacts」セクションを確認
3. 以下のアーティファクトをダウンロード可能：
   - **e2e-test-artifacts**: ログ、環境情報
   - **e2e-test-results**: テスト結果（JSON）

---

## トラブルシューティング

| 問題 | 原因 | 解決策 |
|------|------|--------|
| LocalStackが起動しない | Docker Composeの起動失敗 | docker-compose.ymlの設定を確認 |
| テーブル作成に失敗 | LocalStackの起動未完了 | LocalStackのヘルスチェックを確認 |
| テストがタイムアウト | LocalStackの応答遅延 | jest.config.e2e.jsのtestTimeoutを延長 |
| JSON結果が生成されない | Jestの実行失敗 | npm run test:e2eコマンドを確認 |

---

## ベストプラクティス

### 1. プルリクエスト前にローカルでテスト

```powershell
# LocalStackを起動
docker-compose up -d

# セットアップスクリプトを実行
.\scripts\localstack-setup.ps1

# E2Eテストを実行
npm run test:e2e

# LocalStackを停止
docker-compose down -v
```

### 2. テスト失敗時はアーティファクトを確認

1. GitHub Actionsのワークフロー実行ページを開く
2. 「Artifacts」セクションから「e2e-test-artifacts」をダウンロード
3. `logs/localstack.log`を確認
4. `environment.txt`で環境情報を確認

### 3. 定期的にワークフローを実行

- 週1回、手動でワークフローを実行
- 依存関係の更新後は必ず実行
- LocalStackのバージョン更新後は必ず実行

---

## 次のステップ

### Phase 4: CI/CDパイプライン構築（タスク25）

e2e-test.ymlとci.ymlを統合し、以下を実装予定：

1. **デプロイワークフロー**
   - 開発環境への自動デプロイ
   - 本番環境への手動承認デプロイ

2. **セキュリティスキャン**
   - 依存関係の脆弱性スキャン
   - コードの静的解析

3. **通知機能**
   - Slack通知
   - メール通知

---

## まとめ

e2e-test.ymlワークフローは、LocalStackを使用したE2Eテストの自動実行を提供します。詳細なレポートとアーティファクト管理により、テスト失敗時のデバッグが容易になります。

**推奨される使用方法:**
- プルリクエスト時: 自動実行（ci.yml）
- E2Eテスト開発時: 手動実行（e2e-test.yml）
- デバッグ時: アーティファクトをダウンロードして詳細確認

**関連ドキュメント:**
- [CI/CD設定ガイド](./ci-cd-setup.md)
- [環境構築ガイド](./environment-setup.md)
- [GitHub Actions公式ドキュメント](https://docs.github.com/en/actions)

