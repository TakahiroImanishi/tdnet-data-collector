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

## 最終結果（2026-02-15検証・完了）

### トークン削減実績
- **Phase 1（完了）**: 約3,400トークン削減（README.md追加最適化含む）
- **Phase 2（development/）**: 約11,450トークン削減（完了）
  - ✅ error-handling-implementation.md: 約3,432トークン削減 → 665語（2026-02-14追加最適化）
  - ✅ error-handling-enforcement.md: 約2,894トークン削減 → 316語（2026-02-14追加最適化）
  - ✅ lambda-implementation.md: 約2,271トークン削減 → 269語（2026-02-14追加最適化）
  - ✅ tdnet-scraping-patterns.md: 約1,120トークン削減 → 297語（2026-02-14追加最適化）
  - ✅ testing-strategy.md: 約1,023トークン削減 → 129語（2026-02-14追加最適化）
  - ✅ data-validation.md: 約710トークン削減 → 180語（2026-02-14追加最適化）
  - ✅ mcp-server-guidelines.md: 約2,265トークン削減 → 282語（2026-02-14追加最適化）
  - ✅ documentation-standards.md: 約1,521トークン削減 → 287語（2026-02-14追加最適化）
  - ✅ workflow-guidelines.md: 約825トークン削減 → 267語（2026-02-14追加最適化）
  - ✅ data-scripts.md: 約1,200トークン削減 → 180語（2026-02-15追加最適化）
  - ✅ setup-scripts.md: 約950トークン削減 → 165語（2026-02-15追加最適化）
- **Phase 3（infrastructure/）**: 約1,411トークン削減（完了）
  - ✅ deployment-checklist.md: 約359トークン削減 → 298語（既に最適化済み）
  - ✅ performance-optimization.md: 約1,052トークン削減 → 446語（既に最適化済み）
  - ✅ environment-variables.md: 約1,101トークン削減 → 398語（2026-02-14追加最適化）
  - ✅ deployment-scripts.md: 約1,450トークン削減 → 240語（2026-02-15追加最適化）
  - ✅ monitoring-scripts.md: 約850トークン削減 → 145語（2026-02-15追加最適化）
- **Phase 4（その他）**: 約2,219トークン削減（完了）
  - ✅ security-best-practices.md: 約822トークン削減 → 462語（既に最適化済み）
  - ✅ api-design-guidelines.md: 約542トークン削減 → 227語（既に最適化済み）
  - ✅ api/error-codes.md: 約855トークン削減 → 309語（既に最適化済み）
- **合計**: 約30,450トークン削減（全体の約75%削減）

**全Phase完了！（2026-02-15第4回最適化完了）**

### 現在のファイルサイズ（語数）
| ファイル | 語数 | 状態 |
|---------|------|------|
| core/error-handling-patterns.md | 129 | ✅ 最適 |
| development/testing-strategy.md | 129 | ✅ 最適 |
| README.md | 132 | ✅ 最適 |
| core/tdnet-data-collector.md | 141 | ✅ 最適 |
| infrastructure/monitoring-scripts.md | 145 | ✅ 最適 |
| development/setup-scripts.md | 165 | ✅ 最適 |
| core/tdnet-implementation-rules.md | 171 | ✅ 最適 |
| development/data-validation.md | 180 | ✅ 最適 |
| development/data-scripts.md | 180 | ✅ 最適 |
| development/tdnet-file-naming.md | 209 | ✅ 最適 |
| api/api-design-guidelines.md | 227 | ✅ 最適 |
| infrastructure/deployment-scripts.md | 240 | ✅ 最適 |
| development/workflow-guidelines.md | 267 | ✅ 最適 |
| development/lambda-implementation.md | 269 | ✅ 最適 |
| development/mcp-server-guidelines.md | 282 | ✅ 最適 |
| development/documentation-standards.md | 287 | ✅ 最適 |
| development/tdnet-scraping-patterns.md | 297 | ✅ 最適 |
| infrastructure/deployment-checklist.md | 298 | ✅ 最適 |
| api/error-codes.md | 309 | ✅ 最適 |
| development/error-handling-enforcement.md | 316 | ✅ 最適 |
| infrastructure/monitoring-alerts.md | 355 | ✅ 最適 |
| infrastructure/environment-variables.md | 398 | ✅ 最適 |
| infrastructure/performance-optimization.md | 446 | ✅ 最適 |
| security/security-best-practices.md | 462 | ✅ 最適 |
| development/error-handling-implementation.md | 665 | ✅ 最適 |
| meta/pattern-matching-tests.md | 1,322 | ✅ 維持（テストケース網羅性のため）|

### 実用性の向上
- 必要な情報に素早くアクセス可能
- 実装時の認知負荷を軽減
- 参照関係が明確化
- コアファイル（core/）は平均147語で超軽量
- 条件付き読み込みファイルも大幅に削減（平均280語以下）
- 25ファイル中24ファイルが665語以下に最適化完了
- スクリプト関連ファイルも平均183語に削減

## 最適化完了報告（第4回最適化 - 2026-02-15）

### 達成事項
1. ✅ 全25ファイル中24ファイルを最適化（約75%削減）
2. ✅ コアファイル（常時読み込み）を平均147語に削減
3. ✅ 条件付き読み込みファイルを平均280語以下に削減
4. ✅ 参照関係を明確化（DAG構造維持）
5. ✅ チェックリスト・表形式への変換完了
6. ✅ 第4回最適化で追加4,450トークン削減達成

### 第4回最適化の詳細（2026-02-15）

スクリプト関連の4ファイルを最適化：

1. **deployment-scripts.md**: 約690語 → 240語（約65%削減）
   - 詳細なパラメータ説明を削除
   - 実行内容の冗長な説明を削除
   - 使用例を簡潔化
   - 関連ドキュメントセクションを削除

2. **setup-scripts.md**: 約515語 → 165語（約68%削減）
   - 詳細なパラメータ説明を削除
   - 実行内容の冗長な説明を削除
   - 使用例を簡潔化
   - トラブルシューティングを表形式に集約

3. **data-scripts.md**: 約600語 → 180語（約70%削減）
   - 詳細なパラメータ説明を削除
   - 処理フローの冗長な説明を削除
   - 使用例を簡潔化
   - 注意事項をチェックリスト形式に集約

4. **monitoring-scripts.md**: 約495語 → 145語（約71%削減）
   - 詳細なパラメータ表を削除
   - 実行フローの冗長な説明を削除
   - 使用例を簡潔化
   - 出力例を削除

### 第3回最適化の詳細（2026-02-14）

以下のファイルをさらに最適化：

1. **error-handling-implementation.md**: 1,293語 → 665語（約49%削減）
2. **mcp-server-guidelines.md**: 1,037語 → 282語（約73%削減）
3. **documentation-standards.md**: 794語 → 287語（約64%削減）
4. **environment-variables.md**: 765語 → 398語（約48%削減）
5. **error-handling-enforcement.md**: 635語 → 316語（約50%削減）
6. **workflow-guidelines.md**: 542語 → 267語（約51%削減）

### 現状維持ファイル（1ファイル）
以下のファイルは実用性を考慮し、現状維持としました：
- pattern-matching-tests.md（1,322語）- テストケースの網羅性が必要

### 今後の方針
- 定期的なレビュー（3ヶ月ごと）
- 新規ファイル追加時は簡潔性を優先（目標: 300語以下）
- 実装時のフィードバックを反映
- 全ファイルが実用的かつ簡潔な状態を維持
- スクリプト関連ファイルは特に簡潔性を重視（目標: 200語以下）

## 改善原則（再確認）

1. **冗長性の排除**: 「詳細: xxx.md」の繰り返しを削除
2. **具体性の向上**: 抽象的な原則 → 具体的なルール
3. **構造の最適化**: 長文説明 → チェックリスト・表形式
4. **実用性の重視**: 実装時に即座に使える情報のみ
5. **参照の明確化**: 詳細は別ファイルへの参照を明記
