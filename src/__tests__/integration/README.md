# 統合テスト設計ガイドライン

## 概要

このディレクトリは統合テスト用ですが、現在は使用していません。

## 統合テストの課題

### メモリ不足問題
実際のLambda handlerをインポートすると、全ての依存関係が読み込まれ、メモリ使用量が4GB以上必要になります。これにより、以下の問題が発生します:

- `JavaScript heap out of memory`エラー
- テスト実行が不可能
- CI/CD環境での実行が困難

### 採用した解決策

**E2Eテストへの統合**を採用しました。

## E2Eテストの利点

1. **実環境に近いテスト**: LocalStack環境で実際のAWS SDKを使用
2. **メモリ問題の回避**: 個別のプロセスで実行
3. **既存インフラの活用**: docker-compose、LocalStackセットアップスクリプト
4. **実用的な価値**: 実際の統合動作を検証

## E2Eテストの場所

各Lambda関数のテストディレクトリに配置:
- `src/lambda/query/__tests__/handler.e2e.test.ts`
- `src/lambda/export/__tests__/handler.e2e.test.ts`
- `src/lambda/dlq-processor/__tests__/handler.e2e.test.ts`
- `src/lambda/collect-status/__tests__/handler.e2e.test.ts`
- `src/lambda/collector/__tests__/handler.e2e.test.ts`

## E2Eテストの実行方法

### 前提条件
1. Docker Desktopが起動していること
2. LocalStack環境が起動していること

### 実行手順
```powershell
# Docker Desktop起動確認
docker ps

# LocalStack環境起動
docker compose up -d

# LocalStack環境確認
docker ps --filter "name=localstack"

# DynamoDB/S3リソース作成
scripts/localstack-setup.ps1

# E2Eテスト実行
npm run test:e2e
```

## テストカバレッジ戦略

### ユニットテスト（70%目標）
- 個別関数のロジック検証
- モックを使用した高速実行
- プロパティベーステスト含む

### E2Eテスト（20%目標）
- Lambda関数の統合動作検証
- AWS SDKとの統合検証
- LocalStack環境での実行

### プロパティベーステスト（10%目標）
- データ整合性の検証
- エッジケースの網羅的検証
- fast-checkライブラリ使用

## 統合テストの代替アプローチ

将来的に統合テストを再導入する場合の選択肢:

### オプション1: 軽量モック化（非推奨）
Lambda handlerをモック化して軽量化。ただし、テストの価値が低下するため非推奨。

### オプション2: 別プロセスでの実行
統合テストを別プロセスで実行し、メモリ制限を回避。ただし、複雑性が増すため慎重に検討。

### オプション3: E2Eテストの拡充（推奨）
現在のアプローチを継続し、E2Eテストを拡充。最も実用的で価値の高いアプローチ。

## 関連ドキュメント

- タスク51: `.kiro/specs/tdnet-data-collector/tasks/tasks-improvements-20260222.md`
- 作業記録: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-144301-task51-integration-test-redesign.md`
- テスト戦略: `.kiro/steering/development/testing-strategy.md`
