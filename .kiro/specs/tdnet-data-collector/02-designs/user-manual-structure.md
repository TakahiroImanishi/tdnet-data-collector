# ユーザマニュアル構成設計

**作成日**: 2026-02-22
**最終更新**: 2026-02-22
**ステータス**: 設計完了（ユーザ観点と設計仕様を分離）

## 目的

TDnet Data Collectorの機能と使い方を説明する包括的なユーザマニュアルを作成する。

## 対象ユーザ

- **一般ユーザ**: 投資家、アナリスト、データサイエンティスト
- **管理者**: システム管理者、開発者、運用担当者

## 記載方針

### ユーザ向けガイド（USER_MANUAL.md）
- **焦点**: ユーザが「何ができるか」「どう使うか」
- **内容**: 機能説明、操作手順、エラー対処法
- **表現**: 平易な日本語、技術用語は最小限
- **例**: 「検索ボタンをクリックすると、条件に一致する開示情報が表示されます」

### 設計上の仕様（本ドキュメント）
- **焦点**: システムの「内部仕様」「技術詳細」
- **内容**: アーキテクチャ、データモデル、API仕様、制限値
- **表現**: 技術用語、具体的な数値、実装詳細
- **例**: 「Step Functions Map状態で最大5並列処理、タイムアウト60秒/ページ」


## マニュアル構成（ユーザ向けガイド）

### 1. システム概要

**ユーザ向け記載内容**:
- TDnet Data Collectorとは
  - 日本取引所グループのTDnetから上場企業の開示情報を自動収集するシステム
  - 投資判断や企業分析に必要なデータを簡単に入手できる
- 何ができるか
  - 開示情報の自動収集（決算短信、有価証券報告書など）
  - 企業名や日付で検索
  - PDFファイルのダウンロード
  - データのエクスポート（CSV/JSON）
- 利用環境
  - Webブラウザ（Chrome、Firefox、Safari最新版）
  - インターネット接続必須
  - APIキーが必要（管理者から取得）

**設計上の仕様（本ドキュメントのみ記載）**:
- アーキテクチャ: AWSサーバーレス（Lambda、DynamoDB、S3、API Gateway、Step Functions）
- 技術スタック: Node.js 20.x、TypeScript 5.x、React、AWS CDK
- 4スタック構成: Foundation、Compute、API、Monitoring
- AWS無料枠内運用: Lambda 100万リクエスト/月、DynamoDB 25GB、S3 5GB
- 実装状況: Phase 1-4完了、Phase 5進行中（自動収集・SNS通知は未実装）

### 2. 主要機能の説明

#### 2.1 データ収集機能

**ユーザ向け記載内容**:
- オンデマンド収集
  - 指定した期間の開示情報を手動で収集
  - 日付範囲を指定（例: 2024年1月1日～1月31日）
  - 収集開始後、進捗状況を確認可能
- 収集できるデータ
  - 企業コード、企業名
  - 開示種別（決算短信、有価証券報告書など）
  - 開示日時、タイトル
  - PDFファイル
- 制限事項
  - 過去1年以内のデータのみ取得可能
  - 未来の日付は指定不可
  - 収集には数秒～数分かかる場合がある

**設計上の仕様（本ドキュメントのみ記載）**:
- Step Functions並列処理
  - 4つのLambda関数: init（初期化）、fetch（取得）、save（保存）、aggregate（集約）
  - Map状態で最大5並列処理
  - TDnet APIレート制限: 1リクエスト/秒遵守
- 実行状態管理
  - execution_stateテーブル（DynamoDB）
  - 実行ID形式: `exec_{timestamp}_{random}_{sequence}`
  - ステータス: pending/running/completed/failed/partial_success
  - TTL 30日で自動削除
- エラーハンドリング
  - Retryableエラー: 指数バックオフ再試行（最大3回、2秒→4秒→8秒）
  - Non-Retryableエラー: 即座に失敗（401/403/404/400）
  - Partial Failure: 成功分コミット、失敗分DLQ送信
- タイムアウト設定
  - 初期化: 30秒、取得: 60秒/ページ、保存: 120秒/ページ、集約: 30秒
  - ワークフロー全体: 3600秒（1時間）
- パフォーマンス
  - 通常収集（500件）: 15秒以内
  - 大規模収集（2,700件）: 45秒以内
  - Lambda実行時間: 従来比89.9%削減
- データ整合性
  - disclosure_id: 一意性保証（`generateDisclosureId`）
  - date_partition: YYYY-MM形式、JST基準（`generateDatePartition`）
  - バリデーション: Zod使用

#### 2.2 検索機能

**ユーザ向け記載内容**:
- 検索条件
  - 企業名（部分一致可能）
  - 企業コード（4桁の数字）
  - 日付範囲（開始日～終了日）
  - 開示種別（決算短信、有価証券報告書など）
- 検索結果
  - 一覧表示（開示日時、企業名、タイトル）
  - 並び替え可能（日付順、企業名順）
  - 1ページに20件表示
- 使い方
  - 検索フォームに条件を入力
  - 「検索」ボタンをクリック
  - 結果が表示される

**設計上の仕様（本ドキュメントのみ記載）**:
- DynamoDB Query/Scan
  - GSI使用: date_partition + disclosed_at（月単位クエリ高速化）
  - 複数条件: AND条件で絞り込み
- ソート
  - デフォルト: 開示日時降順
  - オプション: 企業コード順、企業名順
- ページネーション
  - デフォルト: 20件/ページ
  - 最大: 100件/ページ
  - nextTokenによる次ページ取得
- レスポンス形式
  - JSON形式
  - メタデータ + PDF署名付きURL（有効期限1時間）
- パフォーマンス
  - 検索結果表示: 2秒以内

#### 2.3 エクスポート機能

**ユーザ向け記載内容**:
- エクスポート形式
  - CSV: Excelやスプレッドシートで分析可能
  - JSON: プログラムやAIツールで利用可能
- エクスポート手順
  1. 検索条件を指定
  2. 「エクスポート」ボタンをクリック
  3. 形式を選択（CSV/JSON）
  4. エクスポート開始
  5. 完了後、ダウンロードリンクが表示される
- 制限事項
  - 最大10,000件まで
  - ファイルサイズ最大100MB
  - ダウンロードリンクの有効期限: 1時間

**設計上の仕様（本ドキュメントのみ記載）**:
- 非同期処理
  - Lambda関数で非同期実行
  - ジョブID発行
  - ステータス確認API提供
- S3保存
  - エクスポートファイルをS3に保存
  - 署名付きURL生成（有効期限1時間）
- 同時実行制限
  - エクスポートジョブ: 最大5件まで同時実行

#### 2.4 PDF表示・ダウンロード機能

**ユーザ向け記載内容**:
- PDF表示
  - 検索結果から「PDF表示」ボタンをクリック
  - 新しいタブでPDFが開く
  - ブラウザ内で閲覧可能
- PDFダウンロード
  - PDF表示画面で「ダウンロード」ボタンをクリック
  - ローカルに保存される
- 注意事項
  - PDFリンクの有効期限: 1時間
  - 期限切れの場合は再度検索してください

**設計上の仕様（本ドキュメントのみ記載）**:
- S3保存構造
  - ディレクトリ: `YYYY/MM/disclosure_id.pdf`
  - 暗号化: AES-256（サーバーサイド）
- ライフサイクルポリシー
  - 90日後: Standard-IA移行
  - 365日後: Glacier移行
- 署名付きURL生成
  - CloudFront経由
  - 有効期限: 1時間
  - WAF保護
- 整合性検証
  - ダウンロード後にファイルサイズ確認
  - 破損ファイルは再ダウンロード
- エンコーディング処理
  - TDnet: Shift_JIS → UTF-8変換
  - バイナリ（arraybuffer）受信

### 3. Webダッシュボードの使い方

**ユーザ向け記載内容**:
- アクセス方法
  - ブラウザでURLを開く: `https://[配布されたURL]`
  - ログイン不要（APIキーは管理者が設定済み）
- ホーム画面
  - 検索フォーム
  - 最近の開示情報一覧
  - 統計情報（総データ件数、最新収集日時）
- 検索画面
  - 検索条件入力フォーム
  - 検索結果一覧
  - ソート・フィルタリング機能
- 収集状態画面
  - 実行履歴一覧
  - 実行中のジョブの進捗表示
  - 過去の実行結果確認
- 操作のヒント
  - 企業名は部分一致で検索可能
  - 日付範囲は必須ではない（指定しない場合は全期間）
  - 複数条件を組み合わせて絞り込み可能

**設計上の仕様（本ドキュメントのみ記載）**:
- フロントエンド
  - React 18.x
  - TypeScript
  - レスポンシブデザイン（PC/タブレット/スマホ対応）
- CloudFront配信
  - S3静的ホスティング
  - HTTPS必須
  - WAF保護
- API統合
  - API Gateway経由
  - APIキー認証（環境変数から自動取得）
  - CORS設定済み
- パフォーマンス
  - 初期表示: 3秒以内
  - 検索結果表示: 2秒以内
  - 統計情報更新: 5秒以内

### 4. API利用方法（開発者向け）

**ユーザ向け記載内容**:
- API概要
  - プログラムから開示情報を取得できる
  - RESTful API（HTTPリクエスト）
  - 認証が必要（APIキー）
- APIキーの取得
  - 管理者に依頼
  - メールまたはSlackで受け取る
  - 有効期限: 90日（自動更新）
- 基本的な使い方
  ```bash
  # 開示情報を検索
  curl -H "x-api-key: YOUR_API_KEY" \
    "https://[API_URL]/disclosures?start_date=2024-01-01&end_date=2024-01-31"
  ```
- 主なエンドポイント
  1. 開示情報検索: `/disclosures`
  2. データ収集開始: `/collect`
  3. 収集状態確認: `/collect-status`
  4. エクスポート: `/export`
  5. PDF取得: `/pdf-download`

**設計上の仕様（本ドキュメントのみ記載）**:
- ベースURL
  - `https://[API_GATEWAY_ID].execute-api.ap-northeast-1.amazonaws.com/prod`
- 認証方式
  - HTTPヘッダー: `x-api-key: YOUR_API_KEY`
  - または、クエリパラメータ: `?api_key=YOUR_API_KEY`
  - Secrets Manager経由でAPIキー管理
  - 90日ごと自動ローテーション
- レート制限
  - 10,000リクエスト/秒
  - バースト: 5,000リクエスト
  - 超過時: 429 Too Many Requests
- エンドポイント詳細
  1. **POST /collect**: データ収集開始
     - パラメータ: `start_date`, `end_date`（YYYY-MM-DD形式）
     - レスポンス: `{"execution_id": "exec_..."}`
  2. **GET /collect-status**: 収集状態取得
     - パラメータ: `execution_id`
     - レスポンス: `{"status": "running", "progress": 50, ...}`
  3. **GET /disclosures**: 開示情報検索
     - パラメータ: `start_date`, `end_date`, `company_code`, `disclosure_type`
     - レスポンス: `{"items": [...], "nextToken": "..."}`
  4. **GET /disclosures/{disclosure_id}**: 開示情報取得
     - レスポンス: `{"disclosure_id": "...", "company_name": "...", ...}`
  5. **POST /export**: エクスポート開始
     - パラメータ: `format` (csv/json), `start_date`, `end_date`, ...
     - レスポンス: `{"job_id": "..."}`
  6. **GET /export-status**: エクスポート状態取得
     - パラメータ: `job_id`
     - レスポンス: `{"status": "completed", "download_url": "..."}`
  7. **GET /pdf-download**: PDF署名付きURL取得
     - パラメータ: `disclosure_id`
     - レスポンス: `{"url": "https://...", "expires_at": "..."}`
  8. **GET /stats**: 統計情報取得
     - レスポンス: `{"total_count": 12345, "latest_date": "...", ...}`
  9. **GET /health**: ヘルスチェック
     - レスポンス: `{"status": "healthy", "timestamp": "..."}`
- エラーコード
  - `ERR_AUTH_001`: APIキー不正
  - `ERR_AUTH_002`: APIキー期限切れ
  - `ERR_VALIDATION_001`: パラメータ不正
  - `ERR_VALIDATION_002`: 日付フォーマット不正
  - `ERR_VALIDATION_003`: 日付範囲不正（過去1年以内のみ）
  - `ERR_NOT_FOUND_001`: 開示情報が見つからない
  - `ERR_RATE_LIMIT_001`: レート制限超過
  - `ERR_INTERNAL_001`: 内部エラー
- レスポンス形式
  - Content-Type: `application/json`
  - 成功: `{"status": "success", "data": {...}}`
  - エラー: `{"status": "error", "error_code": "ERR_XXX", "message": "..."}`

### 5. よくあるエラーと対処法

**ユーザ向け記載内容**:
- 「アクセスが拒否されました」
  - 原因: APIキーが不正または期限切れ
  - 対処: 管理者にAPIキーの再発行を依頼
- 「データが見つかりません」
  - 原因: 指定した条件に一致する開示情報がない
  - 対処: 検索条件を変更（日付範囲を広げる、企業名を変更）
- 「リクエストが多すぎます」
  - 原因: 短時間に大量のリクエストを送信
  - 対処: 少し待ってから再試行
- 「処理がタイムアウトしました」
  - 原因: 大量のデータを一度に取得しようとした
  - 対処: 日付範囲を短くして再試行
- 「ページが表示されません」
  - 原因: ネットワークエラーまたはサーバーメンテナンス
  - 対処: 時間をおいて再アクセス、管理者に連絡
- 「PDFが開けません」
  - 原因: PDFリンクの有効期限切れ（1時間）
  - 対処: 再度検索してPDFリンクを取得

**設計上の仕様（本ドキュメントのみ記載）**:
- 認証エラー（401/403）
  - Secrets Managerからのキー取得失敗
  - APIキーの不一致
  - 対処: CloudWatch Logsで詳細確認、Secrets Manager設定確認
- データ不在エラー（404）
  - DynamoDB Queryで結果0件
  - 対処: 検索条件の妥当性確認
- レート制限エラー（429）
  - API Gatewayスロットリング
  - 対処: 指数バックオフ再試行実装、リクエスト頻度調整
- タイムアウトエラー（504）
  - Lambda実行時間超過（API Gateway 29秒制限）
  - 対処: Lambda処理最適化、非同期処理への変更検討
- CORSエラー
  - API GatewayのCORS設定不足
  - Lambdaレスポンスヘッダー不足
  - 対処: CORS設定確認、レスポンスヘッダー追加
- SSL証明書エラー
  - 証明書期限切れ
  - 証明書とドメイン名不一致
  - 対処: ACM証明書更新、CloudFront設定確認

### 6. 管理者向け情報

**ユーザ向け記載内容**:
- システム管理
  - APIキーの発行・管理
  - ユーザーサポート
  - データのバックアップ確認
- 運用タスク
  - 定期的な動作確認（週次）
  - エラーログの確認（日次）
  - コスト監視（月次）
- トラブル発生時
  - エラーログを確認
  - 管理者マニュアル参照
  - 必要に応じてAWSサポートに連絡

**設計上の仕様（本ドキュメントのみ記載）**:
- AWS認証
  - AWS SSO: プロファイル `tdnet-prod`
  - ログイン: `aws sso login --profile tdnet-prod`
- デプロイ
  - 分割スタックデプロイ推奨: `deploy-split-stacks.ps1`
  - 変更箇所のみ更新: 2-5分（従来15-20分）
  - 全スタック: Foundation、Compute、API、Monitoring
- APIキー管理
  - Secrets Manager: `tdnet-api-key`
  - 自動ローテーション: 90日ごと
  - 手動ローテーション: `register-api-key.ps1 -Action rotate`
- コスト管理
  - AWS Budgets設定: 月次$10.00
  - アラート閾値: 50%、80%、100%
  - Cost Explorerで日次確認
- 運用スクリプト
  - デプロイ: `deploy-split-stacks.ps1`
  - データ収集: `manual-data-collection.ps1`
  - 監視: `check-cloudwatch-logs-simple.ps1`
  - 診断: `check-iam-permissions.ps1`, `check-waf-status.ps1`
  - 整合性確認: `check-dynamodb-s3-consistency.ps1`
- 監視とアラート
  - CloudWatchダッシュボード
  - CloudWatchアラーム
    - Lambda エラー率 > 5%
    - DynamoDB スロットリング発生
    - API Gateway 4XXError > 10%（5分間）
    - API Gateway 5XXError > 1件
    - DLQメッセージ数 > 0
  - SNS通知（未実装）
- トラブルシューティング
  - CloudWatch Logs確認: `check-cloudwatch-logs-simple.ps1`
  - DynamoDB/S3整合性: `check-dynamodb-s3-consistency.ps1`
  - Lambda 998件制限: `check-lambda-998-limit.ps1`
  - WAF状態: `check-waf-status.ps1`
  - IAM権限: `check-iam-permissions.ps1`

### 7. 付録

**ユーザ向け記載内容**:
- 用語集
  - TDnet: 日本取引所グループの適時開示情報閲覧サービス
  - 開示情報: 上場企業が公開する決算短信、有価証券報告書など
  - 企業コード: 4桁の数字で企業を識別（例: 7203はトヨタ自動車）
  - 開示種別: 決算短信、有価証券報告書、臨時報告書など
  - APIキー: APIを利用するための認証情報
- よくある質問（FAQ）
  - Q: データ収集の頻度は？
    - A: 現在は手動収集のみ。将来的に自動収集を予定
  - Q: 過去何年分のデータを取得できる？
    - A: 過去1年以内のデータのみ
  - Q: PDFファイルはいつまで保存される？
    - A: 無期限（ただし、古いファイルは低コストストレージに移行）
  - Q: APIキーの有効期限は？
    - A: 90日ごとに自動更新
  - Q: 同時に何件まで収集できる？
    - A: システムが自動的に最適化（通常500件で15秒程度）
  - Q: エクスポートファイルのサイズ制限は？
    - A: 最大100MB、10,000件まで
  - Q: スマートフォンで使える？
    - A: はい、Webダッシュボードはスマホ対応
- お問い合わせ
  - 技術的な問題: 管理者に連絡
  - 機能要望: GitHubのIssueに投稿
- 関連リンク
  - TDnet公式サイト: https://www.release.tdnet.info/

**設計上の仕様（本ドキュメントのみ記載）**:
- 技術用語集
  - disclosure_id: 開示情報の一意識別子（例: TD202401151234001）
  - date_partition: 月単位のパーティションキー（YYYY-MM形式、JST基準）
  - Step Functions: AWSのワークフローオーケストレーションサービス
  - DynamoDB: AWSのNoSQLデータベース
  - S3: AWSのオブジェクトストレージ
  - Lambda: AWSのサーバーレスコンピューティング
  - API Gateway: AWSのAPIマネジメントサービス
  - CloudWatch: AWSの監視サービス
  - WAF: Web Application Firewall
  - TTL: Time To Live（自動削除までの期間）
  - GSI: Global Secondary Index（DynamoDBのセカンダリインデックス）
  - CDK: AWS Cloud Development Kit（IaCツール）
- 技術FAQ
  - Q: Lambda関数の構成は？
    - A: 11個（collector系4個、query、export、api系4個、dlq-processor、api-key-rotation）
  - Q: DynamoDBのテーブル構成は？
    - A: disclosures（PK: disclosure_id、GSI: date_partition+disclosed_at）、execution_state（PK: execution_id）
  - Q: S3バケットの構成は？
    - A: PDFファイル（YYYY/MM/disclosure_id.pdf）、エクスポートファイル
  - Q: CloudWatchメトリクスは？
    - A: Lambda実行時間/エラー数、DynamoDB RCU/WCU、S3ストレージ、API Gateway 4XX/5XX/レイテンシ
- 関連技術ドキュメント
  - README.md: 技術ドキュメント
  - API設計ガイドライン: `.kiro/steering/api/api-design-guidelines.md`
  - セキュリティベストプラクティス: `.kiro/steering/security/security-best-practices.md`
  - エラーハンドリングパターン: `.kiro/steering/core/error-handling-patterns.md`
  - 監視とアラート: `.kiro/steering/infrastructure/monitoring-alerts.md`
- 変更履歴
  - 2026-02-22: 初版作成
  - Phase 1-4完了: 基本機能、API、Webダッシュボード、運用改善
  - Phase 5進行中: 自動収集、SNS通知（未実装）

### 1. システム概要（What）

**内容**:
- TDnet Data Collectorとは何か
- 何ができるのか（主要機能）
- どのような価値を提供するか
- システムアーキテクチャの概要

**記載事項**:
- システムの目的と背景
  - TDnet（適時開示情報閲覧サービス）からの自動収集
  - 投資判断・分析のためのデータ提供
- 主要機能一覧
  - ✅ データ収集（オンデマンド収集、Step Functions並列処理）
  - ✅ PDFダウンロード（S3保存）
  - ✅ メタデータ管理（DynamoDB）
  - ✅ 検索API（企業コード、日付範囲、開示種別）
  - ✅ エクスポートAPI（JSON/CSV）
  - ✅ Webダッシュボード（検索UI、PDF表示）
  - ✅ 実行状態管理（進捗追跡）
  - ✅ 監視とアラート（CloudWatch）
  - ⚠️ 自動収集（未実装：EventBridge未設定）
  - ⚠️ SNS通知（未実装）
- 技術スタック
  - ランタイム: Node.js 20.x
  - 言語: TypeScript 5.x
  - コンピューティング: AWS Lambda
  - データベース: Amazon DynamoDB
  - ストレージ: Amazon S3
  - API: Amazon API Gateway
  - IaC: AWS CDK
  - 監視: CloudWatch
- システムアーキテクチャ
  - サーバーレスアーキテクチャ
  - AWS無料枠内で運用可能
  - 4スタック構成（Foundation, Compute, API, Monitoring）

### 2. 主要機能の詳細説明（Features）

#### 2.1 データ収集機能

**内容**:
- オンデマンド収集の仕組み
- Step Functions並列処理
- 実行状態管理
- エラーハンドリング

**記載事項**:
- 収集方式
  - オンデマンド収集: 指定期間の開示情報を手動で収集
  - 自動収集（未実装）: 毎日午前9時（JST）に自動実行予定
- Step Functions並列処理
  - 4つのLambda関数（init/fetch/save/aggregate）
  - 最大5並列でページ処理
  - TDnet APIレート制限（1リクエスト/秒）遵守
- 実行状態管理
  - 実行ID: `exec_{timestamp}_{random}_{sequence}` 形式
  - ステータス: pending/running/completed/failed/partial_success
  - 進捗率: 0-100%
  - 成功件数・失敗件数の追跡
  - TTL 30日で自動削除
- データ整合性
  - disclosure_id: 一意性保証
  - date_partition: YYYY-MM形式（JST基準）
  - バリデーション: Zod使用
- エラーハンドリング
  - Retryableエラー: 指数バックオフ再試行（最大3回）
  - Non-Retryableエラー: 即座に失敗
  - Partial Failure: 成功分コミット、失敗分DLQ送信
  - タイムアウト設定: 初期化30秒、取得60秒、保存120秒、集約30秒
- パフォーマンス
  - 通常収集（500件）: 15秒以内
  - 大規模収集（2,700件）: 45秒以内
  - Lambda実行時間: 従来比89.9%削減
- 制限事項
  - 日付範囲: 過去1年以内のみ
  - 未来日の指定不可
  - 並列実行: 最大5並列

#### 2.2 検索機能

**内容**:
- 検索条件の種類
- フィルタリング・ソート
- ページネーション

**記載事項**:
- 検索条件
  - 企業コード（4桁）
  - 企業名（部分一致）
  - 日付範囲（YYYY-MM-DD形式）
  - 開示種別（決算短信、有価証券報告書など）
- フィルタリング
  - 複数条件の同時指定可能
  - AND条件で絞り込み
- ソート
  - 開示日時の降順（デフォルト）
  - 企業コード順
  - 企業名順
- ページネーション
  - デフォルト: 20件/ページ
  - 最大: 100件/ページ
  - nextTokenによる次ページ取得
- レスポンス形式
  - JSON形式
  - メタデータ + PDF署名付きURL
- パフォーマンス
  - 検索結果表示: 2秒以内

#### 2.3 エクスポート機能

**内容**:
- エクスポート形式
- エクスポートジョブの管理
- ダウンロード方法

**記載事項**:
- エクスポート形式
  - JSON: 構造化データ、LLM/AIエージェント統合向け
  - CSV: スプレッドシート分析向け
- エクスポートジョブ
  - 非同期処理（大量データ対応）
  - ジョブID発行
  - ステータス確認API
  - 完了後にS3署名付きURLを返却
- エクスポート条件
  - 検索条件と同じ（企業コード、日付範囲、開示種別）
  - 最大10,000件まで
- ダウンロード
  - 署名付きURL（有効期限: 1時間）
  - ブラウザまたはcurlでダウンロード
- 制限事項
  - エクスポートジョブ: 同時実行5件まで
  - ファイルサイズ: 最大100MB

#### 2.4 PDF管理機能

**内容**:
- PDFダウンロード
- S3保存
- 署名付きURL生成

**記載事項**:
- PDFダウンロード
  - TDnetから自動ダウンロード
  - Shift_JIS → UTF-8変換
  - バイナリ（arraybuffer）受信
- S3保存
  - ディレクトリ構造: `YYYY/MM/disclosure_id.pdf`
  - 暗号化: AES-256（サーバーサイド）
  - ライフサイクルポリシー: 90日後Standard-IA、365日後Glacier
- 署名付きURL生成
  - 有効期限: 1時間
  - CloudFront経由でアクセス
  - WAF保護
- 整合性検証
  - ダウンロード後にファイルサイズ確認
  - 破損ファイルは再ダウンロード

#### 2.5 実行状態管理機能

**内容**:
- 実行状態の追跡
- 進捗率の計算
- ステータス照会

**記載事項**:
- 実行状態テーブル（execution_state）
  - 実行ID、開始日時、終了日時
  - ステータス、進捗率
  - 総件数、成功件数、失敗件数、成功率
  - パラメータ（開始日、終了日）
- ステータス
  - pending: 実行待ち
  - running: 実行中
  - completed: 完了
  - failed: 失敗
  - partial_success: 部分的成功
- 進捗率計算
  - 処理済み件数 / 総件数 × 100
  - リアルタイム更新
- API照会
  - GET /collect-status?execution_id={id}
  - レスポンス: 実行状態の詳細
- TTL設定
  - 30日後に自動削除

#### 2.6 監視とアラート機能

**内容**:
- CloudWatchメトリクス
- CloudWatchアラーム
- ログ記録

**記載事項**:
- CloudWatchメトリクス
  - Lambda実行時間、エラー数、同時実行数
  - DynamoDB読み取り/書き込みキャパシティ
  - S3ストレージ使用量
  - API Gateway 4XXError、5XXError、レイテンシ
- CloudWatchアラーム
  - Lambda エラー率 > 5%
  - DynamoDB スロットリング発生
  - API Gateway 4XXError > 10%（5分間）
  - API Gateway 5XXError > 1件
  - DLQメッセージ数 > 0
- ログ記録
  - 構造化ログ（JSON形式）
  - ログレベル: DEBUG/INFO/WARN/ERROR
  - ログ保持期間: 30日
  - CloudWatch Logs Insights対応
- ダッシュボード
  - システム全体の可視化
  - リアルタイム監視
  - 過去30日分のトレンド分析

### 3. Webダッシュボードの使い方（How to Use Dashboard）

**内容**:
- ダッシュボードへのアクセス方法
- 検索機能の使い方
- フィルタリング・ソート
- PDFダウンロード
- 実行状態の確認

**記載事項**:
- アクセス方法
  - URL: `https://[CLOUDFRONT_DISTRIBUTION_ID].cloudfront.net`
  - ブラウザ要件: Chrome/Firefox/Safari最新版
  - レスポンシブデザイン（PC/タブレット/スマホ対応）
- 検索機能
  - 検索フォーム: 企業名、企業コード、日付範囲、開示種別
  - 検索ボタンクリックで結果表示
  - リアルタイム検索（入力中に候補表示）
- 検索結果
  - テーブル形式で表示
  - カラム: 開示日時、企業名、企業コード、開示種別、タイトル
  - ソート: カラムヘッダークリックで昇順/降順切り替え
  - ページネーション: 20件/ページ
- PDFダウンロード
  - 「PDF表示」ボタンクリック
  - 新しいタブでPDF表示
  - ダウンロードボタンでローカル保存
- 実行状態確認
  - 「収集状態」タブで実行履歴表示
  - 実行ID、開始日時、ステータス、進捗率、成功率
  - 実行中のジョブは進捗バー表示
- フィルタリング
  - 複数条件の組み合わせ可能
  - クリアボタンで条件リセット
- エクスポート
  - 「エクスポート」ボタンでJSON/CSV選択
  - エクスポートジョブ開始
  - 完了後にダウンロードリンク表示

### 4. API利用方法（How to Use API）

**内容**:
- API概要
- 認証方法（APIキー）
- エンドポイント一覧
- リクエスト例
- レスポンス形式
- エラーコード

**記載事項**:
- API概要
  - RESTful API
  - ベースURL: `https://[API_GATEWAY_ID].execute-api.ap-northeast-1.amazonaws.com/prod`
  - 認証: APIキー必須
  - レート制限: 10,000リクエスト/秒、5,000バースト
- 認証方法
  - HTTPヘッダー: `x-api-key: YOUR_API_KEY`
  - または、クエリパラメータ: `?api_key=YOUR_API_KEY`
  - APIキー取得方法: 管理者に依頼
  - APIキーローテーション: 90日ごと自動更新
- エンドポイント一覧
  1. **データ収集開始**: `POST /collect`
     - パラメータ: `start_date`, `end_date`
     - レスポンス: `execution_id`
  2. **収集状態取得**: `GET /collect-status?execution_id={id}`
     - レスポンス: 実行状態の詳細
  3. **開示情報検索**: `GET /disclosures?start_date={date}&end_date={date}&company_code={code}&disclosure_type={type}`
     - レスポンス: 開示情報リスト
  4. **開示情報取得**: `GET /disclosures/{disclosure_id}`
     - レスポンス: 開示情報詳細
  5. **エクスポート開始**: `POST /export`
     - パラメータ: `format`, `start_date`, `end_date`, `company_code`, `disclosure_type`
     - レスポンス: `job_id`
  6. **エクスポート状態取得**: `GET /export-status?job_id={id}`
     - レスポンス: エクスポートジョブの状態
  7. **PDF署名付きURL取得**: `GET /pdf-download?disclosure_id={id}`
     - レスポンス: 署名付きURL（有効期限1時間）
  8. **統計情報取得**: `GET /stats`
     - レスポンス: 総データ件数、最新収集日時、企業別件数
  9. **ヘルスチェック**: `GET /health`
     - レスポンス: システム状態
- リクエスト例
  ```bash
  # データ収集開始
  curl -X POST "https://api.example.com/prod/collect" \
    -H "x-api-key: YOUR_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"start_date":"2024-01-01","end_date":"2024-01-31"}'
  
  # 開示情報検索
  curl -X GET "https://api.example.com/prod/disclosures?start_date=2024-01-01&end_date=2024-01-31&company_code=7203" \
    -H "x-api-key: YOUR_API_KEY"
  
  # エクスポート開始
  curl -X POST "https://api.example.com/prod/export" \
    -H "x-api-key: YOUR_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"format":"csv","start_date":"2024-01-01","end_date":"2024-01-31"}'
  ```
- レスポンス形式
  - Content-Type: `application/json`
  - 成功: `{"status":"success","data":{...}}`
  - エラー: `{"status":"error","error_code":"ERR_XXX","message":"..."}`
- エラーコード
  - `ERR_AUTH_001`: APIキー不正
  - `ERR_AUTH_002`: APIキー期限切れ
  - `ERR_VALIDATION_001`: パラメータ不正
  - `ERR_VALIDATION_002`: 日付フォーマット不正
  - `ERR_VALIDATION_003`: 日付範囲不正
  - `ERR_NOT_FOUND_001`: 開示情報が見つからない
  - `ERR_RATE_LIMIT_001`: レート制限超過
  - `ERR_INTERNAL_001`: 内部エラー

### 5. よくあるエラーと対処法（Troubleshooting）

**内容**:
- 認証エラー
- データが見つからない
- API呼び出しエラー
- 収集エラー
- その他のエラー

**記載事項**:
- 認証エラー
  - エラー: `{"message":"Forbidden"}`
  - 原因: APIキーが不正または期限切れ
  - 対処: APIキーを確認、管理者に再発行依頼
- データが見つからない
  - エラー: `{"error_code":"ERR_NOT_FOUND_001"}`
  - 原因: 指定した条件に一致する開示情報が存在しない
  - 対処: 検索条件を変更、日付範囲を広げる
- API呼び出しエラー
  - エラー: `{"message":"Too Many Requests"}`
  - 原因: レート制限超過
  - 対処: リクエスト頻度を下げる、再試行ロジック実装
- 収集エラー
  - エラー: `{"status":"failed"}`
  - 原因: TDnetサイトダウン、ネットワークエラー
  - 対処: 時間をおいて再実行、CloudWatch Logsで詳細確認
- タイムアウトエラー
  - エラー: `{"message":"Endpoint request timed out"}`
  - 原因: Lambda関数の実行時間超過
  - 対処: 日付範囲を短縮、管理者に連絡
- CORSエラー
  - エラー: `Access to fetch ... has been blocked by CORS policy`
  - 原因: API GatewayのCORS設定不足
  - 対処: 管理者に連絡、CORS設定を確認
- SSL証明書エラー
  - エラー: `NET::ERR_CERT_DATE_INVALID`
  - 原因: SSL証明書の期限切れ
  - 対処: 管理者に連絡、証明書を更新

### 6. 管理者向け情報（For Administrators）

**内容**:
- システム管理
- 運用スクリプト
- 監視とアラート
- トラブルシューティング

**記載事項**:
- システム管理
  - AWS SSO認証: `tdnet-prod` プロファイル
  - デプロイ: 分割スタックデプロイ推奨（2-5分）
  - APIキー管理: Secrets Manager、90日ごと自動ローテーション
  - コスト管理: AWS Budgets設定（月次$10.00）
- 運用スクリプト
  - デプロイ: `deploy-split-stacks.ps1`
  - データ収集: `manual-data-collection.ps1`
  - 監視: `check-cloudwatch-logs-simple.ps1`
  - 診断: `check-iam-permissions.ps1`
- 監視とアラート
  - CloudWatchダッシュボード
  - CloudWatchアラーム設定
  - SNS通知（未実装）
- トラブルシューティング
  - CloudWatch Logsでエラーログ確認
  - DynamoDBとS3の整合性確認
  - Lambda 998件制限問題の診断
  - WAF状態確認


## 成果物

### ユーザマニュアル（USER_MANUAL.md）
- **対象**: 一般ユーザ、管理者
- **内容**: 「ユーザ向け記載内容」のみを記載
- **表現**: 平易な日本語、技術用語は最小限
- **構成**: 上記1～7のセクション

### 技術仕様書（本ドキュメント）
- **対象**: 開発者、システム管理者
- **内容**: 「設計上の仕様」を詳細に記載
- **表現**: 技術用語、具体的な数値、実装詳細
- **目的**: マニュアル作成時の参照資料、システム保守時の仕様確認

## 参考資料

- `README.md` - 技術ドキュメント（システム概要、技術スタック、アーキテクチャ）
- `.kiro/specs/tdnet-data-collector/01-requirements/functional-requirements.md` - 機能要件（詳細な受入基準）
- `.kiro/steering/api/api-design-guidelines.md` - API設計（エンドポイント、認証、エラーコード）
- `.kiro/steering/core/error-handling-patterns.md` - エラーハンドリング（エラー分類、再試行戦略）
- `.kiro/steering/infrastructure/monitoring-alerts.md` - 監視とアラート（CloudWatchメトリクス、アラーム設定）
- `.kiro/steering/security/security-best-practices.md` - セキュリティ（IAM権限、暗号化、監査ログ）

## 備考

- ユーザマニュアルは日本語で記述
- 技術用語は必要に応じて平易な言葉で説明
- 操作手順は具体的に記載（「～をクリック」「～を入力」）
- スクリーンショットは不要（テキストのみ）
- 実装済み機能と未実装機能を明確に区別
- エラーメッセージと対処法を具体的に記載
- 管理者向け情報は別セクションで記載
