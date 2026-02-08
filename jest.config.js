module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/cdk'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  
  // Exclude improved test examples from running
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.improved\\.ts$',
  ],
  
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  
  collectCoverageFrom: [
    'src/**/*.ts',
    'cdk/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.improved.ts',
    '!src/**/__tests__/test-helpers.ts',
    '!cdk/**/*.test.ts',
    '!cdk/**/*.spec.ts',
  ],
  
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  moduleFileExtensions: ['ts', 'js', 'json'],
  verbose: true,
  
  // タイムアウト設定の最適化
  testTimeout: 30000,
  
  // テスト実行の最適化
  maxWorkers: '50%', // CPU使用率を50%に制限
  
  // モジュール解決の最適化
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  // セットアップファイル
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // グローバル設定
  globals: {
    'ts-jest': {
      isolatedModules: true, // 型チェックをスキップして高速化
    },
  },
  
  // キャッシュの有効化
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
};
