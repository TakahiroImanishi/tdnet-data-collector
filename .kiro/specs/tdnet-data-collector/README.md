# TDnet Data Collector - プロジェクト仕様書

このフォルダには、TDnet Data Collectorプロジェクトの仕様書、設計ドキュメント、作業記録、改善履歴が含まれています。

## 📁 フォルダ構成

```
.kiro/specs/tdnet-data-collector/
├── README.md                    # このファイル
├── docs/                        # 設計ドキュメント
│   ├── requirements.md          # 要件定義書（要件1-15）
│   ├── design.md                # 詳細設計書
│   ├── implementation-checklist.md  # 実装開始前チェックリスト（100項目以上）
│   ├── correctness-properties-checklist.md  # 設計検証項目（15項目）
│   ├── environment-setup.md     # 環境セットアップ手順
│   ├── troubleshooting.md       # トラブルシューティングガイド
│   └── metrics-and-kpi.md       # メトリクスとKPI定義
├── work-logs/                   # 作業記録（タスク実行履歴）
│   ├── README.md                # 作業記録の記録方法
│   ├── create-work-log.ps1      # 作業記録ファイル作成スクリプト
│   └── work-log-[YYYYMMDD-HHMMSS]-[作業概要].md  # 各作業記録
├── improvements/                # 改善履歴（フィードバックループ）
│   ├── README.md                # 改善履歴の記録方法
│   ├── create-improvement.ps1   # 改善履歴ファイル作成スクリプト
│   └── task-*-improvement-*.md  # 各改善記録
└── templates/                   # テンプレートファイル
    ├── package.json.example     # package.jsonのテンプレート
    ├── .env.example             # 環境変数テンプレート
    ├── cdk.context.json.example # CDK Context設定テンプレート
    ├── test-fixtures/           # テスト用フィクスチャ
    └── github-workflows/        # GitHub Actionsワークフロー
        ├── test.yml             # テストワークフロー
        ├── deploy.yml           # デプロイワークフロー
        └── dependency-update.yml # 依存関係更新ワークフロー
```

## 📚 ドキュメント体系

### プロジェクト全体の構造

```
TDnet Data Collector Project
│
├── .kiro/specs/tdnet-data-collector/  ← このフォルダ（仕様書・設計）
│   ├── docs/                          # 設計ドキュメント
│   ├── work-logs/                     # 作業記録
│   ├── improvements/                  # 改善履歴
│   └── templates/                     # テンプレート
│
├── .kiro/steering/                    # 実装ガイドライン
│   ├── core/                          # 基本ルール（常時読み込み）
│   ├── development/                   # 開発ガイドライン
│   ├── infrastructure/                # インフラ・デプロイ
│   ├── security/                      # セキュリティ
│   ├── api/                           # API設計
│   └── meta/                          # メタ情報
│
└── docs/                              # プロジェクトルートのドキュメント
    └── openapi.yaml                   # OpenAPI 3.0仕様
```

## 📖 設計ドキュメント (docs/)

### docs/requirements.md
プロジェクトの要件定義書（要件1-15）。すべての機能要件と非機能要件が記載されています。

**主要な要件:**
- 要件1-5: データ収集機能（TDnetスクレイピング、メタデータ保存、PDF保存）
- 要件6-10: API機能（検索、取得、ヘルスチェック）
- 要件11-15: 非機能要件（パフォーマンス、セキュリティ、監視、コスト最適化）

### docs/design.md
システムの詳細設計書。以下の内容を含みます：
- **アーキテクチャ**: サーバーレスアーキテクチャ（Lambda, DynamoDB, S3, API Gateway）
- **コンポーネント設計**: 各Lambda関数の責務と実装詳細
- **データモデル**: DynamoDB/S3のスキーマ設計
- **API仕様**: RESTful APIエンドポイント設計
- **Correctness Properties**: 15個の設計検証項目
- **CI/CDパイプライン**: GitHub Actions設定
- **コスト見積もり**: AWS無料枠を活用したコスト試算
- **パフォーマンスベンチマーク**: 目標値と測定方法
- **データ保持ポリシー**: データライフサイクル管理

### docs/implementation-checklist.md
実装開始前に確認すべき16カテゴリ、100項目以上のチェックリスト。

**主要カテゴリ:**
- プロジェクト初期化（Git, npm, CDK）
- AWS環境設定（IAM, リージョン、リソース制限）
- Lambda関数実装（エラーハンドリング、ログ、メトリクス）
- DynamoDB設計（テーブル設計、GSI、バックアップ）
- S3設定（バケット、ライフサイクル、暗号化）
- API Gateway設定（認証、レート制限、CORS）
- セキュリティ（IAM、暗号化、監査）
- 監視・アラート（CloudWatch、ログ、メトリクス）
- テスト戦略（ユニット、統合、E2E、プロパティテスト）
- CI/CD（GitHub Actions、デプロイ自動化）
- ドキュメント（README, API仕様、運用手順）
- コスト最適化（無料枠活用、リソース最適化）

### docs/correctness-properties-checklist.md
設計検証のための15個のCorrectness Properties。

**検証項目:**
- データ整合性（重複防止、メタデータとファイルの対応）
- エラーハンドリング（再試行、部分的失敗の許容）
- パフォーマンス（実行時間、スループット）
- セキュリティ（認証、暗号化、監査）
- 可用性（冗長性、障害復旧）
- コスト効率（無料枠活用、リソース最適化）

### docs/environment-setup.md
開発環境のセットアップ手順（local/dev/prod環境）。

**セットアップ内容:**
- Node.js, npm, AWS CLI, AWS CDKのインストール
- AWS認証情報の設定
- 環境変数の設定（.env.example からコピー）
- CDK Context設定（cdk.context.json.example からコピー）
- 依存関係のインストール
- ローカルテスト環境の構築

### docs/troubleshooting.md
よくある問題と解決策をまとめたトラブルシューティングガイド。

**カテゴリ:**
- Lambda関連（タイムアウト、メモリ不足、権限エラー）
- DynamoDB関連（スループット超過、条件チェック失敗）
- S3関連（アクセス拒否、バケット設定）
- スクレイピング関連（レート制限、HTML構造変更）
- API Gateway関連（CORS、認証、レート制限）
- CDK/デプロイ関連（スタック更新失敗、ロールバック）
- 監視・ログ関連（ログ出力、メトリクス、アラート）
- ネットワーク関連（タイムアウト、DNS解決）

### docs/metrics-and-kpi.md
プロジェクトの成功指標、パフォーマンスメトリクス、KPI定義。

**主要KPI:**
- 収集成功率: 95%以上
- 実行時間: 平均5分以内
- コスト: 月額$5以下（AWS無料枠活用）
- エラー率: 5%以下
- 可用性: 99.9%以上

**メトリクス分類:**
- 収集メトリクス（収集件数、成功率、失敗率）
- パフォーマンスメトリクス（実行時間、スループット）
- コストメトリクス（Lambda実行時間、DynamoDB読み書き、S3ストレージ）
- 品質メトリクス（エラー率、データ整合性）
- 可用性メトリクス（稼働率、障害復旧時間）
- CloudWatchメトリクス対応表
- フェーズ別目標値（Phase 1-3）

## 📝 作業記録 (work-logs/)

### 目的
各タスク実行時の作業履歴を記録し、実施内容、問題点、成果物を追跡可能にします。

### ファイル命名規則
```
work-log-[YYYYMMDD-HHMMSS]-[作業概要].md
```

**例:**
- `work-log-20260207-143025-steering-requirements-review.md`
- `work-log-20260207-150000-lambda-error-handling-implementation.md`
- `work-log-20260207-160000-api-design-guidelines-update.md`

### 🔴 重要: 時間の正確な取得

**作業記録のファイル名には、必ず現在時刻を正確に使用すること:**

```powershell
# Windows PowerShellで現在時刻を取得
Get-Date -Format "yyyyMMdd-HHmmss"
```

**禁止事項:**
- ❌ 推測や概算の時間を使用しない（例: `160000`, `150000`）
- ❌ 切りの良い時間を使用しない（例: `140000`, `150000`）
- ✅ 必ず `Get-Date` コマンドで取得した正確な時間を使用する
- ❌ 作業概要にスペース、アンダースコア、大文字、日本語を使用しない
- ✅ 作業概要はケバブケース（小文字、ハイフン区切り）で記述する

### 作業記録の作成方法

**スクリプトを使用（推奨）:**
```powershell
# work-logs/create-work-log.ps1 を実行
cd .kiro/specs/tdnet-data-collector/work-logs
.\create-work-log.ps1
# プロンプトに従って作業概要を入力（ケバブケース）
```

**手動作成:**
```powershell
# 現在時刻を取得
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
# ファイル作成（作業概要はケバブケース）
New-Item "work-log-$timestamp-your-task-description.md"
```

### 記録内容

| セクション | 内容 |
|-----------|------|
| **タスク概要** | 目的、背景、目標 |
| **実施内容** | 実施した作業、問題と解決策 |
| **成果物** | 作成・変更したファイル |
| **次回への申し送り** | 未完了の作業、注意点 |

詳細は `work-logs/README.md` を参照してください。

## 🔄 改善履歴 (improvements/)

### 目的
タスク実行後のフィードバックループで発見された問題と実施した改善を記録します。

### ファイル命名規則
```
task-[タスク番号]-improvement-[連番]-[YYYYMMDD-HHMMSS].md
```

**例:**
- `task-1.1-improvement-1-20260207-143025.md`
- `task-2.3-improvement-2-20260207-150000.md`
- `specs-requirements-improvement-1-20260207-160000.md`
- `steering-error-handling-improvement-1-20260207-170000.md`

### 改善記録の作成方法

**スクリプトを使用（推奨）:**
```powershell
# improvements/create-improvement.ps1 を実行
cd .kiro/specs/tdnet-data-collector/improvements
.\create-improvement.ps1
# プロンプトに従ってタスク番号と改善概要を入力
```

### いつ改善記録を作成するか？

**タスク完了後、以下の場合は改善記録を作成:**
- ❌ エラーや問題が発生した
- ⚠️ パフォーマンスやコストに懸念がある
- 🔄 コードの品質や保守性を改善したい
- 📚 ドキュメントを充実させたい

**問題がなければ、改善記録は不要です。**

### 改善の優先順位

| 優先度 | 対象 |
|--------|------|
| 🔴 **Critical** | システムが動作しない、データ損失のリスク |
| 🟠 **High** | パフォーマンス、セキュリティ、コスト問題 |
| 🟡 **Medium** | コード品質、保守性、テストカバレッジ |
| 🟢 **Low** | ドキュメント、コメント、スタイル |

詳細は `improvements/README.md` を参照してください。

## 📦 テンプレートファイル (templates/)

### templates/package.json.example
プロジェクトのpackage.jsonテンプレート。

**含まれる内容:**
- 必要な依存関係（AWS SDK, TypeScript, テストフレームワーク）
- npm scriptsの定義（build, test, lint, deploy）
- テスト設定（Jest, fast-check）

### templates/.env.example
環境変数テンプレート。

**環境別設定:**
- AWS設定（リージョン、プロファイル、アカウントID）
- DynamoDB/S3設定（テーブル名、バケット名）
- TDnetスクレイピング設定（レート制限、タイムアウト）
- Lambda設定（タイムアウト、メモリ）
- API設定（エンドポイント、認証）
- 通知・監視設定（Slack Webhook、CloudWatch）
- セキュリティ設定（暗号化キー、監査ログ）

**使用方法:**
```powershell
# 開発環境用
cp templates/.env.example .env.development

# 本番環境用
cp templates/.env.example .env.production

# 環境変数を編集
# 注意: .env.* ファイルは .gitignore に追加してください
```

### templates/cdk.context.json.example
CDK Context設定テンプレート。

**環境別設定（development, staging, production）:**
- AWSアカウント・リージョン
- Lambda設定（タイムアウト、メモリ、予約済み同時実行数）
- DynamoDB設定（課金モード、PITR、GSI）
- S3設定（バージョニング、ライフサイクル、暗号化）
- 監視設定（メトリクス、アラート、ログ保持期間）
- API設定（レート制限、認証）
- セキュリティ設定（WAF、CloudTrail、暗号化）

**使用方法:**
```powershell
# プロジェクトルートにコピー
cp templates/cdk.context.json.example cdk.context.json

# 環境を指定してデプロイ
cdk deploy --context environment=development
```

### templates/test-fixtures/
テスト用のサンプルデータとフィクスチャ。

**含まれる内容:**
- サンプル開示情報JSONデータ
- モックTDnetレスポンスHTML
- プロパティテスト用Arbitrary定義
- エッジケーステストデータ

### templates/github-workflows/
GitHub Actionsワークフローのテンプレート。

**ワークフロー:**
- `test.yml` - テストワークフロー（ユニット、統合、E2E）
- `deploy.yml` - デプロイワークフロー（dev, staging, production）
- `dependency-update.yml` - 依存関係更新ワークフロー（Dependabot）

**実装時の配置方法:**
```powershell
# .github/workflows/ ディレクトリにコピー
mkdir -p .github/workflows
cp templates/github-workflows/test.yml .github/workflows/test.yml
cp templates/github-workflows/deploy.yml .github/workflows/deploy.yml
cp templates/github-workflows/dependency-update.yml .github/workflows/dependency-update.yml
```

## 🚀 実装開始手順

### 1. チェックリストの確認
```powershell
# docs/implementation-checklist.md を開いて、すべての項目を確認
```

### 2. プロジェクトの初期化
```powershell
# GitHubリポジトリの作成
git init
git remote add origin <your-repo-url>

# package.jsonの作成
cp templates/package.json.example package.json

# 依存関係のインストール
npm install
```

### 3. 環境変数とCDK設定
```powershell
# 環境変数ファイルの作成
cp templates/.env.example .env.development
cp templates/.env.example .env.production

# CDK Context設定の作成
cp templates/cdk.context.json.example cdk.context.json

# 環境変数を編集（AWS認証情報、リージョンなど）
```

### 4. CI/CDの設定
```powershell
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

### 5. CDKプロジェクトの初期化
```powershell
# CDKプロジェクトの初期化
npx cdk init app --language typescript

# 最初のコミット
git add .
git commit -m "chore: initial commit"
git push origin main
```

### 6. 実装開始
Phase 1（基本機能）から実装を開始してください。詳細は `docs/design.md` を参照。

## 🔗 関連ドキュメント

### Steeringファイル（実装ガイドライン）

プロジェクトルートの `.kiro/steering/` フォルダに実装ガイドラインがあります。

#### Core（常時読み込み）
- `core/tdnet-implementation-rules.md` - 実装ルールとベストプラクティス
- `core/error-handling-patterns.md` - エラーハンドリングパターン
- `core/tdnet-data-collector.md` - タスク実行ルールとフィードバックループ

#### Development（開発ガイドライン）
- `development/testing-strategy.md` - テスト戦略とベストプラクティス
- `development/data-validation.md` - データバリデーションルール
- `development/tdnet-scraping-patterns.md` - TDnetスクレイピングのパターン
- `development/error-handling-implementation.md` - エラーハンドリングの詳細実装
- `development/tdnet-file-naming.md` - ファイル・フォルダ命名規則
- `development/workflow-guidelines.md` - ワークフローガイドライン
- `development/documentation-standards.md` - ドキュメント標準

#### Infrastructure（インフラ・デプロイ）
- `infrastructure/deployment-checklist.md` - デプロイチェックリスト
- `infrastructure/environment-variables.md` - 環境変数一覧
- `infrastructure/performance-optimization.md` - パフォーマンス最適化戦略
- `infrastructure/monitoring-alerts.md` - 監視とアラート設定

#### Security（セキュリティ）
- `security/security-best-practices.md` - セキュリティベストプラクティス

#### API（API設計）
- `api/api-design-guidelines.md` - RESTful API設計ガイドライン
- `api/error-codes.md` - APIエラーコード標準

#### Meta（メタ情報）
- `meta/pattern-matching-tests.md` - fileMatchPatternのテストケースと検証方法

詳細は `.kiro/steering/README.md` を参照してください。

### 仕様書とSteeringファイルの対応関係

| 仕様書 | 関連するsteeringファイル |
|--------|------------------------|
| `requirements.md` | すべてのsteeringファイル（要件を実装するためのガイドライン） |
| `design.md` | `tdnet-implementation-rules.md`, `api-design-guidelines.md`, `performance-optimization.md` |
| `implementation-checklist.md` | すべてのsteeringファイル |
| `correctness-properties-checklist.md` | `testing-strategy.md`, `data-validation.md` |
| `environment-setup.md` | `environment-variables.md`, `deployment-checklist.md` |
| `troubleshooting.md` | `error-handling-patterns.md`, `error-handling-implementation.md` |
| `metrics-and-kpi.md` | `monitoring-alerts.md`, `performance-optimization.md` |

### OpenAPI仕様

プロジェクトルートの `docs/openapi.yaml` にREST APIの完全なOpenAPI 3.0仕様があります。

**含まれる内容:**
- 全エンドポイント定義（GET /disclosures, GET /disclosures/{id}, GET /health）
- リクエスト/レスポンススキーマ
- エラーレスポンス定義
- 認証スキーム（API Key）

### ドキュメント依存関係図

```
requirements.md (要件定義)
    ↓
design.md (設計書)
    ↓
    ├─→ docs/openapi.yaml (API仕様)
    ├─→ correctness-properties-checklist.md (検証項目)
    └─→ implementation-checklist.md (実装前チェック)
         ↓
         └─→ environment-setup.md (環境構築)
              ↓
              └─→ .kiro/steering/ (実装ガイドライン)
                   ↓
                   ├─→ work-logs/ (作業記録)
                   └─→ improvements/ (改善履歴)
```

## 📋 タスク実行の3ステップ

### 1️⃣ タスク開始: タスク分析と作業記録作成

**実施順序:**
1. タスク内容を分析・理解
2. 必要に応じてコードベースを調査（context-gatherer使用可能な場合）
3. 作業記録を作成（タスク概要、目的、背景、実施計画を記入）
4. コード実装を開始

**重要:** 作業記録は、タスクを理解した後に作成します。形式的な記録ではなく、実際の作業計画を反映させてください。

### 2️⃣ タスク実行: 作業内容を随時記録

**実施内容:**
- コード実装、ファイル作成、テスト実行など
- 問題が発生したら、問題と解決策を作業記録に追記
- 作業の進捗を随時記録

### 3️⃣ タスク完了: コミット & 振り返り

**必須作業:**
```text
✅ 作業記録に成果物と次回への申し送りを記入
✅ git commit & push（変更をリモートにプッシュ）
✅ 振り返り: 問題点があれば改善記録を作成
```

### Git Commit & Push

**コミットメッセージ規則:**
```text
[タスク種別] 簡潔な変更内容

関連: work-log-[日時]-[作業概要].md または task-[番号]-improvement-[連番]-[日時].md
```

**タスク種別:**
- `feat`: 新機能追加
- `fix`: バグ修正
- `docs`: ドキュメント更新
- `refactor`: リファクタリング
- `test`: テスト追加・修正
- `chore`: その他の変更
- `improve`: 改善実施

**例:**
```text
feat: TDnet開示情報収集Lambda関数を実装

関連: work-log-20260207-143025-lambda-collector-implementation.md
```

**Git操作手順:**
```powershell
git add .
git commit -m "[タスク種別] 簡潔な変更内容"
git push origin main
```

## 💡 サポート

質問や問題がある場合は、以下を確認してください：

1. **設計書**: `docs/design.md` の該当セクション
2. **実装ガイドライン**: `.kiro/steering/` の関連ファイル
3. **チェックリスト**: `docs/implementation-checklist.md` の確認項目
4. **トラブルシューティング**: `docs/troubleshooting.md` の該当カテゴリ
5. **作業記録**: `work-logs/` の過去の作業履歴
6. **改善履歴**: `improvements/` の過去の改善記録

## 📄 ライセンス

MIT License

---

**最終更新**: 2026年2月7日
