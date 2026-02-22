# CDK Constructs - 実装ガイド

このディレクトリには、TDnet Data Collectorプロジェクトで使用するカスタムCDK Constructsが含まれています。

## 概要

AWS CDK Constructsは、インフラストラクチャコンポーネントを再利用可能な形で定義するための抽象化レイヤーです。このプロジェクトでは、Lambda関数、DynamoDB、S3、API Gatewayなどのリソースを組み合わせたカスタムConstructsを実装しています。

## 実装ガイドライン

### 必須参照ドキュメント

1. **エラーハンドリング強制ルール**  
   [`../../../.kiro/steering/development/error-handling-enforcement.md`](../../../.kiro/steering/development/error-handling-enforcement.md)
   - Lambda関数のエラーハンドリング実装要件
   - DLQ設定、CloudWatch Alarms、構造化ログの必須実装
   - エラーメトリクスとアラート設定

2. **CDK実装ガイドライン**  
   [`../../../.kiro/steering/infrastructure/cdk-implementation.md`](../../../.kiro/steering/infrastructure/cdk-implementation.md)
   - CDKスタック設計原則
   - Construct実装パターン
   - リソース命名規則とタグ付け戦略

3. **セキュリティベストプラクティス**  
   [`../../../.kiro/steering/security/security-best-practices.md`](../../../.kiro/steering/security/security-best-practices.md)
   - IAMロール最小権限原則
   - 暗号化設定（DynamoDB、S3、Lambda環境変数）
   - VPC設定とネットワークセキュリティ

## Construct実装の基本原則

### 1. 再利用性
- 汎用的なパラメータ設定を可能にする
- 環境依存の設定は外部から注入する
- 複数のスタックで再利用可能な設計

### 2. テスタビリティ
- Constructの単体テストを作成
- スナップショットテストでリソース構成を検証
- 環境変数やIAMポリシーの検証

### 3. 保守性
- 明確な命名規則（ケバブケース）
- 適切なコメントとドキュメント
- 依存関係の明示化

## 主要Constructs

### Lambda Function Constructs
- エラーハンドリング設定（DLQ、Alarms）
- 環境変数管理
- IAMロール設定
- メモリ・タイムアウト最適化

### DynamoDB Table Constructs
- GSI設計
- 暗号化設定
- バックアップ設定
- オンデマンド課金設定

### API Gateway Constructs
- WAF統合
- APIキー管理
- レート制限設定
- CORS設定

## 開発ワークフロー

1. **設計**: 要件定義とリソース構成の検討
2. **実装**: Construct作成とパラメータ設定
3. **テスト**: 単体テスト・スナップショットテスト実行
4. **レビュー**: セキュリティ・コスト・パフォーマンスの確認
5. **デプロイ**: CDK deployでリソース作成

## 関連ドキュメント

- [CDK実装ガイドライン](../../../.kiro/steering/infrastructure/cdk-implementation.md)
- [エラーハンドリング強制ルール](../../../.kiro/steering/development/error-handling-enforcement.md)
- [セキュリティベストプラクティス](../../../.kiro/steering/security/security-best-practices.md)
- [デプロイチェックリスト](../../../.kiro/steering/infrastructure/deployment-checklist.md)
- [パフォーマンス最適化](../../../.kiro/steering/infrastructure/performance-optimization.md)
