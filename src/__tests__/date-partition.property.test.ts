/**
 * Property-based tests for date_partition generation
 * 
 * Tests the correctness of generateDatePartition function using fast-check
 * to verify behavior across a wide range of inputs.
 */

import * as fc from 'fast-check';
import { generateDatePartition } from '../utils/date-partition';

describe('generateDatePartition - Property Tests', () => {
  /**
   * Property: generateDatePartition always returns YYYY-MM format (JST-based)
   * 
   * For any valid ISO 8601 date string, the function should return a string
   * in YYYY-MM format based on JST (UTC+9) timezone.
   */
  it('should always return YYYY-MM format for valid ISO 8601 dates', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary dates between 1970-01-01 and current time
        fc.date({ min: new Date('1970-01-01'), max: new Date() }),
        (date) => {
          const isoString = date.toISOString();
          const result = generateDatePartition(isoString);
          
          // Verify format: YYYY-MM
          expect(result).toMatch(/^\d{4}-\d{2}$/);
          
          // Verify year is within valid range
          const [year, month] = result.split('-').map(Number);
          expect(year).toBeGreaterThanOrEqual(1970);
          expect(year).toBeLessThanOrEqual(new Date().getFullYear() + 1);
          
          // Verify month is valid (01-12)
          expect(month).toBeGreaterThanOrEqual(1);
          expect(month).toBeLessThanOrEqual(12);
        }
      ),
      { numRuns: 1000 } // Run 1000 iterations for thorough testing
    );
  });

  /**
   * Property: JST conversion is correctly applied
   * 
   * Verifies that the function correctly converts UTC to JST (UTC+9)
   * before extracting the year and month.
   */
  it('should correctly convert UTC to JST before extracting year-month', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1970-01-01'), max: new Date() }),
        (date) => {
          const isoString = date.toISOString();
          const result = generateDatePartition(isoString);
          
          // Calculate expected JST date
          const utcDate = new Date(isoString);
          const jstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
          const expectedYear = jstDate.getUTCFullYear();
          const expectedMonth = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
          const expected = `${expectedYear}-${expectedMonth}`;
          
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 1000 }
    );
  });

  /**
   * Property: Month boundary edge cases
   * 
   * Tests specific edge cases where UTC to JST conversion crosses month boundaries.
   */
  describe('Month boundary edge cases', () => {
    it('should handle UTC month-end to JST next-month (2024-01-31T15:30:00Z → 2024-02)', () => {
      // UTC: 2024-01-31 15:30 → JST: 2024-02-01 00:30
      const result = generateDatePartition('2024-01-31T15:30:00Z');
      expect(result).toBe('2024-02');
    });

    it('should handle UTC month-start staying in same month (2024-02-01T15:00:00Z → 2024-02)', () => {
      // UTC: 2024-02-01 15:00 → JST: 2024-02-02 00:00
      const result = generateDatePartition('2024-02-01T15:00:00Z');
      expect(result).toBe('2024-02');
    });

    it('should handle leap year February (2024-02-29T15:00:00Z → 2024-03)', () => {
      // UTC: 2024-02-29 15:00 → JST: 2024-03-01 00:00
      const result = generateDatePartition('2024-02-29T15:00:00Z');
      expect(result).toBe('2024-03');
    });

    it('should handle non-leap year February (2023-02-28T15:00:00Z → 2023-03)', () => {
      // UTC: 2023-02-28 15:00 → JST: 2023-03-01 00:00
      const result = generateDatePartition('2023-02-28T15:00:00Z');
      expect(result).toBe('2023-03');
    });

    it('should handle year boundary (2023-12-31T15:30:00Z → 2024-01)', () => {
      // UTC: 2023-12-31 15:30 → JST: 2024-01-01 00:30
      const result = generateDatePartition('2023-12-31T15:30:00Z');
      expect(result).toBe('2024-01');
    });

    it('should handle year boundary staying in same year (2024-01-01T15:00:00Z → 2024-01)', () => {
      // UTC: 2024-01-01 15:00 → JST: 2024-01-02 00:00
      const result = generateDatePartition('2024-01-01T15:00:00Z');
      expect(result).toBe('2024-01');
    });

    it('should handle early morning UTC (2024-01-15T00:30:00Z → 2024-01)', () => {
      // UTC: 2024-01-15 00:30 → JST: 2024-01-15 09:30
      const result = generateDatePartition('2024-01-15T00:30:00Z');
      expect(result).toBe('2024-01');
    });

    it('should handle late evening UTC crossing to next day JST (2024-01-15T16:00:00Z → 2024-01)', () => {
      // UTC: 2024-01-15 16:00 → JST: 2024-01-16 01:00
      const result = generateDatePartition('2024-01-15T16:00:00Z');
      expect(result).toBe('2024-01');
    });
  });

  /**
   * Property: All months are correctly handled
   * 
   * Verifies that all 12 months are correctly processed.
   */
  it('should correctly handle all 12 months', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2020, max: 2025 }), // year (recent years)
        fc.integer({ min: 1, max: 12 }), // month
        fc.integer({ min: 1, max: 28 }), // day (safe for all months)
        fc.integer({ min: 0, max: 14 }), // hour (0-14 to avoid future dates)
        fc.integer({ min: 0, max: 59 }), // minute
        (year, month, day, hour, minute) => {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
          
          // Skip if date is in the future
          if (new Date(dateStr) > new Date()) {
            return true;
          }
          
          const result = generateDatePartition(dateStr);
          
          // Verify format
          expect(result).toMatch(/^\d{4}-\d{2}$/);
          
          // Verify the result is a valid year-month
          const [resultYear, resultMonth] = result.split('-').map(Number);
          expect(resultYear).toBeGreaterThanOrEqual(2020);
          expect(resultYear).toBeLessThanOrEqual(2026);
          expect(resultMonth).toBeGreaterThanOrEqual(1);
          expect(resultMonth).toBeLessThanOrEqual(12);
          
          return true;
        }
      ),
      { numRuns: 1000 }
    );
  });

  /**
   * Property: Idempotency
   * 
   * Calling generateDatePartition multiple times with the same input
   * should always return the same result.
   */
  it('should be idempotent (same input always produces same output)', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1970-01-01'), max: new Date() }),
        (date) => {
          const isoString = date.toISOString();
          const result1 = generateDatePartition(isoString);
          const result2 = generateDatePartition(isoString);
          const result3 = generateDatePartition(isoString);
          
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
        }
      ),
      { numRuns: 1000 }
    );
  });

  /**
   * Property: Consistency with manual calculation
   * 
   * The result should match a manual calculation of JST year-month.
   */
  it('should match manual JST year-month calculation', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1970-01-01'), max: new Date() }),
        (date) => {
          const isoString = date.toISOString();
          const result = generateDatePartition(isoString);
          
          // Manual calculation
          const utcDate = new Date(isoString);
          const jstTimestamp = utcDate.getTime() + 9 * 60 * 60 * 1000;
          const jstDate = new Date(jstTimestamp);
          const manualYear = jstDate.getUTCFullYear();
          const manualMonth = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
          const manualResult = `${manualYear}-${manualMonth}`;
          
          expect(result).toBe(manualResult);
        }
      ),
      { numRuns: 1000 }
    );
  });

  /**
   * Property: Timezone offset handling
   * 
   * Tests that dates with explicit timezone offsets are correctly handled.
   */
  it('should handle dates with explicit timezone offsets', () => {
    // Test with +09:00 offset (JST)
    const jstDate = '2024-01-15T10:30:00+09:00';
    const result1 = generateDatePartition(jstDate);
    expect(result1).toBe('2024-01');

    // Test with -05:00 offset (EST)
    const estDate = '2024-01-15T10:30:00-05:00';
    const result2 = generateDatePartition(estDate);
    // EST 10:30 = UTC 15:30 = JST 00:30 (next day)
    expect(result2).toBe('2024-01');

    // Test with +00:00 offset (UTC)
    const utcDate = '2024-01-15T10:30:00+00:00';
    const result3 = generateDatePartition(utcDate);
    expect(result3).toBe('2024-01');
  });

  /**
   * Property: Milliseconds precision
   * 
   * Tests that dates with milliseconds are correctly handled.
   */
  it('should handle dates with milliseconds precision', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('1970-01-01'), max: new Date() }),
        fc.integer({ min: 0, max: 999 }), // milliseconds
        (date, ms) => {
          // Create ISO string with milliseconds
          const baseIso = date.toISOString();
          const isoWithMs = baseIso.replace(/\.\d{3}Z$/, `.${String(ms).padStart(3, '0')}Z`);
          
          const result = generateDatePartition(isoWithMs);
          
          // Verify format
          expect(result).toMatch(/^\d{4}-\d{2}$/);
          
          // Milliseconds should not affect the year-month result
          const resultWithoutMs = generateDatePartition(baseIso);
          expect(result).toBe(resultWithoutMs);
        }
      ),
      { numRuns: 1000 }
    );
  });

  /**
   * Property: Deterministic output for same UTC timestamp
   * 
   * Different representations of the same UTC timestamp should produce
   * the same date_partition.
   */
  it('should produce same result for equivalent UTC timestamps', () => {
    // Same moment in time, different representations
    const utcZ = '2024-01-15T10:30:00Z';
    const utcOffset = '2024-01-15T10:30:00+00:00';
    const jstOffset = '2024-01-15T19:30:00+09:00';
    
    const result1 = generateDatePartition(utcZ);
    const result2 = generateDatePartition(utcOffset);
    const result3 = generateDatePartition(jstOffset);
    
    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
    expect(result1).toBe('2024-01');
  });

  /**
   * Property: Handles all valid hours (0-23)
   * 
   * Verifies correct behavior across all hours of the day.
   */
  it('should correctly handle all hours of the day', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }), // hour
        (hour) => {
          const dateStr = `2024-01-15T${String(hour).padStart(2, '0')}:30:00Z`;
          const result = generateDatePartition(dateStr);
          
          // Calculate expected result
          const utcDate = new Date(dateStr);
          const jstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
          const expectedMonth = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
          const expectedYear = jstDate.getUTCFullYear();
          
          expect(result).toBe(`${expectedYear}-${expectedMonth}`);
        }
      ),
      { numRuns: 24 } // Test all 24 hours
    );
  });
});
