/**
 * fast-check Arbitrary定義 - プロパティテスト用
 * 
 * このファイルは、TDnet Data Collectorのプロパティテストで使用する
 * Arbitrary（ランダムデータ生成器）の定義を含みます。
 */

import fc from 'fast-check';

// ==========================================
// 基本的なArbitrary
// ==========================================

/**
 * 4桁の企業コード（1000-9999）
 */
export const arbCompanyCode = fc
    .integer({ min: 1000, max: 9999 })
    .map(code => code.toString().padStart(4, '0'));

/**
 * 日付文字列（YYYY-MM-DD形式）
 */
export const arbDateString = fc
    .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
    .map(date => date.toISOString().slice(0, 10));

/**
 * 時刻文字列（HH:MM:SS形式）
 */
export const arbTimeString = fc
    .tuple(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 59 })
    )
    .map(([h, m, s]) => 
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    );

/**
 * ISO8601タイムスタンプ
 */
export const arbTimestamp = fc
    .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
    .map(date => date.toISOString());

// ==========================================
// ドメイン固有のArbitrary
// ==========================================

/**
 * 開示種類
 */
export const arbDisclosureType = fc.constantFrom(
    '決算短信',
    '業績予想修正',
    '配当予想修正',
    '自己株式取得',
    '株式分割',
    '合併',
    '事業譲渡',
    'その他'
);

/**
 * 企業名
 */
export const arbCompanyName = fc.oneof(
    fc.constant('トヨタ自動車株式会社'),
    fc.constant('ソフトバンクグループ株式会社'),
    fc.constant('ソニーグループ株式会社'),
    fc.constant('任天堂株式会社'),
    fc.constant('キーエンス株式会社'),
    fc.string({ minLength: 5, maxLength: 50 }).map(s => `${s}株式会社`)
);

/**
 * 開示情報タイトル
 */
export const arbDisclosureTitle = fc.oneof(
    fc.constant('2024年3月期 第3四半期決算短信〔日本基準〕（連結）'),
    fc.constant('2024年3月期 業績予想の修正に関するお知らせ'),
    fc.constant('配当予想の修正（増配）に関するお知らせ'),
    fc.constant('自己株式の取得に関するお知らせ'),
    fc.string({ minLength: 10, maxLength: 200 })
);

/**
 * 開示情報ID（YYYYMMDD_企業コード_連番）
 */
export const arbDisclosureId = fc
    .tuple(
        arbDateString,
        arbCompanyCode,
        fc.integer({ min: 1, max: 999 })
    )
    .map(([date, code, seq]) => {
        const dateStr = date.replace(/-/g, '');
        const seqStr = seq.toString().padStart(3, '0');
        return `${dateStr}_${code}_${seqStr}`;
    });

/**
 * S3キー（YYYY/MM/DD/企業コード_開示種類_タイムスタンプ.pdf）
 */
export const arbS3Key = fc
    .tuple(
        arbDateString,
        arbCompanyCode,
        arbDisclosureType,
        arbTimestamp
    )
    .map(([date, code, type, timestamp]) => {
        const [year, month, day] = date.split('-');
        const ts = timestamp.replace(/[-:]/g, '').slice(0, 14);
        return `${year}/${month}/${day}/${code}_${type}_${ts}.pdf`;
    });

/**
 * PDF URL
 */
export const arbPdfUrl = fc
    .integer({ min: 100000000000, max: 999999999999 })
    .map(id => `https://www.release.tdnet.info/inbs/${id}.pdf`);

// ==========================================
// 複合Arbitrary
// ==========================================

/**
 * 完全な開示情報オブジェクト
 */
export const arbDisclosure = fc.record({
    disclosure_id: arbDisclosureId,
    company_code: arbCompanyCode,
    company_name: arbCompanyName,
    disclosure_date: arbDateString,
    disclosure_time: arbTimeString,
    disclosure_type: arbDisclosureType,
    title: arbDisclosureTitle,
    pdf_url: arbPdfUrl,
    pdf_s3_key: arbS3Key,
    downloaded_at: arbTimestamp,
    file_size: fc.integer({ min: 1000, max: 10000000 }),
    checksum: fc.hexaString({ minLength: 32, maxLength: 32 })
});

/**
 * 日付範囲（start_date <= end_date）
 */
export const arbDateRange = fc
    .tuple(
        arbDateString,
        fc.integer({ min: 0, max: 365 })
    )
    .map(([startDate, daysOffset]) => {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + daysOffset);
        
        return {
            start_date: startDate,
            end_date: end.toISOString().slice(0, 10)
        };
    });

/**
 * バッチ収集リクエスト
 */
export const arbBatchCollectionRequest = fc.record({
    date_range: arbDateRange,
    company_codes: fc.array(arbCompanyCode, { minLength: 1, maxLength: 10 }),
    disclosure_types: fc.array(arbDisclosureType, { minLength: 1, maxLength: 3 })
});

/**
 * 検索クエリパラメータ
 */
export const arbSearchQuery = fc.record({
    start_date: fc.option(arbDateString, { nil: undefined }),
    end_date: fc.option(arbDateString, { nil: undefined }),
    company_code: fc.option(arbCompanyCode, { nil: undefined }),
    disclosure_type: fc.option(arbDisclosureType, { nil: undefined }),
    limit: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
    offset: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined })
});

// ==========================================
// 無効データのArbitrary（ネガティブテスト用）
// ==========================================

/**
 * 無効な企業コード
 */
export const arbInvalidCompanyCode = fc.oneof(
    fc.string({ minLength: 0, maxLength: 3 }), // 短すぎる
    fc.string({ minLength: 5, maxLength: 10 }), // 長すぎる
    fc.string().filter(s => !/^\d{4}$/.test(s)), // 数字以外
    fc.integer({ min: 0, max: 999 }).map(String), // 範囲外（小）
    fc.integer({ min: 10000, max: 99999 }).map(String) // 範囲外（大）
);

/**
 * 無効な日付形式
 */
export const arbInvalidDateFormat = fc.oneof(
    fc.constant('2024/01/15'), // スラッシュ区切り
    fc.constant('20240115'), // 区切りなし
    fc.constant('15-01-2024'), // DD-MM-YYYY
    fc.constant('2024-13-01'), // 無効な月
    fc.constant('2024-01-32'), // 無効な日
    fc.string({ minLength: 1, maxLength: 20 }).filter(s => !/^\d{4}-\d{2}-\d{2}$/.test(s))
);

/**
 * 無効な日付範囲（start_date > end_date）
 */
export const arbInvalidDateRange = fc
    .tuple(
        arbDateString,
        fc.integer({ min: 1, max: 365 })
    )
    .map(([endDate, daysOffset]) => {
        const end = new Date(endDate);
        const start = new Date(end);
        start.setDate(start.getDate() + daysOffset); // startをendより後にする
        
        return {
            start_date: start.toISOString().slice(0, 10),
            end_date: endDate
        };
    });

// ==========================================
// 使用例
// ==========================================

/**
 * 使用例:
 * 
 * import fc from 'fast-check';
 * import { arbDisclosure, arbCompanyCode } from './arbitraries';
 * 
 * test('Property: 企業コードは常に4桁', () => {
 *     fc.assert(
 *         fc.property(arbCompanyCode, (code) => {
 *             expect(code).toMatch(/^\d{4}$/);
 *             expect(parseInt(code)).toBeGreaterThanOrEqual(1000);
 *             expect(parseInt(code)).toBeLessThanOrEqual(9999);
 *         }),
 *         { numRuns: 100 }
 *     );
 * });
 * 
 * test('Property: 開示情報のバリデーション', () => {
 *     fc.assert(
 *         fc.property(arbDisclosure, (disclosure) => {
 *             expect(() => validateDisclosure(disclosure)).not.toThrow();
 *         }),
 *         { numRuns: 100 }
 *     );
 * });
 * 
 * test('Property: 無効な企業コードはエラー', () => {
 *     fc.assert(
 *         fc.property(arbInvalidCompanyCode, (invalidCode) => {
 *             expect(() => validateCompanyCode(invalidCode))
 *                 .toThrow(ValidationError);
 *         }),
 *         { numRuns: 100 }
 *     );
 * });
 */
