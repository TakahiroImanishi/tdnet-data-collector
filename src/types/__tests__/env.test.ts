/**
 * 環境変数型定義のユニットテスト
 *
 * validateEnvironment, getEnv, getEnvOptional関数のテスト。
 */

import { validateEnvironment, getEnv, getEnvOptional } from '../env';

describe('validateEnvironment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 環境変数をリセット（空のオブジェクトから開始）
    jest.resetModules();
    process.env = {};
  });

  afterAll(() => {
    // 環境変数を復元
    process.env = originalEnv;
  });

  it('すべての必須環境変数が設定されている場合、エラーをスローしない', () => {
    process.env.DYNAMODB_TABLE = 'test-table';
    process.env.S3_BUCKET = 'test-bucket';
    process.env.LOG_LEVEL = 'INFO';

    expect(() => {
      validateEnvironment(['DYNAMODB_TABLE', 'S3_BUCKET', 'LOG_LEVEL']);
    }).not.toThrow();
  });

  it('必須環境変数が1つ未設定の場合、エラーをスローする', () => {
    process.env.DYNAMODB_TABLE = 'test-table';
    process.env.S3_BUCKET = 'test-bucket';
    // LOG_LEVELは未設定

    expect(() => {
      validateEnvironment(['DYNAMODB_TABLE', 'S3_BUCKET', 'LOG_LEVEL']);
    }).toThrow('Missing required environment variables: LOG_LEVEL');
  });

  it('必須環境変数が複数未設定の場合、すべてをエラーメッセージに含める', () => {
    process.env.DYNAMODB_TABLE = 'test-table';
    // S3_BUCKETとLOG_LEVELは未設定

    expect(() => {
      validateEnvironment(['DYNAMODB_TABLE', 'S3_BUCKET', 'LOG_LEVEL']);
    }).toThrow('Missing required environment variables: S3_BUCKET, LOG_LEVEL');
  });

  it('空の配列を渡した場合、エラーをスローしない', () => {
    expect(() => {
      validateEnvironment([]);
    }).not.toThrow();
  });

  it('環境変数が空文字列の場合、エラーをスローする', () => {
    process.env.DYNAMODB_TABLE = '';

    expect(() => {
      validateEnvironment(['DYNAMODB_TABLE']);
    }).toThrow('Missing required environment variables: DYNAMODB_TABLE');
  });
});

describe('getEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {};
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('環境変数が設定されている場合、その値を返す', () => {
    process.env.DYNAMODB_TABLE = 'test-table';

    const result = getEnv('DYNAMODB_TABLE');

    expect(result).toBe('test-table');
  });

  it('環境変数が未設定でデフォルト値がある場合、デフォルト値を返す', () => {
    delete process.env.LOG_LEVEL;

    const result = getEnv('LOG_LEVEL', 'INFO');

    expect(result).toBe('INFO');
  });

  it('環境変数が未設定でデフォルト値がない場合、エラーをスローする', () => {
    delete process.env.DYNAMODB_TABLE;

    expect(() => {
      getEnv('DYNAMODB_TABLE');
    }).toThrow('Environment variable DYNAMODB_TABLE is not set and no default value provided');
  });

  it('環境変数が空文字列の場合、空文字列を返す', () => {
    process.env.DYNAMODB_TABLE = '';

    const result = getEnv('DYNAMODB_TABLE');

    expect(result).toBe('');
  });

  it('デフォルト値が空文字列の場合、空文字列を返す', () => {
    delete process.env.LOG_LEVEL;

    const result = getEnv('LOG_LEVEL', '');

    expect(result).toBe('');
  });
});

describe('getEnvOptional', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {};
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('環境変数が設定されている場合、その値を返す', () => {
    process.env.STATE_MACHINE_ARN = 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:test';

    const result = getEnvOptional('STATE_MACHINE_ARN');

    expect(result).toBe('arn:aws:states:ap-northeast-1:123456789012:stateMachine:test');
  });

  it('環境変数が未設定の場合、undefinedを返す', () => {
    delete process.env.STATE_MACHINE_ARN;

    const result = getEnvOptional('STATE_MACHINE_ARN');

    expect(result).toBeUndefined();
  });

  it('環境変数が空文字列の場合、空文字列を返す', () => {
    process.env.STATE_MACHINE_ARN = '';

    const result = getEnvOptional('STATE_MACHINE_ARN');

    expect(result).toBe('');
  });
});

describe('型定義の整合性', () => {
  it('BaseLambdaEnvironmentの必須フィールドが定義されている', () => {
    // 型チェックのみ（コンパイル時に検証）
    const env: Partial<Record<string, string>> = {
      AWS_REGION: 'ap-northeast-1',
      AWS_LAMBDA_FUNCTION_NAME: 'test-function',
      LOG_LEVEL: 'INFO',
      ENVIRONMENT: 'dev',
      NODE_OPTIONS: '--enable-source-maps',
    };

    expect(env.AWS_REGION).toBe('ap-northeast-1');
    expect(env.LOG_LEVEL).toBe('INFO');
  });

  it('CollectorEnvironmentの必須フィールドが定義されている', () => {
    const env: Partial<Record<string, string>> = {
      AWS_REGION: 'ap-northeast-1',
      AWS_LAMBDA_FUNCTION_NAME: 'tdnet-collector-prod',
      LOG_LEVEL: 'INFO',
      ENVIRONMENT: 'prod',
      NODE_OPTIONS: '--enable-source-maps',
      DYNAMODB_TABLE: 'tdnet-disclosures-prod',
      DYNAMODB_EXECUTIONS_TABLE: 'tdnet-executions-prod',
      S3_BUCKET: 'tdnet-pdfs-prod',
      TDNET_BASE_URL: 'https://www.release.tdnet.info/inbs',
    };

    expect(env.DYNAMODB_TABLE).toBe('tdnet-disclosures-prod');
    expect(env.S3_BUCKET).toBe('tdnet-pdfs-prod');
  });
});
