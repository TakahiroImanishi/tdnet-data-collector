# Implementation Plan: TDnet Data Collector - Phase 5

## Overview

このドキュメントは、TDnet Data Collectorの実装タスクリスト（Phase 5: 本番運用後の自動化強化）です。Phase 1-4が完了した後に実施します。

**実装言語:** TypeScript/Node.js 20.x  
**インフラ:** AWS CDK (TypeScript)  
**テストフレームワーク:** Jest + fast-check (プロパティベーステスト)

## 実装フェーズ

- **Phase 5: 本番運用後の自動化強化** - EventBridge、SNS通知、日次バッチ自動化

## Tasks

## Phase 5: 本番運用後の自動化強化

### 31. 本番デプロイ（続き）

- [ ] 31.5 本番環境の監視開始
  - CloudWatchダッシュボードの確認
  - アラート設定の確認
  - ログ出力の確認
  - _Requirements: 要件12.1（監視）_

- [ ] 31.7 日次バッチの動作確認
  - EventBridgeスケジュールの確認
  - 翌日の自動実行を確認
  - _Requirements: 要件4.1（バッチ処理）_

- [ ] 31.8 運用開始
  - 運用マニュアルの共有
  - アラート対応体制の確認
  - 定期レビュースケジュールの設定
  - _Requirements: 要件13.1（運用開始）_

### 32. EventBridgeスケジューリング

- [ ] 32.1 EventBridge RuleをCDKで定義
  - 日次スケジュール設定（毎日9:00 JST実行）
  - Lambda Collectorをターゲットに設定
  - バッチモードでの実行設定
  - _Requirements: 要件4.1, 4.2（バッチ処理）_

- [ ]* 32.2 EventBridge設定の検証テスト
  - EventBridge Ruleが正しく作成されていることを確認
  - スケジュール設定が正しいことを確認
  - _Requirements: 要件14.1（テスト）_

### 33. SNS通知設定

- [ ] 33.1 SNS TopicをCDKで定義
  - tdnet-alerts トピック作成
  - Emailサブスクリプション設定
  - Lambda関数からの通知送信権限付与
  - _Requirements: 要件4.4（通知）_

- [ ] 33.2 通知送信ロジックの実装
  - エラー発生時のSNS通知送信
  - バッチ完了時のサマリー通知送信
  - _Requirements: 要件4.3, 4.4（サマリーレポート、通知）_

- [ ]* 33.3 SNS通知のユニットテスト
  - エラー時に通知が送信されることを確認
  - 通知内容が正しいことを確認
  - _Requirements: 要件14.1（ユニットテスト）_

### 34. Checkpoint - Phase 5完了確認

- [ ] 34.1 Phase 5の動作確認
  - EventBridgeスケジュールが正常に動作することを確認
  - SNS通知が送信されることを確認
  - 日次バッチが自動実行されることを確認

## Notes

### タスク実行の注意事項

1. **作業記録の作成**: 各タスク開始時に work-log-[YYYYMMDD-HHMMSS]-[作業概要].md を作成してください
   - PowerShellで現在時刻を取得: `Get-Date -Format "yyyyMMdd-HHmmss"`
   - 作業概要はケバブケース（小文字、ハイフン区切り）で記述
   - 保存先: `.kiro/specs/tdnet-data-collector/work-logs/`

2. **テストの実行**: `*` マークのあるサブタスクはオプションですが、品質保証のため実行を推奨します

3. **プロパティベーステスト**: fast-checkを使用し、最低100回（推奨1000回）の反復実行を行ってください

4. **コミット**: 各タスク完了後、必ずGitコミット＆プッシュを実行してください
   - コミットメッセージ形式: `[タスク種別] 簡潔な変更内容`
   - 関連: work-log-[日時].md

5. **振り返り**: タスク完了後、問題があれば改善記録を作成してください
   - ファイル名: task-[タスク番号]-improvement-[連番]-[YYYYMMDD-HHMMSS].md
   - 保存先: `.kiro/specs/tdnet-data-collector/improvements/`

### 依存関係

- **Phase 4 → Phase 5**: Phase 4の運用改善が完成してからPhase 5を開始

### 推定工数

| フェーズ | 推定工数 | 説明 |
|---------|---------|------|
| Phase 5 | 15時間 | 本番運用後の自動化強化（EventBridge、SNS） |

### 優先度

| 優先度 | タスク | 理由 |
|--------|--------|------|
| 🟠 High | EventBridgeスケジューリング | 日次バッチ自動化の要 |
| 🟡 Medium | SNS通知設定 | 運用監視の効率化 |

### 関連ドキュメント

#### 要件・設計
- **[要件定義書](./docs/requirements.md)** - 機能要件と非機能要件（要件1-15）
- **[設計書](./docs/design.md)** - システムアーキテクチャと詳細設計

#### 実装ガイドライン（Steering）
- **[実装ルール](../../steering/core/tdnet-implementation-rules.md)** - コーディング規約、date_partition実装
- **[エラーハンドリング](../../steering/core/error-handling-patterns.md)** - 再試行戦略、エラー分類
- **[タスク実行ルール](../../steering/core/tdnet-data-collector.md)** - 作業記録、改善記録、サブエージェント活用
- **[テスト戦略](../../steering/development/testing-strategy.md)** - ユニット、統合、E2E、プロパティテスト
- **[デプロイチェックリスト](../../steering/infrastructure/deployment-checklist.md)** - デプロイ前後の確認
- **[監視とアラート](../../steering/infrastructure/monitoring-alerts.md)** - CloudWatch設定

#### 作業記録・改善
- **[作業記録README](./work-logs/README.md)** - 作業記録の作成方法
- **[改善記録README](./improvements/README.md)** - 改善記録の作成方法

### Phase 5実装開始前の確認

Phase 5を開始する前に、以下を確認してください：

1. ✅ **Phase 1-4が完了**: すべてのタスクが完了し、本番環境にデプロイ済み
2. ✅ **本番環境が安定稼働**: データ収集、API、監視が正常に動作している
3. ✅ **運用体制が確立**: アラート対応、エラー対応の体制が整っている

---

**最終更新:** 2026-02-15  
**Phase 5タスク数:** 3個のメインタスク、8個のサブタスク  
**推定工数:** 15時間（約2日間）
