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

## 関連ドキュメント

- `../core/tdnet-implementation-rules.md` - プロパティテスト例
- `../../specs/tdnet-data-collector/templates/test-examples/` - 実装例
