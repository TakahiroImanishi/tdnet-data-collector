# TDnet Data Collector - ドキュメント索引

このフォルダには、TDnet Data Collectorプロジェクトの全ドキュメントが含まれています。

## 📁 フォルダ構成

```
02-designs/
├── 01-design/            # 設計ドキュメント（8ファイル）
├── 02-implementation/    # 実装ガイド（4ファイル）
├── 03-testing/           # テスト（4ファイル）
├── 04-deployment/        # デプロイ（6ファイル）
├── 05-operations/        # 運用（8ファイル）
├── 06-scripts/           # スクリプト（3ファイル）
├── 07-step-functions/    # Step Functions設計（6ファイル）
├── milestones.md         # マイルストーン達成状況
└── README.md             # このファイル
```

## 01-design/ - 設計ドキュメント

プロジェクトの要件定義、アーキテクチャ設計、API設計など。

| ファイル | 内容 |
|---------|------|
| design.md | 詳細設計書（アーキテクチャ、データモデル、API設計を統合） |
| api-design.md | REST API設計概要 |
| database-schema.md | DynamoDBスキーマ設計 |
| data-integrity-design.md | データ整合性設計 |
| rate-limiting-design.md | レート制限設計 |
| error-recovery-strategy.md | エラー回復戦略 |
| openapi.yaml | OpenAPI 3.0仕様 |
| README.md | フォルダ概要 |

## 02-implementation/ - 実装ガイド

実装開始前のチェックリストと検証項目、CDKインフラストラクチャドキュメント。

| ファイル | 内容 |
|---------|------|
| implementation-checklist.md | 実装開始前チェックリスト（100項目以上） |
| correctness-properties-checklist.md | 設計検証項目（15項目） |
| cdk-infrastructure.md | CDKインフラストラクチャ完全ガイド |
| README.md | フォルダ概要 |

## 03-testing/ - テスト

テスト環境構築とE2Eテストガイド。

| ファイル | 内容 |
|---------|------|
| e2e-test-guide.md | E2Eテスト実行ガイド |
| localstack-setup.md | LocalStack環境構築手順 |
| load-testing-guide.md | 負荷テストガイド（Phase 5実施予定） |
| smoke-test-guide.md | スモークテストガイド |
| README.md | フォルダ概要 |

## 04-deployment/ - デプロイ

環境構築、CDKブートストラップ、CI/CD設定。

| ファイル | 内容 |
|---------|------|
| environment-setup.md | 環境セットアップ手順 |
| cdk-bootstrap-guide.md | CDKブートストラップガイド |
| ci-cd-guide.md | CI/CDガイド（自動デプロイ） |
| production-deployment-checklist.md | 本番デプロイチェックリスト |
| rollback-procedures.md | ロールバック手順 |
| README.md | フォルダ概要 |

## 05-operations/ - 運用

監視、コスト管理、トラブルシューティング。

| ファイル | 内容 |
|---------|------|
| operations-manual.md | 運用マニュアル（包括的ガイド） |
| monitoring-guide.md | 監視ガイド（CloudWatch、Alarms、Dashboard） |
| metrics-and-kpi.md | メトリクスとKPI |
| cost-monitoring.md | コスト監視ガイド |
| troubleshooting.md | 包括的なトラブルシューティングガイド（Lambda、DynamoDB、S3、スクレイピング、API Gateway、CDK、監視、APIキー関連） |
| backup-strategy.md | バックアップ戦略 |
| lambda-power-tuning.md | Lambda Power Tuningガイド（Phase 5実施予定） |
| README.md | フォルダ概要 |

## 06-scripts/ - スクリプト

運用スクリプトのドキュメント。

| ファイル | 内容 |
|---------|------|
| scripts-overview.md | スクリプト概要 |
| deployment-scripts.md | デプロイスクリプト |
| setup-scripts.md | セットアップスクリプト |
| README.md | フォルダ概要 |

## 07-step-functions/ - Step Functions設計

AWS Step Functionsを使用したデータ収集ワークフローの設計ドキュメント。

| ファイル | 内容 |
|---------|------|
| step-functions-architecture.md | Step Functionsアーキテクチャ設計 |
| step-functions-workflow-diagram.md | ワークフロー図と状態遷移 |
| step-functions-state-machine.json | ステートマシン定義（JSON） |
| step-functions-error-handling.md | エラーハンドリング戦略 |
| step-functions-cost-analysis.md | コスト分析と最適化 |
| README.md | フォルダ概要 |

## milestones.md - マイルストーン

Phase 1-4の達成状況とPhase 5の計画。

## 📖 ドキュメント読み順

### 初めての方
1. `01-design/design.md` - アーキテクチャと詳細設計を確認
2. `02-implementation/implementation-checklist.md` - 実装前チェック
3. `milestones.md` - プロジェクトの進捗状況を確認

### 実装者
1. `02-implementation/implementation-checklist.md` - 実装前チェック
2. `02-implementation/cdk-infrastructure.md` - CDKインフラ構成理解
3. `01-design/api-design.md` - API設計確認
4. `01-design/openapi.yaml` - API仕様確認
5. `04-deployment/environment-setup.md` - 環境構築
6. `07-step-functions/step-functions-architecture.md` - Step Functions設計確認

### テスター
1. `03-testing/localstack-setup.md` - テスト環境構築
2. `03-testing/e2e-test-guide.md` - E2Eテスト実行
3. `02-implementation/correctness-properties-checklist.md` - 検証項目確認

### デプロイ担当者
1. `04-deployment/environment-setup.md` - 環境構築
2. `02-implementation/cdk-infrastructure.md` - CDKインフラ構成理解
3. `04-deployment/cdk-bootstrap-guide.md` - CDKブートストラップ
4. `04-deployment/ci-cd-guide.md` - CI/CD構築

### 運用担当者
1. `05-operations/operations-manual.md` - 運用マニュアル
2. `05-operations/monitoring-guide.md` - 監視ガイド
3. `05-operations/troubleshooting.md` - トラブルシューティング

## 🔗 関連ドキュメント

### Steeringファイル（実装ガイドライン）
プロジェクトルートの `.kiro/steering/` フォルダに実装ガイドラインがあります。

- `core/` - 基本ルール（常時読み込み）
- `development/` - 開発ガイドライン
- `infrastructure/` - インフラ・デプロイ
- `security/` - セキュリティ
- `api/` - API設計

詳細は `.kiro/steering/README.md` を参照してください。

### 作業記録・改善履歴
- `../work-logs/` - タスク実行履歴
- `../improvements/` - 改善記録

## 📝 ドキュメント更新ルール

1. ドキュメント更新時は関連するsteeringファイルも確認
2. 設計変更時は `01-design/` 配下を更新
3. 実装手順変更時は `02-implementation/` 配下を更新
4. 運用手順変更時は `05-operations/` 配下を更新
5. Step Functions設計変更時は `07-step-functions/` 配下を更新
6. 更新後は作業記録に記載

## 📚 ドキュメント作成ガイドライン

新規ドキュメント作成時は、以下のガイドラインに従ってください：

- [ドキュメント作成ガイドライン](../../steering/development/mcp-documentation-guidelines.md) - MCP活用とドキュメント標準
- [ドキュメント標準](../../steering/development/documentation-standards.md) - 一般的なドキュメント標準

---

**最終更新**: 2026年2月22日
