/**
 * 讒矩蛹悶Ο繧ｬ繝ｼ
 *
 * Winston繧剃ｽｿ逕ｨ縺励◆讒矩蛹悶Ο繧ｮ繝ｳ繧ｰ繧呈署萓帙＠縺ｾ縺吶・ * CloudWatch Logs蠖｢蠑上・JSON蜃ｺ蜉帙ｒ繧ｵ繝昴・繝医＠縲√Ο繧ｰ繝ｬ繝吶Ν縺ｫ蠢懊§縺滄←蛻・↑繝ｭ繧ｰ險倬鹸繧定｡後＞縺ｾ縺吶・ *
 * Requirements: 隕∽ｻｶ6.3・域ｧ矩蛹悶Ο繧ｰ・・ */

import winston from 'winston';

/**
 * 繝ｭ繧ｰ繝ｬ繝吶Ν
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * 繝ｭ繧ｰ繧ｳ繝ｳ繝・く繧ｹ繝・ */
export interface LogContext {
  [key: string]: unknown;
}

/**
 * 繝ｭ繧ｬ繝ｼ繧､繝ｳ繧ｿ繝ｼ繝輔ぉ繝ｼ繧ｹ
 */
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

/**
 * Winston 繝ｭ繧ｬ繝ｼ縺ｮ險ｭ螳・ */
const isLambdaEnvironment = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// Lambda迺ｰ蠅・〒縺ｯ縲仝inston縺ｮ莉｣繧上ｊ縺ｫconsole.log繧剃ｽｿ逕ｨ
// 縺薙ｌ縺ｫ繧医ｊ縲，loudWatch Logs縺ｫ遒ｺ螳溘↓繝ｭ繧ｰ縺悟・蜉帙＆繧後ｋ
const winstonLogger = isLambdaEnvironment
  ? null
  : winston.createLogger({
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
 * 讒矩蛹悶Ο繧ｬ繝ｼ螳溯｣・ */
class StructuredLogger implements Logger {
  /**
   * DEBUG繝ｬ繝吶Ν縺ｮ繝ｭ繧ｰ繧定ｨ倬鹸
   *
   * @param message 繝ｭ繧ｰ繝｡繝・そ繝ｼ繧ｸ
   * @param context 繝ｭ繧ｰ繧ｳ繝ｳ繝・く繧ｹ繝茨ｼ医が繝励す繝ｧ繝ｳ・・   *
   * @example
   * ```typescript
   * logger.debug('Processing disclosure', {
   *   disclosure_id: 'TD20240115001',
   *   company_code: '1234',
   * });
   * ```
   */
  debug(message: string, context?: LogContext): void {
    if (isLambdaEnvironment) {
      console.log(JSON.stringify({ level: 'debug', message, ...context }));
    } else {
      winstonLogger!.debug(message, context);
    }
  }

  /**
   * INFO繝ｬ繝吶Ν縺ｮ繝ｭ繧ｰ繧定ｨ倬鹸
   *
   * @param message 繝ｭ繧ｰ繝｡繝・そ繝ｼ繧ｸ
   * @param context 繝ｭ繧ｰ繧ｳ繝ｳ繝・く繧ｹ繝茨ｼ医が繝励す繝ｧ繝ｳ・・   *
   * @example
   * ```typescript
   * logger.info('Disclosure saved successfully', {
   *   disclosure_id: 'TD20240115001',
   *   date_partition: '2024-01',
   * });
   * ```
   */
  info(message: string, context?: LogContext): void {
    if (isLambdaEnvironment) {
      console.log(JSON.stringify({ level: 'info', message, ...context }));
    } else {
      winstonLogger!.info(message, context);
    }
  }

  /**
   * WARN繝ｬ繝吶Ν縺ｮ繝ｭ繧ｰ繧定ｨ倬鹸
   *
   * @param message 繝ｭ繧ｰ繝｡繝・そ繝ｼ繧ｸ
   * @param context 繝ｭ繧ｰ繧ｳ繝ｳ繝・く繧ｹ繝茨ｼ医が繝励す繝ｧ繝ｳ・・   *
   * @example
   * ```typescript
   * logger.warn('Duplicate item detected', {
   *   disclosure_id: 'TD20240115001',
   * });
   * ```
   */
  warn(message: string, context?: LogContext): void {
    if (isLambdaEnvironment) {
      console.warn(JSON.stringify({ level: 'warn', message, ...context }));
    } else {
      winstonLogger!.warn(message, context);
    }
  }

  /**
   * ERROR繝ｬ繝吶Ν縺ｮ繝ｭ繧ｰ繧定ｨ倬鹸
   *
   * @param message 繝ｭ繧ｰ繝｡繝・そ繝ｼ繧ｸ
   * @param context 繝ｭ繧ｰ繧ｳ繝ｳ繝・く繧ｹ繝茨ｼ医が繝励す繝ｧ繝ｳ・・   *
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
    if (isLambdaEnvironment) {
      console.error(JSON.stringify({ level: 'error', message, ...context }));
    } else {
      winstonLogger!.error(message, context);
    }
  }
}

/**
 * 繧ｰ繝ｭ繝ｼ繝舌Ν繝ｭ繧ｬ繝ｼ繧､繝ｳ繧ｹ繧ｿ繝ｳ繧ｹ
 *
 * 繝励Ο繧ｸ繧ｧ繧ｯ繝亥・菴薙〒蜈ｱ譛峨＆繧後ｋ繝ｭ繧ｬ繝ｼ繧､繝ｳ繧ｹ繧ｿ繝ｳ繧ｹ縺ｧ縺吶・ *
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
 * 繝ｭ繧ｰ繝ｬ繝吶Ν繧定ｨｭ螳・ *
 * @param level 繝ｭ繧ｰ繝ｬ繝吶Ν
 *
 * @example
 * ```typescript
 * import { setLogLevel, LogLevel } from './utils/logger';
 *
 * setLogLevel(LogLevel.DEBUG);
 * ```
 */
export function setLogLevel(level: LogLevel): void {
  if (winstonLogger) {
    winstonLogger.level = level;
  }
  // Lambda迺ｰ蠅・〒縺ｯ縲´OG_LEVEL迺ｰ蠅・､画焚縺ｧ蛻ｶ蠕｡縺輔ｌ繧九◆繧√∽ｽ輔ｂ縺励↑縺・}

/**
 * 繧ｨ繝ｩ繝ｼ繧ｪ繝悶ず繧ｧ繧ｯ繝医°繧画ｧ矩蛹悶Ο繧ｰ繧ｳ繝ｳ繝・く繧ｹ繝医ｒ逕滓・
 *
 * Steering貅匁侠縺ｮ讓呎ｺ悶ヵ繧ｩ繝ｼ繝槭ャ繝・ { error_type, error_message, context, stack_trace }
 *
 * @param error 繧ｨ繝ｩ繝ｼ繧ｪ繝悶ず繧ｧ繧ｯ繝・ * @param additionalContext 霑ｽ蜉縺ｮ繧ｳ繝ｳ繝・く繧ｹ繝茨ｼ医が繝励す繝ｧ繝ｳ・・ * @returns 繝ｭ繧ｰ繧ｳ繝ｳ繝・く繧ｹ繝・ *
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
    context: additionalContext || {},
    stack_trace: error.stack,
  };
}

/**
 * Lambda螳溯｡後さ繝ｳ繝・く繧ｹ繝医ｒ蜷ｫ繧繧ｨ繝ｩ繝ｼ繝ｭ繧ｰ繧定ｨ倬鹸
 *
 * Lambda螳溯｣・メ繧ｧ繝・け繝ｪ繧ｹ繝医↓貅匁侠縺励◆讓呎ｺ悶お繝ｩ繝ｼ繝ｭ繧ｰ繝輔か繝ｼ繝槭ャ繝医・ * CloudWatch Logs縺ｫ讒矩蛹悶Ο繧ｰ縺ｨ縺励※險倬鹸縺輔ｌ縺ｾ縺吶・ *
 * @param message 繧ｨ繝ｩ繝ｼ繝｡繝・そ繝ｼ繧ｸ
 * @param error 繧ｨ繝ｩ繝ｼ繧ｪ繝悶ず繧ｧ繧ｯ繝・ * @param lambdaContext Lambda螳溯｡後さ繝ｳ繝・く繧ｹ繝茨ｼ医が繝励す繝ｧ繝ｳ・・ * @param additionalContext 霑ｽ蜉縺ｮ繧ｳ繝ｳ繝・く繧ｹ繝茨ｼ医が繝励す繝ｧ繝ｳ・・ *
 * @example
 * ```typescript
 * export async function handler(event: any, context: any) {
 *   try {
 *     await operation();
 *   } catch (error) {
 *     logLambdaError('Lambda execution failed', error, context, {
 *       disclosure_id: 'TD20240115001',
 *     });
 *     throw error;
 *   }
 * }
 * ```
 */
export function logLambdaError(
  message: string,
  error: Error,
  lambdaContext?: { requestId?: string; functionName?: string },
  additionalContext?: LogContext
): void {
  logger.error(message, {
    error_type: error.constructor.name,
    error_message: error.message,
    context: {
      request_id: lambdaContext?.requestId,
      function_name: lambdaContext?.functionName,
      ...additionalContext,
    },
    stack_trace: error.stack,
  });
}
