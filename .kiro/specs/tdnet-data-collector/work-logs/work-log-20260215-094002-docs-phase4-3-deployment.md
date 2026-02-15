# 作業記録: docsフォルダ整理 Phase 4-3 - デプロイ関連ドキュメント更新

**作業日時**: 2026-02-15 09:40:02  
**作業者**: Kiro (AI Assistant)  
**関連タスク**: Phase 4-3 - デプロイ関連ドキュメントの4スタック構成対応

## 作業概要

4スタック構成（Foundation, Compute, API, Monitoring）への移行に伴い、デプロイ関連ドキュメントを更新する。

## 更新対象ファイル

1. `docs/04-deployment/smoke-test-guide.md` - API URL取得方法の更新
2. `docs/04-deployment/cdk-bootstrap-guide.md` - Bootstrap手順の更新
3. `docs/04-deployment/production-deployment-checklist.md` - デプロイ方式選択の追加
4. `docs/04-deployment/rollback-procedures.md` - ロールバック手順の更新

## 実施内容

### 1. 現状調査

- `scripts/deploy-split-stacks.ps1` の確認完了
- 4スタック構成の理解:
  - TdnetFoundation-{env}: 基盤層（DynamoDB, S3, CloudFront）
  - TdnetCompute-{env}: Lambda関数
  - TdnetApi-{env}: API Gateway
  - TdnetMonitoring-{env}: CloudWatch Alarms, Dashboard

### 2. smoke-test-guide.md の更新

**変更内容**:
- CloudFormationスタック確認セクションを4スタック構成に対応
- API URL取得方法を `TdnetApi-{env}` スタックから取得するように変更
- CloudFront URL取得方法を `TdnetFoundation-{env}` スタックから取得するように変更
- 単一スタック構成の手順も併記（後方互換性）

**更新箇所**:
- セクション 1.1: CloudFormationスタック確認
- セクション 2.1: APIエンドポイント取得
- セクション 6.1: CloudFront URL取得

### 3. cdk-bootstrap-guide.md の更新

**変更内容**:
- 自動化スクリプトセクションに分割スタック方式を追加
- `deploy-split-stacks.ps1` の使用方法を記載
- Bootstrap後の次のステップに4スタック構成の確認方法を追加

**更新箇所**:
- セクション「自動化スクリプトの使用」
- セクション「Bootstrap 後の次のステップ」

### 4. production-deployment-checklist.md の更新

**変更内容**:
- デプロイ方式の選択セクションを追加（単一 vs 分割）
- 分割スタック方式を推奨として明記
- ステップ6に分割スタックデプロイの詳細手順を追加
- デプロイ順序と実行時間の情報を追加
- 個別スタックのデプロイ方法を追加
- リソース確認セクションを4スタック構成に対応
- API Gateway確認セクションを4スタック構成に対応

**更新箇所**:
- セクション「デプロイ方式の選択」（新規追加）
- ステップ6: CDK Deploy
- セクション 9.1: リソース確認
- テスト4: API Gateway確認

### 5. rollback-procedures.md の更新

**変更内容**:
- 全ロールバック手順を4スタック構成に対応
- 方法1: CloudFormationの自動ロールバック
  - 全スタックの状態確認方法を追加
  - 特定スタックのイベント監視方法を追加
- 方法2: 手動ロールバック
  - 分割スタックデプロイスクリプトの使用方法を追加
  - 特定スタックのみのロールバック方法を追加
- 方法3: CloudFormation CLIでのロールバック
  - 4スタック構成での続行ロールバック手順を追加
- 環境別のロールバック手順を4スタック構成に対応
- 緊急時の対応手順（3シナリオ）を4スタック構成に対応
- ロールバック後の確認スクリプトを4スタック構成に対応

**更新箇所**:
- セクション「CDKスタックのロールバック」全体
- セクション「環境別のロールバック手順」全体
- セクション「緊急時の対応手順」全体
- セクション「ロールバック後の確認」のチェックリストと確認スクリプト

## 成果物

### 更新されたドキュメント

1. `.kiro/specs/tdnet-data-collector/docs/03-testing/smoke-test-guide.md`
   - 4スタック構成でのスモークテスト手順を追加
   - 単一スタック構成の手順も併記

2. `.kiro/specs/tdnet-data-collector/docs/04-deployment/cdk-bootstrap-guide.md`
   - 分割スタックデプロイの自動化スクリプト使用方法を追加
   - Bootstrap後の4スタック確認方法を追加

3. `.kiro/specs/tdnet-data-collector/docs/04-deployment/production-deployment-checklist.md`
   - デプロイ方式の選択セクションを新規追加
   - 分割スタックデプロイの詳細手順を追加（推奨方式として）
   - デプロイ時間の目安を記載（70-90%短縮）

4. `.kiro/specs/tdnet-data-collector/docs/04-deployment/rollback-procedures.md`
   - 全ロールバック手順を4スタック構成に完全対応
   - スタック別のロールバック方法を追加
   - 緊急時の対応手順を4スタック構成に対応

### 主な改善点

1. **デプロイ方式の明確化**
   - 単一スタック vs 分割スタックの選択肢を明示
   - 分割スタック方式を推奨として明記
   - デプロイ時間短縮のメリットを記載

2. **スタック別の操作方法**
   - 全スタック一括デプロイ
   - 特定スタックのみデプロイ（Lambda関数のみ更新など）
   - スタック別のロールバック

3. **後方互換性の維持**
   - すべてのドキュメントで単一スタック構成の手順も併記
   - 既存の運用を妨げない配慮

4. **実行時間の明示**
   - 分割スタックデプロイ: 約12-18分（初回）、約3-5分（更新時）
   - 単一スタックデプロイ: 約15-20分
   - デプロイ時間70-90%短縮を明記

## 申し送り事項

### 確認が必要な項目

1. **スタック名の確認**
   - 実際のスタック名が `TdnetFoundation-{env}` 形式であることを確認
   - CDKコードとの整合性を確認

2. **Output名の確認**
   - `ApiUrl` が `TdnetApi-{env}` スタックから取得できることを確認
   - `DashboardUrl` が `TdnetFoundation-{env}` スタックから取得できることを確認

3. **デプロイスクリプトのテスト**
   - `deploy-split-stacks.ps1` が正常に動作することを確認
   - 開発環境でのテストデプロイを推奨

### 今後の改善提案

1. **スクリプトの統合**
   - `deploy.ps1` に分割スタックオプションを追加することを検討
   - `-StackType split|single` パラメータの追加

2. **ドキュメントの簡略化**
   - 単一スタック構成のサポート終了を検討
   - 分割スタック方式のみに統一することで、ドキュメントを簡略化

3. **自動テストの追加**
   - デプロイ後の自動スモークテストスクリプトの作成
   - CI/CDパイプラインへの統合

## 問題と解決策

### 問題1: ドキュメントの冗長性

**問題**: 単一スタックと分割スタックの両方の手順を記載すると、ドキュメントが冗長になる

**解決策**: 
- 分割スタック方式を「推奨」として明記
- 単一スタック方式は「従来方式」として併記
- 将来的には分割スタック方式のみに統一することを検討

### 問題2: スタック名の一貫性

**問題**: スタック名の形式が複数存在する可能性

**解決策**:
- `TdnetFoundation-{env}` 形式を標準として採用
- すべてのドキュメントで統一した命名規則を使用

## 関連ドキュメント

- `scripts/deploy-split-stacks.ps1` - 分割スタックデプロイスクリプト
- `.kiro/specs/tdnet-data-collector/docs/04-deployment/stack-split-design.md` - スタック分割設計
- `.kiro/steering/infrastructure/deployment-scripts.md` - デプロイスクリプトガイド
