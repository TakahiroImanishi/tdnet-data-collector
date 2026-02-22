/**
 * 開示情報テストデータファクトリー
 *
 * テストデータ生成の共通ユーティリティ。
 * テストデータの重複を削減し、一貫性のあるテストデータを提供します。
 *
 * Requirements: テスト改善（タスク25）
 */

import { Disclosure } from '../../types';

/**
 * 開示情報ファクトリーオプション
 */
export interface DisclosureFactoryOptions {
  /** 開示ID（省略時は自動生成） */
  disclosure_id?: string;
  /** 企業コード（省略時は1234） */
  company_code?: string;
  /** 企業名（省略時は「テスト株式会社」） */
  company_name?: string;
  /** 開示日時（省略時は2024-01-15T10:00:00+09:00） */
  disclosed_at?: string;
  /** タイトル（省略時は「決算短信」） */
  title?: string;
  /** PDF URL（省略時は自動生成） */
  pdf_url?: string;
  /** PDFファイル名（省略時は自動生成） */
  pdf_file_name?: string;
  /** 日付パーティション（省略時は自動生成） */
  date_partition?: string;
  /** ファイルサイズ（省略時は100000） */
  file_size?: number;
}

/**
 * 開示情報テストデータを生成
 *
 * @param options ファクトリーオプション
 * @returns 開示情報オブジェクト
 *
 * @example
 * ```typescript
 * // デフォルト値で生成
 * const disclosure = createDisclosure();
 *
 * // カスタム値で生成
 * const disclosure = createDisclosure({
 *   company_code: '7203',
 *   company_name: 'トヨタ自動車株式会社',
 *   title: '2024年3月期 決算短信',
 * });
 * ```
 */
export function createDisclosure(options: DisclosureFactoryOptions = {}): Disclosure {
  const disclosedAt = options.disclosed_at || '2024-01-15T10:00:00+09:00';
  const companyCode = options.company_code || '1234';
  const datePartition = options.date_partition || '2024-01';
  const disclosureId = options.disclosure_id || `TD${disclosedAt.slice(0, 10).replace(/-/g, '')}${companyCode}001`;

  return {
    disclosure_id: disclosureId,
    company_code: companyCode,
    company_name: options.company_name || 'テスト株式会社',
    disclosed_at: disclosedAt,
    title: options.title || '決算短信',
    pdf_url: options.pdf_url || `https://www.release.tdnet.info/inbs/test_${disclosureId}.pdf`,
    pdf_file_name: options.pdf_file_name || `${disclosureId}.pdf`,
    date_partition: datePartition,
    file_size: options.file_size,
  };
}

/**
 * 複数の開示情報テストデータを生成
 *
 * @param count 生成する件数
 * @param baseOptions ベースとなるファクトリーオプション
 * @returns 開示情報オブジェクトの配列
 *
 * @example
 * ```typescript
 * // 10件の開示情報を生成
 * const disclosures = createDisclosures(10);
 *
 * // 同じ企業の開示情報を5件生成
 * const disclosures = createDisclosures(5, {
 *   company_code: '7203',
 *   company_name: 'トヨタ自動車株式会社',
 * });
 * ```
 */
export function createDisclosures(
  count: number,
  baseOptions: DisclosureFactoryOptions = {}
): Disclosure[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date('2024-01-15T10:00:00+09:00');
    date.setDate(date.getDate() + index);
    const disclosedAt = date.toISOString().replace('Z', '+09:00');

    return createDisclosure({
      ...baseOptions,
      disclosed_at: disclosedAt,
      disclosure_id: undefined, // 自動生成
    });
  });
}

/**
 * 特定の企業コードの開示情報を生成
 *
 * @param companyCode 企業コード
 * @param count 生成する件数（デフォルト: 1）
 * @returns 開示情報オブジェクト（配列）
 *
 * @example
 * ```typescript
 * // トヨタ自動車の開示情報を3件生成
 * const disclosures = createDisclosuresByCompany('7203', 3);
 * ```
 */
export function createDisclosuresByCompany(
  companyCode: string,
  count: number = 1
): Disclosure[] {
  const companyNames: Record<string, string> = {
    '7203': 'トヨタ自動車株式会社',
    '9984': 'ソフトバンクグループ株式会社',
    '6758': 'ソニーグループ株式会社',
    '8306': '三菱UFJフィナンシャル・グループ',
    '9432': '日本電信電話株式会社',
  };

  return createDisclosures(count, {
    company_code: companyCode,
    company_name: companyNames[companyCode] || `企業${companyCode}`,
  });
}

/**
 * 特定の日付範囲の開示情報を生成
 *
 * @param startDate 開始日（YYYY-MM-DD形式）
 * @param endDate 終了日（YYYY-MM-DD形式）
 * @param companyCodes 企業コードの配列（省略時はランダム）
 * @returns 開示情報オブジェクトの配列
 *
 * @example
 * ```typescript
 * // 2024年1月の開示情報を生成
 * const disclosures = createDisclosuresByDateRange('2024-01-01', '2024-01-31');
 *
 * // 特定企業の開示情報を生成
 * const disclosures = createDisclosuresByDateRange(
 *   '2024-01-01',
 *   '2024-01-31',
 *   ['7203', '9984']
 * );
 * ```
 */
export function createDisclosuresByDateRange(
  startDate: string,
  endDate: string,
  companyCodes?: string[]
): Disclosure[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const defaultCompanyCodes = ['1234', '5678', '7203', '9984', '6758'];
  const codes = companyCodes || defaultCompanyCodes;

  const disclosures: Disclosure[] = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const disclosedAt = date.toISOString().slice(0, 10) + 'T10:00:00+09:00';

    // 各日付に1-3件の開示情報を生成
    const count = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < count; j++) {
      const companyCode = codes[Math.floor(Math.random() * codes.length)];
      disclosures.push(
        createDisclosure({
          company_code: companyCode,
          disclosed_at: disclosedAt,
        })
      );
    }
  }

  return disclosures;
}

/**
 * 大量の開示情報テストデータを生成（パフォーマンステスト用）
 *
 * @param count 生成する件数
 * @returns 開示情報オブジェクトの配列
 *
 * @example
 * ```typescript
 * // 1000件の開示情報を生成
 * const disclosures = createLargeDisclosureDataset(1000);
 * ```
 */
export function createLargeDisclosureDataset(count: number): Disclosure[] {
  const companyCodes = ['1234', '5678', '7203', '9984', '6758', '8306', '9432'];
  const titles = [
    '決算短信',
    '有価証券報告書',
    '四半期報告書',
    '臨時報告書',
    '自己株式取得に関するお知らせ',
    '配当予想の修正に関するお知らせ',
  ];

  return Array.from({ length: count }, (_, index) => {
    const date = new Date('2024-01-01T10:00:00+09:00');
    date.setDate(date.getDate() + Math.floor(index / 10));
    const disclosedAt = date.toISOString().replace('Z', '+09:00');

    const companyCode = companyCodes[index % companyCodes.length];
    const title = titles[index % titles.length];

    return createDisclosure({
      company_code: companyCode,
      disclosed_at: disclosedAt,
      title: title,
    });
  });
}
