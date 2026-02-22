# TDnet Data Collector - 改善タスク

作成日時: 2026-02-22 08:58:36
元タスク: tasks-quality-20260222.md

## 目的

品質チェックで発見された問題を優先度順に改善する。

## 優先度: 高（緊急対応が必要）

### 1. セキュリティ: 本番APIキーのハードコード削除

**問題**: `.env.production`に本番APIキーが直接記載されている（セキュリティリスク）

**影響範囲**: Dashboard

**対応内容**:
- [x] `.env.production`をGitから削除
- [x] `.gitignore`に`.env.production`を追加
- [x] デプロイスクリプトでSecrets Managerから環境変数を取得する仕組みを実装
- [ ] デプロイドキュメント（DEPLOYMENT.md）を更新

**担当**: AI Assistant

**期限**: 即座

**完了日時**: 2026-02-22 09:04:13

**関連ファイル**:
- `dashboard/.env.production` (削除)
- `dashboard/.env.production.example` (新規作成)
- `dashboard/.gitignore` (更新)
- `scripts/deploy-dashboard.ps1` (更新)
- `dashboard/DEPLOYMENT.md` (未更新)

---

### 2. API設計: 設計ドキュメントとOpenAPI仕様の更新

**問題**: 
- Query Lambda: limitパラメータの不整合（OpenAPI: 100、実装: 1000）
- Stats Lambda: レスポンス項目の不整合（設計と実装が異なる）
- Collect Lambda: ステータスコードの不整合（設計: 202、実装: 200）
- レート制限の不整合（設計: 100/分、実装: 100/秒）

**影響範囲**: API設計ドキュメント、OpenAPI仕様書

**対応内容**:
- [x] API設計ドキュメントを実装に合わせて更新
  - limitパラメータ: 1000に統一
  - Stats Lambdaレスポンス項目を実装に合わせて更新
  - monthパラメータを追加
- [x] OpenAPI仕様書（`docs/api/openapi.yaml`）を更新
- [x] Collect Lambdaのレスポンス形式を実装に合わせて更新（statusCode 200維持）
- [x] Health Lambdaのレスポンス例を更新（healthy: 200、unhealthy: 503）
- [x] レート制限設定を実装に合わせて更新（WAF: 500/5分、API Gateway: 100/秒）

**担当**: AI Assistant

**期限**: 1週間以内

**完了日**: 2026-02-22 09:04:16

**関連ファイル**:
- `.kiro/specs/tdnet-data-collector/docs/01-requirements/api-design.md`
- `.kiro/specs/tdnet-data-collector/docs/01-requirements/openapi.yaml`
- `src/lambda/collect/handler.ts`
- `cdk/lib/constructs/waf.ts`
- `cdk/lib/stacks/api-stack.ts`

**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-090416-api-design-improvements.md`

---

### 3. Dashboard: PdfDownloadコンポーネントの統合

**問題**: PdfDownloadコンポーネントが実装されているが、DisclosureListで使用されていない

**影響範囲**: Dashboard

**対応内容**:
- [ ] DisclosureListコンポーネントにPdfDownloadコンポーネントを統合
- [ ] PDF表示アイコンをPdfDownloadボタンに置き換え
- [ ] E2Eテストを追加（`dashboard/src/__tests__/e2e/pdf-download.spec.ts`）

**担当**: 未定

**期限**: 1週間以内

**関連ファイル**:
- `dashboard/src/components/DisclosureList.tsx`
- `dashboard/src/components/PdfDownload.tsx`
- `dashboard/src/__tests__/e2e/pdf-download.spec.ts`（新規作成）

---

### 4. Dashboard: ユニットテストの修正

**問題**: PdfDownload.test.tsx、ExecutionStatus.test.tsxのテストが失敗

**影響範囲**: Dashboard

**対応内容**:
- [ ] PdfDownload.test.tsx: DOM要素のセットアップを修正（"Target container is not a DOM element"エラー）
- [ ] ExecutionStatus.test.tsx: 状態更新をact()でラップ

**担当**: 未定

**期限**: 1週間以内

**関連ファイル**:
- `dashboard/src/components/__tests__/PdfDownload.test.tsx`
- `dashboard/src/components/__tests__/ExecutionStatus.test.tsx`

---

### 5. セキュリティ: npm audit実行の追加

**問題**: package.jsonやCI/CDパイプラインにnpm audit実行の設定なし

**影響範囲**: プロジェクト全体

**対応内容**:
- [x] package.jsonに`audit`、`audit:fix`、`pretest`スクリプトを追加
- [x] GitHub Actionsワークフロー作成（`.github/workflows/security-audit.yml`）
- [x] 毎週月曜日に自動実行、mainブランチpush時にも実行

**担当**: AI Assistant

**期限**: 1週間以内

**完了日時**: 2026-02-22 09:04:13

**関連ファイル**:
- `package.json` (更新)
- `.github/workflows/security-audit.yml` (新規作成)

---

### 6. 監視: X-Rayトレーシング有効化

**問題**: Lambda関数でX-Rayトレーシングが有効化されていない

**影響範囲**: すべてのLambda関数

**対応内容**:
- [x] Lambda Constructに`tracing: lambda.Tracing.ACTIVE`を追加
- [x] 対象ファイル:
  - `cdk/lib/constructs/lambda-collector.ts`
  - `cdk/lib/constructs/lambda-query.ts`
  - `cdk/lib/constructs/lambda-export.ts`
  - `cdk/lib/constructs/lambda-dlq.ts`
  - `cdk/lib/stacks/compute-stack.ts`（9個のLambda関数）

**担当**: AI Assistant

**期限**: 1週間以内

**完了日**: 2026-02-22 09:15:00

**関連ファイル**:
- `cdk/lib/constructs/lambda-*.ts`
- `cdk/lib/stacks/compute-stack.ts`

**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-090421-monitoring-improvements.md`

---

## 優先度: 中（計画的に対応）

### 7. テスト: カバレッジ測定と最適化

**問題**: テスト実行タイムアウト（120秒）により、実際のカバレッジ率を確認できず

**影響範囲**: テスト全体

**対応内容**:
- [ ] テスト実行時間を最適化（並列実行ワーカー数調整、テストファイル分割）
- [ ] カバレッジ測定: `npm test -- --coverage --maxWorkers=50%`
- [ ] 目標: 80%以上のカバレッジ達成、実行時間60秒以内

**担当**: 未定

**期限**: 2週間以内

**関連ファイル**:
- `test/jest.config.js`
- すべてのテストファイル

---

### 8. テスト: E2Eテスト実行確認

**問題**: LocalStack環境でのE2Eテスト実行が未確認

**影響範囲**: E2Eテスト

**対応内容**:
- [ ] Docker Desktop起動確認
- [ ] LocalStack環境起動: `docker compose up -d`
- [ ] LocalStack環境セットアップ: `scripts/localstack-setup.ps1`
- [ ] E2Eテスト実行: `npm run test:e2e`
- [ ] 実行結果を作業記録に記載

**担当**: 未定

**期限**: 2週間以内

**関連ファイル**:
- `docker-compose.yml`
- `scripts/localstack-setup.ps1`
- `test/jest.config.e2e.js`

---

### 9. データモデル: Zodスキーマの導入

**問題**: Zodスキーマが未実装（設計ドキュメントには記載あり）

**影響範囲**: データバリデーション

**対応内容**:
- [ ] Zodスキーマ定義ファイルを作成（`src/validators/disclosure-schema.ts`）
- [ ] 必須フィールドバリデーション実装
- [ ] Lambda関数でZodスキーマを使用
- [ ] テストを追加

**担当**: 未定

**期限**: 2週間以内

**関連ファイル**:
- `src/validators/disclosure-schema.ts`（新規作成）
- `src/lambda/*/handler.ts`

---

### 10. CDK: タグ付け戦略の実装

**問題**: タグ付け戦略が未実装（コスト管理のため推奨）

**影響範囲**: すべてのAWSリソース

**対応内容**:
- [ ] タグ付け戦略を定義（Environment, Project, Owner, CostCenter等）
- [ ] CDKスタックにタグを追加
- [ ] デプロイ後にタグが適用されていることを確認

**担当**: 未定

**期限**: 2週間以内

**関連ファイル**:
- `cdk/lib/stacks/*.ts`

---

### 11. セキュリティ: API Gateway TLS 1.2設定

**問題**: API GatewayでTLS 1.2以上の明示的な設定が見当たらない

**影響範囲**: API Gateway

**対応内容**:
- [x] API Gatewayに`securityPolicy: SecurityPolicy.TLS_1_2`を設定
- [x] カスタムドメイン使用時の設定を追加

**担当**: AI Assistant

**期限**: 2週間以内

**完了日時**: 2026-02-22 09:04:13

**注意**: デフォルトのAPI Gateway URLはTLS 1.2がデフォルトで有効。カスタムドメイン使用時の設定例をコメントで追加。

**関連ファイル**:
- `cdk/lib/stacks/api-stack.ts` (更新)

---

### 12. 監視: CloudWatch Alarms閾値の見直し

**問題**: Lambda Errors、Throttlesの閾値が設計ドキュメントと異なる

**影響範囲**: CloudWatch Alarms

**対応内容**:
- [x] Lambda Errors: 警告（> 5%）と重大（> 10%）の2段階に分ける
- [x] Lambda Throttles: 警告（> 0）と重大（> 5）の2段階に分ける
- [x] 設計ドキュメントとの整合性を確認

**担当**: AI Assistant

**期限**: 2週間以内

**完了日**: 2026-02-22 09:15:00

**関連ファイル**:
- `cdk/lib/constructs/cloudwatch-alarms.ts`
- `.kiro/steering/infrastructure/monitoring-alerts.md`

**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-090421-monitoring-improvements.md`

---

### 13. 監視: API Gatewayウィジェット修正

**問題**: CloudWatch DashboardのAPI Gatewayウィジェットが型エラーでコメントアウト

**影響範囲**: CloudWatch Dashboard

**対応内容**:
- [x] 型エラーを修正してコメントアウトを解除
- [x] 直接Metricオブジェクトを作成する方式に変更

**担当**: AI Assistant

**期限**: 2週間以内

**完了日**: 2026-02-22 09:15:00

**関連ファイル**:
- `cdk/lib/constructs/cloudwatch-dashboard.ts`

**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-090421-monitoring-improvements.md`

---

### 14. Dashboard: CI/CDパイプラインの実装

**問題**: CI/CDパイプラインが未実装（設定例のみ）

**影響範囲**: Dashboard

**対応内容**:
- [ ] GitHub Actionsワークフローを実装（`.github/workflows/dashboard-deploy.yml`）
- [ ] 自動テスト実行
- [ ] 自動デプロイ（mainブランチへのマージ時）
- [ ] Secrets Managerから環境変数を取得

**担当**: 未定

**期限**: 2週間以内

**関連ファイル**:
- `.github/workflows/dashboard-deploy.yml`（新規作成）
- `scripts/deploy-dashboard.ps1`

---

### 15. ドキュメント: Lambda関数一覧の更新

**問題**: Lambda関数一覧が古い（11個→12個以上、詳細説明不足）

**影響範囲**: ドキュメント

**対応内容**:
- [ ] README.mdのLambda関数一覧を更新
- [ ] 各Lambda関数の詳細説明を追加
- [ ] 実装状況を確認

**担当**: 未定

**期限**: 2週間以内

**関連ファイル**:
- `README.md`
- `.kiro/specs/tdnet-data-collector/docs/02-lambda/README.md`

---

### 16. ドキュメント: API仕様の統一

**問題**: API仕様が複数箇所に分散、重複している

**影響範囲**: ドキュメント

**対応内容**:
- [x] OpenAPI仕様書への参照を追加
- [x] 重複したAPI仕様を削減
- [x] エンドポイント一覧を完全化（health、stats、collect-status追加）

**担当**: AI Assistant

**期限**: 2週間以内

**完了日**: 2026-02-22 09:04:16

**関連ファイル**:
- `README.md`
- `.kiro/specs/tdnet-data-collector/docs/01-requirements/openapi.yaml`
- `.kiro/specs/tdnet-data-collector/docs/01-requirements/api-design.md`

**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-090416-api-design-improvements.md`

---

### 17. セキュリティ: Dependabot設定

**問題**: 依存関係の自動更新プロセスがない

**影響範囲**: プロジェクト全体

**対応内容**:
- [x] Dependabot設定ファイルを作成（`.github/dependabot.yml`）
- [x] 毎週自動更新チェック
- [x] プルリクエスト上限10件

**担当**: AI Assistant

**期限**: 2週間以内

**完了日時**: 2026-02-22 09:04:13

**関連ファイル**:
- `.github/dependabot.yml` (新規作成)

---

## 優先度: 低（余裕があれば対応）

### 18. データモデル: company_codeバリデーションの統一

**問題**: company_codeバリデーションが設計と実装で異なる

**影響範囲**: データバリデーション

**対応内容**:
- [ ] 設計ドキュメントと実装を確認
- [ ] バリデーションルールを統一
- [ ] テストを更新

**担当**: 未定

**期限**: 1ヶ月以内

**関連ファイル**:
- `src/validators/*.ts`
- `.kiro/specs/tdnet-data-collector/docs/04-data-model/data-model.md`

---

### 19. データモデル: file_sizeバリデーションの整理

**問題**: file_sizeバリデーションの実装漏れ

**影響範囲**: データバリデーション

**対応内容**:
- [ ] file_sizeバリデーションを実装
- [ ] テストを追加

**担当**: 未定

**期限**: 1ヶ月以内

**関連ファイル**:
- `src/validators/*.ts`

---

### 20. API: Stats Lambdaのパフォーマンス改善

**問題**: Stats LambdaがScanを使用（パフォーマンス懸念）

**影響範囲**: Stats Lambda

**対応内容**:
- [x] 現状分析完了: Scanを使用、大量データ時にパフォーマンス影響あり
- [x] 改善案検討: 集計テーブル、CloudWatch Metrics、キャッシュ
- [x] API設計書に注意事項を記載
- [ ] 将来的な改善: データ量増加時に集計テーブルを導入

**担当**: AI Assistant

**期限**: 1ヶ月以内

**完了日**: 2026-02-22 09:04:16（分析・ドキュメント化完了、実装は将来対応）

**関連ファイル**:
- `src/lambda/stats/handler.ts`
- `.kiro/specs/tdnet-data-collector/docs/01-requirements/api-design.md`

**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-090416-api-design-improvements.md`

**備考**: 現時点ではデータ量が少ないため、パフォーマンス問題は顕在化していない。データ量が増加した際に集計テーブルを導入する方針。

---

### 21. API: Health Lambdaのステータスコード修正

**問題**: unhealthy時に503を返すべき（現在は200）

**影響範囲**: Health Lambda

**対応内容**:
- [x] 実装確認: 既に正しく実装されている（healthy: 200、unhealthy: 503）
- [x] API設計書を実装に合わせて更新
- [x] OpenAPI仕様を実装に合わせて更新

**担当**: AI Assistant

**期限**: 1ヶ月以内

**完了日**: 2026-02-22 09:04:16

**関連ファイル**:
- `src/lambda/health/handler.ts`
- `.kiro/specs/tdnet-data-collector/docs/01-requirements/api-design.md`
- `.kiro/specs/tdnet-data-collector/docs/01-requirements/openapi.yaml`

**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-090416-api-design-improvements.md`

**備考**: 実装は既に正しかったため、ドキュメントのみ修正。

---

### 22. セキュリティ: CloudWatch Logs権限の限定

**問題**: lambda-dlq.tsで`resources: ['*']`を使用

**影響範囲**: Lambda DLQ

**対応内容**:
- [x] CloudWatch Logs権限を特定ロググループに限定
- [x] IAMポリシーを更新

**担当**: AI Assistant

**期限**: 1ヶ月以内

**完了日時**: 2026-02-22 09:04:13

**関連ファイル**:
- `cdk/lib/constructs/lambda-dlq.ts` (更新)
- [ ] IAMポリシーを更新

**担当**: 未定

**期限**: 1ヶ月以内

**関連ファイル**:
- `cdk/lib/constructs/lambda-dlq.ts`

---

### 23. 監視: DynamoDB/API Gatewayアラーム追加

**問題**: 設計ドキュメントに記載されているが未実装

**影響範囲**: CloudWatch Alarms

**対応内容**:
- [x] DynamoDB UserErrors、SystemErrors、ThrottledRequestsアラーム追加
- [x] API Gateway 4XXError、5XXError、Latencyアラーム追加

**担当**: AI Assistant

**期限**: 1ヶ月以内

**完了日**: 2026-02-22 09:15:00

**関連ファイル**:
- `cdk/lib/constructs/cloudwatch-alarms.ts`

**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-090421-monitoring-improvements.md`

---

### 24. テスト: 統合テストの追加

**問題**: 統合テストが不足（設計目標20%に対して実装は限定的）

**影響範囲**: テスト全体

**対応内容**:
- [ ] Lambda関数間の統合テストを追加
- [ ] AWS SDK統合テストを追加
- [ ] 設計目標20%を達成

**担当**: 未定

**期限**: 1ヶ月以内

**関連ファイル**:
- `src/__tests__/integration/`（新規作成）

---

### 25. テスト: テストデータファクトリーの作成

**問題**: テストデータの重複、ファクトリー不足

**影響範囲**: テスト全体

**対応内容**:
- [ ] テストデータ生成の共通ユーティリティを作成
- [ ] テストデータの重複を削減

**担当**: 未定

**期限**: 1ヶ月以内

**関連ファイル**:
- `src/__tests__/test-helpers/`（新規作成）

---

### 26. Dashboard: E2Eテストの拡充

**問題**: ブラウザカバレッジ不足（Chromiumのみ）、モックデータ不足

**影響範囲**: Dashboard E2Eテスト

**対応内容**:
- [ ] Firefox、Webkitブラウザでのテスト追加
- [ ] モックデータの充実
- [ ] 条件付きスキップの削減

**担当**: 未定

**期限**: 1ヶ月以内

**関連ファイル**:
- `dashboard/playwright.config.ts`
- `dashboard/src/__tests__/e2e/*.spec.ts`

---

### 27. Dashboard: ビルド最適化の検証

**問題**: Lighthouseスコアやバンドルサイズ分析の実施記録なし

**影響範囲**: Dashboard

**対応内容**:
- [ ] Lighthouseスコアの測定（目標: 90以上）
- [ ] バンドルサイズ分析（source-map-explorer）
- [ ] パフォーマンス最適化

**担当**: 未定

**期限**: 1ヶ月以内

**関連ファイル**:
- `dashboard/package.json`

---

### 28. Dashboard: Viteへの移行検討

**問題**: Create React Appを使用（Viteの方が高速）

**影響範囲**: Dashboard

**対応内容**:
- [ ] ViteへのマイグレーションプランをPOC
- [ ] ビルド速度の比較
- [ ] 移行の実施（必要に応じて）

**担当**: 未定

**期限**: 2ヶ月以内

**関連ファイル**:
- `dashboard/package.json`
- `dashboard/vite.config.ts`（新規作成）

---

## 進捗管理

| タスク番号 | タスク名 | 優先度 | 状態 | 担当 | 開始日 | 完了日 |
|-----------|---------|--------|------|------|--------|--------|
| 1 | 本番APIキーのハードコード削除 | 高 | ⏳ 未着手 | - | - | - |
| 2 | API設計ドキュメント更新 | 高 | ⏳ 未着手 | - | - | - |
| 3 | PdfDownloadコンポーネント統合 | 高 | ⏳ 未着手 | - | - | - |
| 4 | ユニットテスト修正 | 高 | ⏳ 未着手 | - | - | - |
| 5 | npm audit実行追加 | 高 | ⏳ 未着手 | - | - | - |
| 6 | X-Rayトレーシング有効化 | 高 | ✅ 完了 | AI Assistant | 2026-02-22 | 2026-02-22 |
| 7 | カバレッジ測定と最適化 | 中 | ⏳ 未着手 | - | - | - |
| 8 | E2Eテスト実行確認 | 中 | ⏳ 未着手 | - | - | - |
| 9 | Zodスキーマ導入 | 中 | ⏳ 未着手 | - | - | - |
| 10 | タグ付け戦略実装 | 中 | ⏳ 未着手 | - | - | - |
| 11 | API Gateway TLS 1.2設定 | 中 | ⏳ 未着手 | - | - | - |
| 12 | CloudWatch Alarms閾値見直し | 中 | ✅ 完了 | AI Assistant | 2026-02-22 | 2026-02-22 |
| 13 | API Gatewayウィジェット修正 | 中 | ✅ 完了 | AI Assistant | 2026-02-22 | 2026-02-22 |
| 14 | CI/CDパイプライン実装 | 中 | ⏳ 未着手 | - | - | - |
| 15 | Lambda関数一覧更新 | 中 | ⏳ 未着手 | - | - | - |
| 16 | API仕様統一 | 中 | ⏳ 未着手 | - | - | - |
| 17 | Dependabot設定 | 中 | ⏳ 未着手 | - | - | - |
| 18-28 | その他（優先度: 低） | 低 | ⏳ 未着手 | - | - | - |
| 23 | DynamoDB/API Gatewayアラーム追加 | 低 | ✅ 完了 | AI Assistant | 2026-02-22 | 2026-02-22 |

## 関連ドキュメント

- 元タスク: `.kiro/specs/tdnet-data-collector/tasks/tasks-quality-20260222.md`
- 作業記録:
  - `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-083712-quality-check-cdk-stack.md`
  - `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-083719-quality-check-api-design.md`
  - `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-083723-quality-check-data-model.md`
  - `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-084812-quality-check-testing.md`
  - `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-084834-quality-check-scripts.md`
  - `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-084932-quality-check-security.md`
  - `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-084828-quality-check-monitoring.md`
  - `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-084841-quality-check-documentation.md`
  - `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-085527-quality-check-dashboard-basic.md`
  - `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-085607-quality-check-dashboard-pdf.md`
  - `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-085601-quality-check-dashboard-test-build.md`
