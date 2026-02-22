---
inclusion: fileMatch
fileMatchPattern: '**/*.test.ts|**/*.spec.ts'
---

# テスト戦略

## テスト比率・カバレッジ

| 種類 | 比率 | カバレッジ目標 |
|------|------|---------------|
| ユニット | 70% | ライン80%、ブランチ75%、関数85% |
| 統合 | 20% | AWS SDK、DynamoDB、S3 |
| E2E | 10% | API経由の完全フロー |

## テスト実行

```bash
npm test                              # すべて
npm run test:unit                     # ユニットのみ
npm run test:integration              # 統合のみ
npm test -- --watchAll=false          # CI/CD用
npm test -- --watchAll=false --coverage  # カバレッジ付き
```

## E2Eテスト（LocalStack必須）

```bash
docker-compose up -d                  # 1. 起動
Start-Sleep -Seconds 30               # 2. 待機
.\scripts\localstack-setup.ps1        # 3. セットアップ
npm run test:e2e                      # 4. 実行
docker-compose down                   # 5. 停止
```

## 必須ルール

- [ ] 対話モード禁止（`--watchAll=false`）
- [ ] 各テスト独立実行可能
- [ ] 外部依存モック化
- [ ] AAAパターン（Arrange → Act → Assert）

## Lambda関数のユニットテスト必須カバレッジ

すべてのLambda関数は以下のカテゴリをカバーするユニットテストを実装すること：

**正常系:**
- 基本的な成功シナリオ（1件、複数件、0件）
- ページネーション処理
- 空データの処理

**バリデーション:**
- 必須パラメータの検証
- 数値範囲の検証
- 日付フォーマットの検証
- 日付範囲の検証

**エラーハンドリング:**
- Retryableエラー（ネットワークエラー、タイムアウト、5xx、429）
- Non-Retryableエラー（404、400、バリデーションエラー）
- 部分的失敗

**パフォーマンス:**
- レート制限の動作確認
- 並列処理の動作確認
- 大量データの処理

**データ整合性:**
- 開示ID生成の一意性
- date_partitionの正確性
- 連番の正確性

**参照:** `work-log-20260222-185043-subagent3-testing-requirements.md`

## 関連ドキュメント

- `../core/tdnet-implementation-rules.md` - プロパティテスト例
- `../../specs/tdnet-data-collector/templates/test-examples/` - 実装例
