/**
 * プロジェクト構造の検証テスト
 *
 * このテストは、TDnet Data Collectorプロジェクトの初期セットアップが
 * 正しく完了していることを検証します。
 *
 * 検証項目:
 * - 必須ディレクトリの存在
 * - 必須ファイルの存在
 * - package.jsonの依存関係
 * - 設定ファイルの妥当性
 *
 * Requirements: 要件14.1（テスト）
 */

import * as fs from 'fs';
import * as path from 'path';

describe('プロジェクト構造の検証', () => {
  const rootDir = path.resolve(__dirname, '../..');

  describe('必須ディレクトリの存在確認', () => {
    const requiredDirectories = [
      'src',
      'cdk',
      'cdk/bin',
      'cdk/lib',
      'docs',
      '.kiro',
      '.kiro/specs',
      '.kiro/specs/tdnet-data-collector',
      '.kiro/steering',
    ];

    test.each(requiredDirectories)('ディレクトリ "%s" が存在すること', (dir) => {
      const dirPath = path.join(rootDir, dir);
      expect(fs.existsSync(dirPath)).toBe(true);
      expect(fs.statSync(dirPath).isDirectory()).toBe(true);
    });
  });

  describe('必須ファイルの存在確認', () => {
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      '.eslintrc.json',
      '.prettierrc.json',
      '.gitignore',
      'cdk.json',
      'README.md',
      'LICENSE',
      'cdk/bin/tdnet-data-collector-split.ts',
      'cdk/lib/stacks/foundation-stack.ts',
      'cdk/lib/stacks/compute-stack.ts',
      'cdk/lib/stacks/api-stack.ts',
      'cdk/lib/stacks/monitoring-stack.ts',
      '.kiro/specs/tdnet-data-collector/tasks/tasks-phase1-4.md',
    ];

    test.each(requiredFiles)('ファイル "%s" が存在すること', (file) => {
      const filePath = path.join(rootDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.statSync(filePath).isFile()).toBe(true);
    });
  });

  describe('package.jsonの検証', () => {
    let packageJson: any;

    beforeAll(() => {
      const packageJsonPath = path.join(rootDir, 'package.json');
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(content);
    });

    test('プロジェクト名が正しいこと', () => {
      expect(packageJson.name).toBe('tdnet-data-collector');
    });

    test('Node.jsバージョンが20.x以上であること', () => {
      expect(packageJson.engines.node).toMatch(/>=20/);
    });

    describe('必須の依存関係がインストールされていること', () => {
      const requiredDependencies = [
        'axios',
        'cheerio',
        'winston',
        '@aws-sdk/client-dynamodb',
        '@aws-sdk/client-s3',
        '@aws-sdk/client-cloudwatch',
        '@aws-sdk/client-secrets-manager',
        '@aws-sdk/client-sns',
      ];

      test.each(requiredDependencies)('依存関係 "%s" が存在すること', (dependency) => {
        expect(packageJson.dependencies).toHaveProperty(dependency);
      });
    });

    describe('必須のdevDependenciesがインストールされていること', () => {
      const requiredDevDependencies = [
        'typescript',
        'ts-node',
        'ts-jest',
        'jest',
        '@types/jest',
        '@types/node',
        'eslint',
        '@typescript-eslint/eslint-plugin',
        '@typescript-eslint/parser',
        'prettier',
        'eslint-config-prettier',
        'eslint-plugin-prettier',
        'aws-cdk',
        'aws-cdk-lib',
        'constructs',
        'fast-check',
      ];

      test.each(requiredDevDependencies)('devDependency "%s" が存在すること', (dependency) => {
        expect(packageJson.devDependencies).toHaveProperty(dependency);
      });
    });

    describe('必須のスクリプトが定義されていること', () => {
      const requiredScripts = [
        'build',
        'test',
        'test:coverage',
        'lint',
        'lint:fix',
        'format',
        'format:check',
        'cdk',
        'cdk:deploy',
        'cdk:diff',
        'cdk:synth',
      ];

      test.each(requiredScripts)('スクリプト "%s" が定義されていること', (script) => {
        expect(packageJson.scripts).toHaveProperty(script);
      });
    });
  });

  describe('tsconfig.jsonの検証', () => {
    let tsconfig: any;

    beforeAll(() => {
      const tsconfigPath = path.join(rootDir, 'tsconfig.json');
      const content = fs.readFileSync(tsconfigPath, 'utf-8');
      tsconfig = JSON.parse(content);
    });

    test('targetがES2022であること', () => {
      expect(tsconfig.compilerOptions.target).toBe('ES2022');
    });

    test('strictモードが有効であること', () => {
      expect(tsconfig.compilerOptions.strict).toBe(true);
    });

    test('必須のcompilerOptionsが設定されていること', () => {
      const requiredOptions = [
        'esModuleInterop',
        'skipLibCheck',
        'forceConsistentCasingInFileNames',
        'resolveJsonModule',
        'moduleResolution',
      ];

      requiredOptions.forEach((option) => {
        expect(tsconfig.compilerOptions).toHaveProperty(option);
      });
    });

    test('includeにsrcとcdkが含まれていること', () => {
      expect(tsconfig.include).toContain('src/**/*');
      expect(tsconfig.include).toContain('cdk/**/*');
    });

    test('excludeにnode_modulesが含まれていること', () => {
      expect(tsconfig.exclude).toContain('node_modules');
    });
  });

  describe('test/jest.config.jsの検証', () => {
    let jestConfig: any;

    beforeAll(() => {
      const jestConfigPath = path.join(rootDir, 'test', 'jest.config.js');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      jestConfig = require(jestConfigPath);
    });

    test('presetがts-jestであること', () => {
      expect(jestConfig.preset).toBe('ts-jest');
    });

    test('testEnvironmentがnodeであること', () => {
      expect(jestConfig.testEnvironment).toBe('node');
    });

    test('rootsにsrcとcdkが含まれていること', () => {
      expect(jestConfig.roots).toContain('<rootDir>/../src');
      expect(jestConfig.roots).toContain('<rootDir>/../cdk');
    });

    test('coverageThresholdが適切に設定されていること', () => {
      expect(jestConfig.coverageThreshold.global.branches).toBeGreaterThanOrEqual(75);
      expect(jestConfig.coverageThreshold.global.functions).toBeGreaterThanOrEqual(80);
      expect(jestConfig.coverageThreshold.global.lines).toBeGreaterThanOrEqual(80);
      expect(jestConfig.coverageThreshold.global.statements).toBeGreaterThanOrEqual(80);
    });
  });

  describe('.eslintrc.jsonの検証', () => {
    let eslintConfig: any;

    beforeAll(() => {
      const eslintConfigPath = path.join(rootDir, '.eslintrc.json');
      const content = fs.readFileSync(eslintConfigPath, 'utf-8');
      eslintConfig = JSON.parse(content);
    });

    test('TypeScriptパーサーが設定されていること', () => {
      expect(eslintConfig.parser).toBe('@typescript-eslint/parser');
    });

    test('必須のプラグインが設定されていること', () => {
      expect(eslintConfig.plugins).toContain('@typescript-eslint');
      expect(eslintConfig.plugins).toContain('prettier');
    });

    test('必須のextendsが設定されていること', () => {
      expect(eslintConfig.extends).toContain('eslint:recommended');
      expect(eslintConfig.extends).toContain('plugin:@typescript-eslint/recommended');
      expect(eslintConfig.extends).toContain('plugin:prettier/recommended');
    });
  });

  describe('.prettierrc.jsonの検証', () => {
    let prettierConfig: any;

    beforeAll(() => {
      const prettierConfigPath = path.join(rootDir, '.prettierrc.json');
      const content = fs.readFileSync(prettierConfigPath, 'utf-8');
      prettierConfig = JSON.parse(content);
    });

    test('Prettier設定が存在すること', () => {
      expect(prettierConfig).toBeDefined();
      expect(typeof prettierConfig).toBe('object');
    });

    test('基本的なフォーマット設定が含まれていること', () => {
      expect(prettierConfig).toHaveProperty('semi');
      expect(prettierConfig).toHaveProperty('singleQuote');
      expect(prettierConfig).toHaveProperty('trailingComma');
    });
  });

  describe('cdk.jsonの検証', () => {
    let cdkConfig: any;

    beforeAll(() => {
      const cdkConfigPath = path.join(rootDir, 'cdk.json');
      const content = fs.readFileSync(cdkConfigPath, 'utf-8');
      cdkConfig = JSON.parse(content);
    });

    test('appエントリーポイントが設定されていること', () => {
      expect(cdkConfig.app).toBeDefined();
      expect(cdkConfig.app).toContain('ts-node');
      expect(cdkConfig.app).toContain('cdk/bin/tdnet-data-collector');
    });

    test('contextが設定されていること', () => {
      expect(cdkConfig.context).toBeDefined();
      expect(typeof cdkConfig.context).toBe('object');
    });
  });

  describe('node_modulesの検証', () => {
    test('node_modulesディレクトリが存在すること', () => {
      const nodeModulesPath = path.join(rootDir, 'node_modules');
      expect(fs.existsSync(nodeModulesPath)).toBe(true);
      expect(fs.statSync(nodeModulesPath).isDirectory()).toBe(true);
    });

    test('主要な依存関係がインストールされていること', () => {
      const criticalDependencies = [
        'aws-cdk-lib',
        'constructs',
        'typescript',
        'jest',
        'fast-check',
      ];

      criticalDependencies.forEach((dep) => {
        const depPath = path.join(rootDir, 'node_modules', dep);
        expect(fs.existsSync(depPath)).toBe(true);
      });
    });
  });

  describe('CDKファイルの検証', () => {
    test('CDK binファイルが有効なTypeScriptファイルであること', () => {
      const binFilePath = path.join(rootDir, 'cdk/bin/tdnet-data-collector-split.ts');
      const content = fs.readFileSync(binFilePath, 'utf-8');

      // 基本的な構文チェック
      expect(content).toContain('#!/usr/bin/env node');
      expect(content).toContain('import');
      expect(content).toContain('App');
    });

    test('CDK stackファイルが有効なTypeScriptファイルであること', () => {
      const stackFilePath = path.join(rootDir, 'cdk/lib/stacks/foundation-stack.ts');
      const content = fs.readFileSync(stackFilePath, 'utf-8');

      // 基本的な構文チェック
      expect(content).toContain('import');
      expect(content).toContain('Stack');
      expect(content).toContain('class');
    });
  });
});
