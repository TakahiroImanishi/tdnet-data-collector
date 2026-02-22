# 作業記録: APIキー管理機能の実装

**作業日時**: 2026-02-22 10:06:18  
**タスク**: APIキー管理タスク（Phase 1: 即座に実施）  
**担当**: Kiro AI Agent

## 背景

タスク31.7.7「2026-02-13のデータ再収集」実行中に403エラー（APIキー認証エラー）が発生しました。原因は`scripts/manual-data-collection.ps1`にハードコードされたAPIキーが無効または期限切れであることです。

セキュリティベストプラクティスに従い、APIキーをSecrets Managerで管理し、スクリプトから動的に取得するように修正します。

## 実施するタスク

### Phase 1（即座に実施）
1. ✅ タスク1.1: `scripts/register-api-key.ps1`の作成
2. ⏳ タスク2.1: `scripts/manual-data-collection.ps1`の修正
3. ⏳ タスク2.4: 修正スクリプトのテスト

## 作業ログ

### タスク1.1: `scripts/register-api-key.ps1`の作成

#### 実装内容

**機能**:
- API Gatewayから既存のAPIキーを取得
- 既存のAPIキーがない場合は新規作成
- Secrets Managerにシークレットを登録/更新
- 確認プロンプト（`-Force`スイッチでスキップ可能）
- 登録確認と使用方法の表示

**パラメータ**:
- `-Environment`: 環境（dev/prod、デフォルト: prod）
- `-ApiKeyName`: APIキー名（デフォルト: tdnet-api-key）
- `-ApiKeyValue`: APIキー値（指定時はAPI Gateway取得をスキップ）
- `-Force`: 確認プロンプトをスキップ

**エラーハンドリング**:
- AWS CLIの存在確認
- API Gateway APIコールのエラーハンドリング
- Secrets Manager APIコールのエラーハンドリング
- 登録確認のエラーハンドリング

**セキュリティ考慮事項**:
- APIキーは最初の8文字のみ表示
- シークレット値はJSON形式で保存（api_key, created_at, environment, description）
- UTF-8エンコーディング設定（BOMなし）

#### 成果物

- ✅ `scripts/register-api-key.ps1`（200行）

### タスク2.1: `scripts/manual-data-collection.ps1`の修正

#### 修正方針

1. ハードコードされたAPIキーを削除（16行目）
2. Secrets ManagerからAPIキーを動的に取得
3. エラーハンドリング（Secrets Manager接続失敗時）
4. UTF-8エンコーディング設定

#### 実装内容

**変更箇所**:
- 16行目: `$ApiKey = "..."` を削除
- 新規追加: Secrets Managerからのキー取得ロジック
- エラーハンドリング: 取得失敗時のエラーメッセージ

**エラーハンドリング**:
```powershell
try {
    $secretJson = aws secretsmanager get-secret-value `
      --secret-id /tdnet/api-key-prod `
      --region ap-northeast-1 `
      --query SecretString `
      --output text
    
    $secret = $secretJson | ConvertFrom-Json
    $ApiKey = $secret.api_key
} catch {
    Write-Host "❌ APIキー取得失敗: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Secrets Managerに /tdnet/api-key-prod が登録されているか確認してください" -ForegroundColor Yellow
    exit 1
}
```



#### 成果物

- ✅ `scripts/manual-data-collection.ps1`（修正完了）
  - ハードコードされたAPIキーを削除
  - Secrets ManagerからAPIキーを動的に取得
  - エラーハンドリング追加
  - UTF-8エンコーディング設定追加
  - 対処方法の表示（Secrets Manager未登録時）

### タスク2.2: `scripts/fetch-data-range.ps1`の修正

#### 実装内容

**変更箇所**:
- 15-16行目: `$ApiKey = "..."` を削除
- 新規追加: Secrets Managerからのキー取得ロジック
- エラーハンドリング: 取得失敗時のエラーメッセージ
- UTF-8エンコーディング設定

#### 成果物

- ✅ `scripts/fetch-data-range.ps1`（修正完了）
  - ハードコードされたAPIキーを削除
  - Secrets ManagerからAPIキーを動的に取得
  - エラーハンドリング追加
  - UTF-8エンコーディング設定追加

## 成果物サマリー

### 新規作成
1. ✅ `scripts/register-api-key.ps1`（200行）
   - API Gatewayから既存のAPIキーを取得または新規作成
   - Secrets Managerにシークレットを登録/更新
   - 確認プロンプトとエラーハンドリング

### 修正
2. ✅ `scripts/manual-data-collection.ps1`
   - APIキーのハードコーディングを削除
   - Secrets Managerから動的に取得
   - 包括的なUTF-8エンコーディング設定を追加

3. ✅ `scripts/fetch-data-range.ps1`
   - APIキーのハードコーディングを削除
   - Secrets Managerから動的に取得
   - 包括的なUTF-8エンコーディング設定を追加

4. ✅ `.kiro/steering/development/powershell-encoding-guidelines.md`
   - 包括的なエンコーディング設定を追加
   - 文字化け防止のベストプラクティスを記載

5. ✅ `.kiro/steering/meta/pattern-matching-tests.md`
   - powershell-encoding-guidelines.mdのテストケースを追加
   - fileMatchPattern: `**/*.ps1`

6. ✅ `.kiro/steering/README.md`
   - powershell-encoding-guidelines.mdの情報を追加
   - 主要fileMatchパターンテーブルを更新

### 作業記録
7. ✅ `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-100618-api-key-management.md`

## 次のステップ

### タスク2.4: 修正スクリプトのテスト

1. **APIキーの登録**
   ```powershell
   # 既存のAPIキーをSecrets Managerに登録
   .\scripts\register-api-key.ps1 -Environment prod
   ```

2. **manual-data-collection.ps1のテスト**
   ```powershell
   # 2026-02-13のデータを再収集（タスク31.7.7）
   .\scripts\manual-data-collection.ps1 -StartDate "2026-02-13" -EndDate "2026-02-13"
   ```

3. **fetch-data-range.ps1のテスト**
   ```powershell
   # 2026-02-13のデータを取得
   .\scripts\fetch-data-range.ps1 -Date "2026-02-13" -Limit 10
   ```

## 申し送り事項

### 完了したタスク
- ✅ タスク1.1: `scripts/register-api-key.ps1`の作成
- ✅ タスク2.1: `scripts/manual-data-collection.ps1`の修正
- ✅ タスク2.2: `scripts/fetch-data-range.ps1`の修正

### 次のアクション
1. APIキーをSecrets Managerに登録（`register-api-key.ps1`実行）
2. 修正スクリプトのテスト実行
3. タスク31.7.7の再実行（2026-02-13のデータ再収集）
4. tasks-api-key-management.mdの更新
5. Git commit & push

### セキュリティ改善
- ✅ APIキーのハードコーディングを排除
- ✅ Secrets Managerでの安全な管理
- ✅ エラーハンドリングの強化
- ✅ UTF-8エンコーディング設定（BOMなし）

### 技術的な改善点
- Secrets Manager APIコールは有料（$0.05/10,000リクエスト）
- 将来的にキャッシュ機能の実装を検討（Phase 2: タスク2.3）
- APIキー自動ローテーション機能の実装を検討（Phase 4: タスク3.1-3.3）

---

**作業完了日時**: 2026-02-22 10:10:00
