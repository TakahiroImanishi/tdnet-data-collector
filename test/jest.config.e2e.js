/**
 * Jest Configuration for E2E Tests
 *
 * E2Eテスト専用の設定ファイル。
 * LocalStack環境または開発環境で実行されることを想定しています。
 */

// config/.env.localを読み込む（E2Eテスト実行前に環境変数を設定）
require('dotenv').config({ path: 'config/.env.local' });

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/../src'],
  
  // E2Eテストのみを実行
  testMatch: ['**/__tests__/**/*.e2e.test.ts'],
  
  // 他のテストファイルを除外しない（testMatchで明示的に指定しているため）
  testPathIgnorePatterns: [
    '/node_modules/',
  ],
  
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
      useESM: false,
    }],
  },
  
  // CommonJS形式を使用
  extensionsToTreatAsEsm: [],
  
  // E2Eテスト用のセットアップファイル
  setupFilesAfterEnv: ['<rootDir>/../jest.setup.e2e.js'],
  
  moduleFileExtensions: ['ts', 'js', 'json'],
  verbose: true,
  
  // E2Eテストは時間がかかるため、タイムアウトを延長
  testTimeout: 60000, // 60秒
  
  // E2Eテストは並列実行しない（LocalStackの競合を避けるため）
  maxWorkers: 1,
  
  // モジュール解決
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
  },
  
  // キャッシュの有効化
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache-e2e',
  
  // カバレッジは収集しない（E2Eテストではカバレッジは重要でない）
  collectCoverage: false,
};
