# 04-deployment - デプロイメントドキュメント

**最終更新**: 2026-02-15

## フォルダの目的

環境構築、デプロイ、CI/CD、ロールバックに関するドキュメントを管理します。

---

## ファイル一覧

### 1. environment-setup.md
**目的**: 環境変数とAWS設定ガイド

**内容**:
- 環境変数ファイル（.env.development, .env.production）の設定
- AWS認証情報の設定
- Secrets Manager設定
- 環境別の設定差異

**対象者**: 開発者・運用担当者（初回セットアップ時）

---

### 2. cdk-bootstrap-guide.md
**目的**: CDK Bootstrap実行手順

**内容**:
- CDK Bootstrapとは
- 自動化スクリプトの使用方法
- 手動セットアップ手順
- Bootstrap実行結果の確認
- トラブルシューティング
- ベストプラクティス

**対象者**: 開発者・運用担当者（初回デプロイ前）

---

### 3. deployment-guide.md
**目的**: デプロイ手順（手動・自動）

**内容**:
- 手動デプロイ手順（CDK CLI使用）
- 自動デプロイ手順（deploy.ps1スクリプト使用）
- 分割スタックデプロイ（推奨方式）
- 単一スタックデプロイ（従来方式）
- デプロイ後の確認手順
- トラブルシューティング

**対象者**: 開発者・運用担当者（デプロイ実施時）

---

### 4. production-deployment-checklist.md
**目的**: 本番環境デプロイチェックリスト

**内容**:
- デプロイ前確認（コード品質、ドキュメント、セキュリティ、監視）
- 本番環境デプロイ手順（詳細版）
- CDK Bootstrap（初回のみ）
- 環境変数設定
- TypeScriptビルド
- CDK Synth/Diff/Deploy
- Webダッシュボードのデプロイ
- デプロイ後確認
- スモークテスト

**対象者**: 運用担当者（本番環境デプロイ時）

---

### 5. rollback-procedures.md
**目的**: ロールバック手順書

**内容**:
- ロールバックが必要な状況
- CDKスタックのロールバック（3つの方法）
- DynamoDB Point-in-Time Recovery（PITR）
- S3バージョニングによる復元
- 緊急時の対応手順（3シナリオ）
- ロールバック後の確認
- 予防措置

**対象者**: 運用担当者（トラブル発生時）

---

### 6. ci-cd-guide.md
**目的**: CI/CDパイプライン設定ガイド

**内容**:
- GitHub Actions設定
- 自動テスト実行
- 自動デプロイ設定
- 環境別のデプロイ戦略

**対象者**: 開発者・運用担当者（CI/CD構築時）

---

## 推奨される読み順

### 手動デプロイの場合
1. **environment-setup.md** - 環境変数とAWS設定を確認
2. **cdk-bootstrap-guide.md** - CDK Bootstrapを実行（初回のみ）
3. **deployment-guide.md** - デプロイを実行
4. **production-deployment-checklist.md** - 本番環境デプロイ時のチェックリストを確認

### 自動デプロイの場合
1. **ci-cd-guide.md** - CI/CDパイプラインを設定
2. **production-deployment-checklist.md** - 本番環境デプロイ時のチェックリストを確認

### トラブル発生時
- **rollback-procedures.md** - ロールバック手順を確認

---

## 関連ドキュメント

- **上位ドキュメント**: [../README.md](../README.md) - ドキュメント全体の構造
- **テスト**: [../03-testing/](../03-testing/) - テスト手順
- **運用**: [../05-operations/](../05-operations/) - 運用ガイド
- **スクリプト**: [../06-scripts/](../06-scripts/) - デプロイスクリプト
- **Steering Files**: [../../../../.kiro/steering/infrastructure/deployment-checklist.md](../../../../.kiro/steering/infrastructure/deployment-checklist.md) - デプロイチェックリスト

---

## デプロイコマンド早見表

### 手動デプロイ

```powershell
# 開発環境
cd cdk
npx cdk bootstrap  # 初回のみ
npx cdk deploy --context environment=dev

# 本番環境
npx cdk deploy --context environment=prod --require-approval always
```

### 自動デプロイ（推奨）

```powershell
# 開発環境（全自動）
.\scripts\deploy.ps1 -Environment dev

# 本番環境（全自動）
.\scripts\deploy.ps1 -Environment prod
```

### 分割スタックデプロイ（推奨）

```powershell
# 全スタックをデプロイ
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack all

# 個別スタックのみデプロイ
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack compute
```

### ロールバック

```powershell
# CloudFormationロールバック
aws cloudformation rollback-stack --stack-name TdnetDataCollectorStack-prod

# 前のバージョンにロールバック
git checkout v1.2.2
npm ci && npm run build
cdk deploy --context environment=prod
```

---

## デプロイ方式の選択

| 方式 | 実行時間 | 推奨度 | 用途 |
|------|---------|--------|------|
| **分割スタックデプロイ** | 12-18分（初回）<br>3-5分（更新） | ⭐⭐⭐ | 本番環境・開発環境 |
| **単一スタックデプロイ** | 15-20分 | ⭐⭐ | 従来方式（互換性） |
| **自動デプロイスクリプト** | 20-25分 | ⭐⭐⭐ | 初回セットアップ |

**推奨**: 新規デプロイは分割スタック方式を使用してください。詳細は `deployment-guide.md` を参照。

---

**最終更新**: 2026-02-15  
**作成者**: TDnet Data Collector Team
