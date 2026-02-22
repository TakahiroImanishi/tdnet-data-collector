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
- **状態:** ⚠️ 未完成（環境パラメータ取得ロジックの問題を修正、残りのリソース名も環境別命名が必要）

#### サブエージェントB: Lambda関数の環境別設定
- **開始時刻:** 2026-02-08 15:44:53
- **作業記録:** work-log-20260208-154453-lambda-environment-config.md
- **状態:** ✅ 完了

#### サブエージェントC: 環境設定ファイルとデプロイスクリプト
- **開始時刻:** 2026-02-08 15:44:53
- **作業記録:** work-log-20260208-154453-environment-config-scripts.md
- **状態:** ✅ 完了

### メインエージェントの作業

#### 1. サブタスクAの問題修正
- **問題:** `this.environment` が AWS環境仕様文字列（`aws://account/region`）を返していた
- **修正:** `getResourceName` と `getBucketName` 関数で `this.deploymentEnvironment` を使用するように変更
- **結果:** DynamoDBテーブル名は正しく環境サフィックスを持つようになった

#### 2. 残存する問題の特定
- S3バケット名、Lambda関数名、API Gateway名、WAF名が環境サフィックスを持っていない
- これらのリソースも環境別に命名する必要がある
- テスト結果: 3/18テスト成功（DynamoDBテーブル名のみ）

## 成果物

### 修正したファイル
1. **`cdk/lib/tdnet-data-collector-stack.ts`** - 環境パラメータ取得ロジックを修正

### サブエージェントの成果物
- **サブエージェントB:** 環境設定システム、Lambda Constructs、全Lambda関数の環境別設定
- **サブエージェントC:** 環境設定ファイル、デプロイスクリプト、ドキュメント

## 次回への申し送り

### 未完了の作業
1. **S3バケット名の環境別命名** - `getBucketName` 関数を使用してすべてのS3バケットに環境サフィックスを追加
2. **Lambda関数名の環境別命名** - すべてのLambda関数名に環境サフィックスを追加
3. **API Gateway名の環境別命名** - API Gateway、APIキー、使用量プランに環境サフィックスを追加
4. **WAF名の環境別命名** - Web ACLに環境サフィックスを追加
5. **テストの再実行** - すべてのリソース名が環境別になった後、テストを再実行

### 注意点
- `this.deploymentEnvironment` を使用して環境値を取得（`this.environment` は使用しない）
- すべてのリソース名に環境サフィックスを追加する必要がある
- テスト成功率: 16.7%（3/18）→ 目標: 100%
