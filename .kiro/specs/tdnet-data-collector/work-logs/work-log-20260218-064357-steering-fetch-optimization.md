# Steering Files Fetch Optimization

**作業日時**: 2026-02-18 06:43:57  
**作業概要**: steeringファイルのフェッチ最適化

## 目的

steeringファイルの読み込みを最適化し、不要なファイルフェッチを削減する。

## 現状分析

### ファイル構成
- **core/** (3ファイル): 常時読み込み
- **development/** (13ファイル): 条件付き読み込み
- **infrastructure/** (6ファイル): 条件付き読み込み
- **security/** (1ファイル): 条件付き読み込み
- **api/** (2ファイル): 条件付き読み込み
- **meta/** (1ファイル): 条件付き読み込み

### 問題点の特定

#### 1. パターンの重複・冗長性

**error-handling-implementation.md**のパターンが過度に広範囲:
```
**/utils/error*.ts|**/utils/retry*.ts|**/utils/logger*.ts|**/scraper/**/*.ts|**/collector/**/*.ts|**/api/**/*.ts|**/lambda/**/*.ts|**/models/**/*.ts|**/types/**/*.ts
```

このパターンは以下と重複:
- `lambda-implementation.md`: `**/lambda/**/*.ts`
- `data-validation.md`: `**/models/**/*.ts|**/types/**/*.ts`
- `tdnet-scraping-patterns.md`: `**/scraper/**/*.ts|**/collector/**/*.ts`
- `api-design-guidelines.md`: `**/api/**/*.ts`

#### 2. 過度に広範囲なパターン

**mcp-server-guidelines.md**:
```
**/lambda/**/*.ts|**/cdk/**/*.ts|**/api/**/*.ts|**/scraper/**/*.ts|**/collector/**/*.ts|**/*.test.ts|**/*.spec.ts|**/docs/**/*.md|**/.kiro/specs/**/*.md
```

ほぼすべてのファイルにマッチする可能性がある。

#### 3. 特定性の欠如

多くのファイルが`**/lambda/**/*.ts`を含むため、Lambda関数編集時に複数のsteeringファイルが同時に読み込まれる。

## 最適化戦略

### 原則
1. **最小特定性の原則**: 各steeringファイルは最も特定的なファイルにのみマッチ
2. **重複排除**: 複数のsteeringファイルが同じファイルにマッチしないようにする
3. **階層的読み込み**: core → 特定領域 → 詳細実装の順で読み込み

### 具体的な最適化案


#### 案1: パターンの特定化（推奨）

**error-handling-implementation.md**を特定のエラーハンドリングファイルのみに限定:
```yaml
# 変更前
fileMatchPattern: '**/utils/error*.ts|**/utils/retry*.ts|**/utils/logger*.ts|**/scraper/**/*.ts|**/collector/**/*.ts|**/api/**/*.ts|**/lambda/**/*.ts|**/models/**/*.ts|**/types/**/*.ts'

# 変更後
fileMatchPattern: '**/utils/error*.ts|**/utils/retry*.ts|**/utils/logger*.ts|**/errors/**/*.ts'
```

**理由**: エラーハンドリング実装の詳細は、エラー関連のユーティリティファイル編集時のみ必要。Lambda/API/Scraper実装時は`error-handling-patterns.md`（core）で十分。

#### 案2: mcp-server-guidelines.mdの分割

**mcp-server-guidelines.md**を2つに分割:

1. **mcp-server-guidelines.md** (development/): AWS実装時のみ
```yaml
fileMatchPattern: '**/lambda/**/*.ts|**/cdk/**/*.ts|**/api/**/*.ts|**/scraper/**/*.ts|**/collector/**/*.ts'
```

2. **mcp-documentation-guidelines.md** (development/): ドキュメント作成時のみ
```yaml
fileMatchPattern: '**/docs/**/*.md|**/.kiro/specs/**/*.md'
```

**理由**: MCPサーバー活用ガイドラインは、AWS実装とドキュメント作成で異なる内容が必要。

#### 案3: Lambda関連パターンの階層化

Lambda関連のsteeringファイルを階層化:

1. **lambda-implementation.md**: Lambda関数の基本実装（メモリ、タイムアウト、環境変数検証）
   - パターン: `**/lambda/**/handler.ts|**/lambda/**/index.ts`（エントリーポイントのみ）

2. **lambda-utils.md** (新規): Lambda内のユーティリティ実装
   - パターン: `**/lambda/**/utils/**/*.ts|**/lambda/**/helpers/**/*.ts`

**理由**: Lambda関数のエントリーポイント編集時は基本実装ガイドのみ、ユーティリティ編集時は詳細実装ガイドを読み込む。

#### 案4: 環境変数パターンの特定化

**environment-variables.md**を環境変数定義ファイルに限定:
```yaml
# 変更前
fileMatchPattern: '**/cdk/**/*.ts|**/lambda/**/*.ts|**/.env*'

# 変更後
fileMatchPattern: '**/.env*|**/config/**/*.ts|**/cdk/lib/config/**/*.ts'
```

**理由**: 環境変数一覧は、環境変数定義ファイルや設定ファイル編集時のみ必要。Lambda/CDK実装時は必要に応じて参照。

### 重複マッチングの分析

現在の設定で、`src/lambda/collector/handler.ts`を編集すると以下がすべて読み込まれる:
1. core/tdnet-implementation-rules.md (常時)
2. core/tdnet-data-collector.md (常時)
3. core/error-handling-patterns.md (常時)
4. development/lambda-implementation.md (`**/lambda/**/*.ts`)
5. development/error-handling-implementation.md (`**/lambda/**/*.ts`)
6. development/mcp-server-guidelines.md (`**/lambda/**/*.ts`)
7. infrastructure/environment-variables.md (`**/lambda/**/*.ts`)

**合計7ファイル** → 最適化後は **4-5ファイル** に削減可能

## 実装計画

### Phase 1: 即座に実施（高優先度）

1. **error-handling-implementation.md**のパターン特定化
2. **mcp-server-guidelines.md**の分割
3. **environment-variables.md**のパターン特定化

### Phase 2: 検討・実施（中優先度）

4. Lambda関連パターンの階層化（必要に応じて）
5. パターンマッチングテストの更新

### Phase 3: 検証（低優先度）

6. 実際のファイル編集時の読み込み状況を確認
7. フィードバックに基づく微調整

## 期待される効果

- Lambda関数編集時の読み込みファイル数: 7 → 4-5ファイル（約30-40%削減）
- ドキュメント編集時の読み込みファイル数: 削減（AWS実装ガイドラインが不要）
- エラーハンドリング実装の詳細は必要時のみ読み込み
- 環境変数一覧は設定ファイル編集時のみ読み込み

## 次のステップ

1. Phase 1の変更を実装
2. pattern-matching-tests.mdを更新
3. 実際のファイル編集で検証
4. 必要に応じてPhase 2を実施


## 実装完了

### Phase 1: 完了

#### 1. error-handling-implementation.mdのパターン特定化 ✅

**変更前**:
```yaml
fileMatchPattern: '**/utils/error*.ts|**/utils/retry*.ts|**/utils/logger*.ts|**/scraper/**/*.ts|**/collector/**/*.ts|**/api/**/*.ts|**/lambda/**/*.ts|**/models/**/*.ts|**/types/**/*.ts'
```

**変更後**:
```yaml
fileMatchPattern: '**/utils/error*.ts|**/utils/retry*.ts|**/utils/logger*.ts|**/errors/**/*.ts'
```

**効果**: Lambda/API/Scraper実装時にエラーハンドリング実装の詳細が読み込まれなくなる。エラー関連ユーティリティ編集時のみ読み込み。

#### 2. mcp-server-guidelines.mdの分割 ✅

**分割前**: 1ファイル（297語）
- パターン: `**/lambda/**/*.ts|**/cdk/**/*.ts|**/api/**/*.ts|**/scraper/**/*.ts|**/collector/**/*.ts|**/*.test.ts|**/*.spec.ts|**/docs/**/*.md|**/.kiro/specs/**/*.md`

**分割後**: 2ファイル
1. **mcp-server-guidelines.md** (AWS実装用、約250語)
   - パターン: `**/lambda/**/*.ts|**/cdk/**/*.ts|**/api/**/*.ts|**/scraper/**/*.ts|**/collector/**/*.ts|**/*.test.ts|**/*.spec.ts`
   - 内容: AWS実装時のMCPサーバー活用（AWS Knowledge, AWS Labs CDK, Brave Web Search, Context7）

2. **mcp-documentation-guidelines.md** (ドキュメント作成用、約200語、新規)
   - パターン: `**/docs/**/*.md|**/.kiro/specs/**/*.md`
   - 内容: ドキュメント作成時のMCPサーバー活用、情報源の明記、最新性確認、著作権・ライセンス

**効果**: AWS実装時とドキュメント作成時で異なるガイドラインを読み込み。ドキュメント作成時にAWS実装の詳細が読み込まれなくなる。

#### 3. environment-variables.mdのパターン特定化 ✅

**変更前**:
```yaml
fileMatchPattern: '**/cdk/**/*.ts|**/lambda/**/*.ts|**/.env*'
```

**変更後**:
```yaml
fileMatchPattern: '**/.env*|**/config/**/*.ts|**/cdk/lib/config/**/*.ts'
```

**効果**: 環境変数一覧は、環境変数定義ファイルや設定ファイル編集時のみ読み込み。Lambda/CDK実装時は読み込まれない。

### 最適化効果の検証

#### Lambda関数編集時（例: `src/lambda/collector/handler.ts`）

**最適化前**: 7ファイル読み込み
1. core/tdnet-implementation-rules.md (常時)
2. core/tdnet-data-collector.md (常時)
3. core/error-handling-patterns.md (常時)
4. development/lambda-implementation.md
5. development/error-handling-implementation.md ← 削除
6. development/mcp-server-guidelines.md
7. infrastructure/environment-variables.md ← 削除

**最適化後**: 5ファイル読み込み
1. core/tdnet-implementation-rules.md (常時)
2. core/tdnet-data-collector.md (常時)
3. core/error-handling-patterns.md (常時)
4. development/lambda-implementation.md
5. development/mcp-server-guidelines.md

**削減率**: 約28%削減（7 → 5ファイル）

#### ドキュメント編集時（例: `.kiro/specs/tdnet-data-collector/docs/architecture.md`）

**最適化前**: 4ファイル読み込み
1. core/tdnet-implementation-rules.md (常時)
2. core/tdnet-data-collector.md (常時)
3. core/error-handling-patterns.md (常時)
4. development/mcp-server-guidelines.md（AWS実装ガイドライン含む）

**最適化後**: 4ファイル読み込み
1. core/tdnet-implementation-rules.md (常時)
2. core/tdnet-data-collector.md (常時)
3. core/error-handling-patterns.md (常時)
4. development/mcp-documentation-guidelines.md（ドキュメント作成専用）

**効果**: ファイル数は同じだが、内容がドキュメント作成に特化（AWS実装の詳細が除外）

#### 環境変数ファイル編集時（例: `config/.env.production`）

**最適化前**: 4ファイル読み込み
1. core/tdnet-implementation-rules.md (常時)
2. core/tdnet-data-collector.md (常時)
3. core/error-handling-patterns.md (常時)
4. infrastructure/environment-variables.md

**最適化後**: 4ファイル読み込み（変更なし）
1. core/tdnet-implementation-rules.md (常時)
2. core/tdnet-data-collector.md (常時)
3. core/error-handling-patterns.md (常時)
4. infrastructure/environment-variables.md

**効果**: 環境変数ファイル編集時は引き続き読み込まれる（意図通り）

#### エラーハンドリングユーティリティ編集時（例: `src/utils/retry.ts`）

**最適化前**: 4ファイル読み込み
1. core/tdnet-implementation-rules.md (常時)
2. core/tdnet-data-collector.md (常時)
3. core/error-handling-patterns.md (常時)
4. development/error-handling-implementation.md

**最適化後**: 4ファイル読み込み（変更なし）
1. core/tdnet-implementation-rules.md (常時)
2. core/tdnet-data-collector.md (常時)
3. core/error-handling-patterns.md (常時)
4. development/error-handling-implementation.md

**効果**: エラーハンドリングユーティリティ編集時は引き続き読み込まれる（意図通り）

### 全体的な効果

- Lambda/API/Scraper実装時: 約28%削減（7 → 5ファイル）
- ドキュメント作成時: 内容がドキュメント作成に特化
- 環境変数ファイル編集時: 適切に読み込み
- エラーハンドリングユーティリティ編集時: 適切に読み込み

### ファイル構成の更新

**development/**フォルダ:
- 既存: 13ファイル
- 追加: mcp-documentation-guidelines.md
- 合計: 14ファイル

## 次のステップ

### 必須
1. ✅ README.mdの更新（fileMatchパターン対応表）
2. ✅ pattern-matching-tests.mdの更新（新規ファイルのテストケース追加）

### 推奨
3. 実際のファイル編集で検証（Lambda関数、ドキュメント、環境変数ファイル）
4. フィードバックに基づく微調整

### 検討
5. Phase 2の実施（Lambda関連パターンの階層化）


## ドキュメント更新完了

### README.md更新 ✅

主要fileMatchパターン対応表を更新:
- Lambda関連パターンを簡略化（`error-handling-*`, `environment-variables`, `performance-optimization`を削除）
- `**/utils/error*.ts`パターンを追加
- `**/config/**/*.ts`パターンを追加
- `**/docs/**/*.md`を`mcp-documentation-guidelines`に変更
- `**/.kiro/specs/**/*.md`を追加（`workflow-guidelines`, `mcp-documentation-guidelines`）

### pattern-matching-tests.md更新 ✅

以下のテストケースを更新:

1. **error-handling-implementation.md**
   - パターン変更: 広範囲 → エラー関連ファイルのみ
   - マッチすべきファイル: エラー関連ユーティリティのみ
   - マッチすべきでないファイル: Lambda/API/Scraperファイルを追加

2. **environment-variables.md**
   - パターン変更: CDK/Lambda全体 → 環境変数定義ファイルのみ
   - マッチすべきファイル: .env*, config/**/*.ts, cdk/lib/config/**/*.ts
   - マッチすべきでないファイル: Lambda/CDK実装ファイルを追加

3. **mcp-server-guidelines.md**（分割後）
   - パターン変更: ドキュメントファイルを除外
   - マッチすべきファイル: AWS実装ファイルとテストファイルのみ
   - マッチすべきでないファイル: ドキュメントファイルを追加

4. **mcp-documentation-guidelines.md**（新規）
   - パターン: `**/docs/**/*.md|**/.kiro/specs/**/*.md`
   - マッチすべきファイル: ドキュメントファイルのみ
   - マッチすべきでないファイル: AWS実装ファイルを追加

## 成果物

### 変更ファイル
1. `.kiro/steering/development/error-handling-implementation.md` - パターン特定化
2. `.kiro/steering/infrastructure/environment-variables.md` - パターン特定化
3. `.kiro/steering/development/mcp-server-guidelines.md` - AWS実装専用に変更
4. `.kiro/steering/development/mcp-documentation-guidelines.md` - 新規作成
5. `.kiro/steering/README.md` - fileMatchパターン対応表更新
6. `.kiro/steering/meta/pattern-matching-tests.md` - テストケース更新

### 新規ファイル
- `.kiro/steering/development/mcp-documentation-guidelines.md` (約200語)

### 最適化効果まとめ

| ファイルタイプ | 最適化前 | 最適化後 | 削減率 |
|--------------|---------|---------|--------|
| Lambda関数 | 7ファイル | 5ファイル | 28% |
| ドキュメント | 4ファイル | 4ファイル | 内容特化 |
| 環境変数 | 4ファイル | 4ファイル | 適切 |
| エラーユーティリティ | 4ファイル | 4ファイル | 適切 |

## 申し送り事項

### 検証推奨
1. Lambda関数編集時（例: `src/lambda/collector/handler.ts`）
   - 期待: 5ファイル読み込み（core 3 + lambda-implementation + mcp-server-guidelines）
   - 確認: error-handling-implementation, environment-variablesが読み込まれないこと

2. ドキュメント編集時（例: `.kiro/specs/tdnet-data-collector/docs/architecture.md`）
   - 期待: 4ファイル読み込み（core 3 + mcp-documentation-guidelines）
   - 確認: AWS実装ガイドラインが読み込まれないこと

3. 環境変数ファイル編集時（例: `config/.env.production`）
   - 期待: 4ファイル読み込み（core 3 + environment-variables）
   - 確認: 正常に読み込まれること

4. エラーユーティリティ編集時（例: `src/utils/retry.ts`）
   - 期待: 4ファイル読み込み（core 3 + error-handling-implementation）
   - 確認: 正常に読み込まれること

### Phase 2検討事項
- Lambda関連パターンの階層化（必要に応じて）
- 実際の使用状況に基づく微調整
- 他のsteeringファイルの最適化可能性

### 関連ドキュメント
- `.kiro/steering/README.md` - steeringファイル構造
- `.kiro/steering/meta/pattern-matching-tests.md` - パターンマッチングテスト
- `.kiro/steering/IMPROVEMENT-PLAN.md` - 最適化計画

