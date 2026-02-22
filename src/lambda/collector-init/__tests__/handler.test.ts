/**
 * Lambda Collector-Init Handler ユニットテスト
 */

import { Context } from 'aws-lambda';
import { handler, validateEvent, generateDateRange, getYesterday, formatDate } from '../handler';
import { ValidationError } from '../../../errors';

// モック設定
jest.mock('../../../utils/logger');
jest.mock('../../../utils/cloudwatch-metrics');

describe('collector-init handler', () => {
  const mockContext: Context = {
    awsRequestId: 'test-request-id',
    functionName: 'collector-init',
  } as Context;

  describe('validateEvent', () => {
    it('バッチモードの正常なイベントを検証できる', () => {
      const event = {
        execution_id: 'exec_123',
        mode: 'batch' as const,
      };

      expect(() => validateEvent(event)).not.toThrow();
    });

    it('オンデマンドモードの正常なイベントを検証できる', () => {
      // 現在日付から7日前を使用（1年以内を保証）
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(today.getDate() - 3);

      const event = {
        execution_id: 'exec_123',
        mode: 'on-demand' as const,
        start_date: sevenDaysAgo.toISOString().split('T')[0],
        end_date: threeDaysAgo.toISOString().split('T')[0],
      };

      expect(() => validateEvent(event)).not.toThrow();
    });

    it('execution_idが未設定の場合はエラー', () => {
      const event = {
        execution_id: '',
        mode: 'batch' as const,
      };

      expect(() => validateEvent(event)).toThrow(ValidationError);
    });

    it('不正なモードの場合はエラー', () => {
      const event = {
        execution_id: 'exec_123',
        mode: 'invalid' as any,
      };

      expect(() => validateEvent(event)).toThrow(ValidationError);
    });

    it('オンデマンドモードでstart_dateが未設定の場合はエラー', () => {
      const event = {
        execution_id: 'exec_123',
        mode: 'on-demand' as const,
        end_date: '2024-01-20',
      };

      expect(() => validateEvent(event)).toThrow(ValidationError);
      expect(() => validateEvent(event)).toThrow('start_date and end_date are required');
    });

    it('不正な日付フォーマットの場合はエラー', () => {
      const event = {
        execution_id: 'exec_123',
        mode: 'on-demand' as const,
        start_date: '2024/01/15',
        end_date: '2024-01-20',
      };

      expect(() => validateEvent(event)).toThrow(ValidationError);
      expect(() => validateEvent(event)).toThrow('Invalid start_date format');
    });

    it('存在しない日付の場合はエラー', () => {
      // 2月30日は存在しないが、JavaScriptのDateは3月2日に自動変換される
      // そのため、このテストは「1年以上前」エラーになる可能性がある
      // 代わりに、明らかに不正な日付文字列を使用
      const event = {
        execution_id: 'exec_123',
        mode: 'on-demand' as const,
        start_date: '2024-13-01', // 13月は存在しない
        end_date: '2024-03-01',
      };

      expect(() => validateEvent(event)).toThrow(ValidationError);
      expect(() => validateEvent(event)).toThrow('Date does not exist');
    });

    it('start_dateがend_dateより後の場合はエラー', () => {
      const event = {
        execution_id: 'exec_123',
        mode: 'on-demand' as const,
        start_date: '2024-01-20',
        end_date: '2024-01-15',
      };

      expect(() => validateEvent(event)).toThrow(ValidationError);
      expect(() => validateEvent(event)).toThrow('must be before or equal to');
    });

    it('負のmax_itemsの場合はエラー', () => {
      const event = {
        execution_id: 'exec_123',
        mode: 'batch' as const,
        max_items: -1,
      };

      expect(() => validateEvent(event)).toThrow(ValidationError);
      expect(() => validateEvent(event)).toThrow('Must be a positive number');
    });
  });

  describe('generateDateRange', () => {
    it('単一日の範囲を生成できる', () => {
      const dates = generateDateRange('2024-01-15', '2024-01-15');
      expect(dates).toEqual(['2024-01-15']);
    });

    it('複数日の範囲を生成できる', () => {
      const dates = generateDateRange('2024-01-15', '2024-01-17');
      expect(dates).toEqual(['2024-01-15', '2024-01-16', '2024-01-17']);
    });

    it('月をまたぐ範囲を生成できる', () => {
      const dates = generateDateRange('2024-01-30', '2024-02-02');
      expect(dates).toEqual(['2024-01-30', '2024-01-31', '2024-02-01', '2024-02-02']);
    });
  });

  describe('getYesterday', () => {
    it('前日の日付を取得できる', () => {
      const yesterday = getYesterday();
      expect(yesterday).toBeInstanceOf(Date);
      
      // 前日であることを確認（JST基準）
      const now = new Date();
      const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const expectedYesterday = new Date(jstNow);
      expectedYesterday.setUTCDate(expectedYesterday.getUTCDate() - 1);
      
      expect(formatDate(yesterday)).toBe(formatDate(expectedYesterday));
    });
  });

  describe('formatDate', () => {
    it('日付をYYYY-MM-DD形式にフォーマットできる', () => {
      const date = new Date('2024-01-15T00:00:00Z');
      expect(formatDate(date)).toBe('2024-01-15');
    });

    it('1桁の月日をゼロパディングできる', () => {
      const date = new Date('2024-01-05T00:00:00Z');
      expect(formatDate(date)).toBe('2024-01-05');
    });
  });
});
