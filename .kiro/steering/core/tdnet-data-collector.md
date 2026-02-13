# TDnet Data Collector - タスク実行ルール

## タスク実行チェックリスト

### 開始時
- [ ] タスク分析・理解
- [ ] コードベース調査（必要時context-gatherer使用）
- [ ] 作業記録作成: `work-log-[YYYYMMDD-HHMMSS]-[作業概要].md`
  - 時刻: `Get-Date -Format "yyyyMMdd-HHmmss"`（推測禁止）
  - 作業概要: ケバブケース（例: `lambda-error-handling`）

### 実行中
- [ ] 実装・テスト実行
- [ ] 問題と解決策を作業記録に追記

### E2Eテスト実行時（必須）
- [ ] Docker Desktop起動確認: `docker ps`
- [ ] LocalStack環境起動: `docker compose up -d`
- [ ] LocalStack環境確認: `docker ps --filter "name=localstack"`
- [ ] DynamoDB/S3リソース確認: `scripts/localstack-setup.ps1`
- [ ] E2Eテスト実行: `npm run test:e2e`

### 完了時
- [ ] 作業記録に成果物・申し送り記入
- [ ] Git commit & push（形式: `[feat/fix/docs/refactor/test/chore/improve] 変更内容`）
- [ ] 問題発生時: 改善記録作成（`task-[番号]-improvement-[連番]-[YYYYMMDD-HHMMSS].md`）

## サブエージェント活用（Autopilotのみ）

### 利用可能
- **context-gatherer**: コードベース探索
- **general-task-execution**: 独立サブタスク委譲
- **custom-agent-creator**: 繰り返しタスク自動化

### サブエージェント実行時の必須指示
1. 作業記録作成（上記形式）
2. tasks.md更新（[ ]→[x]、完了日時・テスト結果追記）

### メインエージェントの責任
- サブエージェント作業記録確認
- メイン記録にリンク追加
- Git commit
- tasks.md更新確認
