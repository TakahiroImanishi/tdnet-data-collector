# TDnet Data Collector - 要件マッピング

**バージョン:** 1.0.0  
**最終更新:** 2026-02-22

---

## 要件とドキュメントの対応表

| 要件 | 対応する設計書セクション | 関連Steering |
|------|----------------------|-------------|
| 要件1: データ収集 | Phase 1: 基本機能 | tdnet-scraping-patterns.md |
| 要件2: メタデータ管理 | データモデル | data-validation.md |
| 要件3: ファイル管理 | ストレージ設計 | - |
| 要件4: バッチ処理 | Phase 3: 自動化 | - |
| 要件5: 任意期間データ取得 | Phase 1: 基本機能 | - |
| 要件6: エラーハンドリング | エラー処理設計 | error-handling-patterns.md |
| 要件7: データクエリとエクスポート | Phase 2: API実装 | api-design-guidelines.md |
| 要件8: 設定管理 | 環境変数設計 | environment-variables.md |
| 要件9: パフォーマンス最適化 | 非機能要件 | performance-optimization.md |
| 要件10: Webダッシュボード | Phase 2: ダッシュボード | - |
| 要件11: API認証 | セキュリティ設計 | security-best-practices.md |
| 要件12: コスト最適化 | 非機能要件 | - |
| 要件13: セキュリティ | セキュリティ設計 | security-best-practices.md |
| 要件14: テスト | テスト戦略 | testing-strategy.md |
| 要件15: DR/バックアップ | DR戦略 | - |
| 要件16: デプロイ自動化 | デプロイ戦略 | deployment-checklist.md |
| 要件17: スタック分割デプロイ | デプロイ戦略 | deployment-checklist.md |
| 要件18: ロールバック戦略 | デプロイ戦略 | deployment-checklist.md |

## 要件カテゴリ別分類

### データ収集・管理（要件1-3）

- **要件1: データ収集機能** - TDnetからの開示情報収集
- **要件2: メタデータ管理** - 開示情報の属性管理
- **要件3: ファイル管理** - PDFファイルの整理と保存

**関連設計:**
- [database-schema.md](../01-design/database-schema.md) - DynamoDBテーブル設計
- [data-integrity-design.md](../01-design/data-integrity-design.md) - データ整合性設計

### 処理・実行（要件4-6）

- **要件4: バッチ処理** - 定期的な自動収集
- **要件5: 任意期間データ取得** - 過去データの遡及収集
- **要件6: エラーハンドリング** - エラー処理とロギング

**関連設計:**
- [error-recovery-strategy.md](../01-design/error-recovery-strategy.md) - エラー回復戦略
- [step-functions-architecture.md](../step-functions-architecture.md) - Step Functions設計

### API・UI（要件7, 10, 11）

- **要件7: データクエリとエクスポート** - データ検索とエクスポート
- **要件10: Webダッシュボード** - Web UI
- **要件11: API認証** - APIセキュリティ

**関連設計:**
- [api-design.md](../01-design/api-design.md) - API設計
- [openapi.yaml](../01-design/openapi.yaml) - OpenAPI仕様

### システム設定（要件8-9）

- **要件8: 設定管理** - 設定ファイル管理
- **要件9: レート制限** - TDnetへのアクセス制御

**関連設計:**
- [rate-limiting-design.md](../01-design/rate-limiting-design.md) - レート制限設計

### 非機能要件（要件12-15）

- **要件12: コスト最適化** - AWS無料枠内での運用
- **要件13: セキュリティ** - セキュリティ対策
- **要件14: テスト** - テスト戦略
- **要件15: DR/バックアップ** - 災害復旧とバックアップ

**関連設計:**
- [cdk-infrastructure.md](../02-implementation/cdk-infrastructure.md) - CDKインフラ設計

## 実装フェーズと要件の対応

### Phase 1: 基本機能（要件1-3, 5, 6）

- データ収集機能
- メタデータ管理
- ファイル管理
- 任意期間データ取得
- エラーハンドリング

### Phase 2: API・UI（要件7, 10, 11）

- データクエリとエクスポート
- Webダッシュボード
- API認証

### Phase 3: 自動化・運用（要件4, 8, 9）

- バッチ処理
- 設定管理
- レート制限

### Phase 4: 品質・セキュリティ（要件12-15）

- コスト最適化
- セキュリティ
- テスト
- DR/バックアップ

---

**最終更新:** 2026-02-22
