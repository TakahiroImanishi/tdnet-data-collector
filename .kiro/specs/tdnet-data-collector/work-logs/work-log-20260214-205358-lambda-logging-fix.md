# 作業記録: Lambda Logging修正

**作業日時**: 2026-02-14 20:53:58
**タスク**: 31.2.6 TDnetサイトのデータ収集テスト（再実行）
**作業概要**: Lambda環境でのログ出力問題の調査と修正

## 問題の特定

### 症状
- Lambda Collector関数が実行されているが、アプリケーションログが全く出力されない
- CloudWatch Logsには`INIT_START`, `START`, `END`, `REPORT`のみ表示
- DynamoDBの実行記録では`collected_count: 0`, `failed_count: 0`で完了
- ローカルテストでは100件成功するが、本番環境では0件

### 調査結果
1. Lambda関数は正常にデプロイされている（2MB、最終更新: 11:47）
2. 環境変数`LOG_LEVEL=DEBUG`は正しく設定されている
3. ビルドされたコードは正しい（`dist/src/lambda/collector/`に全ファイル存在）
4. Collect Lambda関数は`InvocationType: RequestResponse`（同期呼び出し）でCollector Lambda関数を呼び出している
5. Winstonロガーのコンソール出力フォーマットが複雑（colorize + printf）

### 根本原因の仮説
Winstonのコンソール出力フォーマットがLambda環境で正しく動作していない可能性：
- `winston.format.colorize()`はLambda環境では不要
- `winston.format.printf()`のカスタムフォーマットが問題を引き起こしている可能性
- Lambda環境では、シンプルなJSON出力が推奨される

## 修正内容

### 1. logger.tsの修正
- Lambda環境（`NODE_ENV=production`または`AWS_LAMBDA_FUNCTION_NAME`が設定されている場合）では、シンプルなJSON出力を使用
- ローカル環境では、従来の読みやすいフォーマットを維持

## 修正実施（21:06）

### 1. logger.tsの修正
Lambda環境では`console.log/error`を直接使用するように変更：
```typescript
const isLambdaEnvironment = !!process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production';

if (isLambdaEnvironment) {
  console.log(JSON.stringify({ level: 'info', message, ...context }));
} else {
  winstonLogger!.info(message, context);
}
```

### 2. デプロイ＆テスト実行
- デプロイ完了: 21:06
- テスト実行1（2026-02-14）: execution_id `exec_1771070820458_6pyckr_1bb673e9`
  - 結果: 0件収集（TDnetサイトにデータなし）
  - ログ出力: 成功（JSON形式で正しく出力）
- テスト実行2（2026-02-13）: execution_id `exec_1771074285519_tznzpm_6675bd7b`
  - 結果: 100件取得、100件失敗
  - ログ出力: 成功

## 新たな問題の発見（22:07）

### 症状
- HTMLパーサーは100件正常に取得
- しかし、100件すべてが処理失敗
- DynamoDB実行記録: `collected_count: 0`, `failed_count: 100`, `status: failed`

### 調査中
- CloudWatch Logsで詳細なエラーログを確認中
- PDF ダウンロードまたはメタデータ保存で失敗している可能性
- エラーログが大量すぎて、PowerShellのJSON解析が失敗

### 次のステップ
1. AWS Console で CloudWatch Logs を直接確認
2. 失敗の詳細な原因を特定（PDF ダウンロード？メタデータ保存？）
3. 根本原因を修正
4. 再テスト

## 関連ファイル
- `src/utils/logger.ts` - ロガー実装（修正済み）
- `src/lambda/collector/handler.ts` - Collector Lambda関数
- `src/lambda/collect/handler.ts` - Collect Lambda関数
- `src/lambda/collector/download-pdf.ts` - PDF ダウンロード処理
- `src/lambda/collector/save-metadata.ts` - メタデータ保存処理
