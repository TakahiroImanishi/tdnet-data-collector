# デプロイスクリプトから要件への反映確認

**作成日時**: 2026-02-22 18:50:48  
**タスク**: デプロイスクリプトから要件ドキュメントへの反映確認  
**担当**: Subagent 4

---

## 目的

以下のファイルを分析し、要件ドキュメントに反映すべき内容を特定する：
1. `.kiro/specs/tdnet-data-collector/designs/06-scripts/deployment-scripts.md`
2. `scripts/deploy.ps1`
3. `scripts/deploy-prod.ps1`
4. `scripts/deploy-split-stacks.ps1`

---

## 分析結果

### 1. 発見した要件反映すべき内容

#### 1.1 AWS SSO認証の要件（新規）

**現状**: 実装済みだが要件ドキュメントに記載なし

**発見内容**:
- すべてのデプロイスクリプトは起動時に自動的にAWS SSO認証を実行
- プロファイル `imanishi-awssso` を使用
- 認証フロー: `startup.ps1` → AWS SSO認証確認 → 未認証時は `aws sso login` 実行
- 環境変数 `AWS_PROFILE=imanishi-awssso` を設定

**影響範囲**:
- デプロイ手順
- 環境構築
- CI/CD設定

#### 1.2 デプロイ前提条件の要件（拡張）

**現状**: 要件13（デプロイ）に部分的に記載

**発見内容**:
- Node.js、npm、AWS CLI、AWS CDKのバージョン確認が必須
- AWS認証情報の確認（`aws sts get-caller-identity`）
- TypeScriptビルドの必須化（`npm run build`）
- ビルドファイルの検証（`dist/src/lambda/*/index.js` の存在確認）

**影響範囲**:
- デプロイ前チェックリスト
- 環境構築ガイド

#### 1.3 デプロイログ生成の要件（新規）

**現状**: 要件ドキュメントに記載なし

**発見内容**:
- `deploy.ps1` は自動的にデプロイログを生成
- ファイル名: `deployment-log-[YYYYMMDD-HHMMSS].md`
- 記録内容: 日時、環境、リージョン、AWSアカウント、デプロイ担当者、実行ステップ、ステータス

**影響範囲**:
- 監査要件
- トレーサビリティ要件

#### 1.4 環境変数ファイル生成の要件（新規）

**現状**: 要件8（設定管理）に部分的に記載

**発見内容**:
- `deploy.ps1` は自動的に環境変数ファイルを生成（`generate-env-file.ps1`）
- 環境別ファイル: `.env.local`, `.env.production`
- AWS認証情報から自動取得: アカウントID、リージョン

**影響範囲**:
- 設定管理要件
- 環境構築要件

#### 1.5 APIキー管理の要件（拡張）

**現状**: 要件11（API認証）に記載あり

**発見内容**:
- `deploy.ps1` は自動的にAPIキーSecretを作成（`create-api-key-secret.ps1`）
- Secrets Managerに保存: `/tdnet/api-key`
- 初回デプロイ時のみ実行、再デプロイ時はスキップ可能（`-SkipSecretCreation`）

**影響範囲**:
- セキュリティ要件
- デプロイ手順

#### 1.6 スタック分割デプロイの要件（新規）

**現状**: 要件ドキュメントに記載なし

**発見内容**:
- 4スタック構成: Foundation → Compute → API → Monitoring
- 依存関係順のデプロイが必須
- 個別スタックのデプロイが可能（部分更新）
- デプロイ時間の短縮: 70-90%（初回12-18分、更新3-5分）

**影響範囲**:
- デプロイ戦略要件
- パフォーマンス要件

#### 1.7 ロールバック戦略の要件（拡張）

**現状**: 要件ドキュメントに記載なし（rollback-procedures.mdには記載あり）

**発見内容**:
- 3つのロールバック方法:
  1. CloudFormationロールバック（最速・最安全）
  2. 前のコミットにロールバック
  3. 手動デプロイ（最終手段）
- スタック分割時の個別ロールバックが可能

**影響範囲**:
- DR/バックアップ要件（要件15）
- 運用要件

#### 1.8 デプロイ後確認の要件（新規）

**現状**: 要件ドキュメントに記載なし

**発見内容**:
- リソース確認: Lambda関数、DynamoDBテーブル、S3バケット、CloudFront Distribution
- CloudWatch Logs確認
- CloudWatch Alarms確認
- スモークテスト実行

**影響範囲**:
- デプロイ検証要件
- 品質保証要件

---

### 2. 反映先の要件ファイルと該当セクション

#### 2.1 requirements.md

**反映先セクション**: 新規要件として追加

**推奨する追加要件**:

##### 要件16: デプロイ自動化とトレーサビリティ

**ユーザーストーリー**: ユーザーとして、デプロイプロセスが自動化され、すべてのデプロイ操作が記録されることを望む。なぜなら、手動操作によるミスを防ぎ、監査証跡を確保したいから。

**受入基準**:
1. システムはAWS SSO認証を自動的に実行し、認証状態を確認しなければならない
2. システムはデプロイ前に前提条件（Node.js、npm、AWS CLI、AWS CDK、AWS認証情報）を自動チェックしなければならない
3. システムはTypeScriptビルドを実行し、ビルドファイルの存在を検証しなければならない
4. システムはAPIキーSecretを自動作成し、Secrets Managerに保存しなければならない
5. システムは環境変数ファイルを自動生成し、AWS認証情報から必要な値を取得しなければならない
6. システムはデプロイログを自動生成し、日時、環境、リージョン、AWSアカウント、デプロイ担当者、実行ステップ、ステータスを記録しなければならない
7. システムはデプロイ後に自動的にリソース確認、CloudWatch Logs確認、CloudWatch Alarms確認、スモークテストを実行しなければならない

##### 要件17: スタック分割デプロイ戦略

**ユーザーストーリー**: ユーザーとして、デプロイ時間を短縮し、部分的な更新を可能にしたい。なぜなら、頻繁なデプロイを効率的に実行したいから。

**受入基準**:
1. システムは4つのスタック（Foundation、Compute、API、Monitoring）に分割されなければならない
2. システムはスタック間の依存関係を管理し、依存関係順（Foundation → Compute → API → Monitoring）にデプロイしなければならない
3. システムは個別スタックのデプロイをサポートし、部分的な更新を可能にしなければならない
4. システムはスタック分割により、初回デプロイ時間を12-18分、更新時を3-5分に短縮しなければならない
5. システムはスタック削除時に依存関係の逆順（Monitoring → API → Compute → Foundation）で実行しなければならない

##### 要件18: ロールバック戦略

**ユーザーストーリー**: ユーザーとして、デプロイに問題が発生した場合に迅速にロールバックできることを望む。なぜなら、システムのダウンタイムを最小化したいから。

**受入基準**:
1. システムはCloudFormationロールバック機能をサポートし、最速（5-10分）でロールバックできなければならない
2. システムは前のコミットへのロールバックをサポートし、コード変更のみの場合に使用できなければならない
3. システムは手動デプロイによるロールバックをサポートし、複雑な変更の場合に使用できなければならない
4. システムはスタック分割時に個別スタックのロールバックをサポートしなければならない
5. システムはロールバック後に自動的にリソース確認とスモークテストを実行しなければならない

#### 2.2 production-deployment-checklist.md

**反映先セクション**: 「前提条件」セクションを拡張

**推奨する追記内容**:

```markdown
### 前提条件

1. **AWS SSO認証**
   - AWS SSOプロファイル `imanishi-awssso` が設定されていること
   - `aws sso login --profile imanishi-awssso` でログイン済みであること
   - または `.\scripts\startup.ps1` で自動認証を実行

2. **開発環境の確認**
   - Node.js: v20.x以上
   - npm: 10.x以上
   - AWS CLI: 2.x以上
   - AWS CDK: 2.x以上
   - 確認コマンド: `.\scripts\deploy.ps1` の前提条件チェックを実行

3. **TypeScriptビルド**
   - `npm run build` を実行し、ビルドが成功すること
   - `dist/src/lambda/*/index.js` が存在すること
   - ビルドファイルの検証: `Test-Path dist/src/lambda/dlq-processor/index.js`

4. **環境変数の準備**
   - `.env.production` ファイルを作成（または `generate-env-file.ps1` で自動生成）
   - 本番環境のAWSアカウントIDを設定
   - 本番環境のリージョンを設定

5. **APIキーSecret**
   - 初回デプロイ時: `create-api-key-secret.ps1` で自動作成
   - 再デプロイ時: `-SkipSecretCreation` でスキップ可能
```

#### 2.3 ci-cd-guide.md

**反映先セクション**: 「GitHub Secrets設定」セクションを拡張

**推奨する追記内容**:

```markdown
### AWS SSO認証の設定

**注意**: GitHub ActionsではAWS SSOを直接使用できないため、IAMユーザー認証またはOIDC認証を使用してください。

**ローカル開発環境**:
- AWS SSOプロファイル `imanishi-awssso` を使用
- `aws sso login --profile imanishi-awssso` でログイン
- または `.\scripts\startup.ps1` で自動認証

**CI/CD環境**:
- IAMユーザー認証（シンプル）またはOIDC認証（推奨）を使用
- AWS SSOは使用しない
```

---

### 3. 推奨する具体的な文章

#### 3.1 requirements.md への追加

**挿入位置**: 要件15（DR/バックアップ戦略）の後

**追加内容**:

```markdown
### 要件16: デプロイ自動化とトレーサビリティ

**ユーザーストーリー:** ユーザーとして、デプロイプロセスが自動化され、すべてのデプロイ操作が記録されることを望む。なぜなら、手動操作によるミスを防ぎ、監査証跡を確保したいから。

#### 受入基準

1. システムはAWS SSO認証を自動的に実行し、認証状態を確認しなければならない
   - プロファイル `imanishi-awssso` を使用
   - 未認証または期限切れの場合、`aws sso login` を実行
   - 認証成功後、環境変数 `AWS_PROFILE=imanishi-awssso` を設定

2. システムはデプロイ前に前提条件を自動チェックしなければならない
   - Node.js、npm、AWS CLI、AWS CDKのバージョン確認
   - AWS認証情報の確認（`aws sts get-caller-identity`）
   - TypeScriptビルドの実行と検証

3. システムはAPIキーSecretを自動作成し、Secrets Managerに保存しなければならない
   - Secret名: `/tdnet/api-key`
   - 初回デプロイ時のみ実行
   - 再デプロイ時はスキップ可能（`-SkipSecretCreation`）

4. システムは環境変数ファイルを自動生成しなければならない
   - 環境別ファイル: `.env.local`, `.env.production`
   - AWS認証情報から自動取得: アカウントID、リージョン

5. システムはデプロイログを自動生成しなければならない
   - ファイル名: `deployment-log-[YYYYMMDD-HHMMSS].md`
   - 記録内容: 日時、環境、リージョン、AWSアカウント、デプロイ担当者、実行ステップ、ステータス

6. システムはデプロイ後に自動確認を実行しなければならない
   - リソース確認: Lambda関数、DynamoDBテーブル、S3バケット、CloudFront Distribution
   - CloudWatch Logs確認
   - CloudWatch Alarms確認
   - スモークテスト実行

#### 実装状況

- ✅ AWS SSO認証: startup.ps1、deploy.ps1に実装済み
- ✅ 前提条件チェック: deploy.ps1に実装済み
- ✅ APIキー自動作成: create-api-key-secret.ps1に実装済み
- ✅ 環境変数自動生成: generate-env-file.ps1に実装済み
- ✅ デプロイログ生成: deploy.ps1に実装済み
- ✅ デプロイ後確認: production-deployment-checklist.mdに記載済み

---

### 要件17: スタック分割デプロイ戦略

**ユーザーストーリー:** ユーザーとして、デプロイ時間を短縮し、部分的な更新を可能にしたい。なぜなら、頻繁なデプロイを効率的に実行したいから。

#### 受入基準

1. システムは4つのスタックに分割されなければならない
   - Foundation Stack: DynamoDB、S3、Secrets Manager、CloudTrail
   - Compute Stack: Lambda関数、Lambda Layers、DLQ
   - API Stack: API Gateway、WAF、CloudFront
   - Monitoring Stack: CloudWatch Alarms、CloudWatch Dashboard、SNS Topics

2. システムはスタック間の依存関係を管理しなければならない
   - デプロイ順序: Foundation → Compute → API → Monitoring
   - 削除順序: Monitoring → API → Compute → Foundation

3. システムは個別スタックのデプロイをサポートしなければならない
   - Lambda関数のみ更新: Compute Stackのみデプロイ
   - API設定のみ更新: API Stackのみデプロイ
   - 監視設定のみ更新: Monitoring Stackのみデプロイ

4. システムはデプロイ時間を短縮しなければならない
   - 初回デプロイ: 12-18分（単一スタック: 15-20分）
   - 更新デプロイ: 3-5分（単一スタック: 15-20分）
   - 短縮率: 70-90%

5. システムはスタック分割デプロイスクリプトを提供しなければならない
   - スクリプト: `deploy-split-stacks.ps1`
   - アクション: deploy、destroy、diff、synth
   - スタック指定: foundation、compute、api、monitoring、all

#### 実装状況

- ✅ スタック分割: cdk/lib/*-stack.tsに実装済み
- ✅ 依存関係管理: deploy-split-stacks.ps1に実装済み
- ✅ 個別デプロイ: deploy-split-stacks.ps1に実装済み
- ✅ デプロイ時間短縮: 実測値で確認済み

---

### 要件18: ロールバック戦略

**ユーザーストーリー:** ユーザーとして、デプロイに問題が発生した場合に迅速にロールバックできることを望む。なぜなら、システムのダウンタイムを最小化したいから。

#### 受入基準

1. システムはCloudFormationロールバックをサポートしなければならない
   - 適用条件: Lambda関数のコード変更のみ、環境変数の変更のみ
   - 実行方法: `aws cloudformation rollback-stack --stack-name <stack-name>`
   - 所要時間: 5-10分（最速）

2. システムは前のコミットへのロールバックをサポートしなければならない
   - 適用条件: コード変更のみ、新しいリソースの追加なし
   - 実行方法: `git revert <commit-hash>` → `git push origin main`（自動デプロイ）
   - 所要時間: 10-15分

3. システムは手動デプロイによるロールバックをサポートしなければならない
   - 適用条件: DynamoDBスキーマ変更あり、S3バケット削除あり、複雑な変更
   - 実行方法: `git checkout <tag>` → `npm ci` → `npx cdk deploy`
   - 所要時間: 20-30分（最終手段）

4. システムはスタック分割時の個別ロールバックをサポートしなければならない
   - 特定スタックのみロールバック: `aws cloudformation rollback-stack --stack-name <stack-name>`
   - 全スタックの削除と再作成: `deploy-split-stacks.ps1 -Action destroy` → `deploy-split-stacks.ps1 -Action deploy`

5. システムはロールバック後の確認を実行しなければならない
   - Lambda関数の動作確認
   - DynamoDBテーブルのアクセス確認
   - S3バケットのアクセス確認
   - API Gatewayのレスポンス確認
   - CloudWatch Logsのエラー確認
   - スモークテスト実行

#### 実装状況

- ✅ CloudFormationロールバック: rollback-procedures.mdに記載済み
- ✅ 前のコミットへのロールバック: rollback-procedures.mdに記載済み
- ✅ 手動デプロイ: rollback-procedures.mdに記載済み
- ✅ スタック分割ロールバック: deploy-split-stacks.ps1に実装済み
- ✅ ロールバック後確認: rollback-procedures.mdに記載済み
```

---

## 申し送り事項

### 実施すべきアクション

1. **requirements.md の更新**
   - 要件16、17、18を追加
   - 既存の要件13（デプロイ）との整合性を確認

2. **production-deployment-checklist.md の更新**
   - 「前提条件」セクションにAWS SSO認証、開発環境確認、TypeScriptビルド、APIキーSecretを追加

3. **ci-cd-guide.md の更新**
   - 「GitHub Secrets設定」セクションにAWS SSO認証の注意事項を追加

4. **関連ドキュメントの整合性確認**
   - deployment-scripts.md（既に最新）
   - rollback-procedures.md（既に最新）
   - environment-setup.md（AWS SSO認証の記載を確認）

### 注意事項

- AWS SSO認証はローカル開発環境でのみ使用可能
- GitHub ActionsではIAMユーザー認証またはOIDC認証を使用
- デプロイログは監査証跡として重要（要件13のセキュリティと連携）
- スタック分割デプロイは推奨方式として明記

---

## 完了

すべての分析と推奨事項を記載しました。
