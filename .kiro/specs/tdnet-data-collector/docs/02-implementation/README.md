# 02-implementation - 実装ガイド

このフォルダには、TDnet Data Collectorの実装開始前の準備と、CDKインフラストラクチャの詳細ガイドが含まれています。

## フォルダの目的

- 実装開始前の準備事項とチェックリストの提供
- CDKインフラストラクチャの構成と実装詳細の説明
- 設計の正しさを検証するためのプロパティチェックリスト

## ファイル一覧

| ファイル | 説明 |
|---------|------|
| `implementation-checklist.md` | 実装開始前チェックリスト（要件確認、環境準備、開発フロー） |
| `cdk-infrastructure.md` | CDKインフラストラクチャ完全ガイド（4層スタック構成、Constructs、デプロイフロー） |
| `correctness-properties-checklist.md` | 設計検証チェックリスト（要件との対応、正確性プロパティ） |

## 推奨される読み順

### 実装開始前
1. `implementation-checklist.md` - 実装前の準備事項を確認
2. `correctness-properties-checklist.md` - 設計の正しさを検証
3. `cdk-infrastructure.md` - CDK構成を理解

### CDK実装時
1. `cdk-infrastructure.md` - スタック構成とConstructsを参照
2. `implementation-checklist.md` - 実装進捗を確認

## 関連ドキュメント

- [上位ドキュメント](../README.md) - docsフォルダ全体の構成
- [要件・設計](../01-requirements/README.md) - システム要件とアーキテクチャ設計
- [デプロイガイド](../04-deployment/README.md) - デプロイ手順と環境設定
- [実装ルール](../../../steering/core/tdnet-implementation-rules.md) - コーディング規約と実装原則
