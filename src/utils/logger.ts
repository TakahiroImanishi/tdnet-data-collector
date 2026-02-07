/**
 * 構造化ロガー
 *
 * Winstonを使用した構造化ロギングを提供します。
 * CloudWatch Logs形式のJSON出力をサポートし、ログレベルに応じた適切なログ記録を行います。
 *
 * Requirements: 要件6.3（構造化ログ）
 */

import winston from 'winston';

/**
 * ログレベル
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * ログコンテキスト
 */
export interface LogContext {
  [key: string]: unknown;
}

/**
 * ロガーインターフェース
 */
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

/**
 * Winston ロガーの設定
 */
const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || LogLevel.INFO,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'tdnet-data-collector',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
    }),
  ],
});

/**
 * 構造化ロガー実装
 */
class StructuredLogger implements Logger {
  /**
   * DEBUGレベルのログを記録
   *
   * @param message ログメッセージ
   * @param context ログコンテキスト（オプション）
   *
   * @example
   * ```typescript
   * logger.debug('Processing disclosure', {
   *   disclosure_id: 'TD20240115001',
   *   company_code: '1234',
   * });
   * ```
   */
  debug(message: string, context?: LogContext): void {
    winstonLogger.debug(message, context);
  }

  /**
   * INFOレベルのログを記録
   *
   * @param message ログメッセージ
   * @param context ログコンテキスト（オプション）
   *
   * @example
   * ```typescript
   * logger.info('Disclosure saved successfully', {
   *   disclosure_id: 'TD20240115001',
   *   date_partition: '2024-01',
   * });
   * ```
   */
  info(message: string, context?: LogContext): void {
    winstonLogger.info(message, context);
  }

  /**
   * WARNレベルのログを記録
   *
   * @param message ログメッセージ
   * @param context ログコンテキスト（オプション）
   *
   * @example
   * ```typescript
   * logger.warn('Duplicate item detected', {
   *   disclosure_id: 'TD20240115001',
   * });
   * ```
   */
  warn(message: string, context?: LogContext): void {
    winstonLogger.warn(message, context);
  }

  /**
   * ERRORレベルのログを記録
   *
   * @param message ログメッセージ
   * @param context ログコンテキスト（オプション）
   *
   * @example
   * ```typescript
   * logger.error('Failed to save disclosure', {
   *   error_type: 'ValidationError',
   *   error_message: error.message,
   *   context: {
   *     disclosure_id: 'TD20240115001',
   *   },
   *   stack_trace: error.stack,
   * });
   * ```
   */
  error(message: string, context?: LogContext): void {
    winstonLogger.error(message, context);
  }
}

/**
 * グローバルロガーインスタンス
 *
 * プロジェクト全体で共有されるロガーインスタンスです。
 *
 * @example
 * ```typescript
 * import { logger } from './utils/logger';
 *
 * logger.info('Application started');
 * logger.error('Operation failed', {
 *   error_type: 'NetworkError',
 *   error_message: error.message,
 * });
 * ```
 */
export const logger: Logger = new StructuredLogger();

/**
 * ログレベルを設定
 *
 * @param level ログレベル
 *
 * @example
 * ```typescript
 * import { setLogLevel, LogLevel } from './utils/logger';
 *
 * setLogLevel(LogLevel.DEBUG);
 * ```
 */
export function setLogLevel(level: LogLevel): void {
  winstonLogger.level = level;
}

/**
 * エラーオブジェクトから構造化ログコンテキストを生成
 *
 * @param error エラーオブジェクト
 * @param additionalContext 追加のコンテキスト（オプション）
 * @returns ログコンテキスト
 *
 * @example
 * ```typescript
 * try {
 *   await operation();
 * } catch (error) {
 *   logger.error('Operation failed', createErrorContext(error, {
 *     disclosure_id: 'TD20240115001',
 *   }));
 * }
 * ```
 */
export function createErrorContext(
  error: Error,
  additionalContext?: LogContext
): LogContext {
  return {
    error_type: error.constructor.name,
    error_message: error.message,
    stack_trace: error.stack,
    ...additionalContext,
  };
}
