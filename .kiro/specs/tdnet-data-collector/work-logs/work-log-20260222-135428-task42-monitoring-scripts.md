# 作業記録: タスク42 - 監視スクリプトのエラーメッセージ改善

## 作業情報

- **作業日時**: 2026-02-22 13:54:28
- **タスク**: タスク42 - 監視スクリプトのエラーメッセージ改善
- **担当**: AI Assistant
- **関連ファイル**: 
  - `scripts/analyze-cloudwatch-logs.ps1`
  - `scripts/check-cloudwatch-logs-simple.ps1`
  - `scripts/check-dynamodb-s3-consistency.ps1`
  - `scripts/check-waf-status.ps1`

## 作業内容

### 目的

監視スクリプトのエラーメッセージを改善し、エラー発生時の対処方法を明確化する。

### 改善内容

1. **エラーコード体系の導入**
   - ERR-CWL-001: CloudWatch Logsクエリ開始失敗
   - ERR-CWL-002: クエリタイムアウト
   - ERR-CWL-003: ログストリーム未検出
   - ERR-CWL-004: ログストリーム取得失敗
   - ERR-DDB-001: DynamoDBスキャン失敗
   - ERR-S3-001: S3オブジェクトリスト取得失敗
   - ERR-WAF-001: WAF操作失敗

2. **対処方法の追加**
   - 具体的なAWS CLIコマンド例
   - 必要なIAM権限の明示
   - AWSコンソールURLの提供
   - 次のアクションステップ

3. **エラーメッセージの構造化**
   - エラーコード
   - 原因の説明
   - 対処方法（番号付きリスト）
   - 関連ドキュメントへのリンク

## 実施内容

### 1. analyze-cloudwatch-logs.ps1

現状確認:
- 既にエラーコード（ERR-CWL-001, ERR-CWL-002）が実装済み
- 対処方法が詳細に記載されている
- AWSコンソールURLが含まれている

改善点:
- エラーメッセージの一貫性を確保
- 追加のトラブルシューティング手順を提供

### 2. check-cloudwatch-logs-simple.ps1

現状確認:
- エラーコード（ERR-CWL-003, ERR-CWL-004）が実装済み
- 対処方法が記載されている

改善点:
- エラーハンドリングの強化
- より詳細な診断情報の提供

### 3. check-dynamodb-s3-consistency.ps1

現状確認:
- エラーコード（ERR-DDB-001, ERR-S3-001）が実装済み
- 対処方法が詳細に記載されている

改善点:
- エラーメッセージの一貫性を確保
- 追加の診断手順を提供

### 4. check-waf-status.ps1

現状確認:
- 基本的なエラーハンドリングのみ
- エラーコードが未実装

改善点:
- エラーコード体系の導入
- 詳細な対処方法の追加
- AWSコンソールURLの提供

## 作業ログ


### check-waf-status.ps1の改善完了

**改善内容:**
1. エラーコード体系の導入
   - ERR-WAF-001: WAF WebACLリスト取得失敗
   - ERR-WAF-002: API Gatewayリスト取得失敗
   - ERR-WAF-003: 対象API Gateway未検出
   - ERR-WAF-999: 予期しないエラー

2. 詳細な対処方法の追加
   - AWS認証情報確認コマンド
   - IAM権限確認手順（scripts/check-iam-permissions.ps1）
   - AWSコンソールURL（WAF、API Gateway、CloudFormation）
   - デプロイコマンド（scripts/deploy-all.ps1）

3. エラーハンドリングの強化
   - try-catchブロックの追加
   - 2>&1によるエラー出力のキャプチャ
   - 部分的失敗の許容（Associated resources取得失敗時）


### check-cloudwatch-logs-simple.ps1の改善完了

**改善内容:**
1. AWSコンソールURLの追加
   - CloudWatch Logsコンソールへの直接リンク（ログループ指定）
   - URIエスケープ処理を追加

2. IAM権限確認の簡素化
   - `scripts/check-iam-permissions.ps1`への統一
   - 具体的なユーザー名・ポリシー名の指定不要

### check-dynamodb-s3-consistency.ps1の改善完了

**改善内容:**
1. AWSコンソールURLの追加
   - DynamoDBコンソールへの直接リンク（テーブル指定）
   - S3コンソールへの直接リンク（バケット指定）

2. IAM権限確認の簡素化
   - `scripts/check-iam-permissions.ps1`への統一

3. 追加の診断手順
   - テーブルステータス確認
   - バケットリージョン確認

### analyze-cloudwatch-logs.ps1の改善

**改善内容:**
1. AWSコンソールURLの追加
   - CloudWatch Logsコンソールへの直接リンク

2. タイムアウト時の追加ガイダンス
   - ログデータ量が多い場合のフィルター条件追加の提案

3. IAM権限確認の簡素化
   - `scripts/check-iam-permissions.ps1`への統一


## 改善サマリー

### エラーコード体系

| コード | 説明 | 対象スクリプト |
|--------|------|---------------|
| ERR-CWL-001 | CloudWatch Logsクエリ開始失敗 | analyze-cloudwatch-logs.ps1 |
| ERR-CWL-002 | クエリタイムアウト | analyze-cloudwatch-logs.ps1 |
| ERR-CWL-003 | ログストリーム未検出 | check-cloudwatch-logs-simple.ps1 |
| ERR-CWL-004 | ログストリーム取得失敗 | check-cloudwatch-logs-simple.ps1 |
| ERR-DDB-001 | DynamoDBスキャン失敗 | check-dynamodb-s3-consistency.ps1 |
| ERR-S3-001 | S3オブジェクトリスト取得失敗 | check-dynamodb-s3-consistency.ps1 |
| ERR-WAF-001 | WAF WebACLリスト取得失敗 | check-waf-status.ps1 |
| ERR-WAF-002 | API Gatewayリスト取得失敗 | check-waf-status.ps1 |
| ERR-WAF-003 | 対象API Gateway未検出 | check-waf-status.ps1 |
| ERR-WAF-999 | 予期しないエラー | check-waf-status.ps1 |

### 共通改善パターン

1. **IAM権限確認の統一**
   - 変更前: `aws iam get-user-policy --user-name <ユーザー名> --policy-name <ポリシー名>`
   - 変更後: `scripts/check-iam-permissions.ps1`
   - 理由: ユーザー名・ポリシー名の指定が不要で、より簡単に実行可能

2. **AWSコンソールURLの追加**
   - CloudWatch Logs: `https://console.aws.amazon.com/cloudwatch/home?region=$Region#logsV2:log-groups`
   - DynamoDB: `https://console.aws.amazon.com/dynamodbv2/home?region=$Region#table?name=$TableName`
   - S3: `https://s3.console.aws.amazon.com/s3/buckets/$BucketName?region=$Region`
   - WAF: `https://console.aws.amazon.com/wafv2/homev2/web-acls?region=$Region`
   - API Gateway: `https://console.aws.amazon.com/apigateway/main/apis?region=$Region`
   - CloudFormation: `https://console.aws.amazon.com/cloudformation/home?region=$Region`

3. **エラーメッセージの構造化**
   ```
   ❌ [エラーコード] エラーメッセージ
   
   対処方法:
   1. 認証情報確認
   2. IAM権限確認
   3. リソース存在確認
   4. コンソールで確認
   5. 追加の診断手順
   
   詳細: .kiro/steering/infrastructure/monitoring-alerts.md
   ```

### スクリプト別改善詳細

#### 1. check-waf-status.ps1（最大の改善）
- **改善前**: 基本的なエラーハンドリングのみ
- **改善後**: 
  - 3つの主要エラーコード（ERR-WAF-001, 002, 003）
  - 包括的なエラーハンドリング（ERR-WAF-999）
  - try-catchブロックの追加
  - 部分的失敗の許容（Associated resources取得）
  - 詳細な対処方法（5-6ステップ）
  - AWSコンソールURL（WAF、API Gateway、CloudFormation）

#### 2. analyze-cloudwatch-logs.ps1（小規模改善）
- **改善前**: 既に良好なエラーハンドリング
- **改善後**:
  - AWSコンソールURLの追加
  - IAM権限確認の簡素化
  - タイムアウト時の追加ガイダンス

#### 3. check-cloudwatch-logs-simple.ps1（中規模改善）
- **改善前**: 基本的なエラーハンドリング
- **改善後**:
  - AWSコンソールURLの追加（URIエスケープ処理）
  - IAM権限確認の簡素化
  - 6ステップの詳細な対処方法

#### 4. check-dynamodb-s3-consistency.ps1（中規模改善）
- **改善前**: 基本的なエラーハンドリング
- **改善後**:
  - AWSコンソールURL（DynamoDB、S3）の追加
  - IAM権限確認の簡素化
  - 追加の診断手順（テーブルステータス、バケットリージョン）

## 成果物

### 修正ファイル
1. `scripts/check-waf-status.ps1` - 大幅改善
2. `scripts/analyze-cloudwatch-logs.ps1` - 小規模改善
3. `scripts/check-cloudwatch-logs-simple.ps1` - 中規模改善
4. `scripts/check-dynamodb-s3-consistency.ps1` - 中規模改善

### 改善効果

**ユーザビリティ向上:**
- エラー発生時の対処方法が明確
- AWSコンソールへの直接リンクで迅速な確認が可能
- IAM権限確認が簡素化（scripts/check-iam-permissions.ps1の利用）

**トラブルシューティング効率化:**
- エラーコードによる問題の特定が容易
- 段階的な診断手順の提供
- 関連ドキュメントへのリンク

**一貫性の向上:**
- 全スクリプトで統一されたエラーメッセージ形式
- 共通の対処方法パターン
- 標準化されたエラーコード体系

## 申し送り事項

### 今後の改善提案

1. **エラーコードドキュメントの作成**
   - 全エラーコードの一覧表
   - 各エラーの詳細説明と対処方法
   - 配置場所: `.kiro/steering/infrastructure/error-codes.md`

2. **check-iam-permissions.ps1の拡張**
   - 監視スクリプトで必要な権限の自動チェック
   - 不足している権限の具体的な表示
   - IAMポリシーのサンプル提供

3. **他の運用スクリプトへの展開**
   - `scripts/deploy*.ps1`
   - `scripts/fetch-data-range.ps1`
   - `scripts/manual-data-collection.ps1`
   - 同様のエラーハンドリングパターンを適用

4. **エラーログの集約**
   - エラー発生時のログをファイルに記録
   - トラブルシューティング履歴の保存
   - 配置場所: `logs/script-errors-[YYYYMMDD].log`

### テスト推奨

各スクリプトで以下のエラーシナリオをテスト:
1. AWS認証情報なし
2. IAM権限不足
3. リソース未存在
4. ネットワークエラー
5. タイムアウト

### 関連タスク

- タスク41: PowerShellスクリプトのテスト検証（完了）
- タスク43: デプロイスクリプトのエラーハンドリング改善（未着手）

## 完了確認

- [x] 4つの監視スクリプトのエラーメッセージ改善
- [x] エラーコード体系の導入
- [x] AWSコンソールURLの追加
- [x] IAM権限確認の簡素化
- [x] 対処方法の詳細化
- [x] 作業記録の作成
- [x] UTF-8 BOMなしでファイル作成

