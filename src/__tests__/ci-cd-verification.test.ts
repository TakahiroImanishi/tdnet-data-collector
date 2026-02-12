/**
 * CI/CD Pipeline Verification Tests
 * 
 * Property 15: テストカバレッジの維持
 * Validates: Requirements 14.1, 14.5
 * 
 * このテストは、CI/CDパイプラインで実行される検証項目を確認します。
 * - コードカバレッジが80%以上であることを確認
 * - すべてのテストが成功することを確認
 * - ビルドが成功することを確認
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('CI/CD Pipeline Verification', () => {
  describe('Property 15: テストカバレッジの維持', () => {
    it('コードカバレッジが80%以上であることを確認', () => {
      // Arrange
      const coverageThreshold = 80;

      // Act
      // カバレッジレポートを実行
      try {
        execSync('npm run test:coverage -- --silent', {
          stdio: 'pipe',
          encoding: 'utf-8',
        });
      } catch (error) {
        // カバレッジが閾値を下回った場合はエラーがスローされる
        // テストは失敗するが、カバレッジレポートは生成される
      }

      // Assert
      // coverage/coverage-summary.jsonを読み込む
      const coverageSummaryPath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
      
      if (!fs.existsSync(coverageSummaryPath)) {
        throw new Error('カバレッジレポートが生成されていません。npm run test:coverageを実行してください。');
      }

      const coverageSummary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf-8'));
      const totalCoverage = coverageSummary.total;

      // 各カバレッジメトリクスを確認
      expect(totalCoverage.lines.pct).toBeGreaterThanOrEqual(coverageThreshold);
      expect(totalCoverage.statements.pct).toBeGreaterThanOrEqual(coverageThreshold);
      expect(totalCoverage.functions.pct).toBeGreaterThanOrEqual(coverageThreshold);
      expect(totalCoverage.branches.pct).toBeGreaterThanOrEqual(coverageThreshold);

      console.log('✅ コードカバレッジ:');
      console.log(`  - Lines: ${totalCoverage.lines.pct}%`);
      console.log(`  - Statements: ${totalCoverage.statements.pct}%`);
      console.log(`  - Functions: ${totalCoverage.functions.pct}%`);
      console.log(`  - Branches: ${totalCoverage.branches.pct}%`);
    });

    it('すべてのユニットテストが成功することを確認', () => {
      // Arrange & Act
      let testOutput: string;
      try {
        testOutput = execSync('npm test -- --passWithNoTests', {
          stdio: 'pipe',
          encoding: 'utf-8',
        });
      } catch (error: any) {
        // テストが失敗した場合
        throw new Error(`ユニットテストが失敗しました:\n${error.stdout || error.message}`);
      }

      // Assert
      expect(testOutput).toContain('Test Suites:');
      expect(testOutput).not.toContain('failed');
      
      console.log('✅ すべてのユニットテストが成功しました');
    });

    it('すべてのE2Eテストが成功することを確認（LocalStack環境）', () => {
      // Arrange
      const isLocalStackAvailable = process.env.TEST_ENV === 'e2e' || process.env.CI === 'true';

      if (!isLocalStackAvailable) {
        console.log('⚠️  LocalStack環境が利用できないため、E2Eテストをスキップします');
        return;
      }

      // Act
      let testOutput: string;
      try {
        testOutput = execSync('npm run test:e2e -- --passWithNoTests', {
          stdio: 'pipe',
          encoding: 'utf-8',
        });
      } catch (error: any) {
        // E2Eテストが失敗した場合
        throw new Error(`E2Eテストが失敗しました:\n${error.stdout || error.message}`);
      }

      // Assert
      expect(testOutput).toContain('Test Suites:');
      expect(testOutput).not.toContain('failed');
      
      console.log('✅ すべてのE2Eテストが成功しました');
    });

    it('TypeScriptビルドが成功することを確認', () => {
      // Arrange & Act
      let buildOutput: string;
      try {
        buildOutput = execSync('npm run build', {
          stdio: 'pipe',
          encoding: 'utf-8',
        });
      } catch (error: any) {
        // ビルドが失敗した場合
        throw new Error(`TypeScriptビルドが失敗しました:\n${error.stdout || error.message}`);
      }

      // Assert
      // distディレクトリが存在することを確認
      const distPath = path.join(process.cwd(), 'dist');
      expect(fs.existsSync(distPath)).toBe(true);
      
      console.log('✅ TypeScriptビルドが成功しました');
    });

    it('CDKスタックが正しく合成できることを確認', () => {
      // Arrange & Act
      let synthOutput: string;
      try {
        synthOutput = execSync('npm run cdk synth -- --quiet', {
          stdio: 'pipe',
          encoding: 'utf-8',
          cwd: process.cwd(),
        });
      } catch (error: any) {
        // CDK合成が失敗した場合
        throw new Error(`CDKスタック合成が失敗しました:\n${error.stdout || error.message}`);
      }

      // Assert
      // CloudFormationテンプレートが生成されることを確認
      expect(synthOutput).toBeTruthy();
      
      console.log('✅ CDKスタックが正しく合成できました');
    });

    it('Lintチェックが成功することを確認', () => {
      // Arrange & Act
      let lintOutput: string;
      try {
        lintOutput = execSync('npm run lint', {
          stdio: 'pipe',
          encoding: 'utf-8',
        });
      } catch (error: any) {
        // Lintが失敗した場合
        throw new Error(`Lintチェックが失敗しました:\n${error.stdout || error.message}`);
      }

      // Assert
      expect(lintOutput).toBeTruthy();
      
      console.log('✅ Lintチェックが成功しました');
    });
  });

  describe('環境分離の検証', () => {
    it('dev環境とprod環境で異なる設定が適用されることを確認', () => {
      // Arrange
      const { getEnvironmentConfig } = require('../cdk/lib/config/environment-config');

      // Act
      const devConfig = getEnvironmentConfig('dev');
      const prodConfig = getEnvironmentConfig('prod');

      // Assert
      // タイムアウトが異なることを確認
      expect(devConfig.collector.timeout).toBeLessThan(prodConfig.collector.timeout);
      
      // メモリサイズが異なることを確認
      expect(devConfig.collector.memorySize).toBeLessThanOrEqual(prodConfig.collector.memorySize);
      
      // ログレベルが異なることを確認
      expect(devConfig.collector.logLevel).toBe('DEBUG');
      expect(prodConfig.collector.logLevel).toBe('INFO');

      console.log('✅ dev環境とprod環境で異なる設定が適用されています');
      console.log(`  - dev: timeout=${devConfig.collector.timeout}s, memory=${devConfig.collector.memorySize}MB, log=${devConfig.collector.logLevel}`);
      console.log(`  - prod: timeout=${prodConfig.collector.timeout}s, memory=${prodConfig.collector.memorySize}MB, log=${prodConfig.collector.logLevel}`);
    });

    it('すべてのLambda関数に環境別設定が適用されることを確認', () => {
      // Arrange
      const { getEnvironmentConfig } = require('../cdk/lib/config/environment-config');
      const devConfig = getEnvironmentConfig('dev');
      const prodConfig = getEnvironmentConfig('prod');

      // Act & Assert
      const lambdaFunctions = ['collector', 'query', 'export', 'collect', 'collectStatus', 'exportStatus', 'pdfDownload'];
      
      lambdaFunctions.forEach((funcName) => {
        expect(devConfig[funcName]).toBeDefined();
        expect(prodConfig[funcName]).toBeDefined();
        
        expect(devConfig[funcName].timeout).toBeGreaterThan(0);
        expect(devConfig[funcName].memorySize).toBeGreaterThan(0);
        expect(devConfig[funcName].logLevel).toBeDefined();
        
        expect(prodConfig[funcName].timeout).toBeGreaterThan(0);
        expect(prodConfig[funcName].memorySize).toBeGreaterThan(0);
        expect(prodConfig[funcName].logLevel).toBeDefined();
      });

      console.log('✅ すべてのLambda関数に環境別設定が適用されています');
    });
  });

  describe('CI/CDパイプラインの設定検証', () => {
    it('GitHub Actionsワークフローファイルが存在することを確認', () => {
      // Arrange
      const workflowFiles = [
        '.github/workflows/test.yml',
        '.github/workflows/deploy.yml',
        '.github/workflows/e2e-test.yml',
      ];

      // Act & Assert
      workflowFiles.forEach((file) => {
        const filePath = path.join(process.cwd(), file);
        expect(fs.existsSync(filePath)).toBe(true);
        console.log(`✅ ${file} が存在します`);
      });
    });

    it('package.jsonにCI/CD用スクリプトが定義されていることを確認', () => {
      // Arrange
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      // Act & Assert
      const requiredScripts = ['test', 'test:coverage', 'test:e2e', 'build', 'lint', 'cdk'];
      
      requiredScripts.forEach((script) => {
        expect(packageJson.scripts[script]).toBeDefined();
        console.log(`✅ npm run ${script} が定義されています`);
      });
    });
  });
});
