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

**読み込みタイミング:**
- `testing-strategy.md`: テストファイル編集時（`**/*.test.ts`, `**/*.spec.ts`）
- `data-validation.md`: バリデーション関連ファイル編集時（`**/validation/**/*`）
- `tdnet-scraping-patterns.md`: スクレイピング関連ファイル編集時（`**/scraper/**/*`）
- `error-handling-implementation.md`: Lambda、スクレイピング、API関連ファイル編集時
- `tdnet-file-naming.md`: すべてのファイル編集時

### 📁 infrastructure/ - インフラ・デプロイ

インフラストラクチャ、デプロイ、パフォーマンス、監視に関するガイドライン。

- **deployment-checklist.md** - デプロイ前後のチェックリスト
- **environment-variables.md** - 環境変数の定義と管理方法
- **performance-optimization.md** - パフォーマンス最適化戦略
- **monitoring-alerts.md** - 監視とアラート設定

**読み込みタイミング:**
- `deployment-checklist.md`: CDK、GitHub Actionsファイル編集時
- `environment-variables.md`: CDK、Lambda、環境変数ファイル編集時
- `performance-optimization.md`: Lambda、CDKファイル編集時
- `monitoring-alerts.md`: CDK、監視関連ファイル編集時

### 📁 security/ - セキュリティ

セキュリティに関するベストプラクティスとガイドライン。

- **security-best-practices.md** - セキュリティベストプラクティス（IAM、暗号化、監査）

**読み込みタイミング:**
- CDK、IAM、セキュリティ関連ファイル編集時（`**/cdk/**/*`, `**/iam/**/*`）

### 📁 api/ - API設計

API設計に関するガイドラインとベストプラクティス。

- **api-design-guidelines.md** - RESTful API設計ガイドライン

**読み込みタイミング:**
- API関連ファイル編集時（`**/api/**/*`, `**/lambda/query/**/*`）

## 読み込みタイミングの制御

steeringファイルは、front-matterで読み込みタイミングを制御しています：

### 常に読み込まれるファイル（front-matterなし）

core/フォルダ内のファイルは常に読み込まれます。front-matterは不要です。

- `core/` フォルダ内のすべてのファイル
  - tdnet-implementation-rules.md
  - error-handling-patterns.md
  - tdnet-data-collector.md

### 条件付き読み込み（inclusion: fileMatch）

特定のファイルパターンに一致するファイルが編集されたときのみ読み込まれます。

例：
```yaml
---
inclusion: fileMatch
fileMatchPattern: '**/*.test.ts|**/*.spec.ts|**/test/**/*'
---
```

### パターン重複について（意図的な設計）

複数のsteeringファイルが同じfileMatchパターンを含む場合があります。これは意図的な設計です。

**例: CDKファイル編集時（`**/cdk/**/*`）**

以下のsteeringファイルがすべて読み込まれます：
- `security/security-best-practices.md` - セキュリティベストプラクティス
- `infrastructure/deployment-checklist.md` - デプロイチェックリスト
- `infrastructure/environment-variables.md` - 環境変数管理
- `infrastructure/performance-optimization.md` - パフォーマンス最適化
- `infrastructure/monitoring-alerts.md` - 監視とアラート

**理由:**
CDKはインフラストラクチャ全体を定義するため、セキュリティ、デプロイ、環境変数、パフォーマンス、監視のすべての観点が必要です。

**例: Lambdaファイル編集時（`**/lambda/**/*`）**

以下のsteeringファイルが読み込まれます：
- `infrastructure/environment-variables.md` - 環境変数の使用方法
- `infrastructure/performance-optimization.md` - Lambda最適化

**理由:**
Lambda関数は環境変数を使用し、パフォーマンス最適化が重要です。

この設計により、編集中のファイルに関連するすべてのガイドラインが自動的に提供されます。

### 手動読み込み（inclusion: manual）

ユーザーが明示的に指定したときのみ読み込まれます（現在は未使用）。

## 使用例

### テストファイル編集時

```
編集: src/validators/disclosure.test.ts

読み込まれるファイル:
✓ core/tdnet-implementation-rules.md
✓ core/error-handling-patterns.md
✓ core/tdnet-data-collector.md
✓ development/testing-strategy.md
✓ development/data-validation.md
```

### CDKファイル編集時

```
編集: cdk/lib/tdnet-stack.ts

読み込まれるファイル:
✓ core/tdnet-implementation-rules.md
✓ core/error-handling-patterns.md
✓ core/tdnet-data-collector.md
✓ security/security-best-practices.md
✓ infrastructure/deployment-checklist.md
✓ infrastructure/environment-variables.md
✓ infrastructure/performance-optimization.md
✓ infrastructure/monitoring-alerts.md
```

### スクレイピング実装時

```
編集: src/scraper/tdnet-scraper.ts

読み込まれるファイル:
✓ core/tdnet-implementation-rules.md
✓ core/error-handling-patterns.md
✓ core/tdnet-data-collector.md
✓ development/tdnet-scraping-patterns.md
```

## ファイル間の参照関係

### 依存関係マップ

```
core/tdnet-implementation-rules.md (中心)
├─→ core/error-handling-patterns.md (エラー処理詳細)
├─→ development/testing-strategy.md (テスト戦略)
├─→ development/data-validation.md (バリデーション)
├─→ development/tdnet-file-naming.md (命名規則)
└─→ infrastructure/performance-optimization.md (パフォーマンス)

core/error-handling-patterns.md (基本原則)
└─→ development/error-handling-implementation.md (詳細実装)

security/security-best-practices.md (独立)
├─→ infrastructure/environment-variables.md (機密情報管理)
├─→ infrastructure/deployment-checklist.md (セキュリティチェック)
└─→ infrastructure/monitoring-alerts.md (セキュリティアラート)

api/api-design-guidelines.md (独立)
└─→ development/data-validation.md (APIバリデーション)

infrastructure/deployment-checklist.md (統合)
├─→ security/security-best-practices.md
├─→ infrastructure/environment-variables.md
└─→ infrastructure/monitoring-alerts.md

development/tdnet-scraping-patterns.md (独立)
└─→ core/error-handling-patterns.md (スクレイピングエラー)
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

**削減率**: 約60-70%のトークン削減

## fileMatchパターン対応表

各フォルダ/ファイルパターンと、トリガーされるsteeringファイルの対応表：

| フォルダ/ファイルパターン | トリガーされるsteering | 説明 |
|------------------------|---------------------|------|
| `**/*.test.ts`, `**/*.spec.ts`, `**/test/**/*` | `development/testing-strategy.md` | テストファイル編集時 |
| `**/validation/**/*`, `**/validators/**/*` | `development/data-validation.md` | バリデーション関連 |
| `**/scraper/**/*`, `**/collector/**/*` | `development/tdnet-scraping-patterns.md` | スクレイピング実装 |
| `**/api/**/*`, `**/lambda/query/**/*` | `api/api-design-guidelines.md` | API関連 |
| `**/cdk/**/*` | `security/security-best-practices.md`<br>`infrastructure/deployment-checklist.md`<br>`infrastructure/environment-variables.md`<br>`infrastructure/performance-optimization.md`<br>`infrastructure/monitoring-alerts.md` | CDK（インフラ全般） |
| `**/lambda/**/*` | `infrastructure/environment-variables.md`<br>`infrastructure/performance-optimization.md` | Lambda関数 |
| `**/.env*` | `infrastructure/environment-variables.md` | 環境変数ファイル |
| `**/.github/workflows/**/*` | `infrastructure/deployment-checklist.md` | GitHub Actions |
| `**/iam/**/*`, `**/security/**/*` | `security/security-best-practices.md` | セキュリティ関連 |
| `**/monitoring/**/*` | `infrastructure/monitoring-alerts.md` | 監視関連 |
| `**/lambda/**/*`, `**/scraper/**/*`, `**/api/**/*` | `development/error-handling-implementation.md` | エラーハンドリング実装 |
| `**/*` | `development/tdnet-file-naming.md` | ファイル命名規則 |
| `**/monitoring/**/*` | `infrastructure/monitoring-alerts.md` | 監視関連 |

**注意:** 複数のsteeringファイルが同じパターンにマッチする場合、すべて読み込まれます（意図的な設計）。

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

1. **fileMatchPatternを確認**
   - パターンが編集中のファイルパスにマッチしているか確認
   - `|`（パイプ）で複数パターンを区切っているか確認

2. **front-matterの形式を確認**
   ```yaml
   ---
   inclusion: fileMatch
   fileMatchPattern: 'your-pattern-here'
   ---
   ```
   - `---`で囲まれているか
   - `inclusion: fileMatch`が正しく記述されているか

3. **パターンマッチングのルール**
   - `**`: 再帰的にすべてのサブディレクトリをマッチ
   - `*`: 単一レベルのワイルドカード
   - `|`: OR条件（複数パターンのいずれか）
   - 例: `**/test/**/*` → testフォルダ以下のすべてのファイル

### 新しいsteeringファイルの追加手順

1. **適切なフォルダに配置**
   - 基本ルール → `core/`
   - 開発ガイドライン → `development/`
   - インフラ → `infrastructure/`
   - セキュリティ → `security/`
   - API → `api/`

2. **front-matterを設定**
   ```yaml
   ---
   inclusion: fileMatch
   fileMatchPattern: '**/your-folder/**/*|**/your-pattern/**/*'
   ---
   ```

3. **このREADME.mdを更新**
   - ファイル一覧に追加
   - 読み込みタイミングを記載
   - fileMatchパターン対応表を更新

4. **関連ファイルを更新**
   - 依存関係マップに追加
   - 関連するsteeringファイルの「関連ドキュメント」セクションを更新

### fileMatchパターンのテンプレート

```yaml
# テストファイル
fileMatchPattern: '**/*.test.ts|**/*.spec.ts|**/test/**/*'

# Lambda関数
fileMatchPattern: '**/lambda/**/*'

# CDK関連（複数のsteeringが読み込まれる）
fileMatchPattern: '**/cdk/**/*'

# API関連
fileMatchPattern: '**/api/**/*|**/lambda/query/**/*'

# バリデーション
fileMatchPattern: '**/validation/**/*|**/validators/**/*'

# スクレイピング
fileMatchPattern: '**/scraper/**/*|**/collector/**/*'

# セキュリティ関連
fileMatchPattern: '**/cdk/**/*|**/iam/**/*|**/security/**/*'

# 監視関連
fileMatchPattern: '**/cdk/**/*|**/monitoring/**/*'

# 環境変数
fileMatchPattern: '**/.env*'

# GitHub Actions
fileMatchPattern: '**/.github/workflows/**/*'
```

**重要:** 自己参照（ファイル名自体をパターンに含める）は不要です。fileMatchPatternはファイルパスのマッチングに使用されます。

## メンテナンス

このREADME.mdは、steeringファイルの構造や内容が変更されたときに更新してください。

**変更履歴:**
- 2026-02-07: 初版作成
- 2026-02-07: トラブルシューティングセクション追加、fileMatchパターン対応表追加、自己参照削除
- 2026-02-07: developmentフォルダに新規ファイル追加（error-handling-implementation.md、tdnet-file-naming.md）、依存関係マップ更新、絶対パス表記削除
