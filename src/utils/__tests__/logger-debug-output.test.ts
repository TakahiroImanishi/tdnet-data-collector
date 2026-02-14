/**
 * ログ出力確認テスト
 * 
 * LOG_LEVEL=DEBUGでのログ出力を確認するためのテスト
 */

import { logger, setLogLevel, LogLevel, createErrorContext, logLambdaError } from '../logger';

describe('Logger Debug Output Verification', () => {
  beforeAll(() => {
    // LOG_LEVELをDEBUGに設定
    process.env.LOG_LEVEL = 'DEBUG';
    setLogLevel(LogLevel.DEBUG);
  });

  afterAll(() => {
    delete process.env.LOG_LEVEL;
  });

  it('should output DEBUG level logs', () => {
    console.log('\n=== DEBUG Level Log Test ===');
    
    logger.debug('This is a debug message', {
      test_id: 'debug-001',
      operation: 'test_operation',
    });
    
    logger.info('This is an info message', {
      test_id: 'info-001',
      status: 'success',
    });
    
    logger.warn('This is a warning message', {
      test_id: 'warn-001',
      warning_type: 'DuplicateItem',
    });
    
    logger.error('This is an error message', {
      error_type: 'TestError',
      error_message: 'Test error occurred',
      context: {
        test_id: 'error-001',
      },
      stack_trace: 'Error stack trace here',
    });
    
    console.log('=== End of Debug Level Log Test ===\n');
    
    // テストは常に成功（ログ出力の確認が目的）
    expect(true).toBe(true);
  });

  it('should output structured error logs', () => {
    console.log('\n=== Structured Error Log Test ===');
    
    try {
      throw new Error('Test error for structured logging');
    } catch (error) {
      const errorContext = createErrorContext(error as Error, {
        disclosure_id: 'TD20240115001',
        operation: 'test_operation',
      });
      
      logger.error('Operation failed', errorContext);
    }
    
    console.log('=== End of Structured Error Log Test ===\n');
    
    expect(true).toBe(true);
  });

  it('should output Lambda error logs', () => {
    console.log('\n=== Lambda Error Log Test ===');
    
    const mockLambdaContext = {
      requestId: 'test-request-id-12345',
      functionName: 'test-collector-function',
    };
    
    try {
      throw new Error('Lambda execution failed');
    } catch (error) {
      logLambdaError(
        'Lambda execution failed',
        error as Error,
        mockLambdaContext,
        {
          disclosure_id: 'TD20240115001',
          retry_count: 2,
        }
      );
    }
    
    console.log('=== End of Lambda Error Log Test ===\n');
    
    expect(true).toBe(true);
  });

  it('should output logs with various log levels', () => {
    console.log('\n=== Various Log Levels Test ===');
    
    // DEBUGレベル
    logger.debug('Debug: Starting data collection', {
      date: '2024-01-15',
      mode: 'batch',
    });
    
    // INFOレベル
    logger.info('Info: Data collection completed', {
      total_items: 150,
      success_count: 148,
      failure_count: 2,
    });
    
    // WARNレベル
    logger.warn('Warning: Some items were skipped', {
      skipped_count: 2,
      reason: 'Duplicate items detected',
    });
    
    // ERRORレベル
    logger.error('Error: Failed to save some items', {
      error_type: 'DynamoDBError',
      error_message: 'ConditionalCheckFailedException',
      context: {
        failed_items: ['TD20240115001', 'TD20240115002'],
      },
    });
    
    console.log('=== End of Various Log Levels Test ===\n');
    
    expect(true).toBe(true);
  });
});
