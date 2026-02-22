# 作業記録: docsフォルダ構造の論理性チェック

**作業日時**: 2026-02-15 09:33:02  
**作業者**: Kiro AI Assistant  
**関連タスク**: Phase 1-4 タスク31 - docsフォルダ構造分析

## 作業概要

docsフォルダの構造を分析し、02-implementation/と03-implementation/の重複を確認、より論理的なフォルダ構造を提案する。

## 現状分析

### 現在のフォルダ構造

```
docs/
├── 01-requirements/        # 要件・設計（9ファイル）
├── 02-implementation/      # 実装ドキュメント（5ファイル）
├── 03-implementation/      # 実装ドキュメント（1ファイル）⚠️ 重複
├── 03-testing/            # テストドキュメント（4ファイル）
├── 04-deployment/         # デプロイドキュメント（6ファイル）
├── 05-operations/         # 運用ドキュメント（6ファイル）
└── 06-scripts/            # スクリプトドキュメント（3ファイル）
```

### 問題点の特定

#### 1. **重複フォルダ: 02-implementation/ と 03-implementation/**

**02-implementation/ の内容**:
- `batch-metrics.md` - CloudWatchメトリクス送信方法
- `cdk-infrastructure.md` - CDKインフラストラクチャ完全ガイド（非常に詳細）
- `correctness-properties-checklist.md` - 正確性プロパティチェックリスト
- `implementation-checklist.md` - 実装チェックリスト
- `lambda-error-logging.md` - Lambda エラーログ記録方法

**03-implementation/ の内容**:
- `src-folder-documentation.md` - srcフォルダドキュメント（非常に詳細）

**問題**:
- 同じ「implementation」という名前のフォルダが2つ存在
- 03-implementation/は1ファイルのみで、フォルダとして独立する必要性が低い
- 番号の連続性が不自然（02 → 03 → 03 → 04）

#### 2. **命名規則の不一致**

**現状**:
- `01-requirements/` - 要件・設計
- `02-implementation/` - 実装（CDK、メトリクス、チェックリスト）
- `03-implementation/` - 実装（srcフォルダ）
- `03-testing/` - テスト
- `04-deployment/` - デプロイ
- `05-operations/` - 運用
- `06-scripts/` - スクリプト

**問題**:
- 03が2つ存在（03-implementation、03-testing）
- 実装関連が2つのフォルダに分散

#### 3. **内容の論理的な分類**

**02-implementation/ の内容分析**:
- `cdk-infrastructure.md` - インフラコード（CDK）
- `batch-metrics.md` - 監視・メトリクス
- `lambda-error-logging.md` - 監視・ログ
- `implementation-checklist.md` - 実装ガイド
- `correctness-properties-checklist.md` - 実装ガイド

**03-implementation/ の内容分析**:
- `src-folder-documentation.md` - アプリケーションコード（src/）

**問題**:
- CDKインフラコードとアプリケーションコードが別フォルダ
- メトリクス・ログは運用（05-operations/）に近い内容

## 提案: より論理的なフォルダ構造

### 提案1: 実装フォルダの統合

```
docs/
├── 01-requirements/        # 要件・設計
├── 02-implementation/      # 実装ドキュメント（統合）
│   ├── cdk-infrastructure.md
│   ├── src-folder-documentation.md
│   ├── implementation-checklist.md
│   └── correctness-properties-checklist.md
├── 03-testing/            # テストドキュメント
├── 04-deployment/         # デプロイドキュメント
├── 05-operations/         # 運用ドキュメント
│   ├── batch-metrics.md          # 移動
│   ├── lambda-error-logging.md   # 移動
│   ├── monitoring-guide.md
│   ├── cost-monitoring.md
│   ├── troubleshooting.md
│   ├── backup-strategy.md
│   ├── lambda-power-tuning.md
│   └── operations-manual.md
└── 06-scripts/            # スクリプトドキュメント
```

**変更内容**:
- ✅ 03-implementation/ を 02-implementation/ に統合
- ✅ batch-metrics.md を 05-operations/ に移動（監視関連）
- ✅ lambda-error-logging.md を 05-operations/ に移動（監視関連）
- ✅ 番号の連続性を修正（01 → 02 → 03 → 04 → 05 → 06）

**メリット**:
- 実装関連ドキュメントが1箇所に集約
- 監視・ログ関連が運用フォルダに集約
- 番号の連続性が保たれる
- フォルダ構造が直感的

### 提案2: より詳細な分類

```
docs/
├── 01-requirements/        # 要件・設計
├── 02-architecture/        # アーキテクチャ（新規）
│   ├── cdk-infrastructure.md
│   └── src-folder-documentation.md
├── 03-implementation/      # 実装ガイド
│   ├── implementation-checklist.md
│   └── correctness-properties-checklist.md
├── 04-testing/            # テストドキュメント
├── 05-deployment/         # デプロイドキュメント
├── 06-operations/         # 運用ドキュメント
│   ├── batch-metrics.md
│   ├── lambda-error-logging.md
│   ├── monitoring-guide.md
│   ├── cost-monitoring.md
│   ├── troubleshooting.md
│   ├── backup-strategy.md
│   ├── lambda-power-tuning.md
│   └── operations-manual.md
└── 07-scripts/            # スクリプトドキュメント
```

**変更内容**:
- ✅ 02-architecture/ を新規作成（インフラ・アプリコード構造）
- ✅ 03-implementation/ を実装ガイドに特化
- ✅ 番号を再割り当て（04-testing、05-deployment、06-operations、07-scripts）

**メリット**:
- アーキテクチャドキュメントが独立
- 実装ガイドが明確
- より詳細な分類

**デメリット**:
- フォルダ数が増える
- 番号の変更が大きい

## 推奨案: 提案1（実装フォルダの統合）

### 理由

1. **シンプルさ**: フォルダ数を増やさず、既存構造を最小限の変更で改善
2. **論理的な分類**: 実装（コード構造）と運用（監視・ログ）を明確に分離
3. **番号の連続性**: 01 → 02 → 03 → 04 → 05 → 06 で自然な流れ
4. **変更の最小化**: 3ファイルの移動のみで完了

### 具体的な変更手順

1. **03-implementation/src-folder-documentation.md を 02-implementation/ に移動**
2. **02-implementation/batch-metrics.md を 05-operations/ に移動**
3. **02-implementation/lambda-error-logging.md を 05-operations/ に移動**
4. **03-implementation/ フォルダを削除**

## 各フォルダの役割（推奨案）

| フォルダ | 役割 | 主要ドキュメント |
|---------|------|-----------------|
| **01-requirements/** | 要件・設計 | architecture.md, design.md, api-design.md, database-schema.md |
| **02-implementation/** | 実装ドキュメント | cdk-infrastructure.md, src-folder-documentation.md, implementation-checklist.md |
| **03-testing/** | テストドキュメント | e2e-test-guide.md, load-testing-guide.md, localstack-setup.md |
| **04-deployment/** | デプロイドキュメント | deployment-guide.md, ci-cd-guide.md, environment-setup.md |
| **05-operations/** | 運用ドキュメント | monitoring-guide.md, batch-metrics.md, lambda-error-logging.md, troubleshooting.md |
| **06-scripts/** | スクリプトドキュメント | scripts-overview.md, deployment-scripts.md, setup-scripts.md |

## 評価基準

### ✅ 改善される点

1. **重複の解消**: 02-implementation/ と 03-implementation/ の統合
2. **論理的な分類**: 実装（コード構造）と運用（監視・ログ）の明確な分離
3. **番号の連続性**: 01 → 02 → 03 → 04 → 05 → 06
4. **直感的な構造**: フォルダ名と内容が一致

### ⚠️ 注意点

1. **既存リンクの更新**: 他のドキュメントからのリンクを更新する必要がある
2. **README.md の更新**: docsフォルダのREADME.mdを更新する必要がある

## 次のステップ

1. ✅ 構造分析完了
2. ⏭️ 提案の承認待ち
3. ⏭️ ファイル移動実行
4. ⏭️ リンク更新
5. ⏭️ README.md 更新

## 問題と解決策

### 問題1: 03-implementation/ と 02-implementation/ の重複

**解決策**: 03-implementation/src-folder-documentation.md を 02-implementation/ に移動し、03-implementation/ フォルダを削除

### 問題2: メトリクス・ログドキュメントの配置

**解決策**: batch-metrics.md と lambda-error-logging.md を 05-operations/ に移動（監視・運用に関連）

### 問題3: 番号の連続性

**解決策**: 03-implementation/ 削除により、03-testing/ が正しい位置に

## 成果物

- ✅ 現状分析完了
- ✅ 問題点の特定
- ✅ 2つの提案作成
- ✅ 推奨案の選定（提案1）
- ✅ 具体的な変更手順の作成

## 申し送り事項

1. **提案1（実装フォルダの統合）を推奨**
   - シンプルで最小限の変更
   - 論理的な分類
   - 番号の連続性

2. **次のタスクで実行すべき作業**
   - ファイル移動（3ファイル）
   - リンク更新
   - README.md 更新

3. **影響範囲**
   - 移動するファイル: 3ファイル
   - 削除するフォルダ: 1フォルダ
   - 更新が必要なリンク: 要調査

---

**作業完了時刻**: 2026-02-15 09:33:02
