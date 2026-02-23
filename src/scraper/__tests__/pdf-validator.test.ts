/**
 * PDFファイルバリデーションのユニットテスト
 *
 * Property 6: PDFファイルの整合性
 * - サイズ範囲内（10KB〜50MB）
 * - PDFヘッダー（%PDF-）で始まる
 *
 * Requirements: 要件2.3（整合性検証）
 */

import { validatePdfFile } from '../pdf-downloader';
import { ValidationError } from '../../errors';
import { MIN_PDF_SIZE, MAX_PDF_SIZE } from '../../constants/file-limits';

describe('PDF File Validation', () => {
  describe('Property 6: PDFファイルの整合性 - サイズ範囲', () => {
    it('should accept valid PDF files within size range (10KB)', () => {
      // 有効なPDFファイル（最小サイズ）
      const minValidPdf = Buffer.alloc(MIN_PDF_SIZE);
      minValidPdf.write('%PDF-1.4');
      expect(() => validatePdfFile(minValidPdf)).not.toThrow();
    });

    it('should accept valid PDF files within size range (50MB)', () => {
      // 有効なPDFファイル（最大サイズ）
      const maxValidPdf = Buffer.alloc(MAX_PDF_SIZE);
      maxValidPdf.write('%PDF-1.4');
      expect(() => validatePdfFile(maxValidPdf)).not.toThrow();
    });

    it('should accept valid PDF files within size range (1MB)', () => {
      // 有効なPDFファイル（中間サイズ）
      const validPdf = Buffer.alloc(1 * 1024 * 1024);
      validPdf.write('%PDF-1.4');
      expect(() => validatePdfFile(validPdf)).not.toThrow();
    });

    it('should reject PDF files smaller than 10KB', () => {
      const tooSmallPdf = Buffer.alloc(5 * 1024);
      tooSmallPdf.write('%PDF-1.4');
      expect(() => validatePdfFile(tooSmallPdf)).toThrow(ValidationError);
      expect(() => validatePdfFile(tooSmallPdf)).toThrow(/too small/);
    });

    it('should reject PDF files larger than 50MB', () => {
      const tooLargePdf = Buffer.alloc(51 * 1024 * 1024);
      tooLargePdf.write('%PDF-1.4');
      expect(() => validatePdfFile(tooLargePdf)).toThrow(ValidationError);
      expect(() => validatePdfFile(tooLargePdf)).toThrow(/too large/);
    });
  });

  describe('Property 6: PDFヘッダー検証', () => {
    it('should accept PDF files with valid header (%PDF-1.4)', () => {
      const validPdf = Buffer.alloc(MIN_PDF_SIZE);
      validPdf.write('%PDF-1.4');
      expect(() => validatePdfFile(validPdf)).not.toThrow();
    });

    it('should accept PDF files with valid header (%PDF-1.5)', () => {
      const validPdf = Buffer.alloc(MIN_PDF_SIZE);
      validPdf.write('%PDF-1.5');
      expect(() => validatePdfFile(validPdf)).not.toThrow();
    });

    it('should accept PDF files with valid header (%PDF-1.7)', () => {
      const validPdf = Buffer.alloc(MIN_PDF_SIZE);
      validPdf.write('%PDF-1.7');
      expect(() => validatePdfFile(validPdf)).not.toThrow();
    });

    it('should reject files with invalid header', () => {
      const invalidPdf = Buffer.alloc(MIN_PDF_SIZE);
      invalidPdf.write('INVALID');
      expect(() => validatePdfFile(invalidPdf)).toThrow(ValidationError);
      expect(() => validatePdfFile(invalidPdf)).toThrow(/Invalid PDF header/);
    });

    it('should reject files with empty header', () => {
      const emptyPdf = Buffer.alloc(MIN_PDF_SIZE);
      expect(() => validatePdfFile(emptyPdf)).toThrow(ValidationError);
      expect(() => validatePdfFile(emptyPdf)).toThrow(/Invalid PDF header/);
    });

    it('should reject files with partial PDF header', () => {
      const partialPdf = Buffer.alloc(MIN_PDF_SIZE);
      partialPdf.write('%PDF');
      expect(() => validatePdfFile(partialPdf)).toThrow(ValidationError);
      expect(() => validatePdfFile(partialPdf)).toThrow(/Invalid PDF header/);
    });
  });

  describe('Edge Cases', () => {
    it('should reject files at exactly 10KB boundary without valid header', () => {
      const boundaryPdf = Buffer.alloc(MIN_PDF_SIZE);
      boundaryPdf.write('NOTPDF');
      expect(() => validatePdfFile(boundaryPdf)).toThrow(ValidationError);
      expect(() => validatePdfFile(boundaryPdf)).toThrow(/Invalid PDF header/);
    });

    it('should reject files at exactly 50MB boundary without valid header', () => {
      const boundaryPdf = Buffer.alloc(MAX_PDF_SIZE);
      boundaryPdf.write('NOTPDF');
      expect(() => validatePdfFile(boundaryPdf)).toThrow(ValidationError);
      expect(() => validatePdfFile(boundaryPdf)).toThrow(/Invalid PDF header/);
    });

    it('should handle files with exactly 5 bytes (minimum for header check)', () => {
      const minHeaderPdf = Buffer.alloc(MIN_PDF_SIZE);
      minHeaderPdf.write('%PDF-');
      expect(() => validatePdfFile(minHeaderPdf)).not.toThrow();
    });
  });
});