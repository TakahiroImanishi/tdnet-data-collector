# Steering Files Improvement Plan

## 完了済み（Phase 1: Core）

### ✅ README.md - 70%削減
- 冗長なDAG構造説明を削除
- fileMatchパターン対応表を簡略化
- トークン最適化の自明な説明を削除

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

### security/security-best-practices.md - 推定40%削減
### api/api-design-guidelines.md - 推定50%削減
### api/error-codes.md - 推定40%削減
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

## 期待効果

### トークン削減見込み
- **Phase 1（完了）**: 約2,610トークン削減
- **Phase 2（development/）**: 約6,326トークン削減（error-handling-implementation.md + error-handling-enforcement.md完了）
  - ✅ error-handling-implementation.md: 約3,432トークン削減
  - ✅ error-handling-enforcement.md: 約2,894トークン削減
  - 🔄 残り: testing-strategy.md, data-validation.md, lambda-implementation.md, tdnet-scraping-patterns.md
- **Phase 3（infrastructure/）**: 約1,411トークン削減（完了）
  - ✅ deployment-checklist.md: 約359トークン削減
  - ✅ performance-optimization.md: 約1,052トークン削減
- **Phase 4（その他）**: 約800トークン削減
- **合計**: 約11,147トークン削減（全体の約55%削減）

### 実用性の向上
- 必要な情報に素早くアクセス可能
- 実装時の認知負荷を軽減
- 参照関係が明確化

## 改善原則（再確認）

1. **冗長性の排除**: 「詳細: xxx.md」の繰り返しを削除
2. **具体性の向上**: 抽象的な原則 → 具体的なルール
3. **構造の最適化**: 長文説明 → チェックリスト・表形式
4. **実用性の重視**: 実装時に即座に使える情報のみ
5. **参照の明確化**: 詳細は別ファイルへの参照を明記
