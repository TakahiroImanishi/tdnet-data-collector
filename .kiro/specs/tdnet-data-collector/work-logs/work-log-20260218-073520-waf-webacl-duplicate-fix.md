# 作業記録: WAF WebACL重複エラー解消

**作業日時**: 2026-02-18 07:35:20  
**作業者**: AI Assistant  
**作業概要**: WAF WebACLの重複エラーを解消

## 問題分析

### エラー内容
- TdnetApi-prod スタックのデプロイ時にWAF WebACLの重複エラーが発生
- 原因: WAFを別のスタックに定義し直したが、再デプロイしていない

### 現状確認

1. **WAF定義場所**: `cdk/lib/stacks/api-stack.ts` (107行目)
   - `WafConstruct`がAPI Stack内で作成されている
   - API Gateway Stage ARNに関連付けられている

2. **スタック構成** (`cdk/bin/tdnet-data-collector-split.ts`):
   - Foundation Stack → Compute Stack → API Stack → Monitoring Stack
   - WAFはAPI Stackに含まれている

3. **問題の原因**:
   - 既存の本番環境に古いWAF WebACLが残っている
   - 新しいスタック構成でデプロイしようとすると、同じAPI Gatewayに対して2つのWAFが関連付けられようとする

## 解決策

### オプション1: 既存WAFを手動削除してから再デプロイ（推奨）
1. AWS ConsoleでWAF WebACLの関連付けを解除
2. 古いWAF WebACLを削除
3. `cdk deploy TdnetApi-prod`を実行

### オプション2: スタック全体を再デプロイ
1. `scripts/deploy-split-stacks.ps1 -Environment prod`を実行
2. 全スタックを順番に更新

### オプション3: WAFを一時的に無効化してデプロイ
1. `api-stack.ts`からWAF Constructを一時的にコメントアウト
2. デプロイして古いWAFを削除
3. WAF Constructを元に戻してデプロイ

## 実施内容

### 1. 診断スクリプト作成
**ファイル**: `scripts/check-waf-status.ps1`

機能:
- WAF WebACLの一覧を取得
- 各WebACLに関連付けられているリソースを表示
- 対象のAPI Gatewayを特定
- Stage ARNを表示

使用方法:
```powershell
.\scripts\check-waf-status.ps1 -Environment prod
```

### 2. 修正スクリプト作成
**ファイル**: `scripts/fix-waf-duplicate.ps1`

機能:
- 既存のWAF WebACL (`tdnet-web-acl-{env}`) を検索
- API Gatewayとの関連付けを解除
- WAF WebACLを削除
- 次のステップを表示

使用方法:
```powershell
# Dry Runモード（実際の削除は行わない）
.\scripts\fix-waf-duplicate.ps1 -Environment prod -DryRun

# 実際に削除
.\scripts\fix-waf-duplicate.ps1 -Environment prod
```

### 3. 実行手順

#### ステップ1: 現状確認
```powershell
.\scripts\check-waf-status.ps1 -Environment prod
```

#### ステップ2: Dry Run実行
```powershell
.\scripts\fix-waf-duplicate.ps1 -Environment prod -DryRun
```

#### ステップ3: WAF削除実行
```powershell
.\scripts\fix-waf-duplicate.ps1 -Environment prod
```

#### ステップ4: API Stackを再デプロイ
```powershell
cd cdk
cdk deploy TdnetApi-prod
```

または、全スタックを再デプロイ:
```powershell
.\scripts\deploy-split-stacks.ps1 -Environment prod
```

## 技術的詳細

### WAF WebACL重複エラーの原因
1. **既存のWAF**: 以前のデプロイで作成されたWAF WebACLが残っている
2. **新しいWAF**: 新しいスタック構成でWAFを作成しようとする
3. **競合**: 同じAPI Gateway Stageに対して2つのWAFを関連付けることはできない

### CloudFormationの動作
- CloudFormationは既存リソースを自動的に削除しない
- スタック外で作成されたリソースは手動削除が必要
- WAF WebACLAssociationは1つのStageに対して1つのみ

### 解決方法
1. **手動削除**: 既存のWAFを手動で削除してから再デプロイ（今回の方法）
2. **Import**: 既存のWAFをスタックにインポート（複雑）
3. **名前変更**: 新しいWAFに別の名前を付ける（非推奨）

## 成果物

- [x] `scripts/check-waf-status.ps1` - WAF状態確認スクリプト
- [x] `scripts/fix-waf-duplicate.ps1` - WAF重複エラー修正スクリプト
- [x] 作業記録作成

## 申し送り事項

### 次のタスク
1. 本番環境でスクリプトを実行してWAFを削除
2. API Stackを再デプロイ
3. WAFが正しく作成されたことを確認
4. API Gatewayとの関連付けを確認

### 注意事項
- **本番環境での実行**: 必ずDry Runモードで確認してから実行
- **ダウンタイム**: WAF削除から再作成までの間、WAF保護が無効になる（数分程度）
- **バックアップ**: 既存のWAF設定を確認してから削除
- **権限**: `wafv2:*`および`apigateway:*`権限が必要

### トラブルシューティング
- **Lock Token エラー**: WAFが他のプロセスで使用中。数分待ってから再試行
- **関連付け解除エラー**: API Gatewayが存在しない可能性。手動で確認
- **削除エラー**: WAFにルールが関連付けられている可能性。手動で確認

## 関連ドキュメント
- `cdk/lib/stacks/api-stack.ts` - WAF定義
- `cdk/lib/constructs/waf.ts` - WAF Construct実装
- `.kiro/steering/infrastructure/deployment-checklist.md` - デプロイ手順

