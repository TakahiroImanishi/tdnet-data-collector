---
inclusion: fileMatch
fileMatchPattern: '**/lambda/**/*.ts|**/cdk/lib/**/*-stack.ts|**/cdk/lib/constructs/**/*.ts'
---

# Error Handling Enforcement - 強制化ガイドライン

このファイルは、TDnet Data Collectorプロジェクトにおけるエラーハンドリングの**強制化方針**をまとめたものです。

## 目的

エラーハンドリングのベストプラクティスを**推奨**から**必須**に引き上げ、実装漏れを防ぐための仕組みを提供します。

## 役割分担

| ファイル | 役割 | 内容 |
|---------|------|------|
| **core/error-handling-patterns.md** | 基本原則 | エラー分類、再試行戦略の概要 |
| **development/error-handling-implementation.md** | 詳細実装 | 具体的なコード例、AWS SDK設定 |
| **development/error-handling-enforcement.md** (このファイル) | 強制化 | DLQ必須化、Alarms自動設定、テスト検証 |
| **infrastructure/monitoring-alerts.md** | 監視設定 | CloudWatch設定の詳細 |

## 目次

1. [Lambda DLQ必須化方針](#lambda-dlq必須化方針)
2. [CloudWatch Alarms自動設定](#cloudwatch-alarms自動設定)
3. [エラーハンドリングチェックリストの強制](#エラーハンドリングチェックリストの強制)
4. [テストでの検証](#テストでの検証)
5. [CDK実装例](#cdk実装例)

---

## Lambda DLQ必須化方針

### 必須化ルール

**すべての非同期Lambda関数にDead Letter Queue (DLQ)を設定すること。**

