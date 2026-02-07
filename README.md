# TDnet Data Collector

TDnet Data Collectorは、日本取引所グループのTDnet（適時開示情報閲覧サービス）から上場企業の開示情報を自動収集するAWSベースのサーバーレスシステムです。

## 概要

- **実行環境**: AWS Lambda (Node.js 20.x, TypeScript)
- **データベース**: Amazon DynamoDB
- **ストレージ**: Amazon S3
- **API**: Amazon API Gateway
- **IaC**: AWS CDK (TypeScript)
- **監視**: CloudWatch Logs & Metrics

## プロジェクト構造

```
tdnet-data-collector/
├── src/              # アプリケーションコード
│   ├── lambda/       # Lambda関数
│   ├── utils/        # ユーティリティ
│   └── types/        # 型定義
├── cdk/              # CDKインフラコード
│   ├── bin/          # CDKアプリエントリーポイント
│   └── lib/          # CDKスタック定義
├── docs/             # ドキュメント
├── .kiro/            # Kiro設定とSpec
│   ├── specs/        # 仕様書とタスク
│   └── steering/     # 実装ガイドライン
└── tests/            # テストコード
```

## セットアップ

### 前提条件

- Node.js 20.x以上
- AWS CLI設定済み
- AWS CDK CLI (`npm install -g aws-cdk`)

### インストール

```bash
# 依存関係のインストール
npm install

# TypeScriptのビルド
npm run build

# CDK環境の初期化（初回のみ）
cdk bootstrap
```

## 開発

### ビルド

```bash
npm run build        # TypeScriptをコンパイル
npm run watch        # ファイル変更を監視してコンパイル
```

### テスト

```bash
npm test                # テスト実行
npm run test:watch      # テスト監視モード
npm run test:coverage   # カバレッジレポート生成
```

### コード品質

```bash
npm run lint         # ESLintでコードチェック
npm run lint:fix     # ESLintで自動修正
npm run format       # Prettierでフォーマット
npm run format:check # フォーマットチェック
```

### CDK操作

```bash
npm run cdk:diff     # 変更差分を確認
npm run cdk:synth    # CloudFormationテンプレート生成
npm run cdk:deploy   # AWSにデプロイ
npm run cdk:destroy  # スタック削除
```

## ドキュメント

- [要件定義書](.kiro/specs/tdnet-data-collector/docs/requirements.md)
- [設計書](.kiro/specs/tdnet-data-collector/docs/design.md)
- [タスクリスト](.kiro/specs/tdnet-data-collector/tasks.md)
- [OpenAPI仕様](docs/openapi.yaml)

## ライセンス

MIT
