# Steering Files Fetch Optimization - Phase 2

**作業日時**: 2026-02-18 06:52:39  
**作業概要**: steeringファイルのフェッチ最適化Phase 2 - 検証と追加最適化

## Phase 2の目的

Phase 1で実施した最適化の効果を検証し、さらなる最適化の可能性を探る。

## 現状分析

### 現在のsteeringファイル構成

**core/** (常時読み込み - 3ファイル):
- tdnet-implementation-rules.md (171語)
- tdnet-data-collector.md (141語)
- error-handling-patterns.md (136語)

**development/** (条件付き - 14ファイル):
- mcp-documentation-guidelines.md (200語) - 新規
- その他13ファイル

**infrastructure/** (条件付き - 6ファイル)
**security/** (条件付き - 1ファイル)
**api/** (条件付き - 2ファイル)
**meta/** (条件付き - 1ファイル)

### 重複マッチングの再分析

現在の設定で各ファイルタイプを編集した場合の読み込み状況を確認。


## パターン重複分析

### Lambda関連ファイル（`**/lambda/**/*.ts`）にマッチするsteering

1. **lambda-implementation.md** - Lambda基本実装
2. **mcp-server-guidelines.md** - MCPサーバー活用
3. **error-handling-enforcement.md** - エラーハンドリング強制

**問題点**: Lambda関数編集時に3つのsteeringファイルが読み込まれる可能性

### CDK関連ファイル（`**/cdk/**/*.ts`）にマッチするsteering

1. **mcp-server-guidelines.md** - MCPサーバー活用
2. **deployment-checklist.md** - デプロイチェックリスト
3. **error-handling-enforcement.md** - エラーハンドリング強制（`**/cdk/lib/**/*-stack.ts`のみ）
4. **tdnet-file-naming.md** - ファイル命名規則（`**/cdk/lib/**/*-stack.ts`, `**/cdk/lib/constructs/**/*.ts`）
5. **security-best-practices.md** - セキュリティ（`**/cdk/lib/**/*-stack.ts`）
6. **performance-optimization.md** - パフォーマンス（`**/cdk/lib/constructs/*lambda*.ts`, `**/cdk/lib/constructs/*function*.ts`）

**問題点**: CDKファイル編集時に最大6つのsteeringファイルが読み込まれる可能性

### ドキュメント関連ファイル（`**/docs/**/*.md`, `**/.kiro/specs/**/*.md`）にマッチするsteering

1. **documentation-standards.md** - ドキュメント標準
2. **mcp-documentation-guidelines.md** - MCPサーバー活用（ドキュメント）
3. **workflow-guidelines.md** - ワークフロー（`**/.kiro/specs/**/*.md`のみ）

**問題点**: ドキュメント編集時に2-3つのsteeringファイルが読み込まれる（許容範囲）

## Phase 2最適化案

### 案1: Lambda関連パターンの階層化（推奨）

**lambda-implementation.md**を2つに分割:

1. **lambda-implementation.md** - Lambda関数エントリーポイント専用
   ```yaml
   fileMatchPattern: '**/lambda/**/handler.ts|**/lambda/**/index.ts'
   ```
   - 内容: メモリ、タイムアウト、環境変数検証の基本設定

2. **lambda-utils.md** - Lambda内部実装専用（新規）
   ```yaml
   fileMatchPattern: '**/lambda/**/utils/**/*.ts|**/lambda/**/helpers/**/*.ts|**/lambda/**/lib/**/*.ts'
   ```
   - 内容: Lambda内部のユーティリティ実装パターン

**効果**: Lambda関数のエントリーポイント編集時は基本設定のみ、内部実装編集時は詳細パターンを読み込み

### 案2: CDK関連パターンの統合（推奨）

**問題**: CDK関連のsteeringファイルが分散している
- error-handling-enforcement.md
- tdnet-file-naming.md
- security-best-practices.md
- performance-optimization.md

**解決策**: CDK編集時の必須情報を1つのファイルに集約

**cdk-implementation.md**（新規）:
```yaml
fileMatchPattern: '**/cdk/lib/**/*.ts'
```
- 内容: CDK実装時の必須チェックリスト（エラーハンドリング、命名規則、セキュリティ、パフォーマンスの要点のみ）
- 詳細は既存ファイルへの参照

既存ファイルのパターンを特定化:
- **error-handling-enforcement.md**: `**/cdk/lib/constructs/*lambda*.ts`（Lambda Construct専用）
- **tdnet-file-naming.md**: パターン維持（命名規則は全体に適用）
- **security-best-practices.md**: `**/cdk/lib/**/*-stack.ts`（Stack専用）
- **performance-optimization.md**: `**/cdk/lib/constructs/*lambda*.ts|**/cdk/lib/constructs/*function*.ts`（Lambda Construct専用）

### 案3: documentation-standards.mdの特定化

**現在のパターン**:
```yaml
fileMatchPattern: '**/docs/**/*.md|**/README.md|**/.kiro/specs/**/*.md'
```

**問題**: `**/README.md`が広すぎる（プロジェクトルートのREADME.md以外も含む）

**変更後**:
```yaml
fileMatchPattern: '**/docs/**/*.md|README.md|**/.kiro/specs/**/*.md'
```

**効果**: プロジェクトルートのREADME.mdのみにマッチ

### 案4: workflow-guidelines.mdの特定化

**現在のパターン**:
```yaml
fileMatchPattern: '**/.kiro/specs/**/*.md|**/work-logs/**/*.md|**/improvements/**/*.md'
```

**問題**: `**/work-logs/**/*.md`と`**/improvements/**/*.md`が広すぎる

**変更後**:
```yaml
fileMatchPattern: '**/.kiro/specs/**/tasks*.md|**/.kiro/specs/**/spec.md|**/.kiro/specs/**/work-logs/**/*.md|**/.kiro/specs/**/improvements/**/*.md'
```

**効果**: .kiro/specs/配下のwork-logs/とimprovements/のみにマッチ

## Phase 2実装計画

### 優先度: 高
1. ✅ documentation-standards.mdの特定化（即座に実施）
2. ✅ workflow-guidelines.mdの特定化（即座に実施）

### 優先度: 中
3. Lambda関連パターンの階層化（必要に応じて）
4. CDK関連パターンの統合（必要に応じて）

### 優先度: 低
5. 実際の使用状況に基づく微調整

