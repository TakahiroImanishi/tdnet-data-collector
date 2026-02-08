# Work Log: CDK環境パラメータ化

**作成日時**: 2026-02-08 15:44:53  
**タスク**: 15.15-A CDKスタックの環境パラメータ化  
**担当**: Sub-agent (general-task-execution)

---

## タスク概要

### 目的
CDKスタックを環境（dev/prod）ごとにパラメータ化し、環境別のリソース名を生成できるようにする。

### 背景
- 現在のCDKスタックは単一環境のみをサポート
- 開発環境と本番環境を分離する必要がある
- リソース名の衝突を防ぐため、環境別の命名規則が必要

### 目標
1. EnvironmentConfig インターフェースの定義
2. 環境ごとのスタック名・リソース名生成
3. DynamoDBテーブル名の環境別命名
4. S3バケット名の環境別命名
5. テストファイルの更新

---

## 実施内容

### 1. 現状調査

CDKスタックの構造を確認し、以下を特定：
- 現在のリソース命名規則
- 環境パラメータの不在
- テストファイルの構造

### 2. 環境パラメータ化の実装

#### 2.1 インターフェース定義

`cdk/lib/tdnet-data-collector-stack.ts` に以下を追加：
- `EnvironmentConfig` インターフェース（environment: 'dev' | 'prod'）
- `TdnetDataCollectorStackProps` インターフェース（environmentConfig追加）
- 環境別リソース名生成ヘルパー関数

#### 2.2 DynamoDBテーブル名の更新

以下のテーブル名を環境別に変更：
- `tdnet_disclosures` → `tdnet_disclosures_{environment}`
- `tdnet_executions` → `tdnet_executions_{environment}`
- `tdnet_export_status` → `tdnet_export_status_{environment}`

#### 2.3 S3バケット名の更新

以下のバケット名を環境別に変更：
- `tdnet-data-collector-pdfs-{account}` → `tdnet-data-collector-pdfs-{environment}-{account}`
- `tdnet-data-collector-exports-{account}` → `tdnet-data-collector-exports-{environment}-{account}`
- `tdnet-dashboard-{account}` → `tdnet-dashboard-{environment}-{account}`
- `tdnet-cloudtrail-logs-{account}` → `tdnet-cloudtrail-logs-{environment}-{account}`

#### 2.4 Lambda関数名の更新

以下の関数名を環境別に変更：
- `tdnet-collector` → `tdnet-collector-{environment}`
- `tdnet-query` → `tdnet-query-{environment}`
- `tdnet-export` → `tdnet-export-{environment}`
- `tdnet-collect` → `tdnet-collect-{environment}`
- `tdnet-collect-status` → `tdnet-collect-status-{environment}`

#### 2.5 API Gateway・WAFリソース名の更新

以下のリソース名を環境別に変更：
- `tdnet-data-collector-api` → `tdnet-data-collector-api-{environment}`
- `tdnet-api-key` → `tdnet-api-key-{environment}`
- `tdnet-usage-plan` → `tdnet-usage-plan-{environment}`
- `tdnet-web-acl` → `tdnet-web-acl-{environment}`

#### 2.6 CDK Binファイルの更新

`cdk/bin/tdnet-data-collector.ts` を更新：
- 環境変数またはコンテキストから環境を取得
- デフォルト値: 'dev'
- 環境検証（'dev' または 'prod' のみ許可）
- スタック名に環境サフィックスを追加

### 3. テストファイルの作成

`cdk/__tests__/environment-parameterization.test.ts` を作成：
- 開発環境のテスト（全リソース名に `-dev` サフィックス）
- 本番環境のテスト（全リソース名に `-prod` サフィックス）
- デフォルト環境のテスト（環境未指定時は `dev` にフォールバック）
- リソース分離のテスト（dev/prod間で名前が異なることを確認）
- 環境変数伝播のテスト（Lambda関数の環境変数が正しく設定されることを確認）

### 4. 問題と解決策

#### 問題: テスト実行時のエラー

テスト実行時に以下のエラーが発生：
```
CloudAssemblyError: Unable to parse environment specification "dev". 
Expected format: aws://account/region
```

**原因分析:**
CDKが `env` プロパティの値を AWS環境仕様（aws://account/region形式）として解釈しようとしている。これは、スタックのタグまたは環境設定が誤って解釈されている可能性がある。

**解決策（実施中）:**
テストコードとスタック定義を見直し、環境パラメータの渡し方を修正する必要がある。

