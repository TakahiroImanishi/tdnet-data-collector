# 作業記録: Secrets Manager APIキー取得の改善

**作業日時**: 2026-02-23 08:03:43  
**タスク**: タスク6.2.2 - Secrets Manager APIキー取得の改善  
**担当**: Kiro AI Assistant

## 作業概要

Secrets ManagerからのAPIキー取得処理を共通化し、キャッシュ機能を追加してパフォーマンスを改善します。

## 現状分析

### 問題点

1. **API関数での直接環境変数使用**
   - `pdf-download/handler.ts`: `process.env.API_KEY`を直接使用
   - `export-status/handler.ts`: API認証なし（要確認）
   - Secrets Managerからの取得が未実装

2. **キャッシュ機能なし**
   - 毎回Secrets Manager APIを呼び出すとコストとレイテンシが増加
   - Lambda実行間でキャッシュを共有できていない

3. **エラーハンドリング不足**
   - Secrets Manager取得失敗時の適切なエラーハンドリングが必要

### 実装方針

1. **共通ユーティリティ作成**: `src/utils/secrets-manager.ts`
   - Secrets Managerからのシークレット取得
   - メモリキャッシュ機能（TTL付き）
   - エラーハンドリング（再試行、フォールバック）

2. **API関数の更新**
   - `pdf-download/handler.ts`: 共通ユーティリティを使用
   - 他のAPI関数も同様に更新

3. **テスト実装**
   - ユニットテスト: キャッシュ動作、エラーハンドリング
   - 統合テスト: Secrets Manager連携

## 実装内容

### 1. Secrets Manager共通ユーティリティ作成


#### ファイル: `src/utils/secrets-manager.ts`

```typescript
// 主要機能
- getSecret(): Secrets Managerからシークレット取得（キャッシュ付き）
- getApiKey(): APIキー専用ヘルパー関数
- clearCache(): キャッシュクリア（テスト用）

// キャッシュ機能
- デフォルトTTL: 5分
- メモリキャッシュ（Lambda実行間で共有）
- 有効期限チェック

// エラーハンドリング
- Retryable: ThrottlingException, InternalServiceError, ServiceUnavailableException
- Non-Retryable: ResourceNotFoundException, InvalidRequestException
- 指数バックオフ再試行（最大3回）
```

#### ファイル: `src/utils/__tests__/secrets-manager.test.ts`

16個のテストケース実装:
- シークレット取得（正常系）
- キャッシュ動作（2回目はキャッシュから取得）
- キャッシュバイパス（noCache オプション）
- キャッシュ有効期限切れ
- エラーハンドリング（ResourceNotFoundException等）
- 再試行動作（ThrottlingException等）
- getApiKey()関数のテスト

**テスト結果**: 全16テスト成功 ✅

### 2. API関数の更新

#### ファイル: `src/lambda/api/pdf-download/handler.ts`

変更内容:
- `import { getApiKey } from '../../../utils/secrets-manager'` 追加
- `validateApiKey()` を非同期関数に変更
- 環境変数`API_KEY`の代わりに`getApiKey()`を使用
- Secrets Manager取得失敗時のエラーハンドリング追加

#### ファイル: `src/lambda/api/pdf-download/__tests__/handler.test.ts`

変更内容:
- `secrets-manager`モジュールをモック
- `getApiKey()`関数をモック（デフォルト: 'test-api-key'）
- テストケース更新: 「Secrets ManagerからAPIキー取得失敗時は401エラーを返す」
- 不要な環境変数設定を削除

**テスト結果**: 全22テスト成功 ✅

### 3. その他のAPI関数

確認結果:
- `export-status/handler.ts`: API認証なし（認証不要のエンドポイント）
- `query-disclosures`: 存在しない（未実装）

## テスト結果

### ユニットテスト

```bash
# Secrets Manager ユーティリティ
npm test -- src/utils/__tests__/secrets-manager.test.ts
✅ 16 passed

# PDF Download Handler
npm test -- src/lambda/api/pdf-download/__tests__/handler.test.ts
✅ 22 passed
```

## 成果物

### 新規作成
1. `src/utils/secrets-manager.ts` - Secrets Manager共通ユーティリティ
2. `src/utils/__tests__/secrets-manager.test.ts` - ユニットテスト

### 更新
1. `src/lambda/api/pdf-download/handler.ts` - Secrets Manager統合
2. `src/lambda/api/pdf-download/__tests__/handler.test.ts` - テスト更新

## 改善効果

### パフォーマンス
- **キャッシュによるレイテンシ削減**: 2回目以降のAPIキー取得は即座に完了
- **Secrets Manager API呼び出し削減**: 5分間キャッシュにより、コスト削減

### 保守性
- **共通化**: APIキー取得ロジックを1箇所に集約
- **テスタビリティ**: モック化が容易
- **拡張性**: 他のシークレット取得にも再利用可能

### セキュリティ
- **環境変数からの移行**: Secrets Managerによる集中管理
- **ローテーション対応**: キャッシュTTLにより、ローテーション後も自動更新

## 申し送り事項

### 今後の対応

1. **他のAPI関数への適用**
   - 現在は`pdf-download`のみ対応
   - 今後追加されるAPI関数でも`getApiKey()`を使用

2. **CDK設定の確認**
   - Lambda関数にSecrets Manager読み取り権限が付与されているか確認
   - 環境変数`API_KEY_SECRET_NAME`の設定（デフォルト: `/tdnet/api-key`）

3. **監視・アラート**
   - Secrets Manager取得失敗のCloudWatchメトリクス監視
   - 認証エラー率の監視

### 注意事項

- **キャッシュTTL**: デフォルト5分、必要に応じて調整可能
- **Lambda実行間でのキャッシュ共有**: 同一コンテナ内でのみ有効
- **コールドスタート**: 初回実行時はSecrets Manager APIを呼び出し

## 関連ドキュメント

- `.kiro/steering/core/tdnet-implementation-rules.md` - 実装ルール
- `.kiro/steering/development/lambda-guide.md` - Lambda実装ガイド
- `.kiro/steering/core/error-handling-patterns.md` - エラーハンドリング
- `.kiro/specs/tdnet-data-collector/03-tasks/tasks-step-functions-migration.md` - タスク定義
