# 作業記録: 共通APIキー取得関数の作成

**作成日時**: 2026-02-22 10:20:38  
**タスク**: タスク2.3 - 共通関数の作成  
**担当**: Kiro AI Assistant  
**関連タスクファイル**: `.kiro/specs/tdnet-data-collector/tasks/tasks-api-key-management.md`

## 作業概要

Secrets ManagerからAPIキーを取得する共通関数`Get-TdnetApiKey.ps1`を作成し、既存スクリプトのロジックを共通化します。

## 実施内容

### 1. 既存スクリプトの分析

**確認したファイル**:
- `scripts/manual-data-collection.ps1`
- `scripts/fetch-data-range.ps1`

**共通パターン**:
- Secrets Managerから`/tdnet/api-key-{environment}`を取得
- JSONパース後、`api_key`フィールドを抽出
- エラーハンドリング（接続失敗時の詳細メッセージ）
- 環境変数フォールバック機能は未実装

### 2. 共通関数の設計

**機能要件**:
1. Secrets Managerからのキー取得
2. キャッシュ機能（スクリプト実行中のキャッシュ）
3. 環境変数`TDNET_API_KEY`のフォールバック
4. 統一されたエラーハンドリング
5. 詳細なログ出力（オプション）

**パラメータ**:
- `Environment`: 環境名（prod/dev、デフォルト: prod）
- `NoCache`: キャッシュを使用しない（スイッチ）
- `Verbose`: 詳細ログ出力（スイッチ）

### 3. 実装

