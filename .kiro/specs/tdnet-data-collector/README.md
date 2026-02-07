# TDnet Data Collector - 設計ドキュメント

このフォルダには、TDnet Data Collectorプロジェクトの設計ドキュメントとテンプレートが含まれています。

## フォルダ構成

```
.kiro/specs/tdnet-data-collector/
├── .config.kiro                 # Kiro IDE設定ファイル
├── README.md                    # このファイル
├── tasks.md                     # 実装タスク管理
├── docs/                        # ドキュメント
│   ├── requirements.md          # 要件定義書
│   ├── design.md                # 設計書
│   ├── openapi.yaml             # OpenAPI 3.0仕様
│   └── implementation-checklist.md  # 実装開始前チェックリスト
├── improvements/                # 改善履歴
│   ├── README.md                # 改善履歴の記録方法
│   ├── create-improvement.ps1   # 改善履歴ファイル作成スクリプト
│   └── *.md                     # 各改善記録
└── templates/                   # テンプレートファイル
    ├── package.json.example     # package.jsonのテンプレート
    └── github-workflows/        # GitHub Actionsワークフロー
        ├── test.yml             # テストワークフロー
        ├── deploy.yml           # デプロイワークフロー
        └── dependency-update.yml # 依存関係更新ワークフロー
```

## 設定ファイル

### .config.kiro
Kiro IDE用の設定ファイル。以下の設定が含まれます：
- **generationMode**: "requirements-first" - 要件定義から設計を生成するモード

**編集方法:**
通常は編集不要です。Kiro IDEが自動的に管理します。Spec生成モードを変更する場合のみ、手動で編集してください。

## ドキュメント

### docs/requirements.md
プロジェクトの要件定義書（要件1-15）。すべての機能要件と非機能要件が記載されています。

### docs/design.md
システムの詳細設計書。以下の内容を含みます：
- アーキテクチャ図
- コンポーネント設計
- データモデル
- API仕様
- Correctness Properties（1-15）
- CI/CDパイプライン設計
- コスト見積もり
- パフォーマンスベンチマーク目標
- データ保持ポリシー

### docs/openapi.yaml
REST APIの完全なOpenAPI 3.0仕様。以下を含みます：
- 全エンドポイント定義
- リクエスト/レスポンススキーマ
- エラーレスポンス定義
- 認証スキーム

### docs/implementation-checklist.md
実装開始前に確認すべき16カテゴリ、100項目以上のチェックリスト。

### docs/correctness-properties-checklist.md
設計検証のための15個のCorrectness Properties。

### docs/environment-setup.md
開発環境のセットアップ手順（local/dev/prod環境）。

### docs/troubleshooting.md
よくある問題と解決策をまとめたトラブルシューティングガイド。以下を含みます：
- Lambda関連の問題
- DynamoDB関連の問題
- S3関連の問題
- スクレイピング関連の問題
- API Gateway関連の問題
- CDK/デプロイ関連の問題
- 監視・ログ関連の問題
- ネットワーク関連の問題

### docs/metrics-and-kpi.md
プロジェクトの成功指標、パフォーマンスメトリクス、KPI定義。以下を含みます：
- 主要KPI（収集成功率、実行時間、コスト、エラー率、可用性）
- 収集メトリクス
- パフォーマンスメトリクス
- コストメトリクス
- 品質メトリクス
- 可用性メトリクス
- CloudWatchメトリクス対応表
- フェーズ別目標値

## 改善履歴

### improvements/
タスク実行後のフィードバックループで発見された問題と実施した改善の記録。

- **README.md** - 改善履歴の記録方法
- **create-improvement.ps1** - 改善履歴ファイル作成スクリプト
- **task-*-improvement-*.md** - 各タスクの改善記録
- **specs-*.md** - 仕様書の改善記録
- **steering-*.md** - steeringファイルの改善記録

詳細は`improvements/README.md`を参照してください。

## テンプレートファイル

### templates/package.json.example
プロジェクトのpackage.jsonテンプレート。以下を含みます：
- 必要な依存関係
- npm scriptsの定義
- テスト設定

### templates/.env.example
環境変数テンプレート。以下の環境別設定を含みます：
- AWS設定（リージョン、プロファイル）
- DynamoDB/S3設定
- TDnetスクレイピング設定
- Lambda設定
- API設定
- 通知・監視設定
- セキュリティ設定

**使用方法:**
```bash
# 開発環境用
cp templates/.env.example .env.development

# 本番環境用
cp templates/.env.example .env.production

# 環境変数を編集
# 注意: .env.* ファイルは .gitignore に追加してください
```

### templates/cdk.context.json.example
CDK Context設定テンプレート。環境別（development, staging, production）の設定を含みます：
- AWSアカウント・リージョン
- Lambda設定（タイムアウト、メモリ）
- DynamoDB設定（課金モード、PITR）
- S3設定（バージョニング、ライフサイクル）
- 監視設定（メトリクス、アラート）
- API設定（レート制限）
- セキュリティ設定（WAF、CloudTrail）

**使用方法:**
```bash
# プロジェクトルートにコピー
cp templates/cdk.context.json.example cdk.context.json

# 環境を指定してデプロイ
cdk deploy --context environment=development
```

### templates/test-fixtures/
テスト用のサンプルデータとフィクスチャ：
- サンプル開示情報JSONデータ
- モックTDnetレスポンスHTML
- プロパティテスト用Arbitrary定義

### templates/github-workflows/
GitHub Actionsワークフローのテンプレート。実装時に`.github/workflows/`ディレクトリにコピーしてください：

```bash
# 実装時の配置方法
cp templates/github-workflows/test.yml .github/workflows/test.yml
cp templates/github-workflows/deploy.yml .github/workflows/deploy.yml
cp templates/github-workflows/dependency-update.yml .github/workflows/dependency-update.yml
```


## 実装開始手順

### 1. チェックリストの確認
```bash
# docs/implementation-checklist.mdを開いて、すべての項目を確認
```

### 2. プロジェクトの初期化
```bash
# GitHubリポジトリの作成
git init
git remote add origin <your-repo-url>

# package.jsonの作成
cp templates/package.json.example package.json

# 依存関係のインストール
npm install
```

### 3. CI/CDの設定
```bash
# GitHub Actionsワークフローの配置
mkdir -p .github/workflows
cp templates/github-workflows/test.yml .github/workflows/test.yml
cp templates/github-workflows/deploy.yml .github/workflows/deploy.yml
cp templates/github-workflows/dependency-update.yml .github/workflows/dependency-update.yml

# GitHub Secretsの設定（GitHub UIで実施）
# - AWS_ROLE_ARN
# - API_ENDPOINT
# - API_KEY
# - SLACK_WEBHOOK (オプション)
```

### 4. CDKプロジェクトの初期化
```bash
# CDKプロジェクトの初期化
npx cdk init app --language typescript

# 最初のコミット
git add .
git commit -m "chore: initial commit"
git push origin main
```

### 5. 実装開始
Phase 1（基本機能）から実装を開始してください。詳細は`docs/design.md`を参照。

## 関連ドキュメント

プロジェクトルートの`.kiro/steering/`フォルダに以下のガイドラインがあります：

### 実装ガイド
- `tdnet-implementation-rules.md` - 実装ルールとベストプラクティス
- `tdnet-scraping-patterns.md` - TDnetスクレイピングのパターン
- `error-handling-patterns.md` - エラーハンドリングパターン
- `data-validation.md` - データバリデーションルール
- `performance-optimization.md` - パフォーマンス最適化戦略

### API・設計ガイド
- `api-design-guidelines.md` - RESTful API設計ガイドライン
- `testing-strategy.md` - テスト戦略とベストプラクティス

### 運用ガイド
- `deployment-checklist.md` - デプロイチェックリスト
- `security-best-practices.md` - セキュリティベストプラクティス
- `monitoring-alerts.md` - 監視とアラート設定
- `environment-variables.md` - 環境変数一覧

### タスク管理
- `tdnet-data-collector.md` - タスク実行ルールとフィードバックループ

### 仕様書との対応関係

| 仕様書 | 関連するsteeringファイル |
|--------|------------------------|
| `requirements.md` | すべてのsteeringファイル（要件を実装するためのガイドライン） |
| `design.md` | `tdnet-implementation-rules.md`, `api-design-guidelines.md`, `performance-optimization.md` |
| `openapi.yaml` | `api-design-guidelines.md`, `error-handling-patterns.md` |
| `implementation-checklist.md` | すべてのsteeringファイル |
| `correctness-properties-checklist.md` | `testing-strategy.md`, `data-validation.md` |
| `environment-setup.md` | `environment-variables.md`, `deployment-checklist.md` |

### ドキュメント依存関係図

```
requirements.md (要件定義)
    ↓
design.md (設計書)
    ↓
    ├─→ openapi.yaml (API仕様)
    ├─→ correctness-properties-checklist.md (検証項目)
    └─→ implementation-checklist.md (実装前チェック)
         ↓
         └─→ environment-setup.md (環境構築)
              ↓
              └─→ steering files (実装ガイドライン)
```

## サポート

質問や問題がある場合は、以下を確認してください：

1. `docs/design.md`の該当セクション
2. `.kiro/steering/`の関連ガイドライン
3. `docs/implementation-checklist.md`の確認項目

## ライセンス

MIT License
