---
inclusion: fileMatch
fileMatchPattern: '**/cdk/lib/**/*-stack.ts|**/cdk/lib/constructs/**/*.ts|**/src/**/index.ts|**/utils/**/index.ts'
---

# ファイル・フォルダ命名規則

## 基本原則

**fileMatchパターンに対応した命名規則に従う** → 適切なsteeringファイルが自動読み込み

## プロジェクト構造

```
src/
├── lambda/{function-name}/  # Lambda関数
│   ├── index.ts            # エントリーポイント
│   ├── handler.ts          # ハンドラー実装
│   ├── types.ts            # 型定義
│   └── {name}.test.ts      # テスト
├── scraper/                # スクレイピング
├── validation/validators/  # バリデータ
├── api/routes/             # APIルート
├── api/middleware/         # ミドルウェア
└── utils/                  # ユーティリティ

cdk/lib/
├── stacks/                 # CDKスタック
├── constructs/             # CDKコンストラクト
├── iam/                    # IAMポリシー
└── security/               # セキュリティ設定

test/
├── unit/                   # ユニットテスト
├── integration/            # 統合テスト
└── e2e/                    # E2Eテスト
```

## 命名規則

| 種類 | 形式 | 例 |
|------|------|-----|
| Lambda関数 | `{function-name}/` | `collector/`, `query/` |
| スクレイパー | `{target}-scraper.ts` | `tdnet-scraper.ts` |
| バリデータ | `{target}-validator.ts` | `disclosure-validator.ts` |
| CDKスタック | `{name}-stack.ts` | `tdnet-stack.ts` |
| CDKコンストラクト | `{resource}-construct.ts` | `lambda-construct.ts` |
| テスト | `{name}.test.ts` | `collector.test.ts` |
| 統合テスト | `{name}.integration.test.ts` | `dynamodb.integration.test.ts` |
| E2Eテスト | `{name}.e2e.test.ts` | `api.e2e.test.ts` |

## ✅ 良い例

```
src/lambda/collector/index.ts
src/scraper/tdnet-scraper.ts
src/validation/validators/disclosure-validator.ts
cdk/lib/stacks/tdnet-stack.ts
test/unit/validators/disclosure-validator.test.ts
```

## ❌ 悪い例

```
src/utils/helper.ts              # 何のヘルパー？
src/functions/func1.ts           # 機能が不明
src/my-validator.ts              # validation/validators/ に配置すべき
cdk/my-stack.ts                  # cdk/lib/stacks/ に配置すべき
test/test1.ts                    # 対象が不明
```

## チェックリスト

- [ ] ファイル名が機能を明確に表現
- [ ] 適切なフォルダに配置
- [ ] fileMatchパターンに対応
- [ ] ケバブケース（kebab-case）使用
- [ ] テストファイルが実装ファイルと対応

## 関連ドキュメント

- `../core/tdnet-implementation-rules.md` - 実装原則とファイル構造