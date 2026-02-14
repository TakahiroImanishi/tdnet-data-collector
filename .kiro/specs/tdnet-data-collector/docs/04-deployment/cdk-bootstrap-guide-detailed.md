# CDK Bootstrap Guide

このガイドは、AWS CDKのBootstrap処理と、TDnet Data Collectorプロジェクトのデプロイ準備について説明します。

---

## 目次

1. [CDK Bootstrapとは](#cdk-bootstrapとは)
2. [自動化スクリプトの使用（推奨）](#自動化スクリプトの使用推奨)
3. [手動セットアップ](#手動セットアップ)
4. [トラブルシューティング](#トラブルシューティング)
5. [よくある質問](#よくある質問)

---

## CDK Bootstrapとは

AWS CDK Bootstrapは、CDKアプリケーションをデプロイするために必要なAWSリソースを初期化するプロセスです。

### Bootstrap時に作成されるリソース

- **S3バケット**: CDKアセット（Lambda関数コード、Dockerイメージなど）の保存先
- **ECRリポジトリ**: Dockerイメージの保存先（該当する場合）
- **IAMロール**: CDKデプロイ時に使用するロール
- **CloudFormationスタック**: `CDKToolkit`という名前のスタック

### Bootstrap実行タイミング

以下の場合にBootstrapが必要です：

- ✅ 初めてCDKを使用するAWSアカウント・リージョン
- ✅ 新しいリージョンにデプロイする場合
- ✅ CDKバージョンをアップグレードした場合（推奨）

以下の場合はBootstrapは不要です：

- ❌ 既にBootstrap済みのアカウント・リージョン
- ❌ 同じアカウント・リージョンに複数のCDKアプリをデプロイする場合

---

## 自動化スクリプトの使用（推奨）

TDnet Data Collectorプロジェクトでは、デプロイ準備を自動化するスクリプトを提供しています。

### 🚀 クイックスタート（すべて自動）

```powershell
# すべてのステップを自動実行
.\scripts\deploy.ps1 -Environment dev
```

このコマンドは以下を自動実行します：
1. 前提条件チェック（Node.js, npm, AWS CLI, CDK）
2. 依存関係のインストール
3. テスト実行
4. プロジェクトビルド
5. API Key Secret作成（Secrets Manager）
6. 環境変数ファイル生成（.env.development）
7. CDK Bootstrap
8. CDK Deploy

### 📋 ステップバイステップ（推奨）

より細かく制御したい場合は、以下の順序で実行します：

###