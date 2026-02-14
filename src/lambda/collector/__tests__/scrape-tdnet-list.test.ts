/**
 * TDnet List Scraper - Unit Tests
 *
 * Requirements: 要件1.1, 9.1
 */

/**
 * TDnet List Scraper - Unit Tests
 *
 * Requirements: 要件1.1, 9.1
 */

import axios from 'axios';
import { parseDisclosureList } from '../../../scraper/html-parser';
import { ValidationError } from '../../../errors';

// Mock dependencies BEFORE importing the module under test
jest.mock('axios');
jest.mock('../../../scraper/html-parser');
jest.mock('../../../utils/rate-limiter');

// Mock RateLimiter with a factory function
const mockWaitIfNeeded = jest.fn().mockResolvedValue(undefined);
const mockReset = jest.fn();
const mockGetMinDelayMs = jest.fn().mockReturnValue(2000);
const mockGetLastRequestTime = jest.fn().mockReturnValue(null);

jest.mock('../../../utils/rate-limiter', () => {
  return {
    RateLimiter: jest.fn().mockImplementation(() => ({
      waitIfNeeded: mockWaitIfNeeded,
      reset: mockReset,
      getMinDelayMs: mockGetMinDelayMs,
      getLastRequestTime: mockGetLastRequestTime,
    })),
  };
});

// NOW import the module under test (after mocks are set up)
import { scrapeTdnetList } from '../scrape-tdnet-list';

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockParseDisclosureList = parseDisclosureList as jest.MockedFunction<typeof parseDisclosureList>;

describe('scrapeTdnetList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should successfully scrape TDnet list', async () => {
      const mockHtml = '<html><body>Test HTML</body></html>';
      const mockDisclosures = [
        {
          company_code: '1234',
          company_name: 'Test Company',
          disclosure_type: '決算短信',
          title: 'Test Disclosure',
          disclosed_at: '2024-01-15T01:30:00Z',
          pdf_url: 'https://example.com/test.pdf',
        },
      ];

      mockAxios.get.mockResolvedValue({
        data: mockHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      mockParseDisclosureList.mockReturnValue(mockDisclosures);

      const result = await scrapeTdnetList('2024-01-15');

      expect(result).toEqual(mockDisclosures);
      expect(mockWaitIfNeeded).toHaveBeenCalled();
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('20240115'),
        expect.objectContaining({
          timeout: 30000,
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('TDnet-Data-Collector'),
          }),
        })
      );
      expect(mockParseDisclosureList).toHaveBeenCalledWith(mockHtml, '2024-01-15');
    });

    it('should apply rate limiting before each request', async () => {
      const mockHtml = '<html><body>Test HTML</body></html>';
      mockAxios.get.mockResolvedValue({
        data: mockHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });
      mockParseDisclosureList.mockReturnValue([]);

      await scrapeTdnetList('2024-01-15');

      // Verify rate limiter was called
      expect(mockWaitIfNeeded).toHaveBeenCalled();
      // Verify axios.get was called after rate limiter
      expect(mockAxios.get).toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    describe('Date Format Validation', () => {
      it('should reject invalid date format - slash separator', async () => {
        await expect(scrapeTdnetList('2024/01/15')).rejects.toThrow(ValidationError);
        await expect(scrapeTdnetList('2024/01/15')).rejects.toThrow('Expected YYYY-MM-DD format');
      });

      it('should reject invalid date format - no separator', async () => {
        await expect(scrapeTdnetList('20240115')).rejects.toThrow(ValidationError);
        await expect(scrapeTdnetList('20240115')).rejects.toThrow('Expected YYYY-MM-DD format');
      });

      it('should reject invalid date format - single digit month/day', async () => {
        await expect(scrapeTdnetList('2024-1-15')).rejects.toThrow(ValidationError);
        await expect(scrapeTdnetList('2024-01-5')).rejects.toThrow(ValidationError);
        await expect(scrapeTdnetList('2024-1-5')).rejects.toThrow(ValidationError);
      });

      it('should reject invalid date format - extra characters', async () => {
        await expect(scrapeTdnetList('2024-01-15T00:00:00')).rejects.toThrow(ValidationError);
        await expect(scrapeTdnetList('2024-01-15 ')).rejects.toThrow(ValidationError);
        await expect(scrapeTdnetList(' 2024-01-15')).rejects.toThrow(ValidationError);
      });
    });

    describe('Non-Existent Date Validation', () => {
      it('should reject February 30th', async () => {
        await expect(scrapeTdnetList('2024-02-30')).rejects.toThrow(ValidationError);
        await expect(scrapeTdnetList('2024-02-30')).rejects.toThrow('Date does not exist');
      });

      it('should reject February 29th in non-leap year', async () => {
        await expect(scrapeTdnetList('2023-02-29')).rejects.toThrow(ValidationError);
        await expect(scrapeTdnetList('2023-02-29')).rejects.toThrow('Date does not exist');
      });

      it('should accept February 29th in leap year', async () => {
        mockAxios.get.mockResolvedValue({
          data: '<html></html>',
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
        mockParseDisclosureList.mockReturnValue([]);

        await expect(scrapeTdnetList('2024-02-29')).resolves.not.toThrow();
      });

      it('should reject invalid month', async () => {
        await expect(scrapeTdnetList('2024-13-01')).rejects.toThrow(ValidationError);
        await expect(scrapeTdnetList('2024-00-01')).rejects.toThrow(ValidationError);
      });

      it('should reject invalid day', async () => {
        await expect(scrapeTdnetList('2024-01-32')).rejects.toThrow(ValidationError);
        await expect(scrapeTdnetList('2024-01-00')).rejects.toThrow(ValidationError);
      });

      it('should reject April 31st (30-day month)', async () => {
        await expect(scrapeTdnetList('2024-04-31')).rejects.toThrow(ValidationError);
      });

      it('should reject June 31st (30-day month)', async () => {
        await expect(scrapeTdnetList('2024-06-31')).rejects.toThrow(ValidationError);
      });

      it('should reject September 31st (30-day month)', async () => {
        await expect(scrapeTdnetList('2024-09-31')).rejects.toThrow(ValidationError);
      });

      it('should reject November 31st (30-day month)', async () => {
        await expect(scrapeTdnetList('2024-11-31')).rejects.toThrow(ValidationError);
      });
    });

    describe('Date Range Validation', () => {
      it('should reject dates before 1970-01-01', async () => {
        await expect(scrapeTdnetList('1969-12-31')).rejects.toThrow(ValidationError);
        await expect(scrapeTdnetList('1969-12-31')).rejects.toThrow('Must be on or after 1970-01-01');
      });

      it('should accept 1970-01-01', async () => {
        mockAxios.get.mockResolvedValue({
          data: '<html></html>',
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
        mockParseDisclosureList.mockReturnValue([]);

        await expect(scrapeTdnetList('1970-01-01')).resolves.not.toThrow();
      });

      it('should reject dates more than 1 day in the future', async () => {
        const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        const futureDateStr = futureDate.toISOString().split('T')[0];
        
        await expect(scrapeTdnetList(futureDateStr)).rejects.toThrow(ValidationError);
        await expect(scrapeTdnetList(futureDateStr)).rejects.toThrow('Must be within 1 day of current date');
      });

      it('should accept today\'s date', async () => {
        const today = new Date().toISOString().split('T')[0];
        
        mockAxios.get.mockResolvedValue({
          data: '<html></html>',
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
        mockParseDisclosureList.mockReturnValue([]);

        await expect(scrapeTdnetList(today)).resolves.not.toThrow();
      });

      it('should accept tomorrow\'s date (within 1 day)', async () => {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        
        mockAxios.get.mockResolvedValue({
          data: '<html></html>',
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
        mockParseDisclosureList.mockReturnValue([]);

        await expect(scrapeTdnetList(tomorrowStr)).resolves.not.toThrow();
      });
    });

    describe('Valid Date Acceptance', () => {
      beforeEach(() => {
        mockAxios.get.mockResolvedValue({
          data: '<html></html>',
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });
        mockParseDisclosureList.mockReturnValue([]);
      });

      it('should accept valid date format', async () => {
        await expect(scrapeTdnetList('2024-01-15')).resolves.not.toThrow();
        await expect(scrapeTdnetList('2024-12-31')).resolves.not.toThrow();
      });

      it('should accept first day of month', async () => {
        await expect(scrapeTdnetList('2024-01-01')).resolves.not.toThrow();
      });

      it('should accept last day of 31-day month', async () => {
        await expect(scrapeTdnetList('2024-01-31')).resolves.not.toThrow();
        await expect(scrapeTdnetList('2024-03-31')).resolves.not.toThrow();
        await expect(scrapeTdnetList('2024-05-31')).resolves.not.toThrow();
      });

      it('should accept last day of 30-day month', async () => {
        await expect(scrapeTdnetList('2024-04-30')).resolves.not.toThrow();
        await expect(scrapeTdnetList('2024-06-30')).resolves.not.toThrow();
        await expect(scrapeTdnetList('2024-09-30')).resolves.not.toThrow();
      });

      it('should accept February 28th', async () => {
        await expect(scrapeTdnetList('2024-02-28')).resolves.not.toThrow();
        await expect(scrapeTdnetList('2023-02-28')).resolves.not.toThrow();
      });
    });
  });

  describe('Error Handling', () => {
    it('should retry on network errors', async () => {
      const networkError = new Error('ECONNRESET');
      (networkError as any).code = 'ECONNRESET';

      mockAxios.get
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          data: '<html></html>',
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

      mockParseDisclosureList.mockReturnValue([]);

      await scrapeTdnetList('2024-01-15');

      expect(mockAxios.get).toHaveBeenCalledTimes(3);
    });

    it('should retry on timeout errors', async () => {
      const timeoutError = new Error('timeout of 30000ms exceeded');
      (timeoutError as any).code = 'ECONNABORTED';

      mockAxios.get
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce({
          data: '<html></html>',
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

      mockParseDisclosureList.mockReturnValue([]);

      await scrapeTdnetList('2024-01-15');

      expect(mockAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should retry on 5xx errors', async () => {
      const serverError = {
        response: {
          status: 503,
          statusText: 'Service Unavailable',
          data: 'Service Unavailable',
          headers: {},
          config: {} as any,
        },
        isAxiosError: true,
      };

      mockAxios.get
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce({
          data: '<html></html>',
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

      mockParseDisclosureList.mockReturnValue([]);

      await scrapeTdnetList('2024-01-15');

      expect(mockAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should retry on 429 rate limit errors', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          statusText: 'Too Many Requests',
          data: 'Rate limit exceeded',
          headers: {},
          config: {} as any,
        },
        isAxiosError: true,
      };

      mockAxios.get
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          data: '<html></html>',
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

      mockParseDisclosureList.mockReturnValue([]);

      await scrapeTdnetList('2024-01-15');

      expect(mockAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 404 errors', async () => {
      const notFoundError = {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: 'Page not found',
          headers: {},
          config: {} as any,
        },
        isAxiosError: true,
      };

      mockAxios.get.mockRejectedValue(notFoundError);

      await expect(scrapeTdnetList('2024-01-15')).rejects.toThrow(ValidationError);
      expect(mockAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      const networkError = new Error('ECONNRESET');
      (networkError as any).code = 'ECONNRESET';

      mockAxios.get.mockRejectedValue(networkError);

      await expect(scrapeTdnetList('2024-01-15')).rejects.toThrow();
      expect(mockAxios.get).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });

  describe('URL Construction', () => {
    it('should construct correct TDnet URL', async () => {
      mockAxios.get.mockResolvedValue({
        data: '<html></html>',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });
      mockParseDisclosureList.mockReturnValue([]);

      await scrapeTdnetList('2024-01-15');

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('I_list_001_20240115.html'),
        expect.any(Object)
      );
    });

    it('should use custom base URL from environment variable', async () => {
      const originalEnv = process.env.TDNET_BASE_URL;
      process.env.TDNET_BASE_URL = 'https://custom.tdnet.url';

      mockAxios.get.mockResolvedValue({
        data: '<html></html>',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });
      mockParseDisclosureList.mockReturnValue([]);

      await scrapeTdnetList('2024-01-15');

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('https://custom.tdnet.url'),
        expect.any(Object)
      );

      // Restore original environment
      if (originalEnv) {
        process.env.TDNET_BASE_URL = originalEnv;
      } else {
        delete process.env.TDNET_BASE_URL;
      }
    });
  });

  describe('HTTP Headers', () => {
    it('should include proper User-Agent header', async () => {
      mockAxios.get.mockResolvedValue({
        data: '<html></html>',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });
      mockParseDisclosureList.mockReturnValue([]);

      await scrapeTdnetList('2024-01-15');

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('TDnet-Data-Collector'),
          }),
        })
      );
    });

    it('should include Accept and Accept-Language headers', async () => {
      mockAxios.get.mockResolvedValue({
        data: '<html></html>',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });
      mockParseDisclosureList.mockReturnValue([]);

      await scrapeTdnetList('2024-01-15');

      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': expect.stringContaining('text/html'),
            'Accept-Language': expect.stringContaining('ja'),
          }),
        })
      );
    });
  });
});
