/**
 * レート制限設定定数
 *
 * TDnet APIへのアクセスレート制限を定義します。
 * これらの定数は、TDnetサーバーへの過度な負荷を防ぐために使用されます。
 *
 * Requirements: 要件9.1 - レート制限
 */

/**
 * TDnet APIの最小リクエスト間隔（ミリ秒）
 *
 * TDnet APIへのリクエスト間隔を2秒（2000ms）に制限します。
 * この制限は、TDnetサーバーへの過度な負荷を防ぎ、
 * 安定したデータ収集を実現するために設定されています。
 *
 * @remarks
 * 根拠:
 * - TDnet APIは公開されているが、過度なアクセスは推奨されていない
 * - 1リクエスト/秒以下のレートで安定した運用が可能
 * - 2秒間隔（0.5リクエスト/秒）は十分に保守的な設定
 *
 * 使用箇所:
 * - src/lambda/collector/scrape-tdnet-list.ts
 * - src/lambda/collector-fetch/handler.ts
 * - src/lambda/collector/download-pdf.ts
 * - src/lambda/collector/dependencies.ts
 * - src/utils/rate-limiter.ts
 *
 * @constant
 * @type {number}
 * @default 2000
 */
export const TDNET_MIN_DELAY_MS = 2000;
