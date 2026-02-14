# 設計と実装の差分分析

**作業日時**: 2026-02-14 17:51:35  
**タスク**: 設計書と実装の網羅的差分チェック  
**目的**: 未実装機能・不整合の特定と追加タスクの提案

---

## 分析結果サマリー

### 実装状況
- **Phase 1（基本機能）**: ✅ 100%完了
- **Phase 2（API実装）**: ✅ 100%完了
- **Phase 3（Webダッシュボード・監視）**: ✅ 100%完了
- **Phase 4（運用改善）**: ✅ 100%完了
- **Phase 5（EventBridge・SNS）**: ⚠️ 未着手（本番運用後実施予定）

### 発見された主要な差分

#### 1. 🔴 Critical: Lambda関数リスト不一致
**設計書**: 3個のLambda関数（Collector, Query, Export）  
**実装**: 7個のLambda関数
- Lambda Collector
- Lambda Query
- Lambda Export
- Lambda Collect（収集トリガー）
- Lambda Collect Status（収集状態取得）
- Lambda Export Status（エクスポート状態取得）
- Lambda PDF Download（PDF署名付きURL生成）

**影響**: 設計書が実装の実態を反映していない  
**対応**: タスク31.2.4で設計書を更新

#### 2. 🔴 Critical: API認証方式の変更未反映
**設計書**: API Gateway + Lambda二重認証（Secrets Manager使用）  
**実装**: API Gateway認証のみ（2026-02-14に変更）

**変更理由**:
- API GatewayとLambda関数で異なるAPIキーを使用していた（設計ミス）
- 二重認証は冗長であり、API Gateway認証のみで十分
- Secrets Managerの使用を削減してコスト最適化（$0.41/月削減）

**影響**: 設計書が現在の認証方式を反映していない  
**対応**: タスク31.1.3.1で設計書を更新済み

#### 3. 🟠 High: 未実装エンドポイント
**設計書**: GET /health, GET /stats エンドポイントが記載  
**実装**: Lambda関数は実装済みだが、API Gatewayに未統合

**影響**: スモークテストで404 Not Foundエラー  
**対応**: タスク31.2.1で追加が必要

#### 4. 🟡 Medium: date_partition形式の不一致
**設計書**: YYYY-MM-DD形式  
**実装**: YYYY-MM形式（月単位パーティション）

**理由**: 月単位パーティションの方がクエリ効率が高い  
**影響**: 設計書が実装の実態を反映していない  
**対応**: タスク31.2.4で設計書を更新

#### 5. 🟡 Medium: DynamoDB GSI名の不一致
**設計書**: GSI_DateRange  
**実装**: GSI_DatePartition

**影響**: 設計書が実装の実態を反映していない  
**対応**: タスク31.2.4で設計書を更新

#### 6. 🟢 Low: CloudFormation Outputs未記載
**設計書**: CloudFormation Outputsの詳細が記載されていない  
**実装**: API Endpoint, API Key ID, Dashboard URLなどを出力

**影響**: デプロイ後の情報取得方法が不明確  
**対応**: タスク31.2.4で設計書を更新

---

## 追加タスクの提案

### タスク31.2.4: 設計書の包括的更新（High）

**目的**: 設計書を実装の実態に合わせて更新

**更新項目**:
1. Lambda関数リストを7個に更新
2. API認証方式を「API Gateway認証のみ」に変更
3. date_partition形式を`YYYY-MM`に統一
4. DynamoDB GSI名を`GSI_DatePartition`に修正
5. CloudFormation Outputsの詳細を追加
6. API Keyのセキュリティベストプラクティスを明記

**対象ファイル**:
- `.kiro/specs/tdnet-data-collector/docs/design.md`
- `docs/architecture.md`（存在する場合）
- `README.md`（API認証の説明）

**推定工数**: 2-3時間  
**優先度**: 🟠 High  
**前提条件**: タスク31.1.3.1完了

---

## 実装済み機能の確認

### ✅ 完全実装済み

1. **データ収集機能**
   - TDnetスクレイピング
   - メタデータ抽出
   - PDFダウンロード
   - DynamoDB保存
   - S3保存
   - レート制限（1req/秒）
   - エラーハンドリング（指数バックオフ再試行）

2. **API機能**
   - POST /collect（オンデマンド収集）
   - GET /collect/{execution_id}（収集状態取得）
   - GET /disclosures（開示情報クエリ）
   - POST /exports（エクスポート）
   - GET /exports/{export_id}（エクスポート状態取得）
   - GET /disclosures/{disclosure_id}/pdf（PDF署名付きURL）
   - API Gateway認証（APIキー）

3. **Webダッシュボード**
   - React + TypeScript
   - Material-UI
   - 開示情報一覧表示
   - 検索・フィルタリング
   - PDFダウンロード
   - エクスポート機能
   - 実行状態表示
   - レスポンシブデザイン
   - S3 + CloudFront ホスティング

4. **監視・アラート**
   - CloudWatch Logs（保持期間: 本番3ヶ月、開発1週間）
   - カスタムメトリクス（3個: DisclosuresCollected, DisclosuresFailed, CollectionSuccessRate）
   - CloudWatch Alarms（6種類）
   - SNS通知
   - CloudWatch Dashboard

5. **セキュリティ**
   - IAMロール最小権限化
   - S3バケットパブリックアクセスブロック
   - DynamoDB暗号化（AWS管理キー）
   - S3暗号化（SSE-S3）
   - CloudTrail監査ログ（7年間保存）
   - WAF保護（レート制限: 2000リクエスト/5分）
   - Secrets Manager（APIキー管理、90日自動ローテーション）

6. **CI/CD**
   - GitHub Actions（test.yml, deploy.yml, dependency-update.yml, e2e-test.yml）
   - 自動テスト実行
   - 自動デプロイ
   - 週次依存関係更新

7. **テスト**
   - ユニットテスト: 1145テスト成功（カバレッジ85.72%）
   - プロパティベーステスト: 100回以上反復
   - 統合テスト: LocalStack環境
   - E2Eテスト: 28テストケース（100%成功）

### ⚠️ 未実装（Phase 5）

1. **EventBridgeスケジューリング**
   - 日次スケジュール設定（毎日9:00 JST実行）
   - Lambda Collectorをターゲットに設定
   - バッチモードでの実行設定

2. **SNS通知設定**
   - tdnet-alerts トピック作成
   - Emailサブスクリプション設定
   - Lambda関数からの通知送信権限付与
   - エラー発生時のSNS通知送信
   - バッチ完了時のサマリー通知送信

**注意**: Phase 5は本番運用後に実施予定（タスク32-34）

---

## 結論

### 実装状況
- **Phase 1-4**: 完全実装済み（100%）
- **Phase 5**: 未着手（本番運用後実施予定）

### 設計書の更新が必要な項目
1. Lambda関数リスト（3個 → 7個）
2. API認証方式（二重認証 → API Gateway認証のみ）
3. date_partition形式（YYYY-MM-DD → YYYY-MM）
4. DynamoDB GSI名（GSI_DateRange → GSI_DatePartition）
5. CloudFormation Outputs詳細

### 追加タスク
- **タスク31.2.1**: 未実装エンドポイントのAPI Gateway統合（Critical）
- **タスク31.2.4**: 設計書の包括的更新（High）

### 本番デプロイ準備状況
- **Phase 1-4**: ✅ 完了
- **設計書更新**: ⚠️ タスク31.2.4で対応
- **未実装エンドポイント**: ⚠️ タスク31.2.1で対応
- **Phase 5**: 本番運用後実施予定

---

**作業記録終了**: 2026-02-14 17:51:35
