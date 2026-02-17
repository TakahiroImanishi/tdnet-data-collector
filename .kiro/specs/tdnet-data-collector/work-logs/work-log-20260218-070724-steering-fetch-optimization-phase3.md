# Steering Files Fetch Optimization - Phase 3

**作業日時**: 2026-02-18 07:07:24  
**作業概要**: steeringファイルのフェッチ最適化Phase 3 - 検証と微調整

## Phase 3の目的

Phase 1とPhase 2で実施した最適化の効果を検証し、残りの最適化可能性を探る。

## 現状分析

### 現在のsteeringファイル構成

**core/** (常時読み込み - 3ファイル):
- tdnet-implementation-rules.md (171語)
- tdnet-data-collector.md (141語)
- error-handling-patterns.md (136語)
- 合計: 448語

**development/** (条件付き - 14ファイル):
- mcp-documentation-guidelines.md (200語)
- mcp-server-guidelines.md (250語)
- lambda-implementation.md (279語)
- error-handling-implementation.md (280語)
- その他10ファイル

**infrastructure/** (条件付き - 7ファイル):
- cdk-implementation.md (250語) - 新規
- その他6ファイル

**security/** (条件付き - 1ファイル)
**api/** (条件付き - 2ファイル)
**meta/** (条件付き - 1ファイル)

### 残りの最適化可能性

#### 1. Lambda関連パターンの階層化

**現状**: lambda-implementation.mdが`**/lambda/**/*.ts`全体にマッチ

**問題点**: Lambda関数のエントリーポイント（handler.ts, index.ts）編集時も、内部ユーティリティ編集時も同じガイドラインが読み込まれる

**提案**: 2つに分割
1. **lambda-implementation.md** - エントリーポイント専用
   - パターン: `**/lambda/**/handler.ts|**/lambda/**/index.ts`
   - 内容: メモリ、タイムアウト、環境変数検証の基本設定

2. **lambda-utils-implementation.md** - 内部実装専用（新規）
   - パターン: `**/lambda/**/utils/**/*.ts|**/lambda/**/helpers/**/*.ts|**/lambda/**/lib/**/*.ts`
   - 内容: Lambda内部のユーティリティ実装パターン

**効果**: エントリーポイント編集時は基本設定のみ、内部実装編集時は詳細パターンを読み込み

**判断**: 実施する（Lambda関数の構造が明確に分かれているため）

#### 2. API関連パターンの統合

**現状**: 
- api-design-guidelines.md: `**/api/**/*.ts`
- error-codes.md: `**/api/**/*.ts|**/routes/**/*.ts`

**問題点**: API実装時に2つのsteeringファイルが読み込まれる

**提案**: error-codes.mdのパターンを特定化
- 変更後: `**/api/**/errors/**/*.ts|**/api/**/error-codes.ts`

**効果**: エラーコード定義ファイル編集時のみerror-codes.mdが読み込まれる

**判断**: 実施する（エラーコード定義は特定のファイルに限定されるため）

#### 3. テスト関連パターンの特定化

**現状**: testing-strategy.mdが`**/*.test.ts|**/*.spec.ts`全体にマッチ

**問題点**: すべてのテストファイル編集時に読み込まれる

**提案**: 変更なし（テスト戦略はすべてのテストファイルで共通のため）

**判断**: 実施しない

#### 4. スクリプト関連パターンの統合

**現状**: 
- deployment-scripts.md: `scripts/deploy*.ps1`
- setup-scripts.md: `scripts/{create-api-key-secret,generate-env-file,localstack-setup}.ps1`
- data-scripts.md: `scripts/{fetch-data-range,manual-data-collection,migrate-disclosure-fields}.*`
- monitoring-scripts.md: `scripts/{deploy-dashboard,check-iam-permissions}.ps1`

**問題点**: スクリプト編集時に複数のsteeringファイルが読み込まれる可能性

**提案**: scripts-implementation.md（新規）に統合
- パターン: `scripts/**/*.ps1|scripts/**/*.ts`
- 内容: スクリプト実装時の共通ガイドライン（エンコーディング、エラーハンドリング、ログ）

既存ファイルのパターンを特定化:
- deployment-scripts.md: 内容のみ維持（パターン削除、manual inclusionに変更）
- setup-scripts.md: 内容のみ維持（パターン削除、manual inclusionに変更）
- data-scripts.md: 内容のみ維持（パターン削除、manual inclusionに変更）
- monitoring-scripts.md: 内容のみ維持（パターン削除、manual inclusionに変更）

**判断**: 実施する（スクリプト実装時の共通ガイドラインが必要）

## Phase 3実装計画

### 優先度: 高
1. ✅ Lambda関連パターンの階層化
2. ✅ API関連パターンの特定化
3. ✅ スクリプト関連パターンの統合

### 優先度: 中
4. 実際の使用状況に基づく微調整

### 優先度: 低
5. 定期的なレビュー（3ヶ月ごと）


## Phase 3実装完了

### 優先度: 高（完了）

#### 1. Lambda関連パターンの階層化 ✅

**lambda-implementation.md**:
- 変更前: `**/lambda/**/*.ts`
- 変更後: `**/lambda/**/handler.ts|**/lambda/**/index.ts`
- 効果: Lambda関数エントリーポイント専用に特定化

**lambda-utils-implementation.md**（新規作成）:
- パターン: `**/lambda/**/utils/**/*.ts|**/lambda/**/helpers/**/*.ts|**/lambda/**/lib/**/*.ts|**/lambda/**/*.ts`
- 内容: Lambda内部のユーティリティ・ヘルパー実装パターン
- 効果: Lambda内部実装編集時に詳細パターンを読み込み

#### 2. API関連パターンの特定化 ✅

**error-codes.md**:
- 変更前: `**/api/**/*.ts|**/routes/**/*.ts`
- 変更後: `**/api/**/errors/**/*.ts|**/api/**/error-codes.ts|**/errors/**/*.ts`
- 効果: エラーコード定義ファイル編集時のみ読み込み

#### 3. スクリプト関連パターンの統合 ✅

**scripts-implementation.md**（新規作成）:
- パターン: `scripts/**/*.ps1|scripts/**/*.ts`
- 内容: スクリプト実装時の共通ガイドライン（エンコーディング、エラーハンドリング、ログ）
- 効果: すべてのスクリプト編集時に共通ガイドラインを読み込み

**既存ファイルをmanual inclusionに変更**:
- deployment-scripts.md: `inclusion: manual`
- setup-scripts.md: `inclusion: manual`
- data-scripts.md: `inclusion: manual`
- monitoring-scripts.md: `inclusion: manual`
- 効果: 自動読み込みされず、必要時に手動で参照

## 最適化効果の検証

### Lambda関数エントリーポイント編集時（例: `src/lambda/collector/handler.ts`）

**Phase 2後**: 5ファイル読み込み
1. core/tdnet-implementation-rules.md (常時)
2. core/tdnet-data-collector.md (常時)
3. core/error-handling-patterns.md (常時)
4. development/lambda-implementation.md
5. development/mcp-server-guidelines.md

**Phase 3後**: 5ファイル読み込み（変更なし）
- lambda-implementation.mdがエントリーポイント専用に特定化

### Lambda内部ユーティリティ編集時（例: `src/lambda/collector/utils/parser.ts`）

**Phase 2後**: 4ファイル読み込み
1. core/tdnet-implementation-rules.md (常時)
2. core/tdnet-data-collector.md (常時)
3. core/error-handling-patterns.md (常時)
4. development/mcp-server-guidelines.md

**Phase 3後**: 5ファイル読み込み
1. core/tdnet-implementation-rules.md (常時)
2. core/tdnet-data-collector.md (常時)
3. core/error-handling-patterns.md (常時)
4. development/lambda-utils-implementation.md（新規）
5. development/mcp-server-guidelines.md

**効果**: Lambda内部実装時に詳細パターンが読み込まれるようになった

### API実装編集時（例: `src/api/disclosures.ts`）

**Phase 2後**: 5ファイル読み込み
1. core/tdnet-implementation-rules.md (常時)
2. core/tdnet-data-collector.md (常時)
3. core/error-handling-patterns.md (常時)
4. api/api-design-guidelines.md
5. api/error-codes.md
6. development/mcp-server-guidelines.md

**Phase 3後**: 5ファイル読み込み（約17%削減）
1. core/tdnet-implementation-rules.md (常時)
2. core/tdnet-data-collector.md (常時)
3. core/error-handling-patterns.md (常時)
4. api/api-design-guidelines.md
5. development/mcp-server-guidelines.md

削除されたファイル:
- api/error-codes.md（エラーコード定義ファイル専用に変更）

### エラーコード定義編集時（例: `src/api/errors/error-codes.ts`）

**Phase 2後**: 6ファイル読み込み
1. core/tdnet-implementation-rules.md (常時)
2. core/tdnet-data-collector.md (常時)
3. core/error-handling-patterns.md (常時)
4. api/api-design-guidelines.md
5. api/error-codes.md
6. development/mcp-server-guidelines.md

**Phase 3後**: 6ファイル読み込み（変更なし）
- error-codes.mdが適切に読み込まれる

### スクリプト編集時（例: `scripts/deploy-foundation.ps1`）

**Phase 2後**: 4ファイル読み込み
1. core/tdnet-implementation-rules.md (常時)
2. core/tdnet-data-collector.md (常時)
3. core/error-handling-patterns.md (常時)
4. infrastructure/deployment-scripts.md

**Phase 3後**: 4ファイル読み込み（変更なし）
1. core/tdnet-implementation-rules.md (常時)
2. core/tdnet-data-collector.md (常時)
3. core/error-handling-patterns.md (常時)
4. infrastructure/scripts-implementation.md（新規、共通ガイドライン）

**効果**: 共通ガイドラインが読み込まれ、詳細はmanual inclusionで参照可能

## 全体的な効果まとめ

| ファイルタイプ | Phase 2後 | Phase 3後 | 削減率 |
|--------------|----------|----------|--------|
| Lambda関数エントリーポイント | 5ファイル | 5ファイル | 0% |
| Lambda内部ユーティリティ | 4ファイル | 5ファイル | -25%（詳細追加） |
| API実装 | 6ファイル | 5ファイル | 約17% |
| エラーコード定義 | 6ファイル | 6ファイル | 0% |
| スクリプト | 4ファイル | 4ファイル | 0%（内容変更） |

### Phase 1 + Phase 2 + Phase 3の累積効果

**Lambda関数エントリーポイント編集時**:
- 最適化前: 7ファイル
- Phase 1後: 5ファイル（約28%削減）
- Phase 2後: 5ファイル（累積約28%削減）
- Phase 3後: 5ファイル（累積約28%削減）

**Lambda内部ユーティリティ編集時**:
- 最適化前: 4ファイル（lambda-implementation.mdが読み込まれなかった）
- Phase 3後: 5ファイル（lambda-utils-implementation.mdが追加）
- 効果: 詳細な実装パターンが読み込まれるようになった

**API実装編集時**:
- 最適化前: 6ファイル
- Phase 3後: 5ファイル（約17%削減）

**スクリプト編集時**:
- 最適化前: 4ファイル
- Phase 3後: 4ファイル（共通ガイドラインに統合）

## 成果物

### 新規ファイル
1. `.kiro/steering/development/lambda-utils-implementation.md` (約150語)
2. `.kiro/steering/infrastructure/scripts-implementation.md` (約250語)

### 変更ファイル
1. `.kiro/steering/development/lambda-implementation.md` - エントリーポイント専用に特定化
2. `.kiro/steering/api/error-codes.md` - エラーコード定義ファイル専用に特定化
3. `.kiro/steering/infrastructure/deployment-scripts.md` - manual inclusionに変更
4. `.kiro/steering/development/setup-scripts.md` - manual inclusionに変更
5. `.kiro/steering/development/data-scripts.md` - manual inclusionに変更
6. `.kiro/steering/infrastructure/monitoring-scripts.md` - manual inclusionに変更

### ファイル構成の更新

**development/**フォルダ:
- 既存: 14ファイル
- 追加: lambda-utils-implementation.md
- 合計: 15ファイル

**infrastructure/**フォルダ:
- 既存: 7ファイル
- 追加: scripts-implementation.md
- 合計: 8ファイル

## 申し送り事項

### 検証推奨
1. Lambda関数エントリーポイント編集時（例: `src/lambda/collector/handler.ts`）
   - 期待: 5ファイル読み込み（lambda-implementation.mdが読み込まれる）
   - 確認: エントリーポイント専用のガイドラインが適切に読み込まれること

2. Lambda内部ユーティリティ編集時（例: `src/lambda/collector/utils/parser.ts`）
   - 期待: 5ファイル読み込み（lambda-utils-implementation.mdが読み込まれる）
   - 確認: 内部実装の詳細パターンが適切に読み込まれること

3. API実装編集時（例: `src/api/disclosures.ts`）
   - 期待: 5ファイル読み込み（error-codes.mdが読み込まれない）
   - 確認: エラーコード定義ファイル以外では読み込まれないこと

4. スクリプト編集時（例: `scripts/deploy-foundation.ps1`）
   - 期待: 4ファイル読み込み（scripts-implementation.mdが読み込まれる）
   - 確認: 共通ガイドラインが適切に読み込まれること

### Manual Inclusionファイルの使用方法
以下のファイルは自動読み込みされません。必要時に`#`で手動参照してください:
- deployment-scripts.md
- setup-scripts.md
- data-scripts.md
- monitoring-scripts.md

### 今後の方針
- 定期的なレビュー（3ヶ月ごと）
- 実際の使用状況に基づく微調整
- 新規ファイル追加時は簡潔性を優先（目標: 300語以下）

## Phase 3完了

Phase 3の最適化が完了しました。

- Lambda関連パターンの階層化（エントリーポイントと内部実装を分離）
- API関連パターンの特定化（エラーコード定義ファイル専用）
- スクリプト関連パターンの統合（共通ガイドラインに統合）

累積効果:
- Lambda関数エントリーポイント: 約28%削減
- Lambda内部ユーティリティ: 詳細パターン追加
- API実装: 約17%削減
- スクリプト: 共通ガイドラインに統合


## Manual Inclusion取り消し

ユーザーの要望により、スクリプト関連steeringファイルのmanual inclusionを元に戻しました。

### 変更内容
1. deployment-scripts.md: `inclusion: fileMatch` に戻す
2. monitoring-scripts.md: `inclusion: fileMatch` に戻す
3. setup-scripts.md: `inclusion: fileMatch` に戻す
4. data-scripts.md: `inclusion: fileMatch` に戻す

### 最終的なスクリプト編集時の読み込み

**デプロイスクリプト編集時（例: `scripts/deploy-foundation.ps1`）**:
- 読み込まれるファイル:
  1. core 3ファイル（常時）
  2. infrastructure/scripts-implementation.md（共通ガイドライン）
  3. infrastructure/deployment-scripts.md（デプロイ詳細）

**セットアップスクリプト編集時（例: `scripts/create-api-key-secret.ps1`）**:
- 読み込まれるファイル:
  1. core 3ファイル（常時）
  2. infrastructure/scripts-implementation.md（共通ガイドライン）
  3. development/setup-scripts.md（セットアップ詳細）

**データ操作スクリプト編集時（例: `scripts/fetch-data-range.ps1`）**:
- 読み込まれるファイル:
  1. core 3ファイル（常時）
  2. infrastructure/scripts-implementation.md（共通ガイドライン）
  3. development/data-scripts.md（データ操作詳細）

**監視スクリプト編集時（例: `scripts/deploy-dashboard.ps1`）**:
- 読み込まれるファイル:
  1. core 3ファイル（常時）
  2. infrastructure/scripts-implementation.md（共通ガイドライン）
  3. infrastructure/monitoring-scripts.md（監視詳細）

### 効果
- スクリプト編集時に共通ガイドライン + 詳細ガイドラインの両方が自動読み込みされる
- manual inclusionによる手動参照の手間がなくなる

