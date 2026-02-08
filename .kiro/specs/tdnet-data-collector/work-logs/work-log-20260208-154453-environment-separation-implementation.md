# Work Log: 環境分離の実装（タスク15.15）

**作成日時:** 2026-02-08 15:44:53  
**タスク番号:** 15.15  
**優先度:** 🟠 High  
**推定工数:** 3時間

## タスク概要

### 目的
開発環境（dev）と本番環境（prod）を分離し、環境ごとに異なる設定（タイムアウト、メモリ、ログレベル）を適用できるようにする。

### 背景
- 現在のCDKスタックは単一環境のみをサポート
- 開発環境と本番環境で異なる設定が必要（例: 開発環境は短いタイムアウト、本番環境は長いタイムアウト）
- 環境ごとのリソース名の衝突を防ぐ必要がある

### 目標
1. CDKスタックを環境パラメータ化
2. 環境ごとの設定ファイル作成（.env.development、.env.production）
3. Lambda関数の環境別設定（タイムアウト、メモリ、ログレベル）
4. DynamoDB/S3バケット名の環境別命名
5. 環境別デプロイスクリプトの作成

## 実施計画

### サブタスク分割（並列実行可能）

#### サブタスクA: CDKスタックの環境パラメータ化
- **担当:** general-task-execution サブエージェント
- **推定工数:** 1時間
- **内容:**
  - `cdk/lib/tdnet-data-collector-stack.ts` に環境パラメータを追加
  - 環境ごとのスタック名生成（例: TdnetDataCollectorStack-dev、TdnetDataCollectorStack-prod）
  - 環境ごとのリソース名生成（例: tdnet-disclosures-dev、tdnet-disclosures-prod）
  - 環境設定インターフェース定義（EnvironmentConfig）

#### サブタスクB: Lambda関数の環境別設定
- **担当:** general-task-execution サブエージェント
- **推定工数:** 1時間
- **内容:**
  - 環境ごとのLambda設定定義（タイムアウト、メモリ、ログレベル）
  - Collector Lambda: dev（タイムアウト5分、メモリ256MB）、prod（タイムアウト15分、メモリ512MB）
  - Query Lambda: dev（タイムアウト10秒、メモリ128MB）、prod（タイムアウト30秒、メモリ256MB）
  - Export Lambda: dev（タイムアウト2分、メモリ256MB）、prod（タイムアウト5分、メモリ512MB）
  - 環境変数LOG_LEVELの設定（dev: DEBUG、prod: INFO）

#### サブタスクC: 環境設定ファイルとデプロイスクリプト
- **担当:** general-task-execution サブエージェント
- **推定工数:** 1時間
- **内容:**
  - `.env.development` と `.env.production` の作成
  - 環境別デプロイスクリプト作成（scripts/deploy-dev.ps1、scripts/deploy-prod.ps1）
  - CDK context設定（cdk.json）
  - ドキュメント更新（docs/deployment-guide.md）

### 並列実行の理由
- サブタスクA、B、Cは互いに独立しており、並列実行可能
- サブタスクAはCDKスタックの構造変更
- サブタスクBはLambda関数の設定変更
- サブタスクCは環境設定ファイルとスクリプト作成
- 最後に統合テストで動作確認

## 実施内容

### サブエージェント実行

#### サブエージェントA: CDKスタックの環境パラメータ化
- **開始時刻:** 2026-02-08 15:44:53
- **作業記録:** work-log-20260208-154453-cdk-environment-parameterization.md
- **状態:** 実行中

#### サブエージェントB: Lambda関数の環境別設定
- **開始時刻:** 2026-02-08 15:44:53
- **作業記録:** work-log-20260208-154453-lambda-environment-config.md
- **状態:** 実行中

#### サブエージェントC: 環境設定ファイルとデプロイスクリプト
- **開始時刻:** 2026-02-08 15:44:53
- **作業記録:** work-log-20260208-154453-environment-config-scripts.md
- **状態:** 実行中

## 成果物

（サブエージェント実行後に記入）

## 次回への申し送り

（サブエージェント実行後に記入）
