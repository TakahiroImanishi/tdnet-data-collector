# Steering Files Improvement Plan

## 完了済み（Phase 1: Core）

### ✅ README.md - 86%削減（2026-02-14追加最適化）
- 冗長なDAG構造説明を削除
- fileMatchパターン対応表を簡略化（主要パターンのみ）
- 詳細なファイル間参照関係を削除
- トークン最適化の自明な説明を削除
- 930語 → 132語

### ✅ core/tdnet-implementation-rules.md - 50%削減
- 抽象的な原則を具体的なルールに変更
- 「詳細: xxx.md」の繰り返しを削除
- 実装原則を「必須実装ルール」に統合

### ✅ core/tdnet-data-collector.md - 60%削減
- 3ステップの冗長な説明を削除
- チェックリスト形式に簡略化
- 重複情報を削除

### ✅ core/error-handling-patterns.md - 40%削減
- コード例を最小限に
- ベストプラクティスセクションを削除（チェックリストと重複）
- DLQ・Alarmsをチェックリストに追加

## Phase 2: development/（優先度: 高）

### 1. testing-strategy.md - 推定70%削減
**現状**: 約3,500トークン  
**目標**: 約1,050トークン

**削減項目**:
- ❌ テストピラミッド図（テキストで十分）
- ❌ 詳細なコード例（基本パターンのみ）
- ❌ CI/CD設定例（deployment-checklist.mdに統合）
- ❌ テストデータ管理の詳細実装
- ❌ ベストプラクティスの冗長な説明

**残す内容**:
- ✅ テスト比率（70/20/10）
- ✅ 基本的なテストパターン（最小限のコード例）
- ✅ カバレッジ目標
- ✅ テスト実行コマンド

### 2. data-validation.md - 推定60%削減
**現状**: 約4,000トークン  
**目標**: 約1,600トークン

**削減項目**:
- ❌ 各フィールドの詳細なバリデーション実装
- ❌ date_partitionの長い説明（別ファイル参照）
- ❌ 複合バリデーションの詳細実装
- ❌ サニタイゼーションの詳細

**残す内容**:
- ✅ バリデーションルール（表形式）
- ✅ 代表的なコード例（1-2個）
- ✅ date_partition生成関数（簡略版）

### 3. lambda-implementation.md - 推定50%削減
**現状**: 約3,800トークン  
**目標**: 約1,900トークン

**削減項目**:
- ❌ 基本構造の詳細説明
- ❌ エラーハンドリングの詳細（他ファイル参照）
- ❌ パフォーマンス最適化の詳細（他ファイル参照）
- ❌ X-Rayの詳細実装

**残す内容**:
- ✅ メモリ・タイムアウト設定（表形式）
- ✅ 環境変数の検証パターン
- ✅ 基本的なエラーハンドリングパターン（参照付き）

### ✅ 4. error-handling-implementation.md - 50%削減完了
**削減前**: 約6,932トークン  
**削減後**: 約3,500トークン  
**削減率**: 約50%

**削減内容**:
- ✅ 再試行実装を基本パターンのみに簡略化
- ✅ AWS SDK設定を表形式に集約
- ✅ サーキットブレーカーを基本実装のみに簡略化
- ✅ エラー集約の詳細実装を削除（ErrorAggregatorクラス全体を削除）
- ✅ 冗長なコード例を削除
- ✅ ベストプラクティスを4項目に集約

**完了日**: 2026-02-09

### 5. tdnet-scraping-patterns.md - 推定60%削減
**現状**: 約4,500トークン  
**目標**: 約1,800トークン

**削減項目**:
- ❌ HTML構造の詳細説明
- ❌ AdaptiveRateLimiterの完全実装（基本版のみ）
- ❌ グローバルレート制限の詳細
- ❌ CloudWatchメトリクスの詳細

**残す内容**:
- ✅ TDnet URL構造
- ✅ 基本的なスクレイピングパターン
- ✅ 基本的なレート制限実装
- ✅ PDF検証パターン

### ✅ 6. error-handling-enforcement.md - 60%削減完了
**削減前**: 約4,794トークン  
**削減後**: 約1,900トークン  
**削減率**: 約60%

**削減内容**:
- ✅ MonitoredLambda Constructの完全実装を削除（200行以上のコードを削除）
- ✅ DLQプロセッサーの詳細実装を削除
- ✅ テスト例を基本パターンのみに簡略化（5個のテストケースのみ残す）
- ✅ 冗長な説明文を削除

**完了日**: 2026-02-09

### 7-10. その他development/ファイル
- **tdnet-file-naming.md**: 現状維持（既に簡潔）
- **workflow-guidelines.md**: 現状維持（既に簡潔）
- **documentation-standards.md**: 現状維持（既に簡潔）
- **mcp-server-guidelines.md**: 現状維持（既に簡潔）

## Phase 3: infrastructure/（優先度: 中）

### ✅ 1. deployment-checklist.md - 50%削減完了
**削減前**: 約719トークン  
**削減後**: 約360トークン  
**削減率**: 約50%

**削減内容**:
- ✅ 詳細なコマンド例を削除（bash/PowerShellコマンド）
- ✅ トラブルシューティングの詳細を削除
- ✅ デプロイ記録テンプレートを削除
- ✅ 冗長な説明文を削除
- ✅ チェックリスト形式に簡略化

**完了日**: 2026-02-09

### ✅ 2. performance-optimization.md - 60%削減完了
**削減前**: 約1,754トークン  
**削減後**: 約702トークン  
**削減率**: 約60%

**削減内容**:
- ✅ Lambda最適化の詳細説明を削除
- ✅ コールドスタート対策の詳細実装を削除（3つの長いコード例を簡略化）
- ✅ DynamoDB最適化の詳細説明とコード例を削除
- ✅ バッチ操作の詳細実装を削除
- ✅ S3ライフサイクル管理の詳細実装を削除
- ✅ 冗長な説明文を削除

**完了日**: 2026-02-09

### 3-4. その他infrastructure/ファイル
- **environment-variables.md**: 現状維持（既に簡潔）
- **monitoring-alerts.md**: 現状維持（既に簡潔）

## Phase 4: その他（優先度: 低）

### ✅ security/security-best-practices.md - 40%削減完了
**削減前**: 約2,054トークン  
**削減後**: 約1,232トークン  
**削減率**: 約40%

**削減内容**:
- ✅ セキュリティ原則を5項目→3項目に集約
- ✅ IAM CDK実装例を削除（禁止事項のみ残す）
- ✅ 暗号化CDK実装例を削除（表のみ維持）
- ✅ 機密情報管理の詳細実装を削除
- ✅ WAF設定の完全実装を削除（100行以上のコード→基本設定のみ）
- ✅ CloudTrail詳細実装を削除
- ✅ 脆弱性管理を簡略化
- ✅ インシデント対応フローを簡略化

**完了日**: 2026-02-09

### ✅ api/api-design-guidelines.md - 50%削減完了
**削減前**: 約1,084トークン  
**削減後**: 約542トークン  
**削減率**: 約50%

**削減内容**:
- ✅ クエリパラメータの使用例を削除
- ✅ レート制限のレスポンスヘッダー詳細を削除
- ✅ バージョニングの詳細説明を削除
- ✅ 冗長な説明文を削除

**完了日**: 2026-02-09

### ✅ api/error-codes.md - 40%削減完了
**削減前**: 約2,138トークン  
**削減後**: 約1,283トークン  
**削減率**: 約40%

**削減内容**:
- ✅ 9個のエラークラス詳細実装を削除
- ✅ 各エラークラスの使用例を削除
- ✅ Lambda関数での実装例を削除
- ✅ ベストプラクティスセクションを削除
- ✅ 基本構造のみ残す（2個の代表例）

**完了日**: 2026-02-09

### meta/pattern-matching-tests.md - 現状維持

## 実施推奨順序

1. **即座に実施**: development/testing-strategy.md（最も冗長）
2. **即座に実施**: development/data-validation.md（最も冗長）
3. **即座に実施**: development/tdnet-scraping-patterns.md（最も冗長）
4. **次に実施**: development/error-handling-implementation.md
5. **次に実施**: development/lambda-implementation.md
6. **次に実施**: development/error-handling-enforcement.md
7. **その後**: infrastructure/配下
8. **最後**: security/, api/配下

## 最終結果（2026-02-18第6回最適化完了）

### トークン削減実績
- **Phase 1（完了）**: 約3,400トークン削減
- **Phase 2（development/）**: 約14,600トークン削減
- **Phase 3（infrastructure/）**: 約3,161トークン削減
- **Phase 4（security/）**: 約2,719トークン削減
- **Phase 5（2026-02-15）**: 約3,430トークン削減
- **Phase 6（2026-02-18）**: 約1,200トークン削減
- **合計**: 約28,510トークン削減（全体の約82%削減）

**全Phase完了！（2026-02-18第6回最適化完了）**

### 現在のファイルサイズ（語数）
| ファイル | 語数 | 状態 |
|---------|------|------|
| development/data-scripts.md | 77 | ✅ 最適 |
| infrastructure/monitoring-scripts.md | 71 | ✅ 最適 |
| development/setup-scripts.md | 116 | ✅ 最適 |
| development/lambda-utils-implementation.md | 123 | ✅ 最適 |
| development/testing-strategy.md | 129 | ✅ 最適 |
| core/error-handling-patterns.md | 130 | ✅ 最適 |
| infrastructure/cdk-implementation.md | 140 | ✅ 最適 |
| core/tdnet-data-collector.md | 141 | ✅ 最適 |
| infrastructure/deployment-scripts.md | 154 | ✅ 最適 |
| infrastructure/scripts-implementation.md | 166 | ✅ 最適 |
| development/data-validation.md | 180 | ✅ 最適 |
| development/error-handling-enforcement.md | 194 | ✅ 最適 |
| infrastructure/monitoring-alerts.md | 203 | ✅ 最適 |
| infrastructure/performance-optimization.md | 210 | ✅ 最適 |
| development/tdnet-file-naming.md | 209 | ✅ 最適 |
| development/error-handling-implementation.md | 215 | ✅ 最適 |
| infrastructure/environment-variables.md | 222 | ✅ 最適 |
| api/api-design-guidelines.md | 227 | ✅ 最適 |
| api/error-codes.md | 230 | ✅ 最適 |
| development/powershell-encoding-guidelines.md | 231 | ✅ 最適 |
| security/security-best-practices.md | 267 | ✅ 最適 |
| development/workflow-guidelines.md | 267 | ✅ 最適 |
| development/lambda-implementation.md | 269 | ✅ 最適 |
| core/tdnet-implementation-rules.md | 276 | ✅ 最適 |
| development/mcp-server-guidelines.md | 276 | ✅ 最適 |
| development/documentation-standards.md | 287 | ✅ 最適 |
| development/mcp-documentation-guidelines.md | 297 | ✅ 最適 |
| development/tdnet-scraping-patterns.md | 297 | ✅ 最適 |
| infrastructure/deployment-checklist.md | 298 | ✅ 最適 |
| meta/pattern-matching-tests.md | 1,353 | ✅ 維持（テストケース網羅性のため）|

### 実用性の向上
- 必要な情報に素早くアクセス可能
- 実装時の認知負荷を軽減
- 参照関係が明確化
- コアファイル（core/）は平均149語で超軽量
- 条件付き読み込みファイルも大幅に削減（平均230語以下）
- 30ファイル中29ファイルが298語以下に最適化完了
- 全ファイルが実用的かつ簡潔な状態を維持

## 最適化完了報告（第6回最適化 - 2026-02-18）

### 達成事項
1. ✅ 全30ファイル中29ファイルを最適化（約82%削減）
2. ✅ コアファイル（常時読み込み）を平均149語に削減
3. ✅ 条件付き読み込みファイルを平均230語以下に削減
4. ✅ 参照関係を明確化（DAG構造維持）
5. ✅ チェックリスト・表形式への変換完了
6. ✅ 第6回最適化で追加1,200トークン削減達成

### 第6回最適化の詳細（2026-02-18上位ファイル最適化）

上位5ファイルをさらに最適化：

1. **environment-variables.md**: 398語 → 222語（約44%削減）
   - 環境別設定例を削除
   - CDK設定例を削除
   - SSM Parameter Store詳細コマンドを削除
   - トラブルシューティングセクションを削除
   - セキュリティベストプラクティスを簡略化

2. **monitoring-alerts.md**: 355語 → 203語（約43%削減）
   - CDKアラーム設定の詳細実装を削除
   - CloudWatch Logs Insightsクエリを削除
   - 定期レビュー詳細を削除
   - カスタムメトリクス送信を簡略化

3. **error-handling-implementation.md**: 346語 → 215語（約38%削減）
   - ファイルパス指定を削除
   - jitter実装を削除
   - DLQ設定を削除（enforcement.mdに統合）
   - ベストプラクティスコード例を削除
   - 実装済みユーティリティ表を削除

4. **error-handling-enforcement.md**: 316語 → 194語（約39%削減）
   - 役割分担セクションを削除
   - DLQプロセッサー実装を削除
   - MonitoredLambda機能詳細を削除
   - テスト実装例を簡略化

5. **error-codes.md**: 309語 → 230語（約26%削減）
   - エラーコード変換表を削除
   - カスタムエラークラスのプロパティを簡略化
   - ERROR_CODE_MAPのコメントを削除

### 現状維持ファイル（1ファイル）
以下のファイルは実用性を考慮し、現状維持としました：
- pattern-matching-tests.md（1,353語）- テストケースの網羅性が必要

### 今後の方針
- 定期的なレビュー（3ヶ月ごと）
- 新規ファイル追加時は簡潔性を優先（目標: 250語以下）
- 実装時のフィードバックを反映
- 全ファイルが実用的かつ簡潔な状態を維持
- スクリプト関連ファイルは特に簡潔性を重視（目標: 150語以下）
- 最大ファイルサイズ目標: 300語以下（pattern-matching-tests.md除く）

## 改善原則（再確認）

1. **冗長性の排除**: 「詳細: xxx.md」の繰り返しを削除
2. **具体性の向上**: 抽象的な原則 → 具体的なルール
3. **構造の最適化**: 長文説明 → チェックリスト・表形式
4. **実用性の重視**: 実装時に即座に使える情報のみ
5. **参照の明確化**: 詳細は別ファイルへの参照を明記
