module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  roots: ['<rootDir>/src', '<rootDir>/cdk'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  
  // Exclude improved test examples from running
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.improved\\.ts$',
    // E2Eテストはローカル環境ではスキップ（CI/CD環境でのみ実行）
    process.env.RUN_E2E_TESTS !== 'true' ? '\\.e2e\\.test\\.ts$' : '',
    // テストヘルパーファイルを除外
    '/__tests__/test-helpers/',
  ].filter(Boolean),
  
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
      isolatedModules: true,
    }],
  },
  
  collectCoverageFrom: [
    'src/**/*.ts',
    'cdk/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.improved.ts',
    '!src/**/__tests__/**',
    '!cdk/**/*.test.ts',
    '!cdk/**/*.spec.ts',
    '!cdk/**/__tests__/**',
    // Phase 3実装予定の未実装機能を除外（タスク19.9）
    '!src/lambda/get-disclosure/**',
    '!src/lambda/health/**',
    '!src/lambda/stats/**',
  ],
  
  coverageDirectory: 'test/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  moduleFileExtensions: ['ts', 'js', 'json'],
  verbose: false, // 詳細ログを無効化してパフォーマンス向上
  
  // タイムアウト設定の最適化
  testTimeout: 30000,
  
  // テスト実行の最適化
  maxWorkers: '75%', // CPU使用率を75%に引き上げ（テスト実行時間短縮）,
  
  // モジュール解決の最適化
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  // セットアップファイル
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.js'],
  
  // キャッシュの有効化
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
};
