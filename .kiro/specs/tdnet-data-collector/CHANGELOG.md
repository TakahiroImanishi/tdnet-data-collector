# Changelog

このファイルは、TDnet Data Collectorプロジェクトの仕様書の変更履歴を記録します。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいており、
バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

---

## [Unreleased]

### 追加予定
- 要件15（DR/バックアップ戦略）の追加
- Phase 4実装（セキュリティ、監視、CI/CD、最適化）

---

## [1.0.3] - 2026-02-09

### 追加
- Phase 3完了サマリー（`PHASE3-COMPLETION-SUMMARY.md`）
  - CloudWatch監視設定完了（100%テスト成功）
  - Webダッシュボード実装完了（React + Material-UI）
  - CloudFront Distribution設定完了（100%テスト成功）
  - Phase 3全体テスト成功率: 85.7%（66/77テスト成功）
- CloudFront CfnOutput実装（タスク19.7完了）
  - DistributionDomainName出力
  - DistributionId出力
  - DashboardUrl出力（HTTPS形式）
  - テスト: 15/15成功（100%）

### 変更
- tasks.mdのタスク19.7を完了としてマーク
  - 完了日時: 2026-02-09 07:39:19
  - テスト結果: 15/15成功
  - 実際の出力名を記録

### 修正
- CloudFront Constructのテストを実際の出力名に合わせて修正
  - ハッシュ付き名前を動的に検出
  - TLS設定テストをデフォルトCloudFront証明書の制限に対応

---

## [1.0.2] - 2026-02-07

### 追加
- 作業記録テンプレート（`work-logs/work-log-template.md`）
- 作業記録作成スクリプト（`work-logs/create-work-log.ps1`）
- テンプレート使用ガイド（`templates/README.md`）の大幅拡充
  - クイックスタートガイド
  - 環境別セットアップガイド（local/development/staging/production）
  - トラブルシューティングセクション
  - よくある質問（FAQ）セクション

### 変更
- ドキュメント間の相互参照リンクを全面的に追加
  - requirements.md、design.md、openapi.yaml、implementation-checklist.md、environment-setup.md、metrics-and-kpi.md、troubleshooting.md、correctness-properties-checklist.mdに「関連ドキュメント」セクションを追加
- work-logsとimprovementsの使い分けガイドを強化
  - work-logs/README.mdに比較表、フローチャート、具体例、判断基準を追加（約200行）
  - improvements/README.mdに判断基準、具体例、ベストプラクティスを追加（約400行）
- テンプレートファイルに詳細なコメントを追加
  - .env.exampleに各環境変数の説明、推奨値、セキュリティ注意事項を追加
  - cdk.context.json.exampleに各設定項目の説明、環境別推奨値を追加（JSONコメント形式）
- 改善記録インデックスを作成
  - improvements/index.mdを作成（カテゴリ別、優先度別、タグ別の一覧）
  - improvements/update-index.ps1を作成（自動更新スクリプト）

### 修正
- ドキュメント間のナビゲーション改善（相互参照リンクの追加）
- テンプレートファイルの使いやすさ向上（詳細なコメントと使用例）

---

## [1.0.1] - 2026-02-07

### 追加
- 改善記録自動更新スクリプト（`improvements/update-index.ps1`）
- ドキュメント間の相互参照リンク（requirements.md, design.mdに追加）
- 環境別設定ファイルテンプレート（`.env.example`, `cdk.context.json.example`）
- テストフィクスチャテンプレート（`templates/test-fixtures/`）
- トラブルシューティングガイド（`docs/troubleshooting.md`）
- メトリクスとKPI定義（`docs/metrics-and-kpi.md`）

### 変更
- 改善記録の命名規則を統一
  - `general-improvement-*.md` → `docs-improvement-*.md`, `steering-improvement-*.md`, `task-*-improvement-*.md`
- `improvements/README.md`に命名規則の詳細を追加
- `improvements/create-improvement.ps1`に`-AutoUpdateIndex`オプションを追加
- 各ドキュメントにバージョン番号を追加

### 修正
- 改善記録ファイル名の不統一を解消（8件のファイルをリネーム）
- `improvements/index.md`の自動生成化

---

## [1.0.0] - 2026-02-07

### 追加
- 初版リリース
- 要件定義書（requirements.md）: 要件1-14
- 設計書（design.md）: 完全な設計仕様
- OpenAPI仕様（openapi.yaml）: REST API定義
- 実装チェックリスト（implementation-checklist.md）: 100項目以上
- Correctness Propertiesチェックリスト（correctness-properties-checklist.md）: 15個のProperty
- 環境設定ガイド（environment-setup.md）: local/dev/prod環境
- テンプレートファイル（templates/）: package.json, GitHub Actions
- 改善履歴管理（improvements/）: README, create-improvement.ps1, index.md
- steeringファイル（.kiro/steering/）: 10個の実装ガイドライン

### 変更
- improvementsフォルダを `.kiro/steering/` から `.kiro/specs/tdnet-data-collector/` に移動
- 改善履歴ファイルの命名規則を統一（`general-improvement-[連番]-[日時].md`）
- 実装チェックリストをチェックボックス形式に変更
- openapi-examples.yamlを削除し、openapi.yamlに統合

### 修正
- design.mdの重複コンテンツを削除（generateDatePartition関数、実装チェックリスト）
- README.mdにドキュメント依存関係図を追加
- 各ドキュメントに「関連ドキュメント」セクションを追加

---

## バージョン番号の意味

このプロジェクトでは、以下のバージョニング規則を採用しています：

### メジャーバージョン（X.0.0）
- 要件の大幅な変更（要件の追加・削除）
- アーキテクチャの根本的な変更
- 後方互換性のない変更

### マイナーバージョン（0.X.0）
- 新機能の追加（後方互換性あり）
- 設計の改善
- 新しいドキュメントの追加

### パッチバージョン（0.0.X）
- バグ修正
- ドキュメントの誤字修正
- 軽微な改善

---

## 変更カテゴリ

### 追加（Added）
新機能や新しいドキュメントの追加

### 変更（Changed）
既存機能の変更

### 非推奨（Deprecated）
将来削除される予定の機能

### 削除（Removed）
削除された機能

### 修正（Fixed）
バグ修正

### セキュリティ（Security）
セキュリティ関連の変更

---

## リリースノート

### v1.0.0 - 初版リリース（2026-02-07）

TDnet Data Collectorプロジェクトの仕様書初版をリリースしました。

**主要な成果物:**
- 14個の要件定義（要件1-14）
- 完全な設計書（アーキテクチャ、データモデル、API仕様）
- 15個のCorrectness Properties
- 100項目以上の実装チェックリスト
- 環境構築ガイド（local/dev/prod）
- GitHub Actionsテンプレート
- 10個のsteeringファイル（実装ガイドライン）

**既知の問題:**
- 要件15（DR/バックアップ戦略）が未定義
- tasks.mdが空ファイル

**次のステップ:**
1. 要件15の追加
2. tasks.mdの整備
3. 実装開始

---

## 更新履歴

| バージョン | リリース日 | 主な変更内容 |
|-----------|-----------|------------|
| 1.0.2 | 2026-02-07 | ドキュメント相互参照、work-logs/improvements使い分けガイド強化、テンプレート拡充 |
| 1.0.1 | 2026-02-07 | 改善記録管理の強化、相互参照リンク追加、テンプレート追加 |
| 1.0.0 | 2026-02-07 | 初版リリース |

---

## 改善記録との連携

重要な改善は、このCHANGELOGにも記載されます。

### 改善記録からCHANGELOGへの反映ルール

以下の条件を満たす改善は、CHANGELOGに記載してください：

1. **要件の追加・変更・削除**
2. **設計の大幅な変更**
3. **新しいドキュメントの追加**
4. **ドキュメント構造の変更**
5. **重大なバグ修正**

### 改善記録の参照

詳細な改善履歴は `improvements/index.md` を参照してください。

---

## 関連ドキュメント

- **要件定義書**: `docs/requirements.md`
- **設計書**: `docs/design.md`
- **改善履歴**: `improvements/index.md`
- **README**: `README.md`
