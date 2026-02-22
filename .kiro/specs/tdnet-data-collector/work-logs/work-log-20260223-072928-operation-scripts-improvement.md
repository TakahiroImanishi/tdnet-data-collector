# 作業記録: 運用スクリプトの改善

**作業日時**: 2026-02-23 07:29:28
**タスク**: タスク8.1.2 - 運用スクリプトの改善
**担当**: Kiro AI Assistant

## 目的

運用スクリプトがCDK Outputsから環境情報を自動取得し、環境切り替えが容易になるようにする。

## 実施内容

### 1. 共通関数の作成

`scripts/lib/get-stack-outputs.ps1`を作成し、以下の機能を実装:
- CDK Outputsから環境情報を取得する関数
- エラーハンドリング（スタックが存在しない、AWS CLI未設定等）
- キャッシュ機能（同一セッション内での再利用）

### 2. 運用スクリプトの修正

以下のスクリプトを修正し、ハードコーディングを排除:
- `manual-data-collection.ps1`
- `check-step-functions-execution.ps1`
- `cancel-step-functions-execution.ps1`
- `fetch-data-range.ps1`

各スクリプトで以下を実現:
- 環境（dev/prod）をパラメータで指定可能
- CDK Outputsから環境情報を自動取得
- エラーハンドリングの改善

## 作業ログ


### 1. 共通関数の作成完了

`scripts/lib/get-stack-outputs.ps1`を作成しました。

**機能**:
- CDK Stackから環境情報を自動取得
- キャッシュ機能（同一セッション内での再利用）
- エラー分類とユーザーフレンドリーなエラーメッセージ
- AWS SSOプロファイル対応

**取得可能な環境情報**:
- `ApiEndpoint`: API Gateway URL
- `ApiKeySecretName`: Secrets Manager シークレット名
- `Region`: AWSリージョン
- `Environment`: 環境名（dev/prod）
- `StateMachineArn`: Step Functions ARN（Step Functions有効時のみ）

**エラーハンドリング**:
- `STACK_NOT_FOUND`: スタックが存在しない
- `AUTH_EXPIRED`: AWS認証が期限切れ
- `ACCESS_DENIED`: CloudFormationへのアクセス権限なし
- `MISSING_OUTPUT`: 必須の出力が見つからない
- `AWS_CLI_ERROR`: その他のAWS CLIエラー

### 2. 運用スクリプトの修正完了

以下の4つのスクリプトを修正しました:

#### 2.1 manual-data-collection.ps1

**変更内容**:
- `-Environment`パラメータ追加（dev/prod、デフォルト: prod）
- `-Profile`パラメータ追加（AWS CLIプロファイル指定）
- `Get-StackOutputs`関数を使用して環境情報を自動取得
- ハードコーディングされた環境情報を削除

**使用例**:
```powershell
# 本番環境（デフォルト）
.\scripts\manual-data-collection.ps1 -StartDate "2026-02-21" -EndDate "2026-02-22"

# 開発環境
.\scripts\manual-data-collection.ps1 -Environment dev -StartDate "2026-02-21"

# AWS SSOプロファイル指定
.\scripts\manual-data-collection.ps1 -Profile manishi-awssso
```

#### 2.2 check-step-functions-execution.ps1

**変更内容**:
- `-Environment`パラメータ追加（dev/prod、デフォルト: prod）
- `-Profile`パラメータ追加（AWS CLIプロファイル指定）
- `Get-StackOutputs`関数を使用して環境情報を自動取得
- JSON出力時はサイレントモード（環境情報取得メッセージを非表示）
- ハードコーディングされた環境情報を削除

**使用例**:
```powershell
# 本番環境（デフォルト）
.\scripts\check-step-functions-execution.ps1 -ExecutionId exec_123

# 開発環境
.\scripts\check-step-functions-execution.ps1 -Environment dev -ExecutionId exec_123

# JSON形式で出力
.\scripts\check-step-functions-execution.ps1 -ExecutionId exec_123 -Json
```

#### 2.3 cancel-step-functions-execution.ps1

**変更内容**:
- `-Environment`パラメータ追加（dev/prod、デフォルト: prod）
- `-Profile`パラメータ追加（AWS CLIプロファイル指定）
- `Get-StackOutputs`関数を使用して環境情報を自動取得
- `StateMachineArn`から`StateMachineName`を抽出（フォールバック付き）
- ハードコーディングされた環境情報を削除

**使用例**:
```powershell
# 本番環境（デフォルト）
.\scripts\cancel-step-functions-execution.ps1 -ExecutionId exec_123

# 開発環境
.\scripts\cancel-step-functions-execution.ps1 -Environment dev -ExecutionId exec_123

# 確認プロンプトをスキップ
.\scripts\cancel-step-functions-execution.ps1 -ExecutionId exec_123 -Force
```

#### 2.4 fetch-data-range.ps1

**変更内容**:
- `-Environment`パラメータ追加（dev/prod、デフォルト: prod）
- `-Profile`パラメータ追加（AWS CLIプロファイル指定）
- `Get-StackOutputs`関数を使用して環境情報を自動取得
- ハードコーディングされた環境情報を削除

**使用例**:
```powershell
# 本番環境（デフォルト）
.\scripts\fetch-data-range.ps1 -Date "2026-02-21"

# 開発環境
.\scripts\fetch-data-range.ps1 -Environment dev -Date "2026-02-21"

# オフセットとリミット指定
.\scripts\fetch-data-range.ps1 -Date "2026-02-21" -Offset 100 -Limit 50
```

## 成果物

### 新規作成
- `scripts/lib/get-stack-outputs.ps1`: CDK Stack Outputs取得共通関数

### 修正
- `scripts/manual-data-collection.ps1`: 環境情報自動取得対応
- `scripts/check-step-functions-execution.ps1`: 環境情報自動取得対応
- `scripts/cancel-step-functions-execution.ps1`: 環境情報自動取得対応
- `scripts/fetch-data-range.ps1`: 環境情報自動取得対応

## 改善効果

### 運用性の向上
1. **環境切り替えが容易**: `-Environment`パラメータで簡単に切り替え可能
2. **ハードコーディング排除**: すべての環境情報をCDK Outputsから自動取得
3. **エラーメッセージの改善**: ユーザーフレンドリーなエラーメッセージと解決方法の提示
4. **キャッシュ機能**: 同一セッション内での再利用により高速化

### 保守性の向上
1. **一元管理**: 環境情報の取得ロジックを共通関数に集約
2. **変更容易性**: CDK Outputsを変更するだけで全スクリプトに反映
3. **テスト容易性**: 共通関数のテストで全スクリプトの動作を保証

### セキュリティの向上
1. **AWS SSO対応**: プロファイル指定により安全な認証
2. **環境分離**: dev/prod環境の明確な分離

## 申し送り事項

### 次のステップ
1. **タスク8.1.1の完了確認**: CDK Outputsが正しく設定されているか確認
2. **本番環境でのテスト**: 実際に各スクリプトを実行して動作確認
3. **ドキュメント更新**: タスク8.1.3で運用ドキュメントを整備

### 注意事項
1. **CDK Outputsの依存**: タスク8.1.1が完了していない場合、`MISSING_OUTPUT`エラーが発生する可能性
2. **AWS CLI設定**: AWS CLIが正しく設定されていることが前提
3. **AWS SSO**: プロファイル指定時は事前に`aws sso login`が必要

## 完了日時

2026-02-23 07:29:28
