---
inclusion: fileMatch
fileMatchPattern: '**/.kiro/steering/**/*.md'
---

# fileMatchPattern テストケース

このファイルは、各steeringファイルのfileMatchPatternが意図したファイルに正しくマッチするかを検証するためのテストケースをまとめたものです。

## テスト方法

各パターンについて、以下を確認：
1. **マッチすべきファイル**: パターンがマッチすることを期待するファイルパス
2. **マッチすべきでないファイル**: パターンがマッチしないことを期待するファイルパス

---

## development/testing-strategy.md

### fileMatchPattern
```
**/*.test.ts|**/*.spec.ts
```

### マッチすべきファイル ✅
- `src/validators/disclosure.test.ts`
- `src/scraper/tdnet-scraper.spec.ts`
- `tests/unit/validation.test.ts`
- `lambda/collector/handler.test.ts`
- `cdk/test/stack.test.ts`

### マッチすべきでないファイル ❌
- `src/validators/disclosure.ts`
- `src/utils/logger.ts`
- `README.md`
- `package.json`

---

## development/data-validation.md

### fileMatchPattern
```
**/validators/**/*.ts
```

### マッチすべきファイル ✅
- `src/validators/disclosure.ts`
- `src/validators/company-code.ts`
- `lambda/validators/date-range.ts`
- `src/validators/utils/sanitize.ts`
- `validators/pdf-validator.ts`

### マッチすべきでないファイル ❌
- `src/utils/validator-helper.ts` (validatorsフォルダ外)
- `src/validators/disclosure.test.ts` (テストファイル)
- `src/scraper/tdnet-scraper.ts`
- `README.md`

---

## development/tdnet-scraping-patterns.md

### fileMatchPattern
```
**/scraper/**/*.ts|**/collector/**/*.ts
```

### マッチすべきファイル ✅
- `src/scraper/tdnet-scraper.ts`
- `src/scraper/pdf-downloader.ts`
- `lambda/collector/handler.ts`
- `lambda/collector/index.ts`
- `src/collector/batch-processor.ts`
- `scraper/utils/rate-limiter.ts`

### マッチすべきでないファイル ❌
- `src/utils/scraper-helper.ts` (scraperフォルダ外)
- `src/validators/disclosure.ts`
- `src/api/routes.ts`
- `README.md`

---

## development/error-handling-implementation.md

### fileMatchPattern
```
**/lambda/**/handler.ts|**/lambda/**/index.ts
```

### マッチすべきファイル ✅
- `lambda/collector/handler.ts`
- `lambda/collector/index.ts`
- `lambda/query/handler.ts`
- `lambda/query/index.ts`
- `src/lambda/export/handler.ts`
- `lambda/utils/error-handler/index.ts`

### マッチすべきでないファイル ❌
- `lambda/collector/utils.ts` (handler.ts/index.ts以外)
- `src/utils/handler-helper.ts` (lambdaフォルダ外)
- `cdk/lib/lambda-stack.ts`
- `README.md`

---

## api/api-design-guidelines.md

### fileMatchPattern
```
**/api/**/*.ts|**/routes/**/*.ts
```

### マッチすべきファイル ✅
- `src/api/disclosures.ts`
- `src/api/exports.ts`
- `lambda/api/handler.ts`
- `src/routes/disclosures.ts`
- `src/routes/health.ts`
- `api/middleware/auth.ts`

### マッチすべきでないファイル ❌
- `src/utils/api-helper.ts` (apiフォルダ外)
- `src/validators/disclosure.ts`
- `cdk/lib/api-stack.ts`
- `README.md`

---

## api/error-codes.md

### fileMatchPattern
```
**/api/**/*.ts|**/routes/**/*.ts
```

### マッチすべきファイル ✅
- `src/api/disclosures.ts`
- `src/api/exports.ts`
- `lambda/api/handler.ts`
- `src/routes/disclosures.ts`
- `src/routes/health.ts`
- `api/middleware/error-handler.ts`

### マッチすべきでないファイル ❌
- `src/utils/error-helper.ts` (apiフォルダ外)
- `src/validators/disclosure.ts`
- `cdk/lib/api-stack.ts`
- `README.md`

---

## security/security-best-practices.md

### fileMatchPattern
```
**/cdk/**/*.ts|**/iam/**/*.ts|**/security/**/*.ts
```

### マッチすべきファイル ✅
- `cdk/lib/tdnet-stack.ts`
- `cdk/lib/lambda-stack.ts`
- `cdk/bin/app.ts`
- `src/iam/policies.ts`
- `src/security/encryption.ts`
- `iam/roles/lambda-role.ts`
- `security/waf/rules.ts`

### マッチすべきでないファイル ❌
- `src/utils/security-helper.ts` (security/iam/cdkフォルダ外)
- `lambda/collector/handler.ts`
- `src/api/disclosures.ts`
- `README.md`

---

## infrastructure/deployment-checklist.md

### fileMatchPattern
```
**/cdk/**/*.ts
```

### マッチすべきファイル ✅
- `cdk/lib/tdnet-stack.ts`
- `cdk/lib/lambda-stack.ts`
- `cdk/lib/api-stack.ts`
- `cdk/bin/app.ts`
- `cdk/test/stack.test.ts`
- `cdk/lib/constructs/custom-construct.ts`

### マッチすべきでないファイル ❌
- `src/lambda/collector/handler.ts`
- `src/api/disclosures.ts`
- `src/utils/cdk-helper.ts` (cdkフォルダ外)
- `README.md`

---

## infrastructure/environment-variables.md

### fileMatchPattern
```
**/cdk/**/*.ts|**/lambda/**/handler.ts|**/lambda/**/index.ts|**/.env*
```

### マッチすべきファイル ✅
- `cdk/lib/tdnet-stack.ts`
- `lambda/collector/handler.ts`
- `lambda/collector/index.ts`
- `lambda/query/handler.ts`
- `.env`
- `.env.local`
- `.env.production`
- `config/.env.dev`

### マッチすべきでないファイル ❌
- `lambda/collector/utils.ts` (handler.ts/index.ts以外)
- `src/utils/env-helper.ts`
- `README.md`
- `package.json`

---

## infrastructure/performance-optimization.md

### fileMatchPattern
```
**/cdk/**/*.ts|**/lambda/**/*.ts
```

### マッチすべきファイル ✅
- `cdk/lib/tdnet-stack.ts`
- `lambda/collector/handler.ts`
- `lambda/collector/index.ts`
- `lambda/collector/utils.ts`
- `lambda/query/handler.ts`
- `src/lambda/export/handler.ts`

### マッチすべきでないファイル ❌
- `src/api/disclosures.ts` (lambdaフォルダ外)
- `src/utils/performance.ts` (lambdaフォルダ外)
- `README.md`
- `package.json`

---

## infrastructure/monitoring-alerts.md

### fileMatchPattern
```
**/monitoring/**/*.ts
```

### マッチすべきファイル ✅
- `src/monitoring/cloudwatch.ts`
- `src/monitoring/alarms.ts`
- `cdk/lib/monitoring/dashboard.ts`
- `monitoring/metrics/custom-metrics.ts`
- `lambda/monitoring/logger.ts`

### マッチすべきでないファイル ❌
- `src/utils/monitoring-helper.ts` (monitoringフォルダ外)
- `lambda/collector/handler.ts`
- `cdk/lib/tdnet-stack.ts`
- `README.md`

---

## development/workflow-guidelines.md

### fileMatchPattern
```
**/.kiro/specs/**/*.md
```

### マッチすべきファイル ✅
- `.kiro/specs/tdnet-data-collector/spec.md`
- `.kiro/specs/tdnet-data-collector/tasks.md`
- `.kiro/specs/tdnet-data-collector/improvements/task-1.1-improvement-1.md`
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260207.md`
- `.kiro/specs/feature-x/spec.md`

### マッチすべきでないファイル ❌
- `.kiro/steering/README.md` (specsフォルダ外)
- `README.md` (specsフォルダ外)
- `docs/architecture.md` (specsフォルダ外)
- `package.json`

---

## development/documentation-standards.md

### fileMatchPattern
```
**/*.md
```

### マッチすべきファイル ✅
- `README.md`
- `docs/architecture.md`
- `.kiro/steering/README.md`
- `.kiro/specs/tdnet-data-collector/spec.md`
- `lambda/collector/README.md`
- `CHANGELOG.md`

### マッチすべきでないファイル ❌
- `src/utils/logger.ts`
- `package.json`
- `tsconfig.json`
- `.gitignore`

---

## パターンマッチングのルール

### ワイルドカード

- `*`: 単一レベルのワイルドカード（ディレクトリ区切りを含まない）
  - 例: `*.ts` → `file.ts` にマッチ、`dir/file.ts` にマッチしない
- `**`: 再帰的ワイルドカード（すべてのサブディレクトリを含む）
  - 例: `**/*.ts` → `file.ts`, `dir/file.ts`, `dir/sub/file.ts` すべてにマッチ

### OR条件

- `|`: 複数パターンのいずれかにマッチ
  - 例: `**/*.test.ts|**/*.spec.ts` → `.test.ts` または `.spec.ts` で終わるファイル

### 注意点

1. **パターンは相対パス**: ワークスペースルートからの相対パスでマッチング
2. **大文字小文字**: 通常は区別される（OSに依存）
3. **複数マッチ**: 複数のsteeringファイルのパターンにマッチする場合、すべて読み込まれる

---

## テスト実行方法

### 手動テスト

1. 対象ファイルを編集
2. Kiroが読み込んだsteeringファイルを確認
3. 期待通りのsteeringファイルが読み込まれているか検証

### 自動テスト（将来的に実装）

```typescript
// pattern-matching.test.ts
import { matchPattern } from './pattern-matcher';

describe('fileMatchPattern tests', () => {
    test('testing-strategy.md should match test files', () => {
        const pattern = '**/*.test.ts|**/*.spec.ts';
        
        expect(matchPattern(pattern, 'src/validators/disclosure.test.ts')).toBe(true);
        expect(matchPattern(pattern, 'src/validators/disclosure.ts')).toBe(false);
    });
    
    test('data-validation.md should match validators', () => {
        const pattern = '**/validators/**/*.ts';
        
        expect(matchPattern(pattern, 'src/validators/disclosure.ts')).toBe(true);
        expect(matchPattern(pattern, 'src/utils/validator-helper.ts')).toBe(false);
    });
});
```

---

## トラブルシューティング

### パターンがマッチしない場合

1. **パターン構文を確認**: `**` を使用しているか、`|` の前後にスペースがないか
2. **ファイルパスを確認**: ワークスペースルートからの相対パスか
3. **front-matterを確認**: `inclusion: fileMatch` が設定されているか

### 意図しないファイルにマッチする場合

1. **パターンが広すぎる**: より具体的なパターンに変更
2. **複数パターンの競合**: 他のsteeringファイルのパターンも確認

---

## 変更履歴

- 2026-02-07: 初版作成 - 全steeringファイルのパターンマッチングテストケースを追加
