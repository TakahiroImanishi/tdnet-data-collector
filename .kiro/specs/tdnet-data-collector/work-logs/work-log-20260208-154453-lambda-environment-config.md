# Work Log: Lambda環境別設定実装

**作成日時**: 2026-02-08 15:44:53  
**タスク**: 15.15.B - Lambda関数の環境別設定  
**担当**: Sub-agent (general-task-execution)

---

## タスク概要

### 目的
Lambda関数の環境別設定（dev/prod）を実装し、各環境に最適化されたリソース配分とログレベルを設定する。

### 背景
- 開発環境と本番環境で異なるリソース要件がある
- コスト最適化のため、環境ごとに適切なタイムアウトとメモリサイズを設定
- デバッグ効率化のため、環境ごとに適切なログレベルを設定

### 目標
1. 環境ごとのLambda設定インターフェースを定義
2. Collector/Query/Export Lambda の環境別設定を実装
3. CDK Constructsを更新して環境パラメータを適用
4. 環境変数（LOG_LEVEL, ENVIRONMENT）を設定

---

## 実施内容

### 1. プロジェクト構造の調査

既存のCDKスタック構造を調査し、Lambda関数が直接スタックファイル内で定義されていることを確認。環境別設定システムを導入するため、以下の方針を決定：

- 環境設定インターフェースを定義（`cdk/lib/config/environment-config.ts`）
- Lambda関数ごとにConstructを作成（再利用可能な設計）
- メインスタックから環境パラメータを渡す

### 2. 環境設定インターフェースの作成

**ファイル**: `cdk/lib/config/environment-config.ts`

以下のインターフェースと設定を定義：

- `Environment` 型: 'dev' | 'prod'
- `LambdaEnvironmentConfig`: timeout, memorySize, logLevel
- `EnvironmentConfig`: 全Lambda関数の設定を含む
- `devConfig`: 開発環境設定
- `prodConfig`: 本番環境設定
- `getEnvironmentConfig()`: 環境名から設定を取得

**設定内容:**

| Lambda関数 | dev timeout | prod timeout | dev memory | prod memory | dev log | prod log |
|-----------|-------------|--------------|------------|-------------|---------|----------|
| collector | 300秒 (5分) | 900秒 (15分) | 256MB | 512MB | DEBUG | INFO |
| query | 10秒 | 30秒 | 128MB | 256MB | DEBUG | INFO |
| export | 120秒 (2分) | 300秒 (5分) | 256MB | 512MB | DEBUG | INFO |
| collect | 30秒 | 30秒 | 256MB | 256MB | DEBUG | INFO |
| collectStatus | 30秒 | 30秒 | 256MB | 256MB | DEBUG | INFO |
| exportStatus | 30秒 | 30秒 | 256MB | 256MB | DEBUG | INFO |
| pdfDownload | 30秒 | 30秒 | 256MB | 256MB | DEBUG | INFO |

### 3. Lambda Constructsの作成

#### 3.1 Collector Lambda Construct

**ファイル**: `cdk/lib/constructs/lambda-collector.ts`

- `LambdaCollectorProps`: 環境、設定、DynamoDBテーブル、S3バケットを受け取る
- `LambdaCollector`: Lambda関数を作成し、IAM権限を付与
- 環境変数: `ENVIRONMENT`, `LOG_LEVEL` を追加

#### 3.2 Query Lambda Construct

**ファイル**: `cdk/lib/constructs/lambda-query.ts`

- `LambdaQueryProps`: 環境、設定、DynamoDBテーブル、S3バケット、APIキーシークレットを受け取る
- `LambdaQuery`: Lambda関数を作成し、IAM権限を付与
- 環境変数: `ENVIRONMENT`, `LOG_LEVEL` を追加

#### 3.3 Export Lambda Construct

**ファイル**: `cdk/lib/constructs/lambda-export.ts`

- `LambdaExportProps`: 環境、設定、DynamoDBテーブル、S3バケット、APIキーシークレットを受け取る
- `LambdaExport`: Lambda関数を作成し、IAM権限を付与
- 環境変数: `ENVIRONMENT`, `LOG_LEVEL` を追加

### 4. メインスタックの更新（進行中）
