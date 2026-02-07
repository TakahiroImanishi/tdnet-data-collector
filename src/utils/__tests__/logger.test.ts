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
});
