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

