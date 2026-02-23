/**
 * 定数エクスポートファイル
 *
 * すべての定数ファイルを一元的にエクスポートします。
 * これにより、インポート文を簡略化し、コードの可読性を向上させます。
 *
 * 使用例:
 * ```typescript
 * // 修正前
 * import { MIN_PDF_SIZE, MAX_PDF_SIZE } from '../constants/file-limits';
 * import { TDNET_MIN_DELAY_MS } from '../constants/rate-limits';
 * import { HTTP_TIMEOUT_MS } from '../constants/http-config';
 *
 * // 修正後
 * import { MIN_PDF_SIZE, MAX_PDF_SIZE, TDNET_MIN_DELAY_MS, HTTP_TIMEOUT_MS } from '../constants';
 * ```
 */

// ファイルサイズ制限定数
export { MIN_PDF_SIZE, MAX_PDF_SIZE, MAX_FILE_SIZE } from './file-limits';

// レート制限設定定数
export { TDNET_MIN_DELAY_MS } from './rate-limits';

// HTTP設定定数
export { HTTP_TIMEOUT_MS, USER_AGENT_FULL, USER_AGENT_SHORT } from './http-config';
