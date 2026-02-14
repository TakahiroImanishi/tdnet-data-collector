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

### 4. メインスタックの更新（完了）

**ファイル**: `cdk/lib/tdnet-data-collector-stack.ts`

以下の変更を実施：

1. **環境設定のインポート**
   - `Environment` 型と `getEnvironmentConfig` 関数をインポート

2. **環境プロパティの追加**
   - `deploymentEnvironment` プロパティを追加（base classの `environment` との衝突を回避）
   - コンストラクタで環境設定を取得: `getEnvironmentConfig(this.deploymentEnvironment)`

3. **全Lambda関数の更新**
   - Collector Lambda: timeout, memorySize, LOG_LEVEL, ENVIRONMENT を環境別設定に変更
   - Query Lambda: timeout, memorySize, LOG_LEVEL, ENVIRONMENT を環境別設定に変更
   - Export Lambda: timeout, memorySize, LOG_LEVEL, ENVIRONMENT を環境別設定に変更
   - Collect Lambda: timeout, memorySize, LOG_LEVEL, ENVIRONMENT を環境別設定に変更
   - Collect Status Lambda: timeout, memorySize, LOG_LEVEL, ENVIRONMENT を環境別設定に変更
   - Export Status Lambda: timeout, memorySize, LOG_LEVEL, ENVIRONMENT を環境別設定に変更
   - PDF Download Lambda: timeout, memorySize, LOG_LEVEL, ENVIRONMENT を環境別設定に変更

4. **環境変数の追加**
   - すべてのLambda関数に `ENVIRONMENT` 環境変数を追加
   - すべてのLambda関数に `LOG_LEVEL` 環境変数を環境別に設定

### 5. CDK Binファイルの更新（既存）

**ファイル**: `cdk/bin/tdnet-data-collector.ts`

既に以下の変更が適用済み：
- 環境変数またはCDKコンテキストから環境を取得
- 環境のバリデーション（dev/prod のみ許可）
- スタック名に環境サフィックスを追加
- `environmentConfig` プロパティをスタックに渡す

---

## 成果物

### 作成したファイル

1. **`cdk/lib/config/environment-config.ts`**
   - 環境設定インターフェース定義
   - dev/prod 環境設定
   - 全Lambda関数の設定を含む

2. **`cdk/lib/constructs/lambda-collector.ts`**
   - Collector Lambda Construct
   - 環境パラメータを受け取り、設定を適用

3. **`cdk/lib/constructs/lambda-query.ts`**
   - Query Lambda Construct
   - 環境パラメータを受け取り、設定を適用

4. **`cdk/lib/constructs/lambda-export.ts`**
   - Export Lambda Construct
   - 環境パラメータを受け取り、設定を適用

### 変更したファイル

1. **`cdk/lib/tdnet-data-collector-stack.ts`**
   - 環境設定のインポート
   - 全Lambda関数の環境別設定適用
   - 環境変数の追加

2. **`cdk/bin/tdnet-data-collector.ts`** (既存変更)
   - 環境パラメータの取得とバリデーション
   - スタック名の環境別命名

---

## 検証結果

### TypeScript型チェック

環境設定の型定義が正しく適用され、以下が保証されています：

- `Environment` 型: 'dev' | 'prod' のみ許可
- `LambdaEnvironmentConfig`: timeout, memorySize, logLevel の型安全性
- `EnvironmentConfig`: 全Lambda関数の設定を含む

### 設定値の確認

| Lambda関数 | dev timeout | prod timeout | dev memory | prod memory | dev log | prod log |
|-----------|-------------|--------------|------------|-------------|---------|----------|
| collector | 300秒 (5分) | 900秒 (15分) | 256MB | 512MB | DEBUG | INFO |
| query | 10秒 | 30秒 | 128MB | 256MB | DEBUG | INFO |
| export | 120秒 (2分) | 300秒 (5分) | 256MB | 512MB | DEBUG | INFO |
| collect | 30秒 | 30秒 | 256MB | 256MB | DEBUG | INFO |
| collectStatus | 30秒 | 30秒 | 256MB | 256MB | DEBUG | INFO |
| exportStatus | 30秒 | 30秒 | 256MB | 256MB | DEBUG | INFO |
| pdfDownload | 30秒 | 30秒 | 256MB | 256MB | DEBUG | INFO |

---

## 次回への申し送り

### 完了事項

✅ 環境設定インターフェースの作成  
✅ Lambda Constructsの作成（Collector, Query, Export）  
✅ メインスタックの更新（全Lambda関数）  
✅ 環境変数の設定（LOG_LEVEL, ENVIRONMENT）  
✅ CDK Binファイルの更新（既存）

### 今後の作業

1. **デプロイメントスクリプトの作成**
   - 環境別デプロイコマンドの追加
   - `cdk deploy --context environment=dev`
   - `cdk deploy --context environment=prod`

2. **ドキュメントの更新**
   - デプロイメントガイドに環境別デプロイ手順を追加
   - 環境設定の変更方法を記載

3. **テストの実施**
   - dev環境でのデプロイテスト
   - 環境変数の確認
   - Lambda関数の動作確認

### 注意事項

- **環境プロパティ名**: `deploymentEnvironment` を使用（base classの `environment` との衝突を回避）
- **Lambda Constructs**: 作成したが、現在のスタックでは直接Lambda関数を定義する方式を継続（将来的にConstructsに移行可能）
- **環境変数**: すべてのLambda関数に `ENVIRONMENT` と `LOG_LEVEL` を追加済み
