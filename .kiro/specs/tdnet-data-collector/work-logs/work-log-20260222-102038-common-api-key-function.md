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



**成果物**:
- `scripts/common/Get-TdnetApiKey.ps1` (約150行)
- `scripts/common/README.md` (使用方法とドキュメント)
- `scripts/common/__tests__/Get-TdnetApiKey.test.ps1` (テストスクリプト)

### 4. テスト実行

**テスト結果**:
```
========================================
Get-TdnetApiKey.ps1 Test Script
========================================

[Test 1] Script file existence check
OK PASS: Script file exists

[Test 2] Environment variable fallback
OK API key retrieved (environment variable)
OK PASS: Get API key from environment variable

[Test 3] Secrets Manager retrieval (prod)
-- SKIP: Get prod API key
   Reason: Requires valid Secrets Manager configuration

[Test 4] VerboseLog option
OK PASS: VerboseLog option works

========================================
Test Summary
========================================
OK Passed: 3
NG Failed: 0
-- Skipped: 1
Total: 4

OK All tests passed
```

**テスト項目**:
1. ✅ スクリプトファイルの存在確認
2. ✅ 環境変数フォールバック機能
3. ⏭️ Secrets Manager取得（本番環境設定が必要なためスキップ）
4. ✅ VerboseLogオプション

## 問題と解決策

### 問題1: fsWriteツールでの文字化け

**現象**: fsWriteで作成したPowerShellスクリプトが文字化けした

**原因**: fsWriteツールのエンコーディング処理の問題

**解決策**: PowerShellの`[System.IO.File]::WriteAllText()`を使用してUTF-8 BOMなしで直接作成

### 問題2: Verboseパラメータの競合

**現象**: `-Verbose`パラメータが重複定義エラー

**原因**: PowerShellの共通パラメータ`-Verbose`と競合

**解決策**: カスタムパラメータ名を`-VerboseLog`に変更

### 問題3: テストスクリプトのパス指定

**現象**: PowerShell 5.1で`Join-Path`が3つのパラメータを受け付けない

**原因**: PowerShell 5.1の`Join-Path`は2つのパラメータのみサポート

**解決策**: ネストした`Join-Path`を使用: `Join-Path (Join-Path $PSScriptRoot "..") "Get-TdnetApiKey.ps1"`

## 成果物

### 1. scripts/common/Get-TdnetApiKey.ps1

**機能**:
- Secrets ManagerからAPIキーを取得
- 環境変数`TDNET_API_KEY`のフォールバック
- キャッシュ機能（スクリプト実行中）
- 統一されたエラーハンドリング
- 詳細ログ出力（`-VerboseLog`オプション）

**パラメータ**:
- `Environment`: 環境名（prod/dev、デフォルト: prod）
- `NoCache`: キャッシュを使用しない
- `VerboseLog`: 詳細ログ出力

**使用例**:
```powershell
# 基本的な使用
$apiKey = .\scripts\common\Get-TdnetApiKey.ps1

# 開発環境
$apiKey = .\scripts\common\Get-TdnetApiKey.ps1 -Environment dev

# キャッシュなし
$apiKey = .\scripts\common\Get-TdnetApiKey.ps1 -NoCache

# 詳細ログ付き
$apiKey = .\scripts\common\Get-TdnetApiKey.ps1 -VerboseLog
```

### 2. scripts/common/README.md

**内容**:
- 機能説明
- 使用方法
- パラメータ詳細
- フォールバック順序
- エラーハンドリング
- 既存スクリプトでの使用例
- セキュリティ考慮事項
- パフォーマンス情報

### 3. scripts/common/__tests__/Get-TdnetApiKey.test.ps1

**テスト項目**:
- スクリプトファイルの存在確認
- 環境変数フォールバック機能
- Secrets Manager取得（スキップ可能）
- VerboseLogオプション

## 申し送り事項

### 次のステップ

1. **既存スクリプトの更新**（タスク2.4）:
   - `scripts/manual-data-collection.ps1`
   - `scripts/fetch-data-range.ps1`
   - 上記スクリプトで共通関数を使用するように修正

2. **本番環境でのテスト**:
   - Secrets Managerに`/tdnet/api-key-prod`が正しく登録されているか確認
   - 共通関数が正常に動作するか確認

3. **ドキュメント更新**:
   - `tasks-api-key-management.md`のタスク2.3を完了に更新
   - セキュリティベストプラクティスに共通関数の使用を追加

### 注意事項

1. **環境変数の優先順位**:
   - `TDNET_API_KEY`環境変数が設定されている場合は、それが優先使用される
   - 本番環境では環境変数を設定しないことを推奨

2. **キャッシュの有効範囲**:
   - キャッシュはスクリプトスコープ変数に保存される
   - スクリプト終了時に自動的に破棄される
   - セキュリティ上、永続的なキャッシュは実装していない

3. **エラーハンドリング**:
   - Secrets Manager接続失敗時は詳細なエラーメッセージと対処方法を表示
   - エラー時は例外をスローするため、呼び出し元でtry-catchが必要

4. **ファイルエンコーディング**:
   - すべてのファイルはUTF-8 BOMなしで作成済み
   - PowerShellの`[System.IO.File]::WriteAllText()`を使用して確実にBOMなしで作成

## 関連ファイル

- `.kiro/specs/tdnet-data-collector/tasks/tasks-api-key-management.md`
- `scripts/manual-data-collection.ps1`
- `scripts/fetch-data-range.ps1`
- `scripts/register-api-key.ps1`
- `.kiro/steering/core/file-encoding-rules.md`
- `.kiro/steering/development/powershell-encoding-guidelines.md`
