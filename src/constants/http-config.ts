/**
 * HTTP設定定数
 *
 * HTTPリクエストに関する設定値を一元管理します。
 * これらの定数は、TDnetサーバーへのアクセス時の技術的制約に基づいて設定されています。
 *
 * Requirements: 要件1.1, 9.1（TDnetアクセス、レート制限）
 */

/**
 * HTTPタイムアウト設定（ミリ秒）
 *
 * @remarks
 * 30秒（30000ms）に設定されている理由:
 * - TDnetサーバーのレスポンス時間: 通常5-10秒、混雑時は20秒以上
 * - ネットワーク遅延: 最大5秒を想定
 * - 安全マージン: 予期しない遅延に対応
 * - Lambda実行時間: 最大15分のうち、1リクエストあたり30秒は許容範囲
 *
 * 技術的制約:
 * - TDnetサーバーは公開サービスであり、レスポンス時間を制御できない
 * - 短すぎるタイムアウトは不要な再試行を引き起こし、サーバー負荷を増加させる
 * - 長すぎるタイムアウトはLambda実行時間を圧迫する
 */
export const HTTP_TIMEOUT_MS = 30000;

/**
 * User-Agent（フルバージョン）
 *
 * @remarks
 * TDnetサーバーへのアクセス時に使用する完全なUser-Agent文字列。
 * プロジェクト情報とリポジトリURLを含みます。
 *
 * 形式: `TDnet-Data-Collector/バージョン (リポジトリURL)`
 *
 * 技術的制約:
 * - TDnetサーバーは適切なUser-Agentを持つリクエストを優先的に処理する可能性がある
 * - User-Agentにプロジェクト情報を含めることで、サーバー管理者が問題発生時に連絡可能
 * - RFC 7231に準拠した形式を使用
 */
export const USER_AGENT_FULL = 'TDnet-Data-Collector/1.0 (https://github.com/your-org/tdnet-data-collector)';

/**
 * User-Agent（簡易バージョン）
 *
 * @remarks
 * PDFダウンロードなど、シンプルなHTTPリクエストで使用する簡易版User-Agent。
 * プロジェクト名とバージョンのみを含みます。
 *
 * 形式: `TDnet-Data-Collector/バージョン`
 *
 * 使用場面:
 * - PDFファイルのダウンロード
 * - 静的リソースの取得
 * - User-Agentの長さを最小化したい場合
 */
export const USER_AGENT_SHORT = 'TDnet-Data-Collector/1.0';
