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
```text
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
```text
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
**/utils/error*.ts|**/utils/retry*.ts|**/scraper/**/*.ts|**/collector/**/*.ts|**/api/**/*.ts|**/lambda/**/*.ts
```

### マッチすべきファイル ✅
- `src/utils/error-handler.ts`
- `src/utils/retry.ts`
- `src/scraper/tdnet-scraper.ts`
- `src/collector/batch-processor.ts`
- `src/api/disclosures.ts`
- `lambda/collector/handler.ts`
- `lambda/collector/index.ts`
- `lambda/collector/utils.ts`
- `lambda/query/handler.ts`
- `src/lambda/export/handler.ts`
- `lambda/utils/error-handler/index.ts`

### マッチすべきでないファイル ❌
- `src/validators/disclosure.ts` (対象フォルダ外)
- `cdk/lib/lambda-stack.ts` (CDKファイル、Lambda関数コードではない)
- `README.md`
- `package.json`

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
**/cdk/**/*.ts|**/lambda/**/*.ts|**/.env*
```

### マッチすべきファイル ✅
- `cdk/lib/tdnet-stack.ts`
- `cdk/lib/lambda-stack.ts`
- `cdk/bin/app.ts`
- `lambda/collector/handler.ts`
- `lambda/collector/index.ts`
- `lambda/collector/utils.ts`
- `lambda/query/handler.ts`
- `src/lambda/export/handler.ts`
- `.env`
- `.env.local`
- `.env.production`
- `config/.env.dev`

### マッチすべきでないファイル ❌
- `src/api/disclosures.ts` (cdk/lambdaフォルダ外)
- `src/utils/env-helper.ts` (cdk/lambdaフォルダ外)
- `README.md`
- `package.json`

---

## infrastructure/performance-optimization.md

### fileMatchPattern
```
**/cdk/lib/constructs/*lambda*.ts|**/cdk/lib/constructs/*function*.ts|**/dynamodb/**/*.ts|**/s3/**/*.ts|**/lambda/**/*.ts
```

### マッチすべきファイル ✅
- `cdk/lib/constructs/lambda-construct.ts`
- `cdk/lib/constructs/function-construct.ts`
- `src/dynamodb/client.ts`
- `src/s3/uploader.ts`
- `lambda/collector/handler.ts`
- `lambda/collector/index.ts`
- `lambda/collector/utils.ts`
- `lambda/query/handler.ts`
- `src/lambda/export/handler.ts`

### マッチすべきでないファイル ❌
- `cdk/lib/tdnet-stack.ts` (constructs/*lambda*.ts|*function*.tsパターンに非該当)
- `src/api/disclosures.ts` (対象フォルダ外)
- `src/utils/performance.ts` (対象フォルダ外)
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

### 手動テスト（推奨）

各steeringファイルのパターンマッチングを検証する手順：

#### ステップ1: テスト対象ファイルを作成

```powershell
# 例: testing-strategy.mdのパターンをテスト
New-Item -ItemType File -Path "src/validators/disclosure.test.ts" -Force
```

#### ステップ2: ファイルを編集

VS Codeでファイルを開き、何か変更を加えて保存します。

#### ステップ3: Kiroの読み込みを確認

Kiroのチャットで以下を確認：
- 「現在読み込まれているsteeringファイルを教えてください」と質問
- または、Kiroの応答から読み込まれたsteeringファイルを確認

#### ステップ4: 期待通りか検証

このファイルの「マッチすべきファイル」セクションと照合し、期待通りのsteeringファイルが読み込まれているか確認します。

### 検証スクリプト（将来的に実装）

パターンマッチングを自動検証するスクリプトの実装例：

```typescript
// .kiro/steering/meta/verify-patterns.ts
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import minimatch from 'minimatch';

interface SteeringFile {
    path: string;
    pattern: string;
}

interface TestCase {
    name: string;
    pattern: string;
    testPath: string;
    expected: boolean;
}

// すべてのsteeringファイルを読み込み
function loadSteeringFiles(dir: string): SteeringFile[] {
    const files: SteeringFile[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
            files.push(...loadSteeringFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            
            if (frontMatterMatch) {
                const frontMatter = yaml.load(frontMatterMatch[1]) as any;
                if (frontMatter.fileMatchPattern) {
                    files.push({
                        path: fullPath,
                        pattern: frontMatter.fileMatchPattern,
                    });
                }
            }
        }
    }
    
    return files;
}

// パターンマッチングをテスト
function testPattern(pattern: string, testPath: string): boolean {
    const patterns = pattern.split('|');
    return patterns.some(p => minimatch(testPath, p.trim()));
}

// テストケースを実行
function runTests() {
    const steeringFiles = loadSteeringFiles('.kiro/steering');
    
    // テストケースの例（実際にはpattern-matching-tests.mdから読み込む）
    const testCases: TestCase[] = [
        {
            name: 'testing-strategy.md should match test files',
            pattern: '**/*.test.ts|**/*.spec.ts',
            testPath: 'src/validators/disclosure.test.ts',
            expected: true,
        },
        {
            name: 'testing-strategy.md should not match non-test files',
            pattern: '**/*.test.ts|**/*.spec.ts',
            testPath: 'src/validators/disclosure.ts',
            expected: false,
        },
        {
            name: 'data-validation.md should match validators',
            pattern: '**/validators/**/*.ts',
            testPath: 'src/validators/disclosure.ts',
            expected: true,
        },
        {
            name: 'data-validation.md should not match non-validators',
            pattern: '**/validators/**/*.ts',
            testPath: 'src/utils/validator-helper.ts',
            expected: false,
        },
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const testCase of testCases) {
        const result = testPattern(testCase.pattern, testCase.testPath);
        if (result === testCase.expected) {
            passed++;
            console.log(`✅ PASS: ${testCase.name}`);
        } else {
            failed++;
            console.log(`❌ FAIL: ${testCase.name}`);
            console.log(`   Expected: ${testCase.expected}, Got: ${result}`);
            console.log(`   Pattern: ${testCase.pattern}`);
            console.log(`   Test Path: ${testCase.testPath}`);
        }
    }
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log(`${'='.repeat(50)}`);
    
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
```

**実行方法:**
```powershell
# 必要なパッケージをインストール（未インストールの場合）
npm install -g typescript ts-node minimatch js-yaml @types/node @types/minimatch @types/js-yaml

# スクリプトを実行
ts-node .kiro/steering/meta/verify-patterns.ts
```

### クイックテスト用コマンド

各パターンを手動で素早くテストするためのPowerShellコマンド：

```powershell
# パターンマッチングをテスト（minimatchを使用）
function Test-Pattern {
    param(
        [string]$Pattern,
        [string]$TestPath
    )
    
    # Node.jsでminimatchを使用
    node -e "const minimatch = require('minimatch'); console.log(minimatch('$TestPath', '$Pattern'));"
}

# 使用例
Test-Pattern "**/*.test.ts" "src/validators/disclosure.test.ts"  # true
Test-Pattern "**/*.test.ts" "src/validators/disclosure.ts"       # false
Test-Pattern "**/validators/**/*.ts" "src/validators/disclosure.ts"  # true
Test-Pattern "**/validators/**/*.ts" "src/utils/validator-helper.ts"  # false
```

**複数パターン（OR条件）のテスト:**
```powershell
function Test-MultiPattern {
    param(
        [string]$Pattern,  # パイプ区切り（例: "**/*.test.ts|**/*.spec.ts"）
        [string]$TestPath
    )
    
    $patterns = $Pattern -split '\|'
    foreach ($p in $patterns) {
        $result = node -e "const minimatch = require('minimatch'); console.log(minimatch('$TestPath', '$($p.Trim())'));"
        if ($result -eq "true") {
            Write-Host "✅ Match: $TestPath matches pattern: $($p.Trim())"
            return $true
        }
    }
    Write-Host "❌ No Match: $TestPath does not match any pattern in: $Pattern"
    return $false
}

# 使用例
Test-MultiPattern "**/*.test.ts|**/*.spec.ts" "src/validators/disclosure.test.ts"
Test-MultiPattern "**/*.test.ts|**/*.spec.ts" "src/validators/disclosure.spec.ts"
Test-MultiPattern "**/*.test.ts|**/*.spec.ts" "src/validators/disclosure.ts"
```

---

## トラブルシューティング

### パターンがマッチしない場合

1. **パターン構文を確認**: `**` を使用しているか、`|` の前後にスペースがないか
2. **ファイルパスを確認**: ワークスペースルートからの相対パスか
3. **front-matterを確認**: `inclusion: fileMatch` が設定されているか
4. **クイックテストコマンドで検証**: 上記の `Test-Pattern` または `Test-MultiPattern` を使用

### 意図しないファイルにマッチする場合

1. **パターンが広すぎる**: より具体的なパターンに変更
2. **複数パターンの競合**: 他のsteeringファイルのパターンも確認
3. **ワイルドカードの使い方**: `*` と `**` の違いを確認

### 検証スクリプトの実行エラー

1. **Node.jsがインストールされているか確認**:
   ```powershell
   node --version
   npm --version
   ```

2. **minimatchパッケージがインストールされているか確認**:
   ```powershell
   npm list -g minimatch
   ```

3. **TypeScriptがインストールされているか確認**:
   ```powershell
   tsc --version
   ts-node --version
   ```

---

## 変更履歴

- 2026-02-07: 初版作成 - 全steeringファイルのパターンマッチングテストケースを追加
- 2026-02-07: テスト実行方法を大幅に拡充 - 手動テスト手順、検証スクリプト、クイックテストコマンドを追加
- 2026-02-07: tests/フォルダからmeta/フォルダに移動 - steeringファイルのメタ情報として適切に配置
- 2026-02-07: Issue 5対応 - Lambda関連パターンを統合（`**/lambda/**/*.ts`に拡大）
  - `error-handling-implementation.md`: `**/lambda/**/*.ts`を追加
  - `environment-variables.md`: `**/cdk/**/*.ts|**/lambda/**/*.ts|**/.env*`に変更
  - `performance-optimization.md`: `**/lambda/**/*.ts`を追加
