/**
 * スクレイピング関数のテスト例
 * 
 * このファイルは、スクレイピング関数のテストパターンを示します。
 */

import { scrapeDisclosureList } from './scraper';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('scrapeDisclosureList', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    
    it('HTMLから開示情報を正しく抽出する', async () => {
        const mockHTML = `
            <table class="kjTable">
                <tr>
                    <td class="kjTime">15:00</td>
                    <td class="kjCode">7203</td>
                    <td class="kjName">トヨタ自動車株式会社</td>
                    <td class="kjTitle">
                        <a href="/inbs/test.pdf">決算短信</a>
                    </td>
                </tr>
            </table>
        `;
        
        mockedAxios.get.mockResolvedValue({
            data: Buffer.from(mockHTML, 'utf-8'),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
        });
        
        const result = await scrapeDisclosureList('20240115');
        
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            time: '15:00',
            company_code: '7203',
            company_name: 'トヨタ自動車株式会社',
        });
    });
    
    it('空のテーブルの場合は空配列を返す', async () => {
        const mockHTML = '<table class="kjTable"></table>';
        
        mockedAxios.get.mockResolvedValue({
            data: Buffer.from(mockHTML, 'utf-8'),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
        });
        
        const result = await scrapeDisclosureList('20240115');
        
        expect(result).toEqual([]);
    });
    
    it('404エラー時は空配列を返す', async () => {
        mockedAxios.get.mockRejectedValue({
            isAxiosError: true,
            response: { status: 404 },
        });
        
        const result = await scrapeDisclosureList('20240115');
        
        expect(result).toEqual([]);
    });
});
