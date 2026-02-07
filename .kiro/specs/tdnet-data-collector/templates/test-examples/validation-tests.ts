/**
 * バリデーション関数のテスト例
 * 
 * このファイルは、バリデーション関数のテストパターンを示します。
 */

import { validateCompanyCode } from './validation';
import { ValidationError } from './errors';

describe('validateCompanyCode', () => {
    describe('正常系', () => {
        it('有効な4桁コードを受け入れる', () => {
            expect(() => validateCompanyCode('7203')).not.toThrow();
            expect(() => validateCompanyCode('1000')).not.toThrow();
            expect(() => validateCompanyCode('9999')).not.toThrow();
        });
    });
    
    describe('異常系', () => {
        it('空文字列を拒否する', () => {
            expect(() => validateCompanyCode('')).toThrow(ValidationError);
        });
        
        it('3桁以下を拒否する', () => {
            expect(() => validateCompanyCode('999')).toThrow(ValidationError);
        });
        
        it('5桁以上を拒否する', () => {
            expect(() => validateCompanyCode('10000')).toThrow(ValidationError);
        });
        
        it('数字以外を拒否する', () => {
            expect(() => validateCompanyCode('ABC1')).toThrow(ValidationError);
        });
        
        it('範囲外（< 1000）を拒否する', () => {
            expect(() => validateCompanyCode('0999')).toThrow(ValidationError);
        });
    });
});

/**
 * プロパティベーステスト例
 */
import fc from 'fast-check';

describe('validateCompanyCode - Property Tests', () => {
    it('Property: 有効な企業コード（1000-9999）は常に受け入れられる', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1000, max: 9999 }),
                (code) => {
                    const codeStr = code.toString().padStart(4, '0');
                    expect(() => validateCompanyCode(codeStr)).not.toThrow();
                }
            ),
            { numRuns: 100 }
        );
    });
    
    it('Property: 範囲外の数値は常に拒否される', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.integer({ min: 0, max: 999 }),
                    fc.integer({ min: 10000, max: 99999 })
                ),
                (code) => {
                    const codeStr = code.toString();
                    expect(() => validateCompanyCode(codeStr)).toThrow(ValidationError);
                }
            ),
            { numRuns: 100 }
        );
    });
});
