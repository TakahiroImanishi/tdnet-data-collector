---
inclusion: always
description: "タスク実行の3ステップと作業記録ルール"
---

# TDnet Data Collector - タスク実行ルール

## タスク実行の3ステップ

### 1️⃣ タスク開始
1. タスク分析・理解
2. コードベース調査（context-gatherer使用可）
3. 作業記録作成（`.kiro/specs/tdnet-data-collector/work-logs/`）
4. 実装開始

### 2️⃣ タスク実行
実装、テスト実行、問題と解決策を作業記録に随時追記

### 3️⃣ タスク完了
✅ 作業記録に成果物と申し送り記入 → ✅ git commit & push → ✅ 問題あれば改善記録作成

## 作業記録

### ファイル命名
```
work-log-[YYYYMMDD-HHMMSS]-[作業概要].md
```

**時間取得**: `Get-Date -Format "yyyyMMdd-HHmmss"` で正確な時刻を使用（推測禁止）

**作業概要**: ケバブケース（小文字、ハイフン区切り）
- ✅ `lambda-error-handling`, `api-design-update`
- ❌ `Lambda Error Handling`（スペース・大文字）, `lambda_error_handling`（アンダースコア）

### 記録内容
タスク概要 | 実施内容 | 成果物 | 次回への申し送り

詳細: `.kiro/specs/tdnet-data-collector/work-logs/README.md`

## Git Commit

```
[タスク種別] 簡潔な変更内容

関連: work-log-[日時].md
```

タスク種別: feat, fix, docs, refactor, test, chore, improve

## 改善記録（問題発生時のみ）

**作成条件**: エラー発生、パフォーマンス懸念、品質改善必要時

**命名**: `task-[番号]-improvement-[連番]-[YYYYMMDD-HHMMSS].md`

**保存先**: `.kiro/specs/tdnet-data-collector/improvements/`

詳細: `.kiro/specs/tdnet-data-collector/improvements/README.md`

## サブエージェント活用

⚠️ **Autopilotモードのみ利用可能**

### 基本方針
並列実行可能なタスクは積極的にサブエージェントに分割

### 利用可能なサブエージェント
- **context-gatherer**: コードベース探索（新機能実装前、バグ調査）
- **general-task-execution**: 独立サブタスク委譲、並列実行
- **custom-agent-creator**: 繰り返しタスク自動化

### サブエージェント実行時の必須指示

1. **作業記録作成**: `work-log-[YYYYMMDD-HHMMSS]-[作業概要].md`を作成（`Get-Date -Format "yyyyMMdd-HHmmss"`使用）
2. **記録内容**: タスク概要、実施内容、成果物、申し送り
3. **保存先**: `.kiro/specs/tdnet-data-collector/work-logs/`
4. **tasks.md更新**: タスク完了後、[ ]→[x]、完了日時・テスト結果追記

**メインエージェントの責任**: サブエージェント作業記録確認、メイン記録にリンク追加、Git コミット、tasks.md更新確認

詳細: `../development/workflow-guidelines.md`, `tdnet-implementation-rules.md`, `error-handling-patterns.md`
