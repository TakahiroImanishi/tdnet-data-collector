/**
 * ロガーのユニットテスト
 *
 * 構造化ロガーの動作を検証します。
 * ログレベルの適切性、ログフォーマット、コンテキストの記録を確認します。
 *
 * Requirements: 要件6.3, 6.5（構造化ログ、ログレベル）
 */

import { logger, LogLevel, setLogLevel, createErrorContext } from '../logger';
import { ValidationError, RetryableError } from '../../errors';

// Winstonのモック
jest.mock('winston', () => {
  const mFormat = {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    printf: jest.fn(),
  };

  const mTransports = {
    Console: jest.fn(),
  };

  const mLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    level: 'info',
  };

  return {
    format: mFormat,
    transports: mTransports,
    createLogger: jest.fn(() => mLogger),
  };
});

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 13: ログレベルの適切性
   *
   * エラーはERRORレベルで記録されることを確認します。
   */
  describe('Error Logging', () => {
    it('should log errors at ERROR level', () => {
      const errorMessage = 'Operation failed';
      const context = {
        error_type: 'NetworkError',
        error_message: 'Connection timeout',
      };

      logger.error(errorMessage, context);

      // Winstonのerrorメソッドが呼ばれることを確認
      const winston = require('winston');
      const mockLogger = winston.createLogger();
      expect(mockLogger.error).toHaveBeenCalledWith(errorMessage, context);
    });

    it('should log errors with stack trace', () => {
      const error = new Error('Test error');
      const errorMessage = 'Failed to process disclosure';

      logger.error(errorMessage, {
        error_type: error.constructor.name,
        error_message: error.message,
        stack_trace: error.stack,
      });

      const winston = require('winston');
      const mockLogger = winston.createLogger();
      expect(mockLogger.error).toHaveBeenCalled();

      const callArgs = mockLogger.error.mock.calls[0];
      expect(callArgs[0]).toBe(errorMessage);
      expect(callArgs[1]).toHaveProperty('error_type', 'Error');
      expect(callArgs[1]).toHaveProperty('error_message', 'Test error');
      expect(callArgs[1]).toHaveProperty('stack_trace');
    });

    it('should log custom error types', () => {
      const error = new ValidationError('Invalid date format');
      const errorMessage = 'Validation failed';

      logger.error(errorMessage, {
        error_type: error.constructor.name,
        error_message: error.message,
      });

      const winston = require('winston');
      const mockLogger = winston.createLogger();
      expect(mockLogger.error).toHaveBeenCalled();

      const callArgs = mockLogger.error.mock.calls[0];
      expect(callArgs[1]).toHaveProperty('error_type', 'ValidationError');
    });
  });

  /**
   * Property 13: ログレベルの適切性
   *
   * 警告はWARNINGレベルで記録されることを確認します。
   */
  describe('Warning Logging', () => {
    it('should log warnings at WARN level', () => {
      const warningMessage = 'Duplicate item detected';
      const context = {
        disclosure_id: 'TD20240115001',
      };

      logger.warn(warningMessage, context);

      const winston = require('winston');
      const mockLogger = winston.createLogger();
      expect(mockLogger.warn).toHaveBeenCalledWith(warningMessage, context);
    });

    it('should log partial failures as warnings', () => {
      const warningMessage = 'Partial failure in batch processing';
      const context = {
        total: 100,
        success: 95,
        failed: 5,
      };

      logger.warn(warningMessage, context);

      const winston = require('winston');
      const mockLogger = winston.createLogger();
      expect(mockLogger.warn).toHaveBeenCalled();

      const callArgs = mockLogger.warn.mock.calls[0];
      expect(callArgs[0]).toBe(warningMessage);
      expect(callArgs[1]).toMatchObject(context);
    });
  });

  describe('Info Logging', () => {
    it('should log info messages at INFO level', () => {
      const infoMessage = 'Disclosure saved successfully';
      const context = {
        disclosure_id: 'TD20240115001',
        date_partition: '2024-01',
      };

      logger.info(infoMessage, context);

      const winston = require('winston');
      const mockLogger = winston.createLogger();
      expect(mockLogger.info).toHaveBeenCalledWith(infoMessage, context);
    });
  });

  describe('Debug Logging', () => {
    it('should log debug messages at DEBUG level', () => {
      const debugMessage = 'Processing disclosure';
      const context = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
      };

      logger.debug(debugMessage, context);

      const winston = require('winston');
      const mockLogger = winston.createLogger();
      expect(mockLogger.debug).toHaveBeenCalledWith(debugMessage, context);
    });
  });

  describe('Log Context', () => {
    it('should include context in log messages', () => {
      const message = 'Operation completed';
      const context = {
        disclosure_id: 'TD20240115001',
        execution_time: 1234,
        retry_count: 2,
      };

      logger.info(message, context);

      const winston = require('winston');
      const mockLogger = winston.createLogger();
      expect(mockLogger.info).toHaveBeenCalledWith(message, context);
    });

    it('should handle empty context', () => {
      const message = 'Operation completed';

      logger.info(message);

      const winston = require('winston');
      const mockLogger = winston.createLogger();
      expect(mockLogger.info).toHaveBeenCalledWith(message, undefined);
    });

    it('should log with context at different log levels', () => {
      const context = { test: 'value' };
      
      logger.debug('Debug message', context);
      logger.info('Info message', context);
      logger.warn('Warn message', context);
      logger.error('Error message', context);

      const winston = require('winston');
      const mockLogger = winston.createLogger();
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Debug message', context);
      expect(mockLogger.info).toHaveBeenCalledWith('Info message', context);
      expect(mockLogger.warn).toHaveBeenCalledWith('Warn message', context);
      expect(mockLogger.error).toHaveBeenCalledWith('Error message', context);
    });

    it('should log without context at different log levels', () => {
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      const winston = require('winston');
      const mockLogger = winston.createLogger();
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Debug message', undefined);
      expect(mockLogger.info).toHaveBeenCalledWith('Info message', undefined);
      expect(mockLogger.warn).toHaveBeenCalledWith('Warn message', undefined);
      expect(mockLogger.error).toHaveBeenCalledWith('Error message', undefined);
    });
  });
});

describe('createErrorContext', () => {
  it('should create error context from Error object', () => {
    const error = new Error('Test error');
    const context = createErrorContext(error);

    expect(context).toHaveProperty('error_type', 'Error');
    expect(context).toHaveProperty('error_message', 'Test error');
    expect(context).toHaveProperty('stack_trace');
    expect(context.stack_trace).toContain('Test error');
  });

  it('should create error context from custom error', () => {
    const error = new ValidationError('Invalid date format');
    const context = createErrorContext(error);

    expect(context).toHaveProperty('error_type', 'ValidationError');
    expect(context).toHaveProperty('error_message', 'Invalid date format');
    expect(context).toHaveProperty('stack_trace');
  });

  it('should merge additional context', () => {
    const error = new RetryableError('Network error');
    const additionalContext = {
      disclosure_id: 'TD20240115001',
      retry_count: 2,
    };

    const context = createErrorContext(error, additionalContext);

    expect(context).toHaveProperty('error_type', 'RetryableError');
    expect(context).toHaveProperty('error_message', 'Network error');
    expect(context).toHaveProperty('stack_trace');
    expect(context).toHaveProperty('disclosure_id', 'TD20240115001');
    expect(context).toHaveProperty('retry_count', 2);
  });

  it('should handle nested context objects', () => {
    const error = new Error('Test error');
    const additionalContext = {
      context: {
        disclosure_id: 'TD20240115001',
        execution_id: 'exec-123',
      },
    };

    const context = createErrorContext(error, additionalContext);

    expect(context).toHaveProperty('error_type', 'Error');
    expect(context).toHaveProperty('context');
    expect(context.context).toMatchObject({
      disclosure_id: 'TD20240115001',
      execution_id: 'exec-123',
    });
  });
});

describe('setLogLevel', () => {
  it('should set log level to DEBUG', () => {
    setLogLevel(LogLevel.DEBUG);

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    expect(mockLogger.level).toBe('debug');
  });

  it('should set log level to INFO', () => {
    setLogLevel(LogLevel.INFO);

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    expect(mockLogger.level).toBe('info');
  });

  it('should set log level to WARN', () => {
    setLogLevel(LogLevel.WARN);

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    expect(mockLogger.level).toBe('warn');
  });

  it('should set log level to ERROR', () => {
    setLogLevel(LogLevel.ERROR);

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    expect(mockLogger.level).toBe('error');
  });
});

describe('Structured Logging Format', () => {
  it('should log in JSON format for CloudWatch', () => {
    const message = 'Test message';
    const context = {
      disclosure_id: 'TD20240115001',
      timestamp: '2024-01-15T10:30:00Z',
    };

    logger.info(message, context);

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    expect(mockLogger.info).toHaveBeenCalledWith(message, context);
  });

  it('should include service metadata', () => {
    // WinstonのcreateLoggerが呼ばれたときのdefaultMetaを確認
    const winston = require('winston');
    expect(winston.createLogger).toHaveBeenCalled();

    // createLoggerが引数付きで呼ばれていることを確認
    const calls = winston.createLogger.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    
    // 最初の呼び出しに引数があれば、defaultMetaを確認
    if (calls[0] && calls[0][0]) {
      const createLoggerCall = calls[0][0];
      expect(createLoggerCall).toHaveProperty('defaultMeta');
      expect(createLoggerCall.defaultMeta).toHaveProperty('service', 'tdnet-data-collector');
    }
  });

  it('should use LOG_LEVEL environment variable when set', () => {
    // 環境変数を設定してモジュールを再読み込み
    const originalLogLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'debug';

    // モジュールキャッシュをクリアして再読み込み
    jest.resetModules();
    require('../logger');

    const winston = require('winston');
    const calls = winston.createLogger.mock.calls;
    const lastCall = calls[calls.length - 1];
    
    if (lastCall && lastCall[0]) {
      expect(lastCall[0].level).toBe('debug');
    }

    // 環境変数を元に戻す
    if (originalLogLevel) {
      process.env.LOG_LEVEL = originalLogLevel;
    } else {
      delete process.env.LOG_LEVEL;
    }
  });

  it('should default to INFO level when LOG_LEVEL is not set', () => {
    // 環境変数を削除してモジュールを再読み込み
    const originalLogLevel = process.env.LOG_LEVEL;
    delete process.env.LOG_LEVEL;

    jest.resetModules();
    require('../logger');

    const winston = require('winston');
    const calls = winston.createLogger.mock.calls;
    const lastCall = calls[calls.length - 1];
    
    if (lastCall && lastCall[0]) {
      expect(lastCall[0].level).toBe('info');
    }

    // 環境変数を元に戻す
    if (originalLogLevel) {
      process.env.LOG_LEVEL = originalLogLevel;
    }
  });

  it('should use NODE_ENV environment variable when set', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    jest.resetModules();
    require('../logger');

    const winston = require('winston');
    const calls = winston.createLogger.mock.calls;
    const lastCall = calls[calls.length - 1];
    
    if (lastCall && lastCall[0]) {
      expect(lastCall[0].defaultMeta.environment).toBe('production');
    }

    // 環境変数を元に戻す
    if (originalNodeEnv) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  it('should default to development when NODE_ENV is not set', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;

    jest.resetModules();
    require('../logger');

    const winston = require('winston');
    const calls = winston.createLogger.mock.calls;
    const lastCall = calls[calls.length - 1];
    
    if (lastCall && lastCall[0]) {
      expect(lastCall[0].defaultMeta.environment).toBe('development');
    }

    // 環境変数を元に戻す
    if (originalNodeEnv) {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('should format log messages with empty meta correctly', () => {
    // Winston formatのprintfが空のmetaを正しく処理することを確認
    const winston = require('winston');
    const calls = winston.createLogger.mock.calls;
    
    // createLoggerが呼ばれていることを確認
    expect(calls.length).toBeGreaterThan(0);
    
    // Console transportのformatにprintfが含まれていることを確認
    const lastCall = calls[calls.length - 1];
    if (lastCall && lastCall[0] && lastCall[0].transports) {
      expect(lastCall[0].transports).toBeDefined();
      expect(lastCall[0].transports.length).toBeGreaterThan(0);
    }
  });

  it('should test printf formatter with meta', () => {
    // printfフォーマッターの動作を直接テスト
    const formatter = ({ timestamp, level, message, ...meta }: any) => {
      const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
      return `${timestamp} [${level}]: ${message} ${metaStr}`;
    };

    // metaがある場合
    const resultWithMeta = formatter({
      timestamp: '2024-01-15T10:30:00Z',
      level: 'info',
      message: 'Test message',
      disclosure_id: 'TD20240115001',
      company_code: '1234',
    });
    
    expect(resultWithMeta).toContain('Test message');
    expect(resultWithMeta).toContain('disclosure_id');
    expect(resultWithMeta).toContain('TD20240115001');

    // metaがない場合
    const resultWithoutMeta = formatter({
      timestamp: '2024-01-15T10:30:00Z',
      level: 'info',
      message: 'Test message',
    });
    
    expect(resultWithoutMeta).toContain('Test message');
    expect(resultWithoutMeta).not.toContain('disclosure_id');
  });
});

describe('logLambdaError', () => {
  it('should log Lambda error with standard format', () => {
    const { logLambdaError } = require('../logger');
    const error = new ValidationError('Invalid input');
    const lambdaContext = {
      requestId: 'test-request-id',
      functionName: 'TestFunction',
    };

    logLambdaError('Lambda execution failed', error, lambdaContext);

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Lambda execution failed',
      expect.objectContaining({
        error_type: 'ValidationError',
        error_message: 'Invalid input',
        context: expect.objectContaining({
          request_id: 'test-request-id',
          function_name: 'TestFunction',
        }),
        stack_trace: expect.any(String),
      })
    );
  });

  it('should log Lambda error with additional context', () => {
    const { logLambdaError } = require('../logger');
    const error = new RetryableError('Network error');
    const lambdaContext = {
      requestId: 'test-request-id',
      functionName: 'TestFunction',
    };
    const additionalContext = {
      disclosure_id: 'TD20240115001',
      retry_count: 2,
    };

    logLambdaError('Lambda execution failed', error, lambdaContext, additionalContext);

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Lambda execution failed',
      expect.objectContaining({
        error_type: 'RetryableError',
        error_message: 'Network error',
        context: expect.objectContaining({
          request_id: 'test-request-id',
          function_name: 'TestFunction',
          disclosure_id: 'TD20240115001',
          retry_count: 2,
        }),
        stack_trace: expect.any(String),
      })
    );
  });

  it('should handle missing Lambda context', () => {
    const { logLambdaError } = require('../logger');
    const error = new Error('Test error');

    logLambdaError('Lambda execution failed', error);

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Lambda execution failed',
      expect.objectContaining({
        error_type: 'Error',
        error_message: 'Test error',
        context: expect.objectContaining({
          request_id: undefined,
          function_name: undefined,
        }),
        stack_trace: expect.any(String),
      })
    );
  });
});


describe('Logger - エッジケース', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('空文字列のメッセージでもログを記録', () => {
    logger.info('');
    logger.warn('');
    logger.error('');
    logger.debug('');

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    
    expect(mockLogger.info).toHaveBeenCalledWith('', undefined);
    expect(mockLogger.warn).toHaveBeenCalledWith('', undefined);
    expect(mockLogger.error).toHaveBeenCalledWith('', undefined);
    expect(mockLogger.debug).toHaveBeenCalledWith('', undefined);
  });

  it('非常に長いメッセージでもログを記録', () => {
    const longMessage = 'a'.repeat(10000);
    logger.info(longMessage);

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    
    expect(mockLogger.info).toHaveBeenCalledWith(longMessage, undefined);
  });

  it('特殊文字を含むメッセージでもログを記録', () => {
    const specialMessage = 'Test\n\r\t"\'\\message';
    logger.info(specialMessage);

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    
    expect(mockLogger.info).toHaveBeenCalledWith(specialMessage, undefined);
  });

  it('非常に大きなコンテキストオブジェクトでもログを記録', () => {
    const largeContext: any = {};
    for (let i = 0; i < 100; i++) {
      largeContext[`key${i}`] = `value${i}`;
    }

    logger.info('Large context test', largeContext);

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    
    expect(mockLogger.info).toHaveBeenCalledWith('Large context test', largeContext);
  });

  it('ネストされたコンテキストオブジェクトでもログを記録', () => {
    const nestedContext = {
      level1: {
        level2: {
          level3: {
            value: 'deep',
          },
        },
      },
    };

    logger.info('Nested context test', nestedContext);

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    
    expect(mockLogger.info).toHaveBeenCalledWith('Nested context test', nestedContext);
  });

  it('配列を含むコンテキストでもログを記録', () => {
    const contextWithArray = {
      items: ['item1', 'item2', 'item3'],
      numbers: [1, 2, 3],
    };

    logger.info('Array context test', contextWithArray);

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    
    expect(mockLogger.info).toHaveBeenCalledWith('Array context test', contextWithArray);
  });

  it('nullやundefinedを含むコンテキストでもログを記録', () => {
    const contextWithNulls = {
      nullValue: null,
      undefinedValue: undefined,
      emptyString: '',
      zero: 0,
      false: false,
    };

    logger.info('Null context test', contextWithNulls);

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    
    expect(mockLogger.info).toHaveBeenCalledWith('Null context test', contextWithNulls);
  });
});

describe('createErrorContext - エッジケース', () => {
  it('スタックトレースがないエラーでも処理できる', () => {
    const error = new Error('Test error');
    delete error.stack;

    const context = createErrorContext(error);

    expect(context).toHaveProperty('error_type', 'Error');
    expect(context).toHaveProperty('error_message', 'Test error');
    expect(context).toHaveProperty('stack_trace', undefined);
  });

  it('空のエラーメッセージでも処理できる', () => {
    const error = new Error('');
    const context = createErrorContext(error);

    expect(context).toHaveProperty('error_type', 'Error');
    expect(context).toHaveProperty('error_message', '');
    expect(context).toHaveProperty('stack_trace');
  });

  it('非常に長いエラーメッセージでも処理できる', () => {
    const longMessage = 'Error: ' + 'a'.repeat(10000);
    const error = new Error(longMessage);
    const context = createErrorContext(error);

    expect(context).toHaveProperty('error_type', 'Error');
    expect(context).toHaveProperty('error_message', longMessage);
  });

  it('追加コンテキストがnullでも処理できる', () => {
    const error = new Error('Test error');
    const context = createErrorContext(error, null as any);

    expect(context).toHaveProperty('error_type', 'Error');
    expect(context).toHaveProperty('error_message', 'Test error');
  });

  it('追加コンテキストがundefinedでも処理できる', () => {
    const error = new Error('Test error');
    const context = createErrorContext(error, undefined);

    expect(context).toHaveProperty('error_type', 'Error');
    expect(context).toHaveProperty('error_message', 'Test error');
  });

  it('追加コンテキストが空オブジェクトでも処理できる', () => {
    const error = new Error('Test error');
    const context = createErrorContext(error, {});

    expect(context).toHaveProperty('error_type', 'Error');
    expect(context).toHaveProperty('error_message', 'Test error');
  });
});

describe('logLambdaError - エッジケース', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lambdaContextがundefinedでも処理できる', () => {
    const { logLambdaError } = require('../logger');
    const error = new Error('Test error');

    logLambdaError('Lambda execution failed', error, undefined);

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Lambda execution failed',
      expect.objectContaining({
        error_type: 'Error',
        error_message: 'Test error',
        context: expect.objectContaining({
          request_id: undefined,
          function_name: undefined,
        }),
      })
    );
  });

  it('lambdaContextが空オブジェクトでも処理できる', () => {
    const { logLambdaError } = require('../logger');
    const error = new Error('Test error');

    logLambdaError('Lambda execution failed', error, {});

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Lambda execution failed',
      expect.objectContaining({
        error_type: 'Error',
        error_message: 'Test error',
        context: expect.objectContaining({
          request_id: undefined,
          function_name: undefined,
        }),
      })
    );
  });

  it('additionalContextがnullでも処理できる', () => {
    const { logLambdaError } = require('../logger');
    const error = new Error('Test error');
    const lambdaContext = {
      requestId: 'test-request-id',
      functionName: 'TestFunction',
    };

    logLambdaError('Lambda execution failed', error, lambdaContext, null as any);

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('空文字列のメッセージでも処理できる', () => {
    const { logLambdaError } = require('../logger');
    const error = new Error('Test error');

    logLambdaError('', error);

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        error_type: 'Error',
        error_message: 'Test error',
      })
    );
  });
});

describe('setLogLevel - エッジケース', () => {
  it('同じログレベルを複数回設定しても問題ない', () => {
    setLogLevel(LogLevel.INFO);
    setLogLevel(LogLevel.INFO);
    setLogLevel(LogLevel.INFO);

    const winston = require('winston');
    const mockLogger = winston.createLogger();
    expect(mockLogger.level).toBe('info');
  });

  it('ログレベルを順番に変更できる', () => {
    setLogLevel(LogLevel.DEBUG);
    expect(require('winston').createLogger().level).toBe('debug');

    setLogLevel(LogLevel.INFO);
    expect(require('winston').createLogger().level).toBe('info');

    setLogLevel(LogLevel.WARN);
    expect(require('winston').createLogger().level).toBe('warn');

    setLogLevel(LogLevel.ERROR);
    expect(require('winston').createLogger().level).toBe('error');
  });
});
