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

| ファイルパターン | トリガーされるsteering |
|----------------|---------------------|
| `**/*.test.ts`, `**/*.spec.ts` | `development/testing-strategy.md` |
| `**/validators/**/*.ts` | `development/data-validation.md` |
| `**/scraper/**/*.ts`, `**/collector/**/*.ts` | `development/tdnet-scraping-patterns.md` |
| `**/api/**/*.ts`, `**/routes/**/*.ts` | `api/api-design-guidelines.md`, `api/error-codes.md` |
| `**/cdk/**/*.ts` | `security/*`, `infrastructure/*` |
| `**/lambda/**/handler.ts`, `**/lambda/**/index.ts` | `infrastructure/environment-variables.md`, `infrastructure/performance-optimization.md`, `development/error-handling-implementation.md` |
| `**/.env*` | `infrastructure/environment-variables.md` |
| `**/.github/workflows/**/*` | `infrastructure/deployment-checklist.md` |
| `**/iam/**/*.ts`, `**/security/**/*.ts` | `security/security-best-practices.md` |
| `**/monitoring/**/*.ts` | `infrastructure/monitoring-alerts.md` |
| `**/.kiro/specs/**/*.md` | `development/workflow-guidelines.md` |
| `**/*.md` | `development/documentation-standards.md` |

**注意:** 複数のsteeringファイルが同じパターンにマッチする場合、すべて読み込まれます。

## ファイル間の参照関係

```
core/tdnet-implementation-rules.md
├─→ core/error-handling-patterns.md
├─→ development/testing-strategy.md
├─→ development/data-validation.md
└─→ infrastructure/performance-optimization.md

core/tdnet-data-collector.md
├─→ development/workflow-guidelines.md
└─→ development/documentation-standards.md

core/error-handling-patterns.md
├─→ development/error-handling-implementation.md
└─→ api/error-codes.md
```

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
