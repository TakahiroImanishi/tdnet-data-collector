---
inclusion: fileMatch
fileMatchPattern: '**/lambda/**/*.ts'
---

# Lambda実装ガイド

## メモリとタイムアウト

| 関数タイプ | メモリ | タイムアウト |
|-----------|--------|------------|
| Collector（スクレイピング） | 512MB | 15分 |
| Parser（PDF解析） | 1024MB | 5分 |
| Query（API） | 256MB | 30秒 |
| Export（大量データ） | 1024MB | 15分 |

## 環境変数検証

詳細: `error-handling-implementation.md`

## エラーハンドリング

詳細: `error-handling-implementation.md`, `../api/error-codes.md`, `../core/error-handling-patterns.md`

## パフォーマンス最適化

グローバルスコープで初期化（コールドスタート対策）

詳細: `../infrastructure/performance-optimization.md`

## 実装チェックリスト

- [ ] 必須環境変数検証
- [ ] エラーハンドリング実装
- [ ] メモリ・タイムアウト設定
- [ ] コールドスタート対策
- [ ] 構造化ログ

## 関連

`../core/error-handling-patterns.md`, `error-handling-implementation.md`, `../infrastructure/environment-variables.md`, `../infrastructure/performance-optimization.md`, `testing-strategy.md`
