# APIキー管理タスク

**作成日時**: 2026-02-22 10:04:42  
**目的**: Secrets ManagerでのAPIキー管理を自動化し、セキュリティを向上させる

## 概要

本番環境のAPIキーをSecrets Managerで安全に管理し、スクリプトから動的に取得できるようにします。これにより、APIキーのハードコーディングを排除し、セキュリティリスクを低減します。

## タスクリスト

### タスク1: Secrets ManagerにAPIキーを登録するスクリプトの作成

- [x] 1.1 `scripts/register-api-key.ps1`の作成
  - API Gatewayから新しいAPIキーを作成
  - Secrets Managerに登録（シークレット名: `/tdnet/api-key`）
  - 既存のシークレットがある場合は更新
  - 実行確認とロールバック機能
  - _Requirements: 要件11.4, 13.4（APIキー管理、シークレット管理）_
  - _優先度: 🔴 Critical_
  - _推定工数: 2-3時間_
  - _完了: 2026-02-22 10:06:18_
  - _成果物: scripts/register-api-key.ps1（200行）_

- [ ] 1.2 登録スクリプトのドキュメント作成
  - 使用方法の説明
  - 前提条件（AWS CLI、IAM権限）
  - トラブルシューティング
  - _Requirements: 要件13.1（ドキュメント）_
  - _優先度: 🟡 Medium_
  - _推定工数: 1時間_

- [ ] 1.3 登録スクリプトのテスト
  - 開発環境でのテスト実行
  - エラーハンドリングの確認
  - ロールバック機能の確認
  - _Requirements: 要件14.1（テスト）_
  - _優先度: 🟠 High_
  - _推定工数: 1-2時間_

### タスク2: Secrets ManagerからAPIキーを取得する機能の実装

- [x] 2.1 `scripts/manual-data-collection.ps1`の修正
  - ハードコードされたAPIキーを削除
  - Secrets ManagerからAPIキーを動的に取得
  - エラーハンドリング（Secrets Manager接続失敗時）
  - キャッシュ機能（複数回実行時の最適化）
  - _Requirements: 要件11.4, 13.4（APIキー管理、シークレット管理）_
  - _優先度: 🔴 Critical_
  - _推定工数: 2-3時間_
  - _完了: 2026-02-22 10:08:00_
  - _成果物: scripts/manual-data-collection.ps1（修正完了）_

- [x] 2.2 `scripts/fetch-data-range.ps1`の修正
  - ハードコードされたAPIキーを削除
  - Secrets ManagerからAPIキーを動的に取得
  - エラーハンドリング
  - _Requirements: 要件11.4, 13.4（APIキー管理、シークレット管理）_
  - _優先度: 🟠 High_
  - _推定工数: 1-2時間_
  - _完了: 2026-02-22 10:09:00_
  - _成果物: scripts/fetch-data-range.ps1（修正完了）_

- [ ] 2.3 共通関数の作成（オプション）
  - `scripts/common/Get-TdnetApiKey.ps1`の作成
  - Secrets Managerからのキー取得ロジックを共通化
  - キャッシュ機能の実装
  - エラーハンドリングの統一
  - _Requirements: 要件11.4（APIキー管理）_
  - _優先度: 🟡 Medium_
  - _推定工数: 2-3時間_

- [ ] 2.4 修正スクリプトのテスト
  - 開発環境でのテスト実行
  - 本番環境でのテスト実行
  - エラーハンドリングの確認
  - パフォーマンスの確認（キャッシュ効果）
  - _Requirements: 要件14.1（テスト）_
  - _優先度: 🔴 Critical_
  - _推定工数: 2-3時間_

### タスク3: APIキーローテーション機能の実装（Phase 4）

- [ ] 3.1 APIキー自動ローテーションLambdaの実装
  - 新しいAPIキーの作成
  - Secrets Managerの更新
  - 古いAPIキーの無効化（猶予期間あり）
  - CloudWatch Logsへのログ記録
  - _Requirements: 要件11.4（APIキー管理）_
  - _優先度: 🟡 Medium（Phase 4）_
  - _推定工数: 4-6時間_

- [ ] 3.2 ローテーションスケジュールの設定
  - EventBridgeルールの作成（90日ごと）
  - Lambda関数のトリガー設定
  - SNS通知の設定（ローテーション成功/失敗）
  - _Requirements: 要件11.4（APIキー管理）_
  - _優先度: 🟡 Medium（Phase 4）_
  - _推定工数: 2-3時間_

- [ ] 3.3 ローテーション機能のテスト
  - 手動ローテーションのテスト
  - 自動ローテーションのテスト
  - ロールバック機能のテスト
  - _Requirements: 要件14.1（テスト）_
  - _優先度: 🟡 Medium（Phase 4）_
  - _推定工数: 3-4時間_

### タスク4: ドキュメント化

- [ ] 4.1 APIキー管理ガイドの作成
  - `docs/guides/api-key-management.md`の作成
  - 登録手順の説明
  - 取得手順の説明
  - ローテーション手順の説明
  - トラブルシューティング
  - _Requirements: 要件13.1（ドキュメント）_
  - _優先度: 🟠 High_
  - _推定工数: 2-3時間_

- [ ] 4.2 セキュリティベストプラクティスの更新
  - `steering/security/security-best-practices.md`の更新
  - APIキー管理のベストプラクティスを追加
  - Secrets Manager使用のガイドライン
  - _Requirements: 要件13.1（ドキュメント）_
  - _優先度: 🟡 Medium_
  - _推定工数: 1時間_

## 実装の優先順位

### Phase 1（即座に実施）
1. タスク1.1: 登録スクリプトの作成（Critical）
2. タスク2.1: manual-data-collection.ps1の修正（Critical）
3. タスク2.4: 修正スクリプトのテスト（Critical）

### Phase 2（1週間以内）
4. タスク2.2: fetch-data-range.ps1の修正（High）
5. タスク4.1: APIキー管理ガイドの作成（High）
6. タスク1.2: 登録スクリプトのドキュメント作成（Medium）

### Phase 3（2週間以内）
7. タスク2.3: 共通関数の作成（Medium）
8. タスク4.2: セキュリティベストプラクティスの更新（Medium）

### Phase 4（将来の改善）
9. タスク3.1-3.3: APIキーローテーション機能（Medium）

## 技術仕様

### Secrets Manager構造

```json
{
  "SecretId": "/tdnet/api-key",
  "SecretString": "{\"api_key\":\"xxxxx\",\"created_at\":\"2026-02-22T10:00:00Z\",\"environment\":\"prod\"}"
}
```

### PowerShellでのAPIキー取得

```powershell
# Secrets Managerから取得
$secretJson = aws secretsmanager get-secret-value `
  --secret-id /tdnet/api-key `
  --region ap-northeast-1 `
  --query SecretString `
  --output text

$secret = $secretJson | ConvertFrom-Json
$ApiKey = $secret.api_key
```

### エラーハンドリング

```powershell
try {
    $ApiKey = Get-TdnetApiKey -Environment "prod"
} catch {
    Write-Host "❌ APIキー取得失敗: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Secrets Managerに /tdnet/api-key が登録されているか確認してください" -ForegroundColor Yellow
    exit 1
}
```

## セキュリティ考慮事項

1. **APIキーのハードコーディング禁止**
   - すべてのスクリプトでSecrets Managerから動的に取得
   - Git履歴からAPIキーを削除（git filter-branch）

2. **IAM権限の最小化**
   - スクリプト実行ユーザーには`secretsmanager:GetSecretValue`のみ付与
   - APIキー作成・更新は管理者のみ

3. **監査ログの記録**
   - CloudTrailでSecrets Managerへのアクセスを記録
   - 不正アクセスの検知

4. **APIキーのローテーション**
   - 90日ごとに自動ローテーション（Phase 4）
   - 古いキーは猶予期間後に無効化

## 関連ドキュメント

- `steering/security/security-best-practices.md`
- `steering/development/data-scripts.md`
- `steering/infrastructure/deployment-scripts.md`
- `cdk/lib/constructs/secrets-manager.ts`
- `scripts/create-api-key-secret.ps1`（既存）

## 成功基準

- [ ] すべてのスクリプトでAPIキーがハードコードされていない
- [ ] Secrets Managerからのキー取得が正常に動作する
- [ ] エラーハンドリングが適切に実装されている
- [ ] ドキュメントが完備されている
- [ ] 本番環境でのテストが成功する

## 注意事項

1. **既存のAPIキーの扱い**
   - 現在ハードコードされているAPIキーは、新しいキーに置き換え後に無効化
   - Git履歴からの削除を検討（セキュリティリスク）

2. **後方互換性**
   - 環境変数`TDNET_API_KEY`が設定されている場合は、それを優先使用
   - Secrets Manager接続失敗時のフォールバック機能

3. **パフォーマンス**
   - Secrets Manager APIコールは有料（$0.05/10,000リクエスト）
   - キャッシュ機能で不要なAPIコールを削減

4. **テスト環境**
   - 開発環境用のシークレット（`/tdnet/api-key-dev`）を別途作成
   - 本番環境と開発環境を明確に分離
