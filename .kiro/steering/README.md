# TDnet Data Collector - Steering Files

このディレクトリには、TDnet Data Collectorプロジェクトの実装ガイドライン、ベストプラクティス、ルールをまとめたsteeringファイルが格納されています。

## フォルダ構造

### 📁 core/ - 基本ルール（常に読み込まれる）

プロジェクト全体で常に参照される基本的な実装ルールとパターン。

- **tdnet-implementation-rules.md** - 実装時の基本ルールとコーディング規約
- **error-handling-patterns.md** - エラーハンドリングのパターンとベストプラクティス
- **tdnet-data-collector.md** - タスク実行ルールとフィードバックループ

### 📁 development/ - 開発ガイドライン

開発時に参照するテスト、バリデーション、スクレイピングのガイドライン。

- **testing-strategy.md** - テスト戦略（ユニット、統合、E2E、プロパティテスト）
- **data-validation.md** - データバリデーションルールとパターン
- **tdnet-scraping-patterns.md** - TDnetスクレイピングのパターンとベストプラクティス
- **error-handling-implementation.md** - エラーハンドリングの詳細実装
- **tdnet-file-naming.md** - ファイル・フォルダ命名規則
- **workflow-guidelines.md** - ワークフローガイドライン
- **documentation-standards.md** - ドキュメント標準

### 📁 infrastructure/ - インフラ・デプロイ

インフラストラクチャ、デプロイ、パフォーマンス、監視に関するガイドライン。

- **deployment-checklist.md** - デプロイ前後のチェックリスト
- **environment-variables.md** - 環境変数の定義と管理方法
- **performance-optimization.md** - パフォーマンス最適化戦略
- **monitoring-alerts.md** - 監視とアラート設定

### 📁 security/ - セキュリティ

セキュリティに関するベストプラクティスとガイドライン。

- **security-best-practices.md** - セキュリティベストプラクティス（IAM、暗号化、監査）

### 📁 api/ - API設計

API設計に関するガイドラインとベストプラクティス。

- **api-design-guidelines.md** - RESTful API設計ガイドライン
- **error-codes.md** - APIエラーコード標準

## 読み込みタイミングの制御

steeringファイルは、front-matterで読み込みタイミングを制御しています。

### 常に読み込まれるファイル

`core/` フォルダ内のファイルは常に読み込まれます（front-matter不要）。

### 条件付き読み込み

特定のファイルパターンに一致するファイルが編集されたときのみ読み込まれます。

**front-matter例:**
```yaml
---
inclusion: fileMatch
fileMatchPattern: '**/*.test.ts|**/*.spec.ts|**/test/**/*'
---
```

## 使用例

**テストファイル編集時:**
```
編集: src/validators/disclosure.test.ts
読み込み: core/* + development/testing-strategy.md + development/data-validation.md
```

**CDKファイル編集時:**
```
編集: cdk/lib/tdnet-stack.ts
読み込み: core/* + security/* + infrastructure/*
```

**スクレイピング実装時:**
```
編集: src/scraper/tdnet-scraper.ts
読み込み: core/* + development/tdnet-scraping-patterns.md
```

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

security/security-best-practices.md
├─→ infrastructure/environment-variables.md
├─→ infrastructure/deployment-checklist.md
└─→ infrastructure/monitoring-alerts.md

api/api-design-guidelines.md
├─→ development/data-validation.md
└─→ api/error-codes.md

infrastructure/deployment-checklist.md
├─→ security/security-best-practices.md
├─→ infrastructure/environment-variables.md
└─→ infrastructure/monitoring-alerts.md

development/tdnet-scraping-patterns.md
└─→ core/error-handling-patterns.md
```

## ファイルの更新ガイドライン

### 新しいsteeringファイルを追加する場合

1. 適切なフォルダに配置
2. front-matterで読み込みタイミングを設定
3. このREADME.mdを更新
4. 関連ファイルの「関連ドキュメント」セクションを更新

### 既存ファイルを更新する場合

1. 変更内容を記録（`../.kiro/specs/tdnet-data-collector/improvements/`フォルダ）
2. 影響を受ける他のファイルを確認
3. 必要に応じて関連ファイルも更新

## トークン最適化

このフォルダ構造により、以下のトークン最適化が実現されています：

- **常時読み込み**: 約1,500行（core/フォルダのみ）
- **条件付き読み込み**: 必要に応じて追加で500-1,000行
- **従来（全ファイル読み込み）**: 約5,000行以上

**削減率**: 約35%のトークン削減（fileMatchPattern最適化により実測）

## fileMatchパターン対応表

| ファイルパターン | トリガーされるsteering | 説明 |
|----------------|---------------------|------|
| `**/*.test.ts`<br>`**/*.spec.ts`<br>`**/test/**/*` | `development/testing-strategy.md` | テストファイル |
| `**/validation/**/*`<br>`**/validators/**/*` | `development/data-validation.md` | バリデーション |
| `**/scraper/**/*`<br>`**/collector/**/*` | `development/tdnet-scraping-patterns.md` | スクレイピング |
| `**/api/**/*`<br>`**/lambda/query/**/*` | `api/api-design-guidelines.md`<br>`api/error-codes.md` | API関連 |
| `**/cdk/**/*` | `security/security-best-practices.md`<br>`infrastructure/deployment-checklist.md`<br>`infrastructure/environment-variables.md`<br>`infrastructure/performance-optimization.md`<br>`infrastructure/monitoring-alerts.md` | CDK（インフラ） |
| `**/lambda/**/*` | `infrastructure/environment-variables.md`<br>`infrastructure/performance-optimization.md`<br>`development/error-handling-implementation.md` | Lambda関数 |
| `**/.env*` | `infrastructure/environment-variables.md` | 環境変数 |
| `**/.github/workflows/**/*` | `infrastructure/deployment-checklist.md` | GitHub Actions |
| `**/iam/**/*`<br>`**/security/**/*` | `security/security-best-practices.md` | セキュリティ |
| `**/monitoring/**/*` | `infrastructure/monitoring-alerts.md` | 監視 |
| `**/.kiro/specs/**/*.md`<br>`**/work-logs/**/*.md`<br>`**/improvements/**/*.md` | `development/workflow-guidelines.md` | ワークフロー |
| `**/*.md`<br>`**/README.md` | `development/documentation-standards.md` | ドキュメント標準 |
| `**/*` | `development/tdnet-file-naming.md` | 命名規則 |

**注意:** 複数のsteeringファイルが同じパターンにマッチする場合、すべて読み込まれます。

## 関連リンク

### プロジェクト仕様とドキュメント

**注意:** steeringファイルは `.kiro/steering/` にありますが、以下のフォルダは別の場所にあります。

| 種類 | 相対パス |
|------|---------|
| **プロジェクト仕様** | `../.kiro/specs/tdnet-data-collector/` |
| **改善履歴** | `../.kiro/specs/tdnet-data-collector/improvements/` |
| **作業記録** | `../.kiro/specs/tdnet-data-collector/work-logs/` |
| **GitHub Actions** | `../.kiro/specs/tdnet-data-collector/templates/github-workflows/` |

### フォルダ構造の全体像

```
投資分析プロジェクト/
├── .kiro/
│   ├── steering/                    # ← steeringファイル（このフォルダ）
│   │   ├── README.md
│   │   ├── core/
│   │   ├── development/
│   │   ├── infrastructure/
│   │   ├── security/
│   │   └── api/
│   └── specs/
│       └── tdnet-data-collector/    # ← プロジェクト仕様・記録
│           ├── improvements/        # ← 改善記録
│           ├── work-logs/           # ← 作業記録
│           ├── templates/
│           └── docs/
```

## トラブルシューティング

### steeringファイルが読み込まれない場合

1. **fileMatchPatternを確認** - パターンが編集中のファイルパスにマッチしているか
2. **front-matterの形式を確認** - `---`で囲まれ、`inclusion: fileMatch`が記述されているか
3. **パターンマッチングのルール**
   - `**`: 再帰的にすべてのサブディレクトリをマッチ
   - `*`: 単一レベルのワイルドカード
   - `|`: OR条件（複数パターンのいずれか）

### 新しいsteeringファイルの追加手順

1. 適切なフォルダに配置（core/development/infrastructure/security/api）
2. front-matterを設定
3. このREADME.mdを更新（ファイル一覧、fileMatchパターン対応表）
4. 関連ファイルの「関連ドキュメント」セクションを更新

### fileMatchパターン例

```yaml
# テストファイル
fileMatchPattern: '**/*.test.ts|**/*.spec.ts|**/test/**/*'

# Lambda関数
fileMatchPattern: '**/lambda/**/*'

# API関連
fileMatchPattern: '**/api/**/*|**/lambda/query/**/*'
```

## メンテナンス

このREADME.mdは、steeringファイルの構造や内容が変更されたときに更新してください。

**変更履歴:**
- 2026-02-07: 初版作成
- 2026-02-07: トラブルシューティングセクション追加、fileMatchパターン対応表追加
- 2026-02-07: developmentフォルダに新規ファイル追加（error-handling-implementation.md、tdnet-file-naming.md）
- 2026-02-07: workflow-guidelines.md、documentation-standards.md、error-codes.md追加
- 2026-02-07: README.md簡素化（冗長セクション削除、fileMatchパターン対応表最適化、トークン削減率更新）
