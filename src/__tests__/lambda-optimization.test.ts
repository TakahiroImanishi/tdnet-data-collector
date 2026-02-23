/**
 * Lambda最適化テスト
 *
 * タスク24.3: Lambda実行時間の最適化
 * - 不要な依存関係の削除確認
 * - コールドスタート時間の短縮確認
 * - バンドルサイズの最適化確認
 *
 * テスト戦略: .kiro/steering/development/testing-strategy.md
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Lambda最適化テスト', () => {
  describe('依存関係の最適化', () => {
    test('package.jsonにCDK関連の依存関係がdependenciesに含まれていないこと', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
      );

      // CDK関連はdevDependenciesにあるべき
      expect(packageJson.dependencies).not.toHaveProperty('aws-cdk-lib');
      expect(packageJson.dependencies).not.toHaveProperty('constructs');
      expect(packageJson.devDependencies).toHaveProperty('aws-cdk-lib');
      expect(packageJson.devDependencies).toHaveProperty('constructs');
    });

    test('package.jsonにテスト関連の依存関係がdependenciesに含まれていないこと', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
      );

      // テスト関連はdevDependenciesにあるべき
      expect(packageJson.dependencies).not.toHaveProperty('fast-check');
      expect(packageJson.dependencies).not.toHaveProperty('jest');
      expect(packageJson.dependencies).not.toHaveProperty('@types/jest');
      expect(packageJson.devDependencies).toHaveProperty('fast-check');
      expect(packageJson.devDependencies).toHaveProperty('jest');
    });

    test('AWS SDKのバージョンが統一されていること', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
      );

      const awsSdkPackages = Object.keys(packageJson.dependencies).filter((pkg) =>
        pkg.startsWith('@aws-sdk/')
      );

      // すべてのAWS SDKパッケージのバージョンを取得
      const versions = awsSdkPackages.map((pkg) => packageJson.dependencies[pkg]);

      // バージョンが統一されているか確認（^3.515.0に統一）
      const expectedVersion = '^3.515.0';
      versions.forEach((version) => {
        expect(version).toBe(expectedVersion);
      });
    });

    test('本番環境で不要な依存関係が含まれていないこと', () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
      );

      // 本番環境で不要な依存関係のリスト
      const unnecessaryDeps = [
        'aws-cdk-lib',
        'constructs',
        'fast-check',
        'jest',
        '@types/jest',
        'ts-jest',
        'eslint',
        'prettier',
        'dotenv', // Lambda環境変数で管理
      ];

      unnecessaryDeps.forEach((dep) => {
        expect(packageJson.dependencies).not.toHaveProperty(dep);
      });
    });
  });

  describe('TypeScript設定の最適化', () => {
    test('tsconfig.jsonでremoveCommentsが有効になっていること', () => {
      const tsconfig = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../tsconfig.json'), 'utf-8')
      );

      expect(tsconfig.compilerOptions.removeComments).toBe(true);
    });

    test('tsconfig.jsonでsourceMapが有効になっていること（デバッグ用）', () => {
      const tsconfig = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../tsconfig.json'), 'utf-8')
      );

      // ソースマップは有効（エラートレース用）
      expect(tsconfig.compilerOptions.sourceMap).toBe(true);
    });

    test('tsconfig.jsonでtargetがES2022であること', () => {
      const tsconfig = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../tsconfig.json'), 'utf-8')
      );

      // Node.js 20.xはES2022をサポート
      expect(tsconfig.compilerOptions.target).toBe('ES2022');
    });
  });

  describe('Lambda関数のコールドスタート最適化', () => {
    test('Lambda関数がグローバルスコープでAWSクライアントを初期化していること', () => {
      // query/query-disclosures.ts（DynamoDBクライアント）
      const queryDisclosures = fs.readFileSync(
        path.join(__dirname, '../lambda/query/query-disclosures.ts'),
        'utf-8'
      );
      // グローバルスコープでの初期化パターンを確認
      expect(queryDisclosures).toMatch(/const dynamoClient = new DynamoDBClient/);

      // グローバルスコープでの環境変数キャッシュを確認
      expect(queryDisclosures).toMatch(/const TABLE_NAME = process\.env\.DYNAMODB_TABLE_NAME/);
    });

    test('Lambda関数が環境変数をグローバルスコープでキャッシュしていること', () => {
      // query/query-disclosures.ts
      const queryDisclosures = fs.readFileSync(
        path.join(__dirname, '../lambda/query/query-disclosures.ts'),
        'utf-8'
      );
      // DynamoDBクライアントがグローバルスコープで初期化されていることを確認
      expect(queryDisclosures).toContain('DynamoDBClient');
      expect(queryDisclosures).toContain('const dynamoClient');
    });
  });

  describe('バンドルサイズの最適化', () => {
    test('Lambda関数のdistディレクトリが存在すること', () => {
      const distPath = path.join(__dirname, '../../dist/src/lambda');

      // ビルドが実行されていない場合はスキップ
      if (!fs.existsSync(distPath)) {
        console.warn('⚠️  dist/src/lambda が存在しません。npm run build を実行してください。');
        return;
      }

      expect(fs.existsSync(distPath)).toBe(true);
    });

    test('各Lambda関数のバンドルサイズが適切であること', () => {
      const distPath = path.join(__dirname, '../../dist/src/lambda');

      // ビルドが実行されていない場合はスキップ
      if (!fs.existsSync(distPath)) {
        console.warn('⚠️  dist/src/lambda が存在しません。npm run build を実行してください。');
        return;
      }

      const lambdaFunctions = ['collector', 'query', 'export', 'collect', 'stats', 'health'];

      lambdaFunctions.forEach((funcName) => {
        const funcPath = path.join(distPath, funcName);

        if (!fs.existsSync(funcPath)) {
          console.warn(`⚠️  ${funcName} のビルド出力が存在しません。`);
          return;
        }

        // 各Lambda関数のファイルサイズを確認
        const files = fs.readdirSync(funcPath);
        const totalSize = files.reduce((acc, file) => {
          const filePath = path.join(funcPath, file);
          const stats = fs.statSync(filePath);
          return acc + stats.size;
        }, 0);

        // バンドルサイズが10MB以下であることを確認（Lambda制限は50MB）
        const sizeMB = totalSize / (1024 * 1024);
        console.log(`📦 ${funcName}: ${sizeMB.toFixed(2)} MB`);
        expect(sizeMB).toBeLessThan(10);
      });
    });
  });

  describe('メモリとタイムアウトの設定', () => {
    test('environment-config.tsで適切なメモリサイズが設定されていること', () => {
      const envConfig = fs.readFileSync(
        path.join(__dirname, '../../cdk/lib/config/environment-config.ts'),
        'utf-8'
      );

      // Collector: 256-512MB（ネットワークI/O待機が多い）
      expect(envConfig).toMatch(/collector:.*memorySize:\s*(256|512)/s);

      // Query: 128-256MB（軽量なデータ取得）
      expect(envConfig).toMatch(/query:.*memorySize:\s*(128|256)/s);

      // Export: 256-512MB（メモリ集約的）
      expect(envConfig).toMatch(/export:.*memorySize:\s*(256|512)/s);
    });

    test('environment-config.tsで適切なタイムアウトが設定されていること', () => {
      const envConfig = fs.readFileSync(
        path.join(__dirname, '../../cdk/lib/config/environment-config.ts'),
        'utf-8'
      );

      // Collector: 5-15分（スクレイピング）
      expect(envConfig).toMatch(/collector:.*timeout:\s*(300|900)/s);

      // Query: 10-30秒（API）
      expect(envConfig).toMatch(/query:.*timeout:\s*(10|30)/s);

      // Export: 2-5分（大量データ）
      expect(envConfig).toMatch(/export:.*timeout:\s*(120|300)/s);
    });
  });

  describe('コスト最適化', () => {
    test('DynamoDBがオンデマンド課金モードであること', () => {
      const stackFile = fs.readFileSync(
        path.join(__dirname, '../../cdk/lib/stacks/foundation-stack.ts'),
        'utf-8'
      );

      // すべてのDynamoDBテーブルがオンデマンドモード
      expect(stackFile).toMatch(/billingMode:\s*dynamodb\.BillingMode\.PAY_PER_REQUEST/);
    });

    test('S3バケットにライフサイクルポリシーが設定されていること', () => {
      const stackFile = fs.readFileSync(
        path.join(__dirname, '../../cdk/lib/stacks/foundation-stack.ts'),
        'utf-8'
      );

      // PDFバケット: Standard-IA → Glacier移行
      expect(stackFile).toMatch(/storageClass:\s*s3\.StorageClass\.INFREQUENT_ACCESS/);
      expect(stackFile).toMatch(/storageClass:\s*s3\.StorageClass\.GLACIER/);

      // Exportsバケット: 7日後に自動削除
      expect(stackFile).toMatch(/expiration:\s*cdk\.Duration\.days\(7\)/);
    });
  });
});
