# TDnet Data Collector - Steering Files

このディレクトリには、TDnet Data Collectorプロジェクトの実装ガイドライン、ベストプラクティス、ルールをまとめたsteeringファイルが格納されています。

## フォルダ構造

### 📁 core/ - 基本ルール（常に読み込まれる）
- **tdnet-implementation-rules.md** - 実装時の基本ルールとコーディング規約
- **error-handling-patterns.md** - エラーハンドリングのパターンとベストプラクティス
- **tdnet-data-collector.md** - タスク実行ルールとフィードバックループ

### 📁 development/ - 開発ガイドライン
- **testing-strategy.md** - テスト戦略（ユニット、統合、E2E、プロパティテスト）
- **data-validation.md** - データバリデーションルールとパターン
- **tdnet-scraping-patterns.md** - TDnetスクレイピングのパターンとベストプラクティス
- **error-handling-implementation.md** - エラーハンドリングの詳細実装
- **tdnet-file-naming.md** - ファイル・フォルダ命名規則
- **workflow-guidelines.md** - ワークフローガイドライン
- **documentation-standards.md** - ドキュメント標準

### 📁 infrastructure/ - インフラ・デプロイ
- **deployment-checklist.md** - デプロイ前後のチェックリスト
- **environment-variables.md** - 環境変数の定義と管理方法
- **performance-optimization.md** - パフォーマンス最適化戦略
- **monitoring-alerts.md** - 監視とアラート設定

### 📁 security/ - セキュリティ
- **security-best-practices.md** - セキュリティベストプラクティス（IAM、暗号化、監査）

### 📁 api/ - API設計
- **api-design-guidelines.md** - RESTful API設計ガイドライン
- **error-codes.md** - APIエラーコード標準

## 読み込みタイミングの制御

- **常時読み込み**: `core/` フォルダ内のファイル（front-matter不要）
- **条件付き読み込み**: front-matterの`fileMatchPattern`に一致するファイル編集時のみ

**front-matter形式:**
```yaml
---
inclusion: fileMatch
fileMatchPattern: '**/*.test.ts|**/*.spec.ts'
---
```

## fileMatchパターン対応表

### Lambda関連（統合済み）

| ファイルパターン | トリガーされるsteering | 説明 |
|----------------|---------------------|------|
| `**/lambda/**/index.ts` | `development/lambda-implementation.md` | Lambda関数エントリーポイント |
| `**/lambda/**/handler.ts` | `development/lambda-implementation.md` | Lambda関数ハンドラー |

### テスト関連

| ファイルパターン | トリガーされるsteering | 説明 |
|----------------|---------------------|------|
| `**/*.test.ts` | `development/testing-strategy.md` | テストファイル |
| `**/*.spec.ts` | `development/testing-strategy.md` | テストファイル（spec形式） |

### バリデーション関連

| ファイルパターン | トリガーされるsteering | 説明 |
|----------------|---------------------|------|
| `**/validators/**/*.ts` | `development/data-validation.md` | バリデーション |

### スクレイピング・エラーハンドリング関連

| ファイルパターン | トリガーされるsteering | 説明 |
|----------------|---------------------|------|
| `**/scraper/**/*.ts` | `development/tdnet-scraping-patterns.md`<br>`development/error-handling-implementation.md` | スクレイピング |
| `**/collector/**/*.ts` | `development/tdnet-scraping-patterns.md` | コレクター |
| `**/utils/error*.ts` | `development/error-handling-implementation.md` | エラーユーティリティ |
| `**/utils/retry*.ts` | `development/error-handling-implementation.md` | リトライユーティリティ |

### API関連

| ファイルパターン | トリガーされるsteering | 説明 |
|----------------|---------------------|------|
| `**/api/routes/**/*.ts` | `api/api-design-guidelines.md` | APIルート |
| `**/api/handlers/**/*.ts` | `api/api-design-guidelines.md` | APIハンドラー |
| `**/api/**/*.ts` | `api/error-codes.md`<br>`development/error-handling-implementation.md` | API全般 |
| `**/routes/**/*.ts` | `api/error-codes.md` | ルート定義 |

### CDK・インフラ関連

| ファイルパターン | トリガーされるsteering | 説明 |
|----------------|---------------------|------|
| `**/cdk/lib/**/*-stack.ts` | `security/security-best-practices.md`<br>`infrastructure/deployment-checklist.md` | CDKスタック |
| `**/cdk/lib/constructs/**/*.ts` | `development/tdnet-file-naming.md` | CDKコンストラクト |
| `**/cdk/lib/constructs/*lambda*.ts` | `infrastructure/performance-optimization.md` | CDK Lambda構成 |
| `**/cdk/lib/constructs/*function*.ts` | `infrastructure/performance-optimization.md` | CDK Function構成 |
| `**/dynamodb/**/*.ts` | `infrastructure/performance-optimization.md` | DynamoDB関連 |
| `**/s3/**/*.ts` | `infrastructure/performance-optimization.md` | S3関連 |
| `**/iam/**/*.ts` | `security/security-best-practices.md` | IAM関連 |
| `**/security/**/*.ts` | `security/security-best-practices.md` | セキュリティ関連 |
| `**/monitoring/**/*` | `infrastructure/monitoring-alerts.md` | 監視関連 |
| `**/.github/workflows/**/*` | `infrastructure/deployment-checklist.md` | GitHub Actions |

### 環境変数関連

| ファイルパターン | トリガーされるsteering | 説明 |
|----------------|---------------------|------|
| `**/.env*` | `infrastructure/environment-variables.md` | 環境変数ファイル |

### ドキュメント関連

| ファイルパターン | トリガーされるsteering | 説明 |
|----------------|---------------------|------|
| `**/docs/**/*.md` | `development/documentation-standards.md` | ドキュメント |
| `**/README.md` | `development/documentation-standards.md` | READMEファイル |
| `**/.kiro/specs/**/*.md` | `development/documentation-standards.md`<br>`development/workflow-guidelines.md` | 仕様ドキュメント |

### その他

| ファイルパターン | トリガーされるsteering | 説明 |
|----------------|---------------------|------|
| `**/src/**/index.ts` | `development/tdnet-file-naming.md` | エントリーポイント |
| `**/utils/**/index.ts` | `development/tdnet-file-naming.md` | ユーティリティ |

## 最適化の成果

### Lambda関連の統合

**変更前（重複あり）:**
- `**/lambda/**/index.ts` → 4ファイルがトリガー
- `**/lambda/**/handler.ts` → 4ファイルがトリガー

**変更後（統合）:**
- `**/lambda/**/index.ts` → 1ファイルのみ（`lambda-implementation.md`）
- `**/lambda/**/handler.ts` → 1ファイルのみ（`lambda-implementation.md`）

### CDK関連の細分化

**変更前:**
- `**/cdk/**/*.ts` → 5ファイルがトリガー（過度に広範囲）

**変更後:**
- `**/cdk/lib/**/*-stack.ts` → 2ファイル（セキュリティ、デプロイ）
- `**/cdk/lib/constructs/*lambda*.ts` → 1ファイル（パフォーマンス）
- より具体的なパターンで必要なファイルのみ読み込み

### API関連の細分化

**変更前:**
- `**/api/**/*.ts` → 3ファイルがトリガー

**変更後:**
- `**/api/routes/**/*.ts` → 1ファイル（API設計）
- `**/api/handlers/**/*.ts` → 1ファイル（API設計）
- より具体的なパターンで重複を削減

### ドキュメント関連の限定

**変更前:**
- `**/*.md` → すべてのMarkdownファイルがトリガー

**変更後:**
- `**/docs/**/*.md` → docsフォルダのみ
- `**/README.md` → READMEファイルのみ
- `**/.kiro/specs/**/*.md` → 仕様ドキュメントのみ

## トークン削減効果

- **Lambda関連**: 約75%削減（4ファイル → 1ファイル）
- **CDK関連**: 約60%削減（より具体的なパターン）
- **API関連**: 約33%削減（より具体的なパターン）
- **ドキュメント関連**: 約50%削減（限定的なパターン）

**全体の推定削減率**: 約30-40%のトークン削減

## ファイル間の参照関係

```
core/tdnet-implementation-rules.md (中心)
├─→ core/error-handling-patterns.md
├─→ development/testing-strategy.md
├─→ development/data-validation.md
├─→ development/tdnet-file-naming.md
└─→ infrastructure/performance-optimization.md

core/tdnet-data-collector.md (タスク実行)
├─→ development/workflow-guidelines.md (サブエージェント活用)
└─→ development/documentation-standards.md (ドキュメント標準)

core/error-handling-patterns.md
├─→ development/error-handling-implementation.md
└─→ api/error-codes.md

api/api-design-guidelines.md
├─→ development/data-validation.md
└─→ api/error-codes.md

infrastructure/deployment-checklist.md
├─→ security/security-best-practices.md
├─→ infrastructure/environment-variables.md
└─→ infrastructure/monitoring-alerts.md

security/security-best-practices.md
├─→ infrastructure/environment-variables.md
└─→ infrastructure/monitoring-alerts.md

development/tdnet-scraping-patterns.md
└─→ core/error-handling-patterns.md
```

**注意:** 参照関係は一方向（DAG: Directed Acyclic Graph）になっており、循環参照はありません。

## 関連リンク

| 種類 | 相対パス |
|------|---------|
| **プロジェクト仕様** | `../.kiro/specs/tdnet-data-collector/` |
| **改善履歴** | `../.kiro/specs/tdnet-data-collector/improvements/` |
| **作業記録** | `../.kiro/specs/tdnet-data-collector/work-logs/` |
| **テンプレート** | `../.kiro/specs/tdnet-data-collector/templates/` |

## トークン最適化

- **常時読み込み**: core/フォルダのみ（約800行）
- **条件付き読み込み**: 必要に応じて追加で300-600行
- **最適化後の削減率**: 約25%のトークン削減

## メンテナンス

このREADME.mdは、steeringファイルの構造や内容が変更されたときに更新してください。変更履歴はGitコミットログを参照してください。

### 新しいsteeringファイルを追加する場合

1. 適切なフォルダに配置（core/development/infrastructure/security/api）
2. front-matterで読み込みタイミングを設定
3. このREADME.mdを更新（ファイル一覧、fileMatchパターン対応表）
4. 関連ファイルの「関連ドキュメント」セクションを更新
