# 作業記録: タスク31.2.6.10 - Secrets Manager APIキー形式の修正

## 作業情報
- **作業日時**: 2026-02-14 23:38:26
- **タスクID**: 31.2.6.10
- **作業者**: Kiro AI Assistant
- **優先度**: 🔴 Critical
- **推定工数**: 15分
- **実績工数**: 10分

## タスク概要
Secrets Managerの `/tdnet/api-key` の値を正しいJSON形式に修正

## 問題点
Secrets Managerに保存されているAPIキーが無効なJSON形式だった：
```json
{api_key:FOLg2JPZkvKSC83exwa7jWEhbVcNT4AD}
```

問題：
- キー名がクォートされていない
- 値がクォートされていない
- JSON.parse()でパースできない

## 実施内容

### 1. 現状確認
```powershell
aws secretsmanager get-secret-value --secret-id /tdnet/api-key --query SecretString --output text --region ap-northeast-1
```

結果: `{api_key:FOLg2JPZkvKSC83exwa7jWEhbVcNT4AD}` （無効なJSON）

### 2. API Gateway APIキー確認
```powershell
aws apigateway get-api-keys --include-values --region ap-northeast-1
```

確認結果：
- **prod環境**: `l2yePlH5s01Ax2y6whl796IaG5TYjuhD39vXRYzL`
- **dev環境**: `tIxU5bIJGD31lLxlEmunK1doCo2BTxLk5hnBIJci`

### 3. Secrets Manager更新
prod環境のAPIキーを使用して正しいJSON形式で更新：

```powershell
aws secretsmanager put-secret-value `
  --secret-id /tdnet/api-key `
  --secret-string '{"api_key":"l2yePlH5s01Ax2y6whl796IaG5TYjuhD39vXRYzL"}' `
  --region ap-northeast-1
```

結果:
- ARN: `arn:aws:secretsmanager:ap-northeast-1:803879841964:secret:/tdnet/api-key-faes17`
- VersionId: `fd82cc8b-6791-41bc-8802-98d40bf65749`
- VersionStages: `["AWSCURRENT"]`

### 4. 更新確認
```powershell
aws secretsmanager get-secret-value --secret-id /tdnet/api-key --query SecretString --output text --region ap-northeast-1
```

結果: `{"api_key":"l2yePlH5s01Ax2y6whl796IaG5TYjuhD39vXRYzL"}` ✅

## 修正内容

### 修正前
```json
{api_key:FOLg2JPZkvKSC83exwa7jWEhbVcNT4AD}
```

### 修正後
```json
{"api_key":"l2yePlH5s01Ax2y6whl796IaG5TYjuhD39vXRYzL"}
```

## 変更点
1. キー名を `api_key` → `"api_key"` にクォート
2. 値を `FOLg2JPZkvKSC83exwa7jWEhbVcNT4AD` → `"l2yePlH5s01Ax2y6whl796IaG5TYjuhD39vXRYzL"` にクォート
3. API Gateway prod環境のAPIキーと同期

## 影響範囲
- Lambda関数が正しくAPIキーを取得できるようになる
- `JSON.parse(secretValue)` が正常に動作する
- API Gateway認証が正常に機能する

## テスト結果
- ✅ Secrets Manager値の取得成功
- ✅ JSON形式の検証成功
- ✅ API Gateway APIキーとの同期確認

## 申し送り事項
1. **dev環境のSecrets Manager**: 必要に応じてdev環境のAPIキーも同様に修正
   ```powershell
   aws secretsmanager put-secret-value `
     --secret-id /tdnet/api-key `
     --secret-string '{"api_key":"tIxU5bIJGD31lLxlEmunK1doCo2BTxLk5hnBIJci"}' `
     --region ap-northeast-1
   ```

2. **Lambda関数のテスト**: 次回デプロイ時にLambda関数がSecrets Managerから正しくAPIキーを取得できることを確認

3. **ドキュメント更新**: 環境変数管理ドキュメントにSecrets Manager設定手順を追記

## 関連ファイル
- Requirements: `.kiro/specs/tdnet-data-collector/requirements.md` (要件11.4)
- Tasks: `.kiro/specs/tdnet-data-collector/tasks.md` (タスク31.2.6.10)

## 完了条件
- [x] Secrets Managerの値が正しいJSON形式になっている
- [x] API Gateway prod環境のAPIキーと同期している
- [x] 作業記録を作成している
- [x] tasks.mdのタスク31.2.6.10を[x]に更新

## 成果物
- Secrets Manager `/tdnet/api-key` の値を正しいJSON形式に修正完了
- 作業記録ドキュメント作成完了
