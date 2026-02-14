# TDnet Data Collector - アーキテクチャ設計書

## システム概要

TDnet Data Collectorは、TDnet（適時開示情報伝達システム）から上場企業の開示情報を自動収集し、APIで提供するAWSサーバーレスシステムです。

## アーキテクチャ原則

1. **サーバーレス**: Lambda、DynamoDB、S3を中心とした完全サーバーレス構成
2. **コスト最適化**: AWS無料枠内での運用を目指す
3. **スケーラビリティ**: オンデマンドスケーリングによる柔軟な拡張性
4. **セキュリティ**: 最小権限の原則、暗号化、監査ログ
5. **可観測性**: CloudWatch Logs、Metrics、Alarms、Dashboardによる包括的な監視

## システム構成図

```mermaid
graph TB
    subgraph "外部システム"
        TDnet[TDnet<br/>適時開示情報伝達システム]
        User[ユーザー/アプリケーション]
    end

    subgraph "エッジ層"
        CloudFront[CloudFront<br/>CDN]
        WAF[WAF<br/>Web Application Firewall]
        APIGW[API Gateway<br/>REST API]
    end

    subgraph "アプリケーション層"
        subgraph "Lambda関数"
            L1[Collector<br/>データ収集]
            L2[Query<br/>クエリ処理]
            L3[Export<br/>エクスポート]
            L4[Collect<br/>収集トリガー]
            L5[Collect Status<br/>収集状態確認]
            L6[Export Status<br/>エクスポート状態確認]
            L7[PDF Download<br/>PDF URL生成]
        end
        
        DLQ[SQS DLQ<br/>Dead Letter Queue]
    end

    subgraph "データ層"
        subgraph "DynamoDB"
            DB1[tdnet_disclosures<br/>開示情報メタデータ]
            DB2[tdnet_executions<br/>実行状態管理]
            DB3[tdnet_export_status<br/>エクスポート状態]
        end
        
        subgraph "S3"
            S1[pdfs<br/>PDFファイル]
            S2[exports<br/>エクスポートファイル]
            S3[dashboard<br/>静的ファイル]
            S4[cloudtrail-logs<br/>監査ログ]
        end
    end

    subgraph "セキュリティ・管理層"
        Secrets[Secrets Manager<br/>APIキー管理]
        CloudTrail[CloudTrail<br/>監査ログ]
        
        subgraph "CloudWatch"
            CWLogs[Logs]
            CWMetrics[Metrics]
            CWAlarms[Alarms]
            CWDashboard[Dashboard]
        end
        
        SNS[SNS<br/>アラート通知]
    end

    %% 外部接続
    TDnet -->|スクレイピング| L1
    User -->|HTTPS| CloudFront
    User -->|HTTPS| WAF
    CloudFront --> S3
    WAF --> APIGW

    %% API Gateway → Lambda
    APIGW -->|GET /disclosures| L2
    APIGW -->|POST /exports| L3
    APIGW -->|POST /collect| L4
    APIGW -->|GET /collect/{id}| L5
    APIGW -->|GET /exports/{id}| L6
    APIGW -->|GET /disclosures/{id}/pdf| L7

    %% Lambda → DynamoDB
    L1 --> DB1
    L1 --> DB2
    L2 --> DB1
    L3 --> DB1
    L3 --> DB3
    L4 -->|invoke| L1
    L5 --> DB2
    L6 --> DB3
    L7 --> DB1

    %% Lambda → S3
    L1 --> S1
    L2 -->|署名付きURL| S1
    L3 --> S2
    L5 --> S1
    L7 -->|署名付きURL| S1

    %% Lambda → DLQ
    L1 -.->|失敗時| DLQ
    L2 -.->|失敗時| DLQ
    L3 -.->|失敗時| DLQ

    %% Lambda → Secrets Manager
    L2 --> Secrets
    L3 --> Secrets
    L4 --> Secrets
    L6 --> Secrets
    L7 --> Secrets

    %% 監視・ログ
    L1 --> CWLogs
    L2 --> CWLogs
    L3 --> CWLogs
    L4 --> CWLogs
    L5 --> CWLogs
    L6 --> CWLogs
    L7 --> CWLogs
    
    L1 --> CWMetrics
    L2 --> CWMetrics
    L3 --> CWMetrics
    L4 --> CWMetrics
    L5 --> CWMetrics
    L6 --> CWMetrics
    L7 --> CWMetrics
    
    CWMetrics --> CWAlarms
    CWAlarms --> SNS
    
    CloudTrail --> S4
    CloudTrail --> CWLogs

    style TDnet fill:#e1f5ff
    style User fill:#e1f5ff
    style CloudFront fill:#ff9900
    style WAF fill:#ff9900
    style APIGW fill:#ff9900
    style L1 fill:#ff9900
    style L2 fill:#ff9900
    style L3 fill:#ff9900
    style L4 fill:#ff9900
    style L5 fill:#ff9900
    style L6 fill:#ff9900
    style L7 fill:#ff9900
    style DB1 fill:#3b48cc
    style DB2 fill:#3b48cc
    style DB3 fill:#3b48cc
    style S1 fill:#569a31
    style S2 fill:#569a31
    style S3 fill:#569a31
    style S4 fill:#569a31
    style Secrets fill:#dd344c
    style CloudTrail fill:#759c3e
    style CWLogs fill:#ff9900
    style CWMetrics fill:#ff9900
    style CWAlarms fill:#ff9900
    style CWDashboard fill:#ff9900
    style SNS fill:#ff9900
    style DLQ fill:#ff9900
```

## コンポーネント詳細

### 1. エッジ層

#### CloudFront
- **用途**: Webダッシュボードの配信
- **機能**: 
  - S3バケット（dashboard）からの静的ファイル配信
  - グローバルエッジロケーションでのキャッシング
  - HTTPS通信の強制

#### WAF (Web Application Firewall)
- **用途**: API Gatewayの保護
- **ルール**:
  - レート制限: 2000リクエスト/5分
  - AWSマネージドルール: Common Rule Set
  - AWSマネージドルール: Known Bad Inputs

#### API Gateway
- **用途**: RESTful APIの提供
- **認証**: APIキー認証
- **エンドポイント**:
  - `GET /disclosures` - 開示情報クエリ
  - `GET /disclosures/{disclosure_id}/pdf` - PDF署名付きURL取得
  - `POST /exports` - エクスポートリクエスト
  - `GET /exports/{export_id}` - エクスポート状態確認
  - `POST /collect` - データ収集トリガー
  - `GET /collect/{execution_id}` - 収集状態確認

### 2. アプリケーション層

#### Lambda関数

| 関数名 | 用途 | メモリ | タイムアウト | 同時実行数 |
|--------|------|--------|--------------|------------|
| **collector** | TDnetからデータ収集 | 512MB | 900秒 | 1 |
| **query** | 開示情報クエリ処理 | 256MB | 30秒 | 無制限 |
| **export** | データエクスポート | 512MB | 300秒 | 無制限 |
| **collect** | 収集トリガー | 128MB | 30秒 | 無制限 |
| **collect-status** | 収集状態確認 | 128MB | 10秒 | 無制限 |
| **export-status** | エクスポート状態確認 | 128MB | 10秒 | 無制限 |
| **pdf-download** | PDF署名付きURL生成 | 128MB | 10秒 | 無制限 |

#### Dead Letter Queue (DLQ)
- **用途**: Lambda関数の失敗メッセージ保存
- **処理**: DLQプロセッサーLambdaで自動処理・通知

### 3. データ層

#### DynamoDBテーブル

##### tdnet_disclosures（開示情報メタデータ）
- **PK**: `disclosure_id` (STRING)
- **GSI1**: `company_code` + `disclosed_at`
- **GSI2**: `date_partition` + `disclosed_at`
- **属性**:
  - 企業コード、企業名
  - 開示日時、開示種別
  - タイトル、PDF URL
  - S3キー、ファイルサイズ
- **暗号化**: AWS管理キー
- **バックアップ**: ポイントインタイムリカバリ有効

##### tdnet_executions（実行状態管理）
- **PK**: `execution_id` (STRING)
- **GSI**: `status` + `started_at`
- **属性**:
  - 実行状態（running/completed/failed）
  - 開始・終了日時
  - 収集件数、エラー情報
- **TTL**: 30日後に自動削除

##### tdnet_export_status（エクスポート状態管理）
- **PK**: `export_id` (STRING)
- **GSI**: `status` + `requested_at`
- **属性**:
  - エクスポート状態（pending/processing/completed/failed）
  - リクエスト日時、完了日時
  - S3キー、ファイルサイズ
- **TTL**: 30日後に自動削除

#### S3バケット

##### pdfs（PDFファイル長期保存）
- **用途**: TDnetからダウンロードしたPDFファイル
- **暗号化**: S3マネージドキー
- **バージョニング**: 有効
- **ライフサイクル**:
  - 90日後: Standard-IAに移行
  - 365日後: Glacierに移行

##### exports（エクスポートファイル一時保存）
- **用途**: ユーザーがエクスポートしたCSV/JSONファイル
- **暗号化**: S3マネージドキー
- **ライフサイクル**: 7日後に自動削除

##### dashboard（Webダッシュボード）
- **用途**: 静的ファイルホスティング
- **暗号化**: S3マネージドキー
- **アクセス**: CloudFront OAI経由のみ

##### cloudtrail-logs（監査ログ）
- **用途**: CloudTrail監査ログの長期保存
- **暗号化**: S3マネージドキー
- **ライフサイクル**:
  - 90日後: Glacierに移行
  - 7年後: 自動削除（コンプライアンス要件）

### 4. セキュリティ・管理層

#### Secrets Manager
- **用途**: APIキーの安全な管理
- **機能**:
  - 自動ローテーション（90日ごと）
  - Lambda関数からの読み取り権限管理

#### CloudTrail
- **用途**: AWS APIコールの監査ログ
- **対象**:
  - DynamoDBテーブル（全操作）
  - S3バケット（pdfs）のデータイベント
- **保存先**: S3バケット（cloudtrail-logs）+ CloudWatch Logs

#### CloudWatch

##### Logs
- **用途**: Lambda関数のログ保存
- **保持期間**: 30日

##### Metrics
- **カスタムメトリクス**:
  - TDnet/Collector: 収集成功率、収集件数
  - TDnet/Query: クエリレイテンシ、エラー率
  - TDnet/Export: エクスポート成功率

##### Alarms
- **監視項目**:
  - Lambda関数エラー率（閾値: 10%）
  - Lambda関数実行時間（閾値: 14分）
  - DLQメッセージ数（閾値: 1件以上）
  - 収集成功率（閾値: 95%未満）

##### Dashboard
- **表示内容**:
  - Lambda関数メトリクス（呼び出し数、エラー率、実行時間）
  - DynamoDBメトリクス（読み書き容量、スロットリング）
  - S3メトリクス（リクエスト数、バケットサイズ）
  - API Gatewayメトリクス（リクエスト数、レイテンシ）

#### SNS
- **用途**: CloudWatch Alarmsからのアラート通知
- **通知先**: メール、Slack（オプション）

## データフロー

詳細なデータフローについては、[docs/data-flow.md](../../../docs/data-flow.md)を参照してください。

## セキュリティ設計

### 認証・認可
- **API認証**: APIキー認証（Secrets Manager管理）
- **IAM権限**: 最小権限の原則
- **Lambda実行ロール**: 必要最小限のポリシー

### 暗号化
- **転送中**: HTTPS/TLS 1.2以上
- **保管中**:
  - DynamoDB: AWS管理キー
  - S3: S3マネージドキー
  - Secrets Manager: AWS管理キー

### ネットワークセキュリティ
- **S3バケット**: パブリックアクセスブロック有効
- **API Gateway**: WAFによる保護
- **CloudFront**: HTTPS通信強制

### 監査
- **CloudTrail**: 全APIコールの記録
- **CloudWatch Logs**: Lambda関数ログの保存
- **ログ保持**: 7年間（コンプライアンス要件）

## コスト最適化

### AWS無料枠の活用
- **Lambda**: 100万リクエスト/月、40万GB秒/月
- **DynamoDB**: 25GB、25読み書き容量ユニット/秒
- **S3**: 5GB、20,000 GETリクエスト、2,000 PUTリクエスト
- **CloudWatch**: 10カスタムメトリクス、10アラーム

### コスト削減策
- **Lambda**: メモリ最適化、タイムアウト最小化
- **DynamoDB**: オンデマンド課金、GSI最小限
- **S3**: ライフサイクルポリシーによる自動アーカイブ
- **CloudWatch Logs**: 保持期間30日

### 推定月額コスト
詳細なコスト見積もりについては、[docs/cost-estimation.md](../../../docs/cost-estimation.md)を参照してください。

## スケーラビリティ

### 自動スケーリング
- **Lambda**: 自動スケーリング（同時実行数制限あり）
- **DynamoDB**: オンデマンドモードで自動スケーリング
- **API Gateway**: 自動スケーリング（レート制限あり）

### パフォーマンス最適化
- **Lambda**: メモリ最適化、コールドスタート対策
- **DynamoDB**: GSIによる効率的なクエリ
- **S3**: CloudFrontによるキャッシング

## 可用性・信頼性

### 高可用性
- **マルチAZ**: DynamoDB、S3、Lambda（自動）
- **リージョン**: 単一リージョン（ap-northeast-1）

### 障害対策
- **Lambda**: DLQによる失敗メッセージ保存
- **DynamoDB**: ポイントインタイムリカバリ
- **S3**: バージョニング有効

### 監視・アラート
- **CloudWatch Alarms**: エラー率、実行時間、DLQメッセージ数
- **SNS**: アラート通知

## 運用・保守

### デプロイ
- **CI/CD**: GitHub Actions
- **IaC**: AWS CDK (TypeScript)
- **環境**: dev、prod

### モニタリング
- **CloudWatch Dashboard**: リアルタイム監視
- **CloudWatch Logs Insights**: ログ分析
- **X-Ray**: 分散トレーシング（オプション）

### バックアップ・リカバリ
- **DynamoDB**: ポイントインタイムリカバリ（35日間）
- **S3**: バージョニング、ライフサイクルポリシー
- **CloudTrail**: 7年間保存

## 今後の拡張性

### 機能拡張
- [ ] リアルタイム通知（EventBridge + SNS）
- [ ] データ分析（Athena + QuickSight）
- [ ] 機械学習（SageMaker）

### スケール拡張
- [ ] マルチリージョン対応
- [ ] DynamoDB Global Tables
- [ ] S3クロスリージョンレプリケーション

### セキュリティ強化
- [ ] Cognito認証
- [ ] VPC Lambda
- [ ] KMS カスタマー管理キー

## 参考資料

- [README.md](../../../README.md) - プロジェクト概要
- [docs/data-flow.md](../../../docs/data-flow.md) - データフロー詳細
- [docs/cost-estimation.md](../../../docs/cost-estimation.md) - コスト見積もり
- [docs/ci-cd-pipeline.md](../../../docs/ci-cd-pipeline.md) - CI/CDパイプライン
- [.kiro/steering/README.md](../../../.kiro/steering/README.md) - 実装ガイドライン
