/**
 * TDnet List Scraper - Unit Tests
 *
 * Requirements: 要件1.1, 9.1
 */

import axios from 'axios';
import { scrapeTdnetList } from '../scrape-tdnet-list';
import { parseDisclosureList } from '../../../scraper/html-parser';
import { RateLimiter } from '../../../utils/rate-limiter';
import { ValidationError, RetryableError } from '../../../errors';

// Mock dependencies
jest.mock('axios');
jest.mock('../../../scraper/html-parser');
jest.mock('../../../utils/rate-limiter');

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockParseDisclosureList = parseDisclosureList as jest.MockedFunction<typeof parseDisclosureList>;
const MockRateLimiter = RateLimiter as jest.MockedClass<typeof RateLimiter>;

describe('scrapeTdnetList', () => {
  let mockRateLimiterInstance: jest.Mocked<RateLimiter>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock RateLimiter instance
    mockRateLimiterInstance = {
      waitIfNeeded: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn(),
      getMinDelayMs: jest.fn().mockReturnValue(2000),
      getLastRequestTime: jest.fn().mockReturnValue(null),
    } as any;

    MockRateLimiter.mockImplementation(() => mockRateLimiterInstance);
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
      expect(mockRateLimiterInstance.waitIfNeeded).toHaveBeenCalled();
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('2024-01-15'),
        expect.objectContaining({
          timeout: 30000,
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('TDnet-Data-Collector'),
          }),
        })
      );
      expect(mockParseDisclosureList).toHaveBeenCalledWith(mockHtml);
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

      expect(mockRateLimiterInstance.waitIfNeeded).toHaveBeenCalledBefore(
        mockAxios.get as jest.Mock
      );
    });
  });

  describe('Validation', () => {
    it('should reject invalid date format', async () => {
      await expect(scrapeTdnetList('2024/01/15')).rejects.toThrow(ValidationError);
      await expect(scrapeTdnetList('20240115')).rejects.toThrow(ValidationError);
      await expect(scrapeTdnetList('2024-1-15')).rejects.toThrow(ValidationError);
    });

    it('should reject non-existent dates', async () => {
      await expect(scrapeTdnetList('2024-02-30')).rejects.toThrow(ValidationError);
      await expect(scrapeTdnetList('2024-13-01')).rejects.toThrow(ValidationError);
    });

    it('should accept valid date format', async () => {
      mockAxios.get.mockResolvedValue({
        data: '<html></html>',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });
      mockParseDisclosureList.mockReturnValue([]);

      await expect(scrapeTdnetList('2024-01-15')).resolves.not.toThrow();
      await expect(scrapeTdnetList('2024-12-31')).resolves.not.toThrow();
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
        expect.stringContaining('I_list_001_2024-01-15.html'),
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
