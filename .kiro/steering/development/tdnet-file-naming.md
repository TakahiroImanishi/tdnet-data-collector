---
inclusion: fileMatch
fileMatchPattern: '**/cdk/lib/**/*-stack.ts|**/cdk/lib/constructs/**/*.ts|**/src/**/index.ts|**/utils/**/index.ts'
---

# TDnet Data Collector - ファイル・フォルダ命名規則

このファイルは、TDnet Data Collectorプロジェクトのファイルとフォルダの命名規則をまとめたものです。

## 基本原則

**steeringファイルのfileMatchパターンに対応した命名規則に従うこと。**

これにより、適切なタイミングで関連するsteeringファイルが自動的に読み込まれます。

### 命名規則の重要性

- **自動的なsteering読み込み**: 適切な命名により、必要なガイドラインが自動的に提供される
- **コードの可読性**: 明確な命名により、ファイルの目的が一目で分かる
- **保守性の向上**: 一貫した命名規則により、プロジェクトの保守が容易になる
- **チーム開発**: 統一された規則により、チーム全体で理解しやすいコードベースを維持

## プロジェクト構造

```
tdnet-data-collector/
├── src/
│   ├── lambda/              # Lambda関数
│   │   ├── collector/       # データ収集Lambda
│   │   ├── query/           # API Lambda
│   │   └── parser/          # PDF解析Lambda
│   ├── scraper/             # スクレイピング関連
│   ├── validation/          # バリデーション関連
│   │   └── validators/      # バリデータ実装
│   ├── api/                 # API関連
│   ├── monitoring/          # 監視関連
│   └── utils/               # ユーティリティ
├── cdk/                     # CDK（Infrastructure as Code）
│   ├── lib/
│   │   ├── stacks/
│   │   ├── constructs/
│   │   ├── iam/             # IAM関連
│   │   └── security/        # セキュリティ設定
│   └── bin/
├── test/                    # テストファイル
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── .github/
    └── workflows/           # GitHub Actions
```

### フォルダの役割

| フォルダ | 役割 | 含まれるファイル |
|---------|------|----------------|
| `src/lambda/` | Lambda関数の実装 | ハンドラー、ビジネスロジック、型定義 |
| `src/scraper/` | スクレイピング関連 | TDnetスクレイパー、ユーティリティ |
| `src/validation/` | バリデーション関連 | バリデータ、スキーマ定義 |
| `src/api/` | API関連 | ルート、ミドルウェア |
| `src/monitoring/` | 監視関連 | メトリクス、アラート設定 |
| `src/utils/` | ユーティリティ | 共通関数、ヘルパー |
| `cdk/` | インフラコード | スタック、コンストラクト、IAM、セキュリティ |
| `test/` | テストコード | ユニット、統合、E2Eテスト |
| `.github/workflows/` | CI/CD | GitHub Actionsワークフロー |

## ファイル命名規則

### Lambda関数

**構造:**
```
src/lambda/{function-name}/
├── index.ts                 # エントリーポイント
├── handler.ts               # ハンドラー実装
├── types.ts                 # 型定義
└── {function-name}.test.ts  # テスト
```

**例:**
```
src/lambda/collector/
├── index.ts
├── handler.ts
├── types.ts
└── collector.test.ts

src/lambda/query/
├── index.ts
├── handler.ts
├── types.ts
└── query.test.ts

src/lambda/parser/
├── index.ts
├── handler.ts
├── types.ts
└── parser.test.ts
```

**トリガーされるsteering:**
- `infrastructure/environment-variables.md`
- `infrastructure/performance-optimization.md`

**命名のポイント:**
- Lambda関数名はケバブケース（kebab-case）
- テストファイルは `{function-name}.test.ts` の形式
- 型定義は `types.ts` に集約

### スクレイピング関連

**構造:**
```
src/scraper/
├── tdnet-scraper.ts         # TDnetスクレイピング実装
├── scraper-utils.ts         # スクレイピングユーティリティ
└── tdnet-scraper.test.ts    # テスト
```

**トリガーされるsteering:**
- `development/tdnet-scraping-patterns.md`

**命名のポイント:**
- スクレイパーの実装は `{target}-scraper.ts` の形式
- ユーティリティは `scraper-utils.ts`
- テストファイルは `{scraper-name}.test.ts`

### バリデーション関連

**構造:**
```
src/validation/
├── validators/
│   ├── disclosure-validator.ts
│   ├── company-code-validator.ts
│   └── date-validator.ts
├── schemas/
│   └── disclosure-schema.ts
└── validators.test.ts
```

**トリガーされるsteering:**
- `development/data-validation.md`

**命名のポイント:**
- バリデータは `{target}-validator.ts` の形式
- スキーマは `{target}-schema.ts` の形式
- `validators/` フォルダに個別のバリデータを配置
- `schemas/` フォルダにスキーマ定義を配置

### API関連

**構造:**
```
src/api/
├── routes/
│   ├── disclosures.ts
│   └── health.ts
├── middleware/
│   ├── auth.ts
│   └── error-handler.ts
└── api.test.ts
```

**トリガーされるsteering:**
- `api/api-design-guidelines.md`

**命名のポイント:**
- ルートは複数形（`disclosures.ts`, `companies.ts`）
- ミドルウェアは機能名（`auth.ts`, `error-handler.ts`）
- `routes/` フォルダにルート定義を配置
- `middleware/` フォルダにミドルウェアを配置

### CDK関連

**構造:**
```
cdk/
├── lib/
│   ├── stacks/
│   │   ├── tdnet-stack.ts
│   │   └── monitoring-stack.ts
│   ├── constructs/
│   │   ├── lambda-construct.ts
│   │   └── dynamodb-construct.ts
│   ├── iam/
│   │   └── policies.ts
│   └── security/
│       └── waf-rules.ts
└── bin/
    └── tdnet-app.ts
```

**トリガーされるsteering:**
- `security/security-best-practices.md`
- `infrastructure/deployment-checklist.md`
- `infrastructure/environment-variables.md`
- `infrastructure/performance-optimization.md`
- `infrastructure/monitoring-alerts.md`

**命名のポイント:**
- スタックは `{name}-stack.ts` の形式
- コンストラクトは `{resource}-construct.ts` の形式
- IAMポリシーは `policies.ts` に集約
- セキュリティ設定は `security/` フォルダに配置

### テストファイル

**構造:**
```
test/
├── unit/
│   ├── validators/
│   │   └── disclosure-validator.test.ts
│   └── scraper/
│       └── tdnet-scraper.test.ts
├── integration/
│   ├── dynamodb.integration.test.ts
│   └── s3.integration.test.ts
└── e2e/
    └── api.e2e.test.ts
```

**命名規則:**
- ユニットテスト: `{module-name}.test.ts`
- 統合テスト: `{module-name}.integration.test.ts`
- E2Eテスト: `{module-name}.e2e.test.ts`
- Specファイル: `{module-name}.spec.ts`

**トリガーされるsteering:**
- `development/testing-strategy.md`
- `development/data-validation.md`（バリデーションテスト時）

**命名のポイント:**
- テストファイルは対応する実装ファイルと同じ名前
- テストの種類を拡張子で区別（`.test.ts`, `.integration.test.ts`, `.e2e.test.ts`）
- テストフォルダ構造は実装フォルダ構造と対応

### GitHub Actions

**構造:**
```
.github/workflows/
├── test.yml                 # テストワークフロー
├── deploy.yml               # デプロイワークフロー
└── dependency-update.yml    # 依存関係更新
```

**トリガーされるsteering:**
- `infrastructure/deployment-checklist.md`

**命名のポイント:**
- ワークフローファイルはケバブケース
- 機能を明確に表す名前（`test.yml`, `deploy.yml`）

### 環境変数ファイル

**構造:**
```
.env.example                 # 環境変数テンプレート
.env.development             # 開発環境
.env.production              # 本番環境
```

**トリガーされるsteering:**
- `infrastructure/environment-variables.md`

**命名のポイント:**
- `.env.example` はテンプレート（Gitにコミット）
- `.env.{environment}` は環境ごとの設定（Gitに含めない）

## ファイル命名のベストプラクティス

### ✅ 良い例

```typescript
// Lambda関数
src/lambda/collector/index.ts
src/lambda/collector/handler.ts
src/lambda/collector/collector.test.ts

// スクレイピング
src/scraper/tdnet-scraper.ts
src/scraper/scraper-utils.ts

// バリデーション
src/validation/validators/disclosure-validator.ts
src/validation/validators/company-code-validator.ts

// API
src/api/routes/disclosures.ts
src/api/middleware/auth.ts

// CDK
cdk/lib/stacks/tdnet-stack.ts
cdk/lib/iam/policies.ts
cdk/lib/security/waf-rules.ts

// テスト
test/unit/validators/disclosure-validator.test.ts
test/integration/dynamodb.integration.test.ts
test/e2e/api.e2e.test.ts
```

**良い理由:**
- ファイル名が機能を明確に表現している
- 適切なフォルダに配置されている
- ケバブケース（kebab-case）を使用している
- テストファイルが実装ファイルと対応している

### ❌ 悪い例

```typescript
// 不明確な命名
src/utils/helper.ts              // 何のヘルパー？
src/functions/func1.ts           // 機能が不明
src/test.ts                      // テスト対象が不明

// パターンに合わない配置
src/my-validator.ts              // validation/validators/ に配置すべき
src/my-scraper.ts                // scraper/ に配置すべき
cdk/my-stack.ts                  // cdk/lib/stacks/ に配置すべき

// 不適切なテスト命名
test/test1.ts                    // 対象が不明
test/mytest.spec.ts              // 命名規則に従っていない
```

**悪い理由:**
- ファイル名が機能を表現していない
- 適切なフォルダに配置されていない
- 命名規則に従っていない
- テストファイルが実装ファイルと対応していない

## フォルダ作成のガイドライン

新しい機能を追加する際は、以下の順序でフォルダを作成：

### 1. 機能フォルダの作成

```bash
# Lambda関数の場合
mkdir -p src/lambda/new-function
mkdir -p test/unit/new-function

# スクレイピング機能の場合
mkdir -p src/scraper
mkdir -p test/unit/scraper

# API機能の場合
mkdir -p src/api/routes
mkdir -p src/api/middleware
mkdir -p test/unit/api
```

### 2. 必要なサブフォルダの作成

```bash
# バリデーション関連
mkdir -p src/validation/validators
mkdir -p src/validation/schemas

# API関連
mkdir -p src/api/routes
mkdir -p src/api/middleware

# CDK関連
mkdir -p cdk/lib/stacks
mkdir -p cdk/lib/constructs
mkdir -p cdk/lib/iam
mkdir -p cdk/lib/security
```

### 3. テストフォルダの作成

```bash
# テストフォルダ構造
mkdir -p test/unit/{module-name}
mkdir -p test/integration
mkdir -p test/e2e
```

### フォルダ作成のチェックリスト

新しいフォルダを作成する前に確認：

- [ ] フォルダ名はプロジェクト構造に従っているか
- [ ] 対応するテストフォルダも作成したか
- [ ] fileMatchパターンに対応しているか
- [ ] 既存のフォルダ構造と一貫性があるか

## fileMatchパターンとの対応表

この表は、ファイルパスと自動的に読み込まれるsteeringファイルの対応関係を示しています。

| フォルダ/ファイルパターン | トリガーされるsteering | 説明 |
|------------------------|---------------------|------|
| `**/*.test.ts`, `**/*.spec.ts`, `**/test/**/*` | `development/testing-strategy.md` | テストファイル編集時 |
| `**/validation/**/*`, `**/validators/**/*` | `development/data-validation.md` | バリデーション関連 |
| `**/scraper/**/*`, `**/collector/**/*` | `development/tdnet-scraping-patterns.md` | スクレイピング実装 |
| `**/api/**/*`, `**/lambda/query/**/*` | `api/api-design-guidelines.md` | API関連 |
| `**/cdk/**/*`, `**/lambda/**/*`, `**/.env*` | `infrastructure/environment-variables.md` | 環境変数使用 |
| `**/lambda/**/*`, `**/cdk/**/*` | `infrastructure/performance-optimization.md` | パフォーマンス最適化 |
| `**/cdk/**/*`, `**/monitoring/**/*` | `infrastructure/monitoring-alerts.md` | 監視とアラート |
| `**/cdk/**/*`, `**/.github/workflows/**/*` | `infrastructure/deployment-checklist.md` | デプロイ関連 |
| `**/cdk/**/*`, `**/iam/**/*`, `**/security/**/*` | `security/security-best-practices.md` | セキュリティ関連 |

### パターンマッチングの理解

**ワイルドカードの意味:**
- `**`: 再帰的にすべてのサブディレクトリをマッチ
- `*`: 単一レベルのワイルドカード
- `|`: OR条件（複数パターンのいずれか）

**例:**
- `**/test/**/*` → `test/` フォルダ以下のすべてのファイル
- `**/*.test.ts` → すべての `.test.ts` ファイル
- `**/lambda/**/*` → `lambda/` フォルダ以下のすべてのファイル

### 複数steeringの読み込み

同じファイルパターンに対して複数のsteeringファイルが読み込まれる場合があります。これは意図的な設計です。

**例: CDKファイル編集時（`**/cdk/**/*`）**

以下のsteeringファイルがすべて読み込まれます：
- `security/security-best-practices.md` - セキュリティベストプラクティス
- `infrastructure/deployment-checklist.md` - デプロイチェックリスト
- `infrastructure/environment-variables.md` - 環境変数管理
- `infrastructure/performance-optimization.md` - パフォーマンス最適化
- `infrastructure/monitoring-alerts.md` - 監視とアラート

**理由:** CDKはインフラストラクチャ全体を定義するため、すべての観点が必要です。

## 命名規則チェックリスト

新しいファイルを作成する前に確認：

### 基本チェック

- [ ] ファイル名は機能を明確に表現しているか
- [ ] 適切なフォルダに配置されているか
- [ ] fileMatchパターンに対応しているか
- [ ] ケバブケース（kebab-case）を使用しているか
- [ ] 拡張子は適切か（`.ts`, `.test.ts`, `.spec.ts`）

### テストファイルのチェック

- [ ] テストファイルは対応する実装ファイルと同じ構造か
- [ ] テストの種類を拡張子で区別しているか（`.test.ts`, `.integration.test.ts`, `.e2e.test.ts`）
- [ ] テストフォルダ構造は実装フォルダ構造と対応しているか

### Lambda関数のチェック

- [ ] `index.ts` がエントリーポイントとして存在するか
- [ ] `handler.ts` にハンドラー実装があるか
- [ ] `types.ts` に型定義があるか
- [ ] `{function-name}.test.ts` にテストがあるか

### CDKのチェック

- [ ] スタックは `stacks/` フォルダに配置されているか
- [ ] コンストラクトは `constructs/` フォルダに配置されているか
- [ ] IAM関連は `iam/` フォルダに配置されているか
- [ ] セキュリティ設定は `security/` フォルダに配置されているか

## 命名規則の例外

以下の場合は、標準的な命名規則から外れることが許容されます：

### 1. 外部ライブラリとの統合

外部ライブラリが特定の命名規則を要求する場合：

```typescript
// Next.jsの場合
pages/api/disclosures.ts  // Next.jsの規約に従う

// Jestの設定ファイル
jest.config.js             // Jestの規約に従う
```

### 2. 設定ファイル

プロジェクトルートの設定ファイル：

```
tsconfig.json
package.json
.eslintrc.js
.prettierrc
```

### 3. ドキュメントファイル

ドキュメントファイルは大文字で始めることが許容されます：

```
README.md
CHANGELOG.md
LICENSE
```

## トラブルシューティング

### steeringファイルが読み込まれない場合

**症状:** ファイルを編集しても、期待するsteeringファイルが読み込まれない

**確認事項:**
1. ファイルパスがfileMatchパターンにマッチしているか確認
2. steeringファイルのfront-matterが正しく設定されているか確認
3. パターンマッチングのルールを理解しているか確認

**解決策:**
- fileMatchパターン対応表を参照
- ファイルを適切なフォルダに移動
- steeringファイルのfront-matterを修正

### ファイル配置が不明な場合

**症状:** 新しいファイルをどこに配置すべきか分からない

**確認事項:**
1. ファイルの役割を明確にする
2. プロジェクト構造を参照
3. 類似のファイルがどこに配置されているか確認

**解決策:**
- プロジェクト構造セクションを参照
- フォルダの役割表を確認
- 既存のファイル配置を参考にする

---

## 関連ドキュメント

### 参照元（このファイルを参照しているファイル）

- **実装ルール**: `../core/tdnet-implementation-rules.md` - プロジェクトの基本実装原則とファイル構造

### 参照先（このファイルが参照しているファイル）

このファイルは他のsteeringファイルを参照していません。

## まとめ

- **一貫性**: すべてのファイルで一貫した命名規則を使用する
- **明確性**: ファイル名は機能を明確に表現する
- **構造**: 適切なフォルダ構造に従う
- **自動化**: fileMatchパターンにより、適切なsteeringファイルが自動的に読み込まれる
- **保守性**: 一貫した命名規則により、プロジェクトの保守が容易になる
