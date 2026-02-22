# TDnet Data Collector - 改善履歴

このフォルダには、タスク実行後のフィードバックループで発見された問題と実施した改善を記録します。

## 改善記録とは

### 目的

改善記録は、タスク完了後のフィードバックループで発見された問題を分析し、実施した改善を記録するためのドキュメントです。

### 作業記録との違い

| 項目 | 作業記録（work-logs/） | 改善記録（improvements/） |
|------|----------------------|------------------------|
| **目的** | タスク実行の履歴を記録 | 継続的改善の記録 |
| **作成タイミング** | タスク実行中（開始時に作成） | タスク完了後（フィードバックループ時） |
| **記録内容** | 実施した作業、問題と解決策、成果物 | 問題点の分析、改善点の特定、改善結果 |
| **対象タスク** | すべてのタスク（必須） | 改善が必要なタスク（任意） |
| **視点** | 「何をしたか」（What） | 「なぜ問題が起きたか、どう改善するか」（Why & How） |
| **粒度** | 作業の詳細記録 | 問題の根本原因分析と改善策 |
| **頻度** | タスクごとに1つ | 必要に応じて複数回 |

### ワークフロー

```
作業記録（実行中）
    ↓
タスク完了
    ↓
問題や改善点あり？
    ↓ YES
フィードバックループ
    ↓
改善記録（分析結果）
```

詳細なフローチャートは `.kiro/specs/tdnet-data-collector/work-logs/README.md` を参照してください。

## いつ改善記録を作成すべきか

### 改善記録を作成する場合 ✅

以下のいずれかに該当する場合、改善記録を作成してください：

| 状況 | 説明 | 優先度 |
|------|------|--------|
| **バグ・エラー発見** | 実装上のバグ、ロジックエラー、例外処理の不備 | 🔴 Critical / 🟠 High |
| **設計の改善が必要** | アーキテクチャの見直し、コンポーネント間の結合度、リファクタリング | 🟠 High / 🟡 Medium |
| **要件の不明確さ** | 要件定義書の曖昧さ、矛盾、欠落 | 🟠 High |
| **テストの不足** | テストカバレッジ不足、エッジケース未対応、プロパティテスト不足 | 🟡 Medium |
| **ドキュメントの不整合** | steeringファイルと実装の乖離、設計書の更新漏れ | 🟡 Medium |
| **パフォーマンス問題** | 実行時間超過、メモリ使用量過多、コスト増加 | 🟠 High |
| **セキュリティ懸念** | 脆弱性、権限設定の問題、機密情報の露出 | 🔴 Critical |
| **保守性の問題** | コードの可読性低下、複雑度増加、技術的負債 | 🟡 Medium |

### 改善記録を作成しない場合 ❌

以下の場合は改善記録を作成する必要はありません：

| 状況 | 理由 |
|------|------|
| **問題なく完了** | 計画通りに実装が完了し、問題が発見されなかった |
| **軽微な修正のみ** | タイポ修正、コメント追加、フォーマット調整など |
| **単純な作業** | ファイルコピー、設定変更、ドキュメント更新のみ |
| **一時的な対処** | 作業記録に記載した一時的な対処で十分な場合 |

### 判断フローチャート

```
タスク完了
    ↓
┌──────────────────────────────┐
│ 以下のいずれかに該当するか？ │
│                              │
│ □ バグ・エラー発見           │
│ □ 設計改善が必要             │
│ □ 要件が不明確               │
│ □ テストが不足               │
│ □ ドキュメント不整合         │
│ □ パフォーマンス問題         │
│ □ セキュリティ懸念           │
│ □ 保守性の問題               │
└────────┬─────────────────────┘
         │
         ├─YES→ 【改善記録を作成】
         │       1. フィードバックループ実施
         │       2. 問題の根本原因を分析
         │       3. 改善策を実施
         │       4. 改善記録を文書化
         │       improvements/task-X.X-improvement-N-[日時].md
         │
         └─NO──→ 【作業記録のみで完了】
                 問題がないため改善記録は不要
                 work-logs/work-log-[日時].md
```

## 具体的な改善記録の例

### 例1: エラーハンドリングの改善

**作業記録で発見した問題:**
```markdown
## 発生した問題と解決策

### 問題1: Lambda関数でネットワークエラー発生

**状況:** TDnetへのリクエスト中にネットワークエラーが発生
**原因:** 再試行ロジックが実装されていない
**解決策:** 手動で再実行（一時的な対処）
```

**改善記録での分析と改善:**

```markdown
# タスク1.1完了後の改善 - エラーハンドリング強化

**実行日時:** 2026-02-07 15:05:30 JST

## 問題点

### 1. 再試行ロジックの欠如

- Lambda関数でネットワークエラーが発生すると即座に失敗
- 一時的なネットワーク障害でも処理が中断される
- 他のLambda関数も同様の問題を抱えている可能性

### 2. エラーログの不十分さ

- エラーログが構造化されていない
- コンテキスト情報（disclosure_id、company_code等）が不足
- CloudWatch Logsでの検索が困難

## 改善内容

### 1. 汎用的な再試行ユーティリティの実装

- `src/utils/error-handling.ts` を作成
- `retryWithBackoff()` 関数を実装（指数バックオフ + ジッター）
- `RetryableError` クラスで再試行可能なエラーを明示

### 2. 構造化ログの導入

- JSON形式のログ出力
- コンテキスト情報を必ず含める
- エラー分類（Retryable / Non-Retryable）

### 3. ドキュメント更新

- `error-handling-patterns.md` に再試行戦略を追加
- サーキットブレーカーパターンを文書化
- エラーコード標準化を追加

## 影響範囲

- **steering**: `error-handling-patterns.md` 更新
  - 再試行戦略セクション追加
  - エラーコード標準化セクション追加
- **コード**: `src/utils/error-handling.ts` 新規作成
- **コード**: `src/lambda/collector/handler.ts` 更新
- **テスト**: `src/utils/error-handling.test.ts` 新規作成

## 検証結果

- ユニットテスト: 15/15 passed
- テストカバレッジ: 95%
- ネットワークエラー発生時の再試行動作を確認
- CloudWatch Logsでの検索性が向上

## 優先度

🟠 High - パフォーマンスとエラーハンドリングの改善

## タグ

#error-handling #retry-logic #logging #lambda
```

### 例2: パフォーマンス最適化

```markdown
# タスク2.3完了後の改善 - DynamoDBクエリ最適化

**実行日時:** 2026-02-08 09:15:30 JST

## 問題点

### 1. クエリパフォーマンスの低下

- 日付範囲検索で全件スキャンが発生
- レスポンスタイムが3秒以上
- DynamoDBの読み込みキャパシティを大量消費

### 2. インデックス設計の不備

- GSIが適切に設計されていない
- ソートキーが活用されていない

## 改善内容

### 1. GSIの追加

- `date-index` GSI を追加（PK: disclosure_date, SK: company_code）
- 日付範囲検索を効率化

### 2. クエリの最適化

- Scanから Query に変更
- FilterExpression の削減

## 影響範囲

- **design.md**: DynamoDBテーブル設計を更新
- **CDK**: GSI定義を追加
- **コード**: クエリロジックを最適化

## 検証結果

- レスポンスタイム: 3秒 → 0.5秒（83%改善）
- 読み込みキャパシティ: 90%削減
- コスト: 月額$50 → $5（90%削減）

## 優先度

🟠 High - パフォーマンスとコスト最適化

## タグ

#performance #dynamodb #optimization #cost
```

### 例3: セキュリティ改善

```markdown
# タスク3.1完了後の改善 - API認証強化

**実行日時:** 2026-02-09 10:30:00 JST

## 問題点

### 1. APIキー管理の不備

- APIキーがハードコードされている
- ローテーション機能がない
- 漏洩時の対応手順が未定義

### 2. アクセス制御の不足

- IP制限がない
- レート制限が緩い
- 監査ログが不十分

## 改善内容

### 1. Secrets Managerへの移行

- APIキーをSecrets Managerで管理
- 自動ローテーション機能を有効化

### 2. WAFルールの追加

- IP制限ルールを追加
- レート制限を強化（100req/min → 10req/min）

### 3. CloudTrailログの有効化

- API呼び出しの監査ログを記録
- 異常検知アラートを設定

## 影響範囲

- **security-best-practices.md**: APIキー管理セクション追加
- **CDK**: Secrets Manager、WAF、CloudTrail設定追加
- **コード**: APIキー取得ロジックを更新

## 検証結果

- APIキーローテーションテスト: 成功
- WAFルール動作確認: 正常
- CloudTrailログ記録: 正常

## 優先度

🔴 Critical - セキュリティ強化

## タグ

#security #api-key #waf #cloudtrail
```

## 改善記録作成のベストプラクティス

### 1. 根本原因を分析する

**悪い例:**
```markdown
## 問題点
- エラーが発生した
```

**良い例:**
```markdown
## 問題点
- Lambda関数でネットワークエラーが発生すると即座に失敗
- 原因: 再試行ロジックが実装されていない
- 影響: 一時的なネットワーク障害でも処理が中断される
- 他のLambda関数も同様の問題を抱えている可能性
```

### 2. 改善の影響範囲を明確にする

**悪い例:**
```markdown
## 影響範囲
- コードを修正した
```

**良い例:**
```markdown
## 影響範囲
- **steering**: `error-handling-patterns.md` 更新
  - 再試行戦略セクション追加（50行）
- **コード**: `src/utils/error-handling.ts` 新規作成（200行）
- **コード**: `src/lambda/collector/handler.ts` 更新（30行変更）
- **テスト**: `src/utils/error-handling.test.ts` 新規作成（150行）
```

### 3. 検証結果を定量的に記録する

**悪い例:**
```markdown
## 検証結果
- パフォーマンスが改善された
```

**良い例:**
```markdown
## 検証結果
- レスポンスタイム: 3秒 → 0.5秒（83%改善）
- 読み込みキャパシティ: 90%削減
- コスト: 月額$50 → $5（90%削減）
- テストカバレッジ: 70% → 95%
```

### 4. 優先度とタグを必ず設定する

**優先度:**
- 🔴 Critical: システムが動作しない、データ損失のリスク、セキュリティ問題
- 🟠 High: パフォーマンス問題、コスト問題、設計の大幅な改善
- 🟡 Medium: コード品質、保守性、テストカバレッジ
- 🟢 Low: ドキュメント、コメント、コーディングスタイル

**タグ:**
- 検索性を高めるため、関連するキーワードをタグとして追加
- 例: `#error-handling`, `#performance`, `#security`, `#dynamodb`, `#lambda`

## ファイル命名規則

各改善分析は以下の命名規則でファイルを作成してください：

### タスク関連の改善

```
task-[タスク番号]-improvement-[連番]-[YYYYMMDD-HHMMSS]-[topic].md
```

- **タスク番号**: 実行したタスクの番号（例: 1.1, 2.3）
- **連番**: 同じタスクで複数回改善分析を行う場合の連番（1, 2, 3...）
- **日時**: 改善分析を実施した日時（YYYYMMdd-HHmmss形式）
- **topic**: 改善のトピック（推奨、ケバブケース）
  - 例: `error-handling`, `performance`, `security`, `validation`

例：
- `task-1.1-improvement-1-20260207-143025-error-handling.md` - タスク1.1のエラーハンドリング改善
- `task-1.1-improvement-2-20260207-150530-performance.md` - タスク1.1のパフォーマンス改善
- `task-2.3-improvement-1-20260208-091530-dynamodb-optimization.md` - タスク2.3のDynamoDB最適化

### ドキュメント関連の改善

```
docs-improvement-[連番]-[YYYYMMDD-HHMMSS]-[topic].md
```

要件定義書、設計書、OpenAPI仕様などのドキュメント改善の記録。

- **topic**: 改善のトピック（推奨）
  - 例: `structure`, `consistency`, `openapi`, `requirements`

例：
- `docs-improvement-1-20260207-122500-structure.md` - ドキュメント構造の改善
- `docs-improvement-2-20260207-130000-consistency-check.md` - 整合性チェック結果

### Steering関連の改善

```
steering-improvement-[連番]-[YYYYMMDD-HHMMSS]-[topic].md
```

steeringファイル（実装ガイドライン）の改善記録。

- **topic**: 改善のトピック（推奨）
  - 例: `error-handling`, `work-log-rules`, `file-naming`, `consistency`

例：
- `steering-improvement-1-20260207-120500-consistency-check.md` - steeringファイルの整合性チェック
- `steering-improvement-2-20260207-115718-error-handling-patterns.md` - エラーハンドリングパターンの追加
- `steering-improvement-9-20260207-135530.md` - 作業記録作成ルールの明確化（旧形式、非推奨）

**重要:** 
- ❌ `general-improvement-*.md` のような汎用的な命名は使用しないでください
- ✅ 必ず上記のいずれかのカテゴリ（task, docs, steering）に分類してください
- ✅ トピック名を含めることで、ファイル一覧から改善内容を素早く把握できます

## 自動ファイル作成スクリプト

改善履歴ファイルを簡単に作成するためのPowerShellスクリプトを用意しています：

### create-improvement.ps1 - 改善記録作成

```powershell
# タスク番号とトピックを指定して実行
.\create-improvement.ps1 -TaskNumber "1.1" -Topic "error-handling"

# ドキュメント改善記録を作成
.\create-improvement.ps1 -Category "docs" -Topic "structure"

# Steering改善記録を作成
.\create-improvement.ps1 -Category "steering" -Topic "work-log-rules"

# 作成後に自動的にindex.mdを更新
.\create-improvement.ps1 -TaskNumber "1.1" -Topic "performance" -AutoUpdateIndex
```

スクリプトは以下を自動的に行います：
1. 正確なJST時刻を取得
2. 既存の改善ファイル数から連番を自動決定
3. トピック名をファイル名に含める
4. テンプレート付きのファイルを作成
5. ファイルパスを表示
6. オプションでファイルを開く
7. オプションでindex.mdを自動更新

**-Topic パラメータについて:**
- 改善のトピックを表す短い文字列（ケバブケース推奨）
- 例: `error-handling`, `performance`, `security`, `validation`
- ファイル名に含まれ、改善内容を素早く把握できる

### update-index.ps1 - インデックス更新

```powershell
# index.mdを自動更新
.\update-index.ps1
```

スクリプトは以下を自動的に行います：
1. すべての改善記録ファイルをスキャン
2. カテゴリ別に分類（task, docs, steering）
3. タイトル、概要、優先度、タグを抽出
4. index.mdを自動生成
5. 統計情報を表示

## 記録フォーマット

各ファイルは以下の形式で記録してください：

```markdown
# タスク[タスク番号]完了後の改善

**実行日時:** [YYYY-MM-DD HH:MM:SS JST]

## 問題点

- [発見された問題の説明]

## 改善内容

- [実施した改善の説明]

## 影響範囲

- **requirements.md**: [変更内容]
- **design.md**: [変更内容]
- **steering**: [変更内容]
- **コード**: [変更内容]

## 検証結果

- [改善の効果]

## 優先度

[Critical / High / Medium / Low]
```

## 日時の取得方法

正確なJST（日本標準時）を取得するため、以下のいずれかの方法を使用してください：

1. **PowerShellコマンド（Windows）:**
   ```powershell
   Get-Date -Format "yyyy-MM-dd HH:mm:ss"
   ```

2. **Node.js（タイムゾーン指定）:**
   ```javascript
   new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
   ```

3. **手動記録の場合:**
   現在のシステム時刻がJSTであることを確認してから記録してください。

## 関連ドキュメント

- **タスク実行ルール**: `.kiro/steering/core/tdnet-data-collector.md` - フィードバックループの詳細
- **作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/README.md` - 作業記録の作成方法と使い分け
- **実装ルール**: `.kiro/steering/core/tdnet-implementation-rules.md` - 基本的な実装原則

**重要:** 作業記録と改善記録の使い分けについては、上記の「改善記録とは」セクションと、作業記録のREADME.mdを参照してください。

## 変更履歴

- 2026-02-07: 初版作成
- 2026-02-07: 改善記録の目的と使い分けを強化（判断基準、具体例、ベストプラクティスを追加）


## アーカイブ

完了したPhaseの改善記録は`archive/`に移動されます：

### Phase1アーカイブ（22ファイル）

- `archive/phase1/`: Phase1完了分
  - docs-improvement-1～5
  - general-improvement-10～11
  - steering-improvement-1～3, 9
  - steering-optimization-improvement-1
  - task-1-improvement-1
  - task-9.1-improvement-1～3
  - task-9.1-comprehensive-analysis
  - task-9.15-improvement-1
  - task-15.7-improvement-1
  - task-requirements-design-review-improvement-1
  - task-review-improvement-1
  - SUMMARY-phase1-completion

### アーカイブ基準

- Phase完了後、該当Phaseの改善記録を移動
- 現在進行中のPhaseの改善記録は親フォルダに残す
- SUMMARYファイルもアーカイブに含める
