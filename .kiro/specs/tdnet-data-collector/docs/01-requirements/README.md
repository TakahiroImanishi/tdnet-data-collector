# 01-requirements - 要件定義・設計ドキュメント

このフォルダには、TDnet Data Collectorの要件定義とアーキテクチャ設計に関するドキュメントが含まれています。

## フォルダの目的

- システムの要件定義と受入基準の明確化
- アーキテクチャ設計とコンポーネント構成の定義
- データベーススキーマとAPI仕様の詳細設計
- エラーリカバリー、レート制限、データ整合性の設計方針

## ファイル一覧

| ファイル | 説明 |
|---------|------|
| `requirements.md` | システム要件定義書（機能要件、非機能要件、受入基準） |
| `design.md` | アーキテクチャ設計書（システム構成、コンポーネント設計、技術選定） |
| `database-schema.md` | DynamoDBスキーマ設計（3テーブルの詳細定義） |
| `api-design.md` | REST API設計（エンドポイント、リクエスト/レスポンス仕様） |
| `openapi.yaml` | OpenAPI 3.0仕様書（API定義の機械可読形式） |
| `error-recovery-strategy.md` | エラーリカバリー戦略（再試行、DLQ、部分的失敗処理） |
| `rate-limiting-design.md` | レート制限設計（TDnetスクレイピング、API制限） |
| `data-integrity-design.md` | データ整合性設計（一意性保証、バリデーション、冪等性） |

## 推奨される読み順

### 初めての方
1. `requirements.md` - システムの目的と要件を理解
2. `design.md` - アーキテクチャ全体像を把握
3. `database-schema.md` - データモデルを確認
4. `api-design.md` - API仕様を確認

### 実装者向け
1. `design.md` - アーキテクチャ設計を確認
2. `database-schema.md` - DynamoDBスキーマを理解
3. `error-recovery-strategy.md` - エラーハンドリング方針を確認
4. `rate-limiting-design.md` - レート制限実装を確認
5. `data-integrity-design.md` - データ整合性保証を確認

## 関連ドキュメント

- [上位ドキュメント](../README.md) - docsフォルダ全体の構成
- [実装ガイド](../02-implementation/README.md) - 実装チェックリストとCDK構成
- [テストガイド](../03-testing/README.md) - テスト戦略と実装
